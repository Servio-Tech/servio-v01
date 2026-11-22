#!/usr/bin/env bash
# Disposable local PostgreSQL over a private Unix socket; never reads credentials.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(pg_config --bindir)"
for name in ${!PG@}; do unset "$name"; done
TMP="$(mktemp -d /tmp/servio-legacy-rpc-security.XXXXXX)"
SOCKET="$TMP/socket"
mkdir -p "$SOCKET"
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/server.log" -o "-F -c listen_addresses='' -k $SOCKET" start >/dev/null
PSQL=("$BIN/psql" -X -q -h "$SOCKET" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscriptions_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_dates_fixture.sql" >/dev/null
# Extract original function bodies, including public-menu and order paths, rather
# than replacing them with stubs. The deployed sync trigger is in our fixture.
python3 - "$ROOT" "$TMP/functions.sql" <<'PY'
import pathlib,re,sys
root=pathlib.Path(sys.argv[1])/'supabase/migrations'
items=[
 ('20260930080500_multi_tenancy_auth_realtime.sql',['get_public_tenant','get_public_store']),
 ('20261018090000_menu_ingredient_inventory.sql',['get_public_menu_items']),
 ('20261024131000_branch_rpc_scope_guards_v2.sql',['get_public_branches']),
 ('20261024120000_branches_and_cashier_order_isolation.sql',['create_public_order','create_public_waiter_call','create_public_feedback']),
 ('20261030080000_customer_tracking_reviews.sql',['get_public_order_tracking']),
 ('20261102213544_redact_public_menu_operational_fields.sql',['get_public_categories','get_public_menu_items']),
 ('20261102212441_secure_public_branch_reads.sql',['get_public_tables']),
 ('20261102212721_secure_public_menu_asset_reads.sql',['get_public_menu_item_images']),
 ('20261104030000_branch_menu_item_order.sql',['get_public_menu_item_details']),
 ('20261102114000_harden_customer_order_submission.sql',['compact_public_order_items','create_public_order_with_tracking']),
 ('20261105120000_cashier_web_push_notifications.sql',['claim_cashier_notification_deliveries']),
 ('20261024135000_cashier_login_branch_required.sql',['verify_cashier_login']),
 ('20261024133000_remove_tax_number.sql',['create_tenant_for_registration']),
 ('20261103010000_include_paid_ready_sales.sql',['refresh_cashier_session_totals']),
 ('20261031093000_ready_orders_payment_guard.sql',['guard_ready_order_payment_state']),
 ('20261031095000_harden_staff_order_scope_and_payment.sql',['guard_unpaid_completion_state'])]
out=['ALTER TABLE public.menu_items ADD COLUMN sort_order integer NOT NULL DEFAULT 0;']
for filename,names in items:
    text=(root/filename).read_text()
    for name in names:
        pattern=r'(?is)create\s+(?:or\s+replace\s+)?function\s+public\.'+re.escape(name)+r'\s*\(.*?\bas\s*(\$[a-z_]*\$).*?\1\s*;'
        matches=list(re.finditer(pattern,text))
        if not matches: raise SystemExit(f'missing {filename}:{name}')
        out.extend(m.group(0) for m in matches)
out.extend([
 'REVOKE ALL ON FUNCTION public.compact_public_order_items(jsonb) FROM PUBLIC,anon,authenticated;',
 'REVOKE ALL ON FUNCTION public.verify_cashier_login(text,text,text,text) FROM PUBLIC,anon,authenticated;',
 'GRANT EXECUTE ON FUNCTION public.verify_cashier_login(text,text,text,text) TO service_role;',
 # Match the live explicitly granted roles, in addition to its PUBLIC grants.
 'GRANT EXECUTE ON FUNCTION public.create_tenant_for_registration(text,text,text,text,text) TO anon,authenticated,service_role;',
 'GRANT EXECUTE ON FUNCTION public.refresh_cashier_session_totals(uuid) TO anon,authenticated,service_role;'])
pathlib.Path(sys.argv[2]).write_text('\n'.join(out)+'\n')
PY
"${PSQL[@]}" -f "$TMP/functions.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/legacy_rpc_security_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261121130000_tenant_subscriptions_and_branch_limits.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122020000_owner_user_blocks.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122030000_enforce_subscription_dates.sql" >/dev/null
# Run intervening migrations too when present in this working tree.
for file in "$ROOT/supabase/migrations/20261122040000_account_deletion_guards.sql" "$ROOT/supabase/migrations/20261122050000_subscription_audit.sql"; do
  if [[ -f "$file" ]]; then "${PSQL[@]}" -f "$file" >/dev/null; fi
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/legacy_rpc_security_prechecks.sql" >/dev/null
# Both an invoker trigger and a definer with insufficient rights are unsafe.
# Simulate drift locally and assert the whole migration rolls back, then restore.
"${PSQL[@]}" -c 'CREATE ROLE legacy_security_noexec NOLOGIN' >/dev/null
for drift in invoker owner; do
  if [[ "$drift" == invoker ]]; then
    "${PSQL[@]}" -c 'ALTER FUNCTION public.sync_cashier_session_totals_from_order() SECURITY INVOKER' >/dev/null
  else
    "${PSQL[@]}" -c 'ALTER FUNCTION public.sync_cashier_session_totals_from_order() OWNER TO legacy_security_noexec' >/dev/null
  fi
  if "${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122060000_harden_legacy_rpc_privileges.sql" >"$TMP/refused.log" 2>&1; then
    echo "FAIL: migration accepted unsafe $drift trigger" >&2; exit 1
  fi
  grep -q 'Cashier totals trigger or its owner privilege differs' "$TMP/refused.log" || { cat "$TMP/refused.log" >&2; exit 1; }
  "${PSQL[@]}" -c "DO \$\$ BEGIN IF NOT has_function_privilege('anon','public.refresh_cashier_session_totals(uuid)','EXECUTE') OR NOT has_function_privilege('anon','public.create_tenant_for_registration(text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'failed migration did not roll back'; END IF; END \$\$;" >/dev/null
  if [[ "$drift" == invoker ]]; then
    "${PSQL[@]}" -c 'ALTER FUNCTION public.sync_cashier_session_totals_from_order() SECURITY DEFINER' >/dev/null
  else
    "${PSQL[@]}" -c 'ALTER FUNCTION public.sync_cashier_session_totals_from_order() OWNER TO CURRENT_USER' >/dev/null
  fi
done
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122060000_harden_legacy_rpc_privileges.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/legacy_rpc_security_checks.sql" >/dev/null
echo 'PASS: isolated legacy RPC ACLs, subscription-wrapper ordering, registration, menu/orders and cashier trigger totals'
