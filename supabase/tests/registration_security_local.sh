#!/usr/bin/env bash
# Disposable socket-only cluster. No project environment, .env, remote DB or live data.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
for name in ${!PG@}; do unset "$name"; done
BIN="$(pg_config --bindir)"
[[ $("$BIN/initdb" --version) == *' 16.'* ]] || { echo 'PostgreSQL 16 is required' >&2; exit 1; }
TMP="$(mktemp -d /tmp/servio-registration-security.XXXXXX)"
SOCKET="$TMP/socket"
mkdir -p "$SOCKET"
cleanup() {
  local child
  while read -r child; do kill "$child" 2>/dev/null || true; done < <(jobs -pr)
  "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  wait 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/server.log" -o "-F -c listen_addresses='' -k $SOCKET" start >/dev/null
PSQL=("$BIN/psql" -X -q -h "$SOCKET" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscriptions_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_dates_fixture.sql" >/dev/null
# Actual historical definitions, not hand-written substitutes. The original
# project lacks the initial base schema and several platform-owned objects, so
# the fixture necessarily remains a schema approximation, not full Supabase.
python3 - "$ROOT" "$TMP/functions.sql" <<'PY'
import pathlib,re,sys
root=pathlib.Path(sys.argv[1])/'supabase/migrations'
items=[
 ('20260930080500_multi_tenancy_auth_realtime.sql',['tenant_match','create_tenant_for_registration','get_public_tenant','get_public_store']),
 ('20260930080530_cashier_auth_session_support.sql',['handle_new_user']),
 ('20261006060700_menu_addon_complements_admin_writes.sql',['is_current_tenant_admin']),
 ('20261021050000_account_settings_and_cashier_lifecycle.sql',['current_tenant_id','sync_profile_settings_from_auth','deactivate_cashier']),
 ('20261031068000_atomic_registration_provisioning.sql',['ensure_profile_for_current_user']),
 ('20261024133000_remove_tax_number.sql',['create_tenant_for_registration']),
 ('20261024135000_cashier_login_branch_required.sql',['verify_cashier_login']),
 ('20261103010000_include_paid_ready_sales.sql',['refresh_cashier_session_totals']),
 ('20261031093000_ready_orders_payment_guard.sql',['guard_ready_order_payment_state']),
 ('20261031095000_harden_staff_order_scope_and_payment.sql',['guard_unpaid_completion_state'])]
out=[]
for filename,names in items:
 text=(root/filename).read_text()
 for name in names:
  pattern=r'(?is)create\s+(?:or\s+replace\s+)?function\s+public\.'+re.escape(name)+r'\s*\(.*?\bas\s*(\$[a-z_]*\$).*?\1\s*;'
  matches=list(re.finditer(pattern,text))
  if len(matches)!=1: raise SystemExit(f'expected exactly one {filename}:{name}; got {len(matches)}')
  out.append(matches[0].group(0))
out += [
 'REVOKE ALL ON FUNCTION public.current_tenant_id(),public.is_current_tenant_admin(),public.tenant_match(uuid) FROM PUBLIC,anon;',
 'GRANT EXECUTE ON FUNCTION public.current_tenant_id(),public.is_current_tenant_admin(),public.tenant_match(uuid) TO authenticated;',
 'REVOKE ALL ON FUNCTION public.handle_new_user(),public.sync_profile_settings_from_auth() FROM PUBLIC,anon,authenticated;',
 'REVOKE ALL ON FUNCTION public.create_tenant_for_registration(text,text) FROM PUBLIC,anon,authenticated;',
 'GRANT EXECUTE ON FUNCTION public.create_tenant_for_registration(text,text,text,text,text) TO anon,authenticated,service_role;',
 'REVOKE ALL ON FUNCTION public.verify_cashier_login(text,text,text,text) FROM PUBLIC,anon,authenticated;',
 'GRANT EXECUTE ON FUNCTION public.verify_cashier_login(text,text,text,text) TO service_role;',
 'REVOKE ALL ON FUNCTION public.deactivate_cashier(uuid) FROM PUBLIC,anon;',
 'GRANT EXECUTE ON FUNCTION public.deactivate_cashier(uuid) TO authenticated;',
 'REVOKE ALL ON FUNCTION public.ensure_profile_for_current_user() FROM PUBLIC,anon;',
 'GRANT EXECUTE ON FUNCTION public.ensure_profile_for_current_user() TO authenticated;',
 'GRANT EXECUTE ON FUNCTION public.refresh_cashier_session_totals(uuid) TO anon,authenticated,service_role;']
pathlib.Path(sys.argv[2]).write_text('\n'.join(out)+'\n')
PY
"${PSQL[@]}" -f "$TMP/functions.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/legacy_rpc_security_fixture.sql" >/dev/null
# Shift RPCs require cashier_sessions as a return type, created by the previous
# fixture. Extract their real old bodies before 220300 wraps them. We only test
# registration here; this is not a functional shift/order test.
python3 - "$ROOT" "$TMP/shift-functions.sql" <<'PY'
import pathlib,re,sys
root=pathlib.Path(sys.argv[1])/'supabase/migrations'
items=[('20261024123000_branch_rpc_repairs.sql','open_cashier_session'),
       ('20261103010000_include_paid_ready_sales.sql','close_cashier_session')]
out=[]
for filename,name in items:
 text=(root/filename).read_text()
 pattern=r'(?is)create\s+(?:or\s+replace\s+)?function\s+public\.'+re.escape(name)+r'\s*\(.*?\bas\s*(\$[a-z_]*\$).*?\1\s*;'
 matches=list(re.finditer(pattern,text))
 if len(matches)!=1: raise SystemExit(f'expected exactly one {filename}:{name}; got {len(matches)}')
 out.append(matches[0].group(0))
out += ['REVOKE ALL ON FUNCTION public.open_cashier_session(numeric),public.close_cashier_session(uuid,numeric,text) FROM PUBLIC,anon;',
        'GRANT EXECUTE ON FUNCTION public.open_cashier_session(numeric),public.close_cashier_session(uuid,numeric,text) TO authenticated;']
pathlib.Path(sys.argv[2]).write_text('\n'.join(out)+'\n')
PY
"${PSQL[@]}" -f "$TMP/shift-functions.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/registration_security_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261104050000_remove_legacy_auth_profile_trigger.sql" >/dev/null
# Positive control: the historical unwrapped definition is actually vulnerable.
"${PSQL[@]}" -f "$ROOT/supabase/tests/registration_security_old_control.sql" >/dev/null
echo 'PASS: old-definition positive control reproduced locally and rolled back'
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261121130000_tenant_subscriptions_and_branch_limits.sql" >/dev/null
"${PSQL[@]}" -v wrapper=false -v final=false -f "$ROOT/supabase/tests/registration_security_checks.sql" >/dev/null
echo 'PASS: 211300 unwrapped registration and RLS checks'
echo 'WARNING: legacy RPC permits anonymous unbound tenant creation until 220600; positive control reproduced and rolled back'
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122020000_owner_user_blocks.sql" >/dev/null
"${PSQL[@]}" -v wrapper=false -v final=false -f "$ROOT/supabase/tests/registration_security_checks.sql" >/dev/null
echo 'PASS: 220200 registration and RLS checks'
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122030000_enforce_subscription_dates.sql" >/dev/null
"${PSQL[@]}" -v wrapper=true -v final=false -f "$ROOT/supabase/tests/registration_security_checks.sql" >/dev/null
echo 'PASS: 220300 wrapper, private-body ACLs, registration and RLS checks'
for file in \
  20261122040000_account_deletion_guards.sql \
  20261122050000_subscription_audit.sql \
  20261122060000_harden_legacy_rpc_privileges.sql \
  20261122070000_subscription_status.sql \
  20261122080000_secure_cashier_sessions.sql \
  20261122090000_secure_order_payload.sql; do
  "${PSQL[@]}" -f "$ROOT/supabase/migrations/$file" >/dev/null
  final=false
  [[ "$file" < 20261122060000 ]] || final=true
  "${PSQL[@]}" -v wrapper=true -v final="$final" -f "$ROOT/supabase/tests/registration_security_checks.sql" >/dev/null
  echo "PASS: $file registration, RLS and ACL checks"
  [[ "$file" != 20261122060000_harden_legacy_rpc_privileges.sql ]] || echo 'PASS: 220600 closes legacy RPC to anon and authenticated'
done
# Two separate sessions, same newly-created identity. The first holds the Auth
# row through commit. Prove that session two is blocked by session one, compare
# their returned tenant IDs, and verify the committed rows (READ COMMITTED only).
"${PSQL[@]}" -c "INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES ('20000000-0000-0000-0000-000000000020','race@example.test',now(),'{\"store_name\":\"Race Store\",\"store_slug\":\"race-store\",\"tenant_id\":\"00000000-0000-0000-0000-000000000001\",\"role\":\"admin\"}');" >/dev/null
PGAPPNAME=regsec_writer "${PSQL[@]}" -At -c "BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL statement_timeout='15s'; SET LOCAL request.jwt.claim.sub='20000000-0000-0000-0000-000000000020'; SET LOCAL request.jwt.claim.role='authenticated'; SET LOCAL ROLE authenticated; SELECT (public.ensure_profile_for_current_user()).tenant_id; SELECT pg_sleep(5); COMMIT;" >"$TMP/race1" 2>&1 &
pid=$!
for _ in $(seq 1 100); do
  if [[ $("${PSQL[@]}" -Atc "SELECT count(*) FROM pg_stat_activity WHERE application_name='regsec_writer' AND wait_event='PgSleep'") == 1 ]]; then break; fi
  if ! kill -0 "$pid" 2>/dev/null; then cat "$TMP/race1" >&2; exit 1; fi
  sleep .05
done
[[ $("${PSQL[@]}" -Atc "SELECT count(*) FROM pg_stat_activity WHERE application_name='regsec_writer' AND wait_event='PgSleep'") == 1 ]] || { echo 'race writer did not start' >&2; exit 1; }
PGAPPNAME=regsec_waiter "${PSQL[@]}" -At -c "BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL statement_timeout='15s'; SET LOCAL request.jwt.claim.sub='20000000-0000-0000-0000-000000000020'; SET LOCAL request.jwt.claim.role='authenticated'; SET LOCAL ROLE authenticated; SELECT (public.ensure_profile_for_current_user()).tenant_id; COMMIT;" >"$TMP/race2" 2>&1 &
waiter=$!
blocked=false
for _ in $(seq 1 100); do
  if [[ $("${PSQL[@]}" -Atc "SELECT count(*) FROM pg_stat_activity w JOIN pg_stat_activity b ON b.pid=ANY(pg_blocking_pids(w.pid)) WHERE w.application_name='regsec_waiter' AND w.wait_event_type='Lock' AND b.application_name='regsec_writer'") == 1 ]]; then blocked=true; break; fi
  if ! kill -0 "$waiter" 2>/dev/null; then cat "$TMP/race2" >&2; break; fi
  sleep .05
done
[[ "$blocked" == true ]] || { echo 'race waiter was not observed blocked by writer' >&2; exit 1; }
wait "$waiter" || { cat "$TMP/race2" >&2; exit 1; }
wait "$pid" || { cat "$TMP/race1" >&2; exit 1; }
one=$(grep -E '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' "$TMP/race1" || true)
two=$(grep -E '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' "$TMP/race2" || true)
[[ -n "$one" && "$one" == "$two" ]] || { echo 'race calls returned different or invalid tenant IDs' >&2; cat "$TMP/race1" "$TMP/race2" >&2; exit 1; }
"${PSQL[@]}" -c "DO \$\$ DECLARE t uuid; BEGIN SELECT tenant_id INTO STRICT t FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000020' AND role='admin'; IF t::text <> '$one' OR t='00000000-0000-0000-0000-000000000001' OR (SELECT count(*) FROM public.tenants WHERE slug='race-store')<>1 OR (SELECT count(*) FROM public.store WHERE tenant_id=t)<>1 OR (SELECT count(*) FROM public.branches WHERE tenant_id=t AND slug='main')<>1 OR (SELECT count(*) FROM public.tenant_subscriptions WHERE tenant_id=t AND plan='starter')<>1 THEN RAISE EXCEPTION 'concurrent registration wrong'; END IF; END \$\$;" >/dev/null
echo 'PASS: READ COMMITTED waiter blocked; both callbacks returned one fresh tenant with one complete registration'
