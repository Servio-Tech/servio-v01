#!/usr/bin/env bash
# Disposable PostgreSQL only. This does not connect to Supabase or production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(pg_config --bindir)"
for name in ${!PG@}; do unset "$name"; done
[[ $($BIN/initdb --version) == *' 16.'* ]] || { echo 'PostgreSQL 16 is required' >&2; exit 1; }
TMP="$(mktemp -d /tmp/servio-realtime-blocks.XXXXXX)"
mkdir -p "$TMP/socket"
cleanup() {
  "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/log" -o "-F -c listen_addresses='' -k $TMP/socket" start >/dev/null
P=("$BIN/psql" -X -q -h "$TMP/socket" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${P[@]}" -f "$ROOT/supabase/tests/owner_user_blocks_realtime_fixture.sql" >/dev/null

# Use the exact helper body from the preceding block migration, not a test-only
# reimplementation, and reproduce its authenticated EXECUTE grant.
python3 - "$ROOT" "$TMP/actual-helper.sql" <<'PY'
import pathlib, re, sys
root = pathlib.Path(sys.argv[1])
source = root / 'supabase/migrations/20261122020000_owner_user_blocks.sql'
text = source.read_text()
pattern = r'(?is)create\s+function\s+public\.platform_current_user_allowed\s*\(\).*?\bas\s*(\$[a-z_]*\$).*?\1\s*;'
found = list(re.finditer(pattern, text))
if len(found) != 1:
    raise SystemExit(f'Expected exactly one platform_current_user_allowed() definition, got {len(found)}')
body = found[0].group(0)
pathlib.Path(sys.argv[2]).write_text(body + '\nREVOKE ALL ON FUNCTION public.platform_current_user_allowed() FROM PUBLIC, anon;\nGRANT EXECUTE ON FUNCTION public.platform_current_user_allowed() TO authenticated, service_role;\n')
PY
"${P[@]}" -f "$TMP/actual-helper.sql" >/dev/null

active='10000000-0000-0000-0000-000000000001'
blocked='10000000-0000-0000-0000-000000000002'
visible_for() {
  local user_id="$1" topic="$2"
  "${P[@]}" -Atc "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '$user_id', false); SELECT set_config('request.jwt.claims', '{\"sub\":\"$user_id\"}', false); SELECT count(*) FROM realtime.messages WHERE topic='$topic'; RESET ROLE;" | tail -1
}

# Restore/record existing behavior first: the permissive policy allows both
# sessions to see their respective topics before the new migration is applied.
[[ "$(visible_for "$active" 'tenant:active')" == 1 ]] || { echo 'Baseline failure: active user could not SELECT existing channel' >&2; exit 1; }
[[ "$(visible_for "$blocked" 'tenant:blocked')" == 1 ]] || { echo 'Baseline failure: blocked user did not exhibit pre-migration permissive access' >&2; exit 1; }
echo 'PASS: baseline existing permissive Realtime policy allows both users'

# Capture grants and the old policy so the test also detects accidental ACL or
# policy replacement by the new migration.
before_acl=$("${P[@]}" -Atc "SELECT COALESCE(relacl::text,'<null>') FROM pg_catalog.pg_class WHERE oid='realtime.messages'::regclass")
"${P[@]}" -f "$ROOT/supabase/migrations/20261122100000_owner_user_blocks_realtime.sql" >/dev/null
after_acl=$("${P[@]}" -Atc "SELECT COALESCE(relacl::text,'<null>') FROM pg_catalog.pg_class WHERE oid='realtime.messages'::regclass")
[[ "$before_acl" == "$after_acl" ]] || { echo 'SECURITY FAILURE: migration changed realtime.messages ACLs' >&2; exit 1; }
"${P[@]}" -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='realtime.messages'::regclass AND polname='fixture_existing_channel_select' AND polpermissive) THEN RAISE EXCEPTION 'Existing permissive Realtime policy was replaced'; END IF; IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='realtime.messages'::regclass AND polname='platform_user_not_blocked_realtime' AND NOT polpermissive AND polcmd='r') THEN RAISE EXCEPTION 'Expected restrictive SELECT policy missing'; END IF; END \$\$" >/dev/null

[[ "$(visible_for "$active" 'tenant:active')" == 1 ]] || { echo 'SECURITY FAILURE: active user was denied Realtime SELECT' >&2; exit 1; }
[[ "$(visible_for "$blocked" 'tenant:blocked')" == 0 ]] || { echo 'SECURITY FAILURE: blocked user still sees Realtime channel messages' >&2; exit 1; }
echo 'PASS: restrictive Realtime policy hides blocked user rows while active access remains'
echo 'PASS: existing permissive policy and table ACL were preserved'

# The migration must fail closed rather than silently skip when Realtime is not
# present. Dropping the fixture table is safe because this is a disposable DB.
"${P[@]}" -c 'DROP TABLE realtime.messages' >/dev/null
if "${P[@]}" -f "$ROOT/supabase/migrations/20261122100000_owner_user_blocks_realtime.sql" >"$TMP/missing-table.out" 2>&1; then
  echo 'SECURITY FAILURE: migration accepted missing realtime.messages' >&2
  exit 1
fi
grep -Fq 'requires realtime.messages' "$TMP/missing-table.out" || { cat "$TMP/missing-table.out" >&2; exit 1; }
echo 'PASS: migration fails closed when realtime.messages is unavailable'
echo 'PASS: isolated PostgreSQL Realtime block-policy tests'
