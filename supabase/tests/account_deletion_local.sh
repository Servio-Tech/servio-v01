#!/usr/bin/env bash
set -euo pipefail
# Disposable Unix-socket-only PostgreSQL cluster. Never reads any remote URL.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
TMP=$(mktemp -d /tmp/servio-account-deletion.XXXXXX)
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust -U postgres >"$TMP/init.log"
"$BIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -l "$TMP/server.log" start >/dev/null
PSQL=("$BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$TMP" -U postgres -d postgres)
"${PSQL[@]}" -f "$ROOT/supabase/tests/account_deletion_fixture.sql"
# Copy the actual old RPC body so 220300 wraps the real implementation.
python3 - "$ROOT" "$TMP/rpc.sql" <<'PY'
import pathlib, re, sys
text=(pathlib.Path(sys.argv[1])/'supabase/migrations/20261021050000_account_settings_and_cashier_lifecycle.sql').read_text()
m=re.search(r'(?is)CREATE OR REPLACE FUNCTION public\.deactivate_cashier\(p_cashier_id uuid\).*?\$\$;',text)
if not m: raise SystemExit('missing historical RPC')
pathlib.Path(sys.argv[2]).write_text(m.group(0)+'\nREVOKE ALL ON FUNCTION public.deactivate_cashier(uuid) FROM PUBLIC, anon, authenticated;\nGRANT EXECUTE ON FUNCTION public.deactivate_cashier(uuid) TO authenticated;\n')
PY
"${PSQL[@]}" -f "$TMP/rpc.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122020000_owner_user_blocks.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122030000_enforce_subscription_dates.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122040000_account_deletion_guards.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/account_deletion_checks.sql" >"$TMP/checks.log"
echo 'PASS functional checks and real subscription RPC wrapper'

wait_sleep() {
  local name=$1
  for _ in $(seq 1 100); do
    if [[ $("${PSQL[@]}" -Atc "SELECT count(*) FROM pg_stat_activity WHERE application_name='$name' AND wait_event='PgSleep'") == 1 ]]; then return; fi
    sleep .05
  done
  echo "Session $name failed to enter sleep" >&2; exit 1
}
start_writer() {
  local name=$1 sql=$2
  PGAPPNAME="$name" "${PSQL[@]}" -c "$sql" >"$TMP/$name.log" 2>&1 &
  WRITER_PID=$!
  wait_sleep "$name"
}
expect_fail() {
  local name=$1 needle=$2 sql=$3
  if PGAPPNAME="$name" "${PSQL[@]}" -c "$sql" >"$TMP/$name.log" 2>&1; then
    echo "$name unexpectedly succeeded" >&2; cat "$TMP/$name.log" >&2; exit 1
  fi
  if ! grep -q "$needle" "$TMP/$name.log"; then cat "$TMP/$name.log" >&2; exit 1; fi
}
check() { "${PSQL[@]}" -c "$1" >/dev/null; }

# Different rows in the same tenant: delete one Auth identity while demoting
# the other admin. The losing transaction must not remove the final admin.
start_writer admin_delete "BEGIN; DELETE FROM auth.users WHERE id='10000000-0000-0000-0000-000000000001'; SELECT pg_sleep(2); COMMIT;"
expect_fail admin_demote LAST_TENANT_ADMIN "UPDATE public.profiles SET role='cashier' WHERE id='10000000-0000-0000-0000-000000000002';"
wait "$WRITER_PID"
check "DO \$\$ BEGIN IF (SELECT count(*) FROM public.profiles WHERE tenant_id='40000000-0000-0000-0000-000000000001' AND role='admin')<>1 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id='10000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'admin race damaged state'; END IF; END \$\$;"
echo 'PASS concurrent Auth delete vs admin role change'

# Two direct deactivations must leave one active, without removing either Auth
# identity or the historical delivery / closed shift.
start_writer cashier_a "BEGIN; UPDATE public.cashiers SET is_active=false WHERE id='60000000-0000-0000-0000-000000000001'; SELECT pg_sleep(2); COMMIT;"
expect_fail cashier_b LAST_ACTIVE_CASHIER "UPDATE public.cashiers SET is_active=false WHERE id='60000000-0000-0000-0000-000000000002';"
wait "$WRITER_PID"
check "DO \$\$ BEGIN IF (SELECT count(*) FROM public.cashiers WHERE tenant_id='40000000-0000-0000-0000-000000000001' AND is_active)<>1 OR (SELECT count(*) FROM auth.users WHERE id IN ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'))<>2 OR NOT EXISTS(SELECT 1 FROM public.notification_deliveries WHERE id='90000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'cashier race damaged state'; END IF; END \$\$;"
echo 'PASS concurrent cashier deactivations and historical data retention'

# A direct shift INSERT racing archival cannot open for the archived cashier.
check "UPDATE public.cashiers SET is_active=true WHERE id='60000000-0000-0000-0000-000000000001';"
start_writer archive_shift "BEGIN; UPDATE public.cashiers SET is_active=false WHERE id='60000000-0000-0000-0000-000000000001'; SELECT pg_sleep(2); COMMIT;"
expect_fail open_shift 'Active cashier required' "INSERT INTO public.cashier_sessions VALUES('a0000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','open');"
wait "$WRITER_PID"
echo 'PASS concurrent archive vs direct open shift'

