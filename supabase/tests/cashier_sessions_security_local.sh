#!/usr/bin/env bash
# Disposable PostgreSQL only: no production credentials, sockets or Git operations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(pg_config --bindir)"
for name in ${!PG@}; do unset "$name"; done
[[ $("$BIN/initdb" --version) == *' 16.'* ]] || { echo 'PostgreSQL 16 is required' >&2; exit 1; }
TMP="$(mktemp -d /tmp/servio-cashier-security.XXXXXX)"
mkdir -p "$TMP/socket"
cleanup() {
  local pid
  while read -r pid; do kill "$pid" 2>/dev/null || true; done < <(jobs -pr)
  "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  wait 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/log" -o "-F -c listen_addresses='' -k $TMP/socket" start >/dev/null
P=("$BIN/psql" -X -q -h "$TMP/socket" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${P[@]}" -f "$ROOT/supabase/tests/cashier_sessions_security_fixture.sql" >/dev/null
# Import the exact function definitions from their latest migrations. SQL-language
# tenant_match resolves current_tenant_id when created, so define it first.
python3 - "$ROOT" "$TMP/actual.sql" <<'PY'
import pathlib,re,sys
m=pathlib.Path(sys.argv[1])/'supabase/migrations'
items=[
 ('20261021050000_account_settings_and_cashier_lifecycle.sql','current_tenant_id'),
 ('20260930080500_multi_tenancy_auth_realtime.sql','tenant_match'),
 ('20261006060700_menu_addon_complements_admin_writes.sql','is_current_tenant_admin'),
 ('20261024123000_branch_rpc_repairs.sql','open_cashier_session'),
 ('20261024130000_branch_isolation_hardening.sql','list_cashier_sessions'),
 ('20261103010000_include_paid_ready_sales.sql','close_cashier_session'),
 ('20261103010000_include_paid_ready_sales.sql','refresh_cashier_session_totals'),
 ('20261031110000_fix_cashier_order_updates.sql','is_current_cashier_session'),
 ('20261031093000_ready_orders_payment_guard.sql','guard_ready_order_payment_state'),
 ('20261031095000_harden_staff_order_scope_and_payment.sql','guard_unpaid_completion_state'),
 ('20261122040000_account_deletion_guards.sql','platform_guard_open_cashier_shift'),
]
out=[]
for file,name in items:
 text=(m/file).read_text()
 p=r'(?is)create\s+(?:or\s+replace\s+)?function\s+public\.'+re.escape(name)+r'\s*\(.*?\bas\s*(\$[a-z_]*\$).*?\1\s*;'
 matches=list(re.finditer(p,text))
 if len(matches)!=1: raise SystemExit(f'Expected one {name} in {file}, got {len(matches)}')
 out.append(matches[0].group(0))
pathlib.Path(sys.argv[2]).write_text('\n'.join(out)+'\n')
PY
"${P[@]}" -f "$TMP/actual.sql" >/dev/null
"${P[@]}" -f "$ROOT/supabase/tests/cashier_sessions_security_setup.sql" >/dev/null
# Run the actual subscription wrapper and legacy ACL migrations, unchanged.
"${P[@]}" -f "$ROOT/supabase/migrations/20261122030000_enforce_subscription_dates.sql" >/dev/null
"${P[@]}" -f "$ROOT/supabase/migrations/20261122060000_harden_legacy_rpc_privileges.sql" >/dev/null
"${P[@]}" -c "CREATE TABLE public.cashier_function_snapshot AS SELECT p.oid,n.nspname,p.proname,p.proowner,p.proacl,p.prosecdef,p.proconfig,md5(pg_get_functiondef(p.oid)) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid IN ('public.open_cashier_session(numeric)'::regprocedure,'public.close_cashier_session(uuid,numeric,text)'::regprocedure,'public.refresh_cashier_session_totals(uuid)'::regprocedure,'public.sync_cashier_session_totals_from_order()'::regprocedure,'servio_subscription_private.open_cashier_session(numeric)'::regprocedure,'servio_subscription_private.close_cashier_session(uuid,numeric,text)'::regprocedure,'servio_subscription_private.refresh_cashier_session_totals(uuid)'::regprocedure)" >/dev/null
"${P[@]}" -f "$ROOT/supabase/tests/cashier_sessions_security_prechecks.sql" >/dev/null
echo 'PASS: baseline cross-tenant close and direct tampering were exploitable'

# Exercise the separate column-only service preservation path: unlike a table
# grant it must not accidentally grant UPDATE on every column.
"$BIN/createdb" -h "$TMP/socket" -U "$(id -un)" -T postgres cashier_service_acl_test
PS=("$BIN/psql" -X -q -h "$TMP/socket" -U "$(id -un)" -d cashier_service_acl_test -v ON_ERROR_STOP=1)
"${PS[@]}" -c 'REVOKE ALL ON public.cashier_sessions FROM PUBLIC; GRANT UPDATE(notes), INSERT(notes), REFERENCES(id) ON public.cashier_sessions TO PUBLIC; GRANT SELECT ON public.cashier_sessions TO service_role;' >/dev/null
"${PS[@]}" -f "$ROOT/supabase/migrations/20261122080000_secure_cashier_sessions.sql" >/dev/null
"${PS[@]}" -c "DO \$\$ BEGIN IF NOT has_column_privilege('service_role','public.cashier_sessions','notes','UPDATE') OR NOT has_column_privilege('service_role','public.cashier_sessions','notes','INSERT') OR NOT has_column_privilege('service_role','public.cashier_sessions','id','REFERENCES') OR has_table_privilege('service_role','public.cashier_sessions','UPDATE') OR has_column_privilege('service_role','public.cashier_sessions','total_sales','UPDATE') OR has_column_privilege('authenticated','public.cashier_sessions','notes','UPDATE') THEN RAISE EXCEPTION 'Service column privilege preservation or API revoke failed'; END IF; END \$\$; SET ROLE service_role; UPDATE public.cashier_sessions SET notes='column maintenance' WHERE id='40000000-0000-0000-0000-000000000005'; RESET ROLE; DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000005' AND notes='column maintenance') THEN RAISE EXCEPTION 'Column-only service maintenance failed'; END IF; END \$\$" >/dev/null
echo 'PASS: inherited column-only service privileges preserved without expansion'

"${P[@]}" -f "$ROOT/supabase/migrations/20261122080000_secure_cashier_sessions.sql" >/dev/null
"${P[@]}" -f "$ROOT/supabase/tests/cashier_sessions_security_checks.sql" >/dev/null
echo 'PASS: post-migration authorization, ACL/RLS, subscription and sales checks'

# An advisory lock provides a deterministic gate: the first transaction has
# completed its RPC but cannot commit, and the second must actually block on it.
wait_for_sql() {
  local sql="$1" label="$2" result i
  for ((i=0;i<120;i++)); do
    result=$("${P[@]}" -Atc "$sql")
    [[ "$result" == t ]] && return 0
    sleep 0.05
  done
  echo "SECURITY/TEST FAILURE: timed out waiting for $label" >&2
  "${P[@]}" -c "SELECT application_name,state,wait_event_type,wait_event,pg_blocking_pids(pid) FROM pg_stat_activity WHERE application_name LIKE 'cashier_%'" >&2 || true
  return 1
}
run_pair() {
  local tag="$1" key="$2" first="$3" second="$4" holder a b
  PGAPPNAME="cashier_${tag}_holder" "${P[@]}" -Atc "SELECT pg_advisory_lock($key); SELECT pg_sleep(60)" >"$TMP/$tag.holder" 2>"$TMP/$tag.holder.err" & holder=$!
  wait_for_sql "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='cashier_${tag}_holder' AND wait_event='PgSleep')" "$tag gate acquisition"
  PGAPPNAME="cashier_${tag}_first" "${P[@]}" -Atc "$first SELECT pg_advisory_lock($key); COMMIT;" >"$TMP/$tag.first" 2>"$TMP/$tag.first.err" & a=$!
  wait_for_sql "SELECT EXISTS (SELECT 1 FROM pg_stat_activity a JOIN pg_stat_activity b ON b.pid=ANY(pg_blocking_pids(a.pid)) WHERE a.application_name='cashier_${tag}_first' AND b.application_name='cashier_${tag}_holder')" "$tag first RPC and gate"
  PGAPPNAME="cashier_${tag}_second" "${P[@]}" -Atc "$second COMMIT;" >"$TMP/$tag.second" 2>"$TMP/$tag.second.err" & b=$!
  wait_for_sql "SELECT EXISTS (SELECT 1 FROM pg_stat_activity a JOIN pg_stat_activity b ON b.pid=ANY(pg_blocking_pids(a.pid)) WHERE a.application_name='cashier_${tag}_second' AND b.application_name='cashier_${tag}_first')" "$tag second RPC blocked by first"
  [[ $("${P[@]}" -Atc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='cashier_${tag}_holder'") == t ]] || { echo "Could not release $tag gate" >&2; return 1; }
  wait "$holder" || true
  if wait "$a"; then rc1=0; else rc1=$?; fi
  if wait "$b"; then rc2=0; else rc2=$?; fi
}
CASHIER='20000000-0000-0000-0000-000000000006'
start_sql="BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','$CASHIER',false);"
run_pair open 792001 "$start_sql SELECT (public.open_cashier_session(12)).id;" "$start_sql SELECT (public.open_cashier_session(99)).id;"
[[ "$rc1" == 0 && "$rc2" == 0 ]] || { cat "$TMP/open.first.err" "$TMP/open.second.err" >&2; exit 1; }
sid1=$(grep -E '^[0-9a-f-]{36}$' "$TMP/open.first" | tail -1 || true)
sid2=$(grep -E '^[0-9a-f-]{36}$' "$TMP/open.second" | tail -1 || true)
[[ -n "$sid1" && "$sid1" == "$sid2" ]] || { echo 'SECURITY FAILURE: concurrent opens returned different IDs' >&2; exit 1; }
[[ $("${P[@]}" -Atc "SELECT count(*) FROM public.cashier_sessions WHERE cashier_id='30000000-0000-0000-0000-000000000006' AND status='open' AND opening_cash=12") == 1 ]] || { echo 'SECURITY FAILURE: concurrent open state incorrect' >&2; exit 1; }
run_pair close 792002 "$start_sql SELECT (public.close_cashier_session('$sid1',20,'winner')).id;" "$start_sql SELECT (public.close_cashier_session('$sid1',99,'loser')).id;"
[[ "$rc1" == 0 && "$rc2" != 0 ]] && grep -q 'Open cashier session not found' "$TMP/close.second.err" || { echo 'SECURITY FAILURE: concurrent close did not reject loser' >&2; cat "$TMP/close.first.err" "$TMP/close.second.err" >&2; exit 1; }
[[ $("${P[@]}" -Atc "SELECT closing_cash||':'||notes FROM public.cashier_sessions WHERE id='$sid1'") == '20.00:winner' ]] || { echo 'SECURITY FAILURE: losing close overwrote winner' >&2; exit 1; }
echo 'PASS: concurrent opens and closes, with observed transaction blocking'

# Two paid orders must not lose one another from totals, even if the second
# trigger begins its update while the first transaction still owns the shift.
sid3=$("${P[@]}" -Atc "$start_sql SELECT (public.open_cashier_session(0)).id; COMMIT;" | grep -E '^[0-9a-f-]{36}$' | tail -1)
order_prefix="INSERT INTO public.orders(tenant_id,branch_id,cashier_session_id,status,payment_status,total_price,payment_method) VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','$sid3','ready','paid',"
run_pair totals 792003 "$start_sql $order_prefix 10,'cash');" "$start_sql $order_prefix 20,'cash');"
[[ "$rc1" == 0 && "$rc2" == 0 ]] || { echo 'Concurrent order insert failed' >&2; cat "$TMP/totals.first.err" "$TMP/totals.second.err" >&2; exit 1; }
[[ $("${P[@]}" -Atc "SELECT total_sales||':'||cash_sales FROM public.cashier_sessions WHERE id='$sid3'") == '30.00:30.00' ]] || { echo 'SECURITY FAILURE: concurrent orders lost shift totals' >&2; exit 1; }
rr_sql="BEGIN ISOLATION LEVEL REPEATABLE READ; SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','$CASHIER',false);"
run_pair totals_rr 792004 "$start_sql $order_prefix 5,'cash');" "$rr_sql $order_prefix 7,'cash');"
[[ "$rc1" == 0 && "$rc2" != 0 ]] && grep -Fq 'could not serialize access due to concurrent update' "$TMP/totals_rr.second.err" || { echo 'SECURITY FAILURE: repeatable-read order was not safely serialized' >&2; cat "$TMP/totals_rr.first.err" "$TMP/totals_rr.second.err" >&2; exit 1; }
[[ $("${P[@]}" -Atc "SELECT total_sales||':'||cash_sales FROM public.cashier_sessions WHERE id='$sid3'") == '35.00:35.00' ]] || { echo 'SECURITY FAILURE: repeatable-read rollback left incorrect totals' >&2; exit 1; }
echo 'PASS: concurrent order totals and repeatable-read serialization'

# Each failed migration runs in a local clone and must fail for the intended
# prerequisite, not because the already-installed policy names are duplicated.
"$BIN/createdb" -h "$TMP/socket" -U "$(id -un)" -T postgres cashier_precondition_test
PC=("$BIN/psql" -X -q -h "$TMP/socket" -U "$(id -un)" -d cashier_precondition_test -v ON_ERROR_STOP=1)
expect_failure() {
  local label="$1" expected="$2"
  if "${PC[@]}" -f "$ROOT/supabase/migrations/20261122080000_secure_cashier_sessions.sql" >"$TMP/$label.out" 2>&1; then
    echo "SECURITY FAILURE: migration accepted $label" >&2; exit 1
  fi
  grep -Fq "$expected" "$TMP/$label.out" || { cat "$TMP/$label.out" >&2; exit 1; }
}
"${PC[@]}" -c 'ALTER TABLE public.cashier_sessions DISABLE ROW LEVEL SECURITY' >/dev/null
expect_failure no_rls 'cashier_sessions row-level security must be enabled'
"${PC[@]}" -c 'ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.orders ENABLE REPLICA TRIGGER orders_sync_cashier_session_totals' >/dev/null
expect_failure replica_only 'Expected enabled complete cashier totals order trigger is missing'
"${PC[@]}" -c 'DROP TRIGGER orders_sync_cashier_session_totals ON public.orders' >/dev/null
expect_failure missing_trigger 'Expected enabled complete cashier totals order trigger is missing'
"${PC[@]}" -c 'CREATE TRIGGER orders_sync_cashier_session_totals AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_cashier_session_totals_from_order()' >/dev/null
expect_failure insert_only 'Expected enabled complete cashier totals order trigger is missing'
"${PC[@]}" -c 'DROP TRIGGER orders_sync_cashier_session_totals ON public.orders; CREATE TRIGGER orders_sync_cashier_session_totals AFTER INSERT OR DELETE OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_cashier_session_totals_from_order()' >/dev/null
expect_failure missing_update_columns 'Expected enabled complete cashier totals order trigger is missing'
echo 'PASS: migration rejects disabled RLS and missing, replica-only or incomplete totals triggers'

# Inherited table and column grants must be rejected transactionally. Roles are
# cluster-global, so this clone/test is last.
"$BIN/createdb" -h "$TMP/socket" -U "$(id -un)" -T postgres cashier_inherit_test
PI=("$BIN/psql" -X -q -h "$TMP/socket" -U "$(id -un)" -d cashier_inherit_test -v ON_ERROR_STOP=1)
"${PI[@]}" -c 'CREATE ROLE cashier_test_inherited; GRANT cashier_test_inherited TO authenticated; GRANT TRUNCATE ON public.cashier_sessions TO cashier_test_inherited;' >/dev/null
"${PI[@]}" -c 'DROP POLICY cashier_sessions_no_api_insert ON public.cashier_sessions; DROP POLICY cashier_sessions_no_api_update ON public.cashier_sessions; DROP POLICY cashier_sessions_no_api_delete ON public.cashier_sessions;' >/dev/null
"${PI[@]}" -c "CREATE TABLE public.cashier_test_snapshot AS SELECT relacl::text AS acl, md5(pg_get_functiondef('servio_subscription_private.close_cashier_session(uuid,numeric,text)'::regprocedure)) AS body FROM pg_class WHERE oid='public.cashier_sessions'::regclass" >/dev/null
assert_rollback() {
 "${PI[@]}" -c "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM public.cashier_test_snapshot s JOIN pg_class c ON c.oid='public.cashier_sessions'::regclass WHERE s.acl IS DISTINCT FROM c.relacl::text OR s.body IS DISTINCT FROM md5(pg_get_functiondef('servio_subscription_private.close_cashier_session(uuid,numeric,text)'::regprocedure))) THEN RAISE EXCEPTION 'Failed migration changed ACL or function body'; END IF; IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.cashier_sessions'::regclass AND polname LIKE 'cashier_sessions_no_api_%') THEN RAISE EXCEPTION 'Failed migration left policies behind'; END IF; END \$\$" >/dev/null
}
if "${PI[@]}" -f "$ROOT/supabase/migrations/20261122080000_secure_cashier_sessions.sql" >"$TMP/inherit_table.out" 2>&1; then echo 'SECURITY FAILURE: inherited TRUNCATE accepted' >&2; exit 1; fi
grep -Fq 'Inherited TRUNCATE privilege' "$TMP/inherit_table.out" || { cat "$TMP/inherit_table.out" >&2; exit 1; }
assert_rollback
"${PI[@]}" -c 'REVOKE TRUNCATE ON public.cashier_sessions FROM cashier_test_inherited; GRANT UPDATE(total_sales) ON public.cashier_sessions TO cashier_test_inherited;' >/dev/null
"${PI[@]}" -c "UPDATE public.cashier_test_snapshot SET acl=(SELECT relacl::text FROM pg_class WHERE oid='public.cashier_sessions'::regclass)" >/dev/null
if "${PI[@]}" -f "$ROOT/supabase/migrations/20261122080000_secure_cashier_sessions.sql" >"$TMP/inherit_column.out" 2>&1; then echo 'SECURITY FAILURE: inherited column UPDATE accepted' >&2; exit 1; fi
grep -Fq 'Inherited column UPDATE privilege' "$TMP/inherit_column.out" || { cat "$TMP/inherit_column.out" >&2; exit 1; }
assert_rollback
"${PI[@]}" -c "DO \$\$ BEGIN IF NOT has_column_privilege('authenticated','public.cashier_sessions','total_sales','UPDATE') THEN RAISE EXCEPTION 'Expected inherited column grant is missing'; END IF; END \$\$" >/dev/null
echo 'PASS: inherited table/column grants rejected and failed migrations rolled back'
echo 'PASS: all cashier-session security tests (isolated PostgreSQL 16)'
