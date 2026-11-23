#!/usr/bin/env bash
# Disposable local Unix-socket cluster only. Never reads production credentials.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(pg_config --bindir)"
TMP="$(mktemp -d /tmp/servio-subscription-dates.XXXXXX)"
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/server.log" -o "-F -c listen_addresses='' -k $TMP" start >/dev/null
PSQL=("$BIN/psql" -X -q -h "$TMP" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscriptions_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_dates_fixture.sql" >/dev/null
# Load the original definitions, not simplified replicas, including latest menu
# shape and both order-with-tracking overloads. These files also contain unrelated
# DDL, so extract just each complete dollar-quoted CREATE FUNCTION statement.
python3 - "$ROOT" "$TMP/functions.sql" <<'PY'
import re,sys,pathlib
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
 ('20261024135000_cashier_login_branch_required.sql',['verify_cashier_login'])]
out=['ALTER TABLE public.menu_items ADD COLUMN sort_order integer NOT NULL DEFAULT 0;']
for filename,names in items:
 text=(root/filename).read_text()
 for name in names:
  pattern=r'(?is)create\s+(?:or\s+replace\s+)?function\s+public\.'+re.escape(name)+r'\s*\(.*?\bas\s*(\$[a-z_]*\$).*?\1\s*;'
  matches=list(re.finditer(pattern,text))
  if not matches: raise SystemExit(f'missing {filename}:{name}')
  out.extend(m.group(0) for m in matches)
  if name not in ('compact_public_order_items','verify_cashier_login'):
   for m in matches:
    # Fixture functions are public by default, matching the usual Supabase grant.
    pass
out.append('REVOKE ALL ON FUNCTION public.compact_public_order_items(jsonb) FROM PUBLIC,anon,authenticated;')
out.append('REVOKE ALL ON FUNCTION public.verify_cashier_login(text,text,text,text) FROM PUBLIC,anon,authenticated;')
out.append('GRANT EXECUTE ON FUNCTION public.verify_cashier_login(text,text,text,text) TO service_role;')
pathlib.Path(sys.argv[2]).write_text('\n'.join(out)+'\n')
PY
"${PSQL[@]}" -f "$TMP/functions.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_dates_legacy_rpc_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261121130000_tenant_subscriptions_and_branch_limits.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122020000_owner_user_blocks.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122030000_enforce_subscription_dates.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_dates_checks.sql"
echo 'PASS: isolated PostgreSQL subscription date tests (original RPC bodies exercised)'