# When Auth deletion wins, a later non-FK link must fail instead of becoming
# dangling. In the opposite ordering the Auth delete must be blocked.
check "INSERT INTO auth.users VALUES ('30000000-0000-0000-0000-000000000004','r1@example.test',now(),null),('30000000-0000-0000-0000-000000000005','r2@example.test',now(),null); INSERT INTO public.cashiers VALUES ('60000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001','R1',null,true),('60000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000001','R2',null,true);"
start_writer auth_first "BEGIN; DELETE FROM auth.users WHERE id='30000000-0000-0000-0000-000000000004'; SELECT pg_sleep(2); COMMIT;"
expect_fail link_second 'Cashier Auth identity not found' "UPDATE public.cashiers SET auth_user_id='30000000-0000-0000-0000-000000000004' WHERE id='60000000-0000-0000-0000-000000000004';"
wait "$WRITER_PID"
start_writer link_first "BEGIN; UPDATE public.cashiers SET auth_user_id='30000000-0000-0000-0000-000000000005' WHERE id='60000000-0000-0000-0000-000000000005'; SELECT pg_sleep(2); COMMIT;"
expect_fail auth_second 'User deletion blocked by linked cashier' "DELETE FROM auth.users WHERE id='30000000-0000-0000-0000-000000000005';"
wait "$WRITER_PID"
check "DO \$\$ BEGIN IF (SELECT auth_user_id FROM public.cashiers WHERE id='60000000-0000-0000-0000-000000000004') IS NOT NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id='30000000-0000-0000-0000-000000000005') THEN RAISE EXCEPTION 'link race damaged state'; END IF; END \$\$;"
echo 'PASS Auth delete vs non-FK linking in both orders'

# A subscription can arrive while deletion waits on its Auth FK, or after the
# deletion holds its row lock. In neither ordering may history be cascaded away.
check "INSERT INTO auth.users VALUES ('30000000-0000-0000-0000-000000000006','n1@example.test',now(),null),('30000000-0000-0000-0000-000000000007','n2@example.test',now(),null);"
start_writer subscription_first "BEGIN; INSERT INTO public.notification_subscriptions VALUES ('80000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000006'); INSERT INTO public.notification_deliveries VALUES ('90000000-0000-0000-0000-000000000006','80000000-0000-0000-0000-000000000006','sent'); SELECT pg_sleep(2); COMMIT;"
expect_fail notify_delete_second 'retained notification subscriptions' "DELETE FROM auth.users WHERE id='30000000-0000-0000-0000-000000000006';"
wait "$WRITER_PID"
start_writer notify_delete_first "BEGIN; DELETE FROM auth.users WHERE id='30000000-0000-0000-0000-000000000007'; SELECT pg_sleep(2); COMMIT;"
expect_fail subscription_second 'violates foreign key constraint' "INSERT INTO public.notification_subscriptions VALUES ('80000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000007');"
wait "$WRITER_PID"
check "DO \$\$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.notification_deliveries WHERE id='90000000-0000-0000-0000-000000000006') OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id='30000000-0000-0000-0000-000000000006') THEN RAISE EXCEPTION 'notification history damaged'; END IF; END \$\$;"
echo 'PASS Auth delete vs notification subscription in both orders'

# A manager demoted before their cashier RPC acquires its profile lock must not
# archive a cashier using the role observed by an earlier request/statement.
check "INSERT INTO auth.users VALUES ('10000000-0000-0000-0000-000000000004','admin4@example.test',now(),null); INSERT INTO public.profiles VALUES ('10000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001','admin');"
start_writer actor_demote "BEGIN; UPDATE public.profiles SET role='cashier' WHERE id='10000000-0000-0000-0000-000000000004'; SELECT pg_sleep(2); COMMIT;"
expect_fail actor_rpc 'Admin role required' "SELECT set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"10000000-0000-0000-0000-000000000004\"}',false); SET ROLE authenticated; SELECT public.deactivate_cashier('60000000-0000-0000-0000-000000000004');"
wait "$WRITER_PID"
check "DO \$\$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.cashiers WHERE id='60000000-0000-0000-0000-000000000004' AND is_active) THEN RAISE EXCEPTION 'demoted manager archived cashier'; END IF; END \$\$;"
echo 'PASS concurrent manager demotion vs authenticated cashier RPC'

# The profile row lock must wait for in-flight profile FK references before the
# owner preflight checks for retained data; no SET NULL or account deletion.
check "UPDATE public.profiles SET role='admin' WHERE id='10000000-0000-0000-0000-000000000004';"
start_writer profile_reference "BEGIN; INSERT INTO public.profile_history VALUES ('b0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004'); SELECT pg_sleep(2); COMMIT;"
expect_fail owner_preflight 'retained application data' "SELECT public.platform_prepare_user_deletion('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004');"
wait "$WRITER_PID"
check "DO \$\$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.profile_history WHERE id='b0000000-0000-0000-0000-000000000002' AND profile_id='10000000-0000-0000-0000-000000000004') OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id='10000000-0000-0000-0000-000000000004') THEN RAISE EXCEPTION 'profile reference damaged'; END IF; END \$\$;"
echo 'PASS concurrent profile FK insertion vs owner deletion preflight'

echo 'PASS: isolated account deletion tests'
