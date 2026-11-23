#!/usr/bin/env bash
# Disposable private-socket PostgreSQL only; do not load any project/env credentials.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(pg_config --bindir)"
for name in ${!PG@}; do unset "$name"; done
TMP="$(mktemp -d /tmp/servio-order-payload.XXXXXX)"
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/server.log" -o "-F -c listen_addresses='' -k $TMP" start >/dev/null
PSQL=("$BIN/psql" -X -q -h "$TMP" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/order_payload_security_fixture.sql"
python3 - "$ROOT" "$TMP/functions.sql" <<'PY'
import pathlib,re,sys
root=pathlib.Path(sys.argv[1])/'supabase/migrations'
items=[
 ('20261003105039_compact_order_payload_server_guard.sql',['compact_order_items_payload','compact_order_items_before_write']),
 ('20261018110000_validate_order_addon_selections.sql',['prevent_order_with_unavailable_menu_items']),
 ('20261031064000_allow_historical_payment_updates.sql',['validate_order_pricing_and_split']),
 ('20261024120000_branches_and_cashier_order_isolation.sql',['create_public_order','create_public_waiter_call','create_public_feedback']),
 ('20261030080000_customer_tracking_reviews.sql',['get_public_order_tracking']),
 ('20261102114000_harden_customer_order_submission.sql',['compact_public_order_items','create_public_order_with_tracking']),
]
out=[]
for filename,names in items:
 text=(root/filename).read_text()
 for name in names:
  pattern=r'(?is)create\s+(?:or\s+replace\s+)?function\s+public\.'+re.escape(name)+r'\s*\(.*?\bas\s*(\$[a-z_]*\$).*?\1\s*;'
  matches=list(re.finditer(pattern,text))
  if len(matches)!=(2 if name=='create_public_order_with_tracking' else 1): raise SystemExit(f'unexpected definitions {filename}:{name}: {len(matches)}')
  out.extend(m.group(0) for m in matches)
out += [
 'REVOKE ALL ON FUNCTION public.compact_public_order_items(jsonb) FROM PUBLIC,anon,authenticated;',
 'REVOKE ALL ON FUNCTION public.prevent_order_with_unavailable_menu_items() FROM PUBLIC,anon,authenticated;',
 'REVOKE ALL ON FUNCTION public.validate_order_pricing_and_split() FROM PUBLIC,anon,authenticated;',
 'REVOKE ALL ON FUNCTION public.create_public_order(text,jsonb,numeric,text,text,text),public.create_public_waiter_call(text,text,text,text),public.create_public_feedback(text,text,numeric,text[],text,text),public.get_public_order_tracking(text,uuid,text),public.create_public_order_with_tracking(text,jsonb,numeric,text,text,text),public.create_public_order_with_tracking(text,jsonb,numeric,text,text) FROM PUBLIC;',
 'GRANT EXECUTE ON FUNCTION public.create_public_order(text,jsonb,numeric,text,text,text),public.create_public_waiter_call(text,text,text,text),public.create_public_feedback(text,text,numeric,text[],text,text),public.get_public_order_tracking(text,uuid,text),public.create_public_order_with_tracking(text,jsonb,numeric,text,text,text),public.create_public_order_with_tracking(text,jsonb,numeric,text,text) TO anon,authenticated;',
 'CREATE TRIGGER orders_compact_items_before_write BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.compact_order_items_before_write();',
 'CREATE TRIGGER orders_prevent_unavailable_menu_items BEFORE INSERT OR UPDATE OF items ON public.orders FOR EACH ROW EXECUTE FUNCTION public.prevent_order_with_unavailable_menu_items();',
 'CREATE TRIGGER orders_validate_pricing_and_split BEFORE INSERT OR UPDATE OF items,total_price,payment_status,payment_method,cash_amount,card_amount ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_pricing_and_split();'
]
pathlib.Path(sys.argv[2]).write_text('\n'.join(out)+'\n')
PY
"${PSQL[@]}" -f "$TMP/functions.sql"
# Apply the real wrapping migration (other platform/block policies are outside this fixture).
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122030000_enforce_subscription_dates.sql"
"${PSQL[@]}" -v phase=baseline -f "$ROOT/supabase/tests/order_payload_security_checks.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122090000_secure_order_payload.sql"
"${PSQL[@]}" -v phase=secured -f "$ROOT/supabase/tests/order_payload_security_checks.sql"
echo 'PASS: baseline exploit reproduced; patched RPC/trigger, accounting, add-on, subscription and role checks passed (synthetic PostgreSQL)'
