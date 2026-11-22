#!/usr/bin/env bash
# Only creates a disposable local Unix-socket PostgreSQL cluster; never reads env URLs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/servio-subscription-tests.XXXXXX")"
SOCKET="$TMP/socket"
mkdir -p "$SOCKET"
cleanup() {
  "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
"$PG_BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$TMP/data" -l "$TMP/postgres.log" -o "-F -c listen_addresses='' -k $SOCKET" start >/dev/null
PSQL=("$PG_BIN/psql" -X -q -h "$SOCKET" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscriptions_fixture.sql" >"$TMP/fixture.log"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261121130000_tenant_subscriptions_and_branch_limits.sql" >"$TMP/migration.log"
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscriptions_checks.sql" >"$TMP/checks.log"
echo 'PASS: functional, authorization, metadata and menu-resolution checks'

# Four distinct tenants. Both READ COMMITTED and REPEATABLE READ are checked.
for i in 6 7 8 9; do
  tenant="00000000-0000-0000-0000-00000000000$i"
  "${PSQL[@]}" -c "INSERT INTO public.tenants(id,name,slug) VALUES ('$tenant','Concurrency $i','concurrency-$i'); SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false); SELECT public.owner_set_subscription('$tenant','pro',now(),null);" >/dev/null
  if (( i < 8 )); then
    "${PSQL[@]}" -c "INSERT INTO public.branches(tenant_id,name,slug) VALUES ('$tenant','Second','second');" >/dev/null
  fi
done

race() {
  local i="$1" isolation="$2" kind="$3" tenant marker a_pid b_status count
  tenant="00000000-0000-0000-0000-00000000000$i"
  marker="$TMP/ready-$i"
  "${PSQL[@]}" >"$TMP/a-$i.log" 2>&1 <<EOF &
BEGIN;
INSERT INTO public.branches(tenant_id,name,slug) VALUES ('$tenant','Concurrent A','concurrent-a');
\! touch '$marker'
SELECT pg_sleep(2);
COMMIT;
EOF
  a_pid=$!
  for _ in $(seq 1 100); do [[ -f "$marker" ]] && break; sleep 0.05; done
  if [[ ! -f "$marker" ]]; then cat "$TMP/a-$i.log"; wait "$a_pid" || true; echo 'first transaction did not acquire lock' >&2; exit 1; fi
  set +e
  if [[ "$kind" == insert ]]; then
    "${PSQL[@]}" >"$TMP/b-$i.log" 2>&1 <<EOF
BEGIN ISOLATION LEVEL $isolation;
SELECT count(*) FROM public.branches WHERE tenant_id='$tenant';
INSERT INTO public.branches(tenant_id,name,slug) VALUES ('$tenant','Concurrent B','concurrent-b');
COMMIT;
EOF
  else
    "${PSQL[@]}" >"$TMP/b-$i.log" 2>&1 <<EOF
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
BEGIN ISOLATION LEVEL $isolation;
SELECT count(*) FROM public.branches WHERE tenant_id='$tenant';
SELECT public.owner_set_subscription('$tenant','starter',now(),null);
COMMIT;
EOF
  fi
  b_status=$?
  set -e
  if ! wait "$a_pid"; then cat "$TMP/a-$i.log"; exit 1; fi
  if [[ "$b_status" -eq 0 ]] || ! grep -Eqi 'Branch limit reached|Cannot downgrade to starter|could not serialize access' "$TMP/b-$i.log"; then
    cat "$TMP/b-$i.log"; echo "unexpected concurrency outcome: $isolation $kind" >&2; exit 1
  fi
  count="$("${PSQL[@]}" -t -A -c "SELECT count(*) FROM public.branches WHERE tenant_id='$tenant'")"
  if [[ "$kind" == insert && "$count" != 3 ]] || [[ "$kind" == downgrade && "$count" != 2 ]]; then echo "incorrect branch count: $count" >&2; exit 1; fi
  if [[ "$kind" == downgrade ]]; then
    [[ "$("${PSQL[@]}" -t -A -c "SELECT plan FROM public.tenant_subscriptions WHERE tenant_id='$tenant'")" == pro ]] || { echo 'downgrade escaped check' >&2; exit 1; }
  fi
  echo "PASS: $kind race under $isolation"
}
race 6 'READ COMMITTED' insert
race 7 'REPEATABLE READ' insert
race 8 'READ COMMITTED' downgrade
race 9 'REPEATABLE READ' downgrade
echo 'All tests passed; temporary database removed on exit.'
