#!/usr/bin/env bash
# Self-contained Unix-socket-only cluster. No connection URL or credentials are read.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(pg_config --bindir)"
# Prevent libpq environment settings from altering even local test connections.
for name in ${!PG@}; do unset "$name"; done
TMP="$(mktemp -d /tmp/servio-subscription-audit.XXXXXX)"
SOCKET="$TMP/socket"
mkdir -p "$SOCKET"
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/server.log" -o "-F -c listen_addresses='' -k $SOCKET" start >/dev/null
PSQL=("$BIN/psql" -X -q -h "$SOCKET" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscriptions_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_dates_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_audit_fixture.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261121130000_tenant_subscriptions_and_branch_limits.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122020000_owner_user_blocks.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122030000_enforce_subscription_dates.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122040000_account_deletion_guards.sql" >/dev/null
"${PSQL[@]}" -c "DO \$\$ BEGIN IF to_regprocedure('public.owner_set_subscription_audited(uuid,text,timestamptz,timestamptz)') IS NOT NULL THEN RAISE EXCEPTION 'audit RPC unexpectedly exists before migration'; END IF; END \$\$;" >/dev/null
SERVIO_AUDIT_TEST_PHASE=before SERVIO_AUDIT_TEST_SOCKET="$SOCKET" SERVIO_AUDIT_TEST_PSQL="$BIN/psql" SERVIO_AUDIT_TEST_USER="$(id -un)" node --test "$ROOT/supabase/tests/subscription_audit_edge.test.mjs"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122050000_subscription_audit.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_audit_checks.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122110000_owner_subscription_idempotent_v1.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/subscription_idempotency_checks.sql" >/dev/null
echo 'PASS: subscription idempotency privileges, replay, payload conflict, current-state replay, and rollback'

# Two separate sessions use the exact same key/payload. The first retains the
# tenant row lock after the RPC returns so the second is forced to wait/replay.
tenant='00000000-0000-0000-0000-00000000000a'
key='40000000-0000-0000-0000-00000000000a'
"${PSQL[@]}" -c "INSERT INTO public.tenants(id,name,slug) VALUES ('$tenant','Idempotency race','idempotency-race');" >/dev/null
marker="$TMP/idempotency-ready"
"${PSQL[@]}" >"$TMP/idempotency-a.log" 2>&1 <<EOF &
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',false);
SELECT public.owner_set_subscription_idempotent_v1('$tenant','pro','2035-01-01','2035-12-31','$key');
\\! touch '$marker'
SELECT pg_sleep(2);
COMMIT;
EOF
pid=$!
for _ in $(seq 1 100); do [[ -f "$marker" ]] && break; sleep 0.05; done
[[ -f "$marker" ]] || { cat "$TMP/idempotency-a.log"; echo 'idempotency race setup failed' >&2; exit 1; }
"${PSQL[@]}" >"$TMP/idempotency-b.log" 2>&1 <<EOF
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',false);
SELECT public.owner_set_subscription_idempotent_v1('$tenant','pro','2035-01-01','2035-12-31','$key');
EOF
wait "$pid" || { cat "$TMP/idempotency-a.log"; exit 1; }
[[ "$("${PSQL[@]}" -t -A -c "SELECT count(*) FROM public.platform_subscription_idempotency WHERE actor_id='10000000-0000-0000-0000-000000000002' AND idempotency_key='$key'")" == 1 ]] || { cat "$TMP/idempotency-b.log"; echo 'concurrent calls stored more than one key' >&2; exit 1; }
[[ "$("${PSQL[@]}" -t -A -c "SELECT count(*) FROM public.platform_owner_audit WHERE target_tenant_id='$tenant' AND action='set_subscription' AND outcome='completed'")" == 1 ]] || { cat "$TMP/idempotency-b.log"; echo 'concurrent replay created multiple audit events' >&2; exit 1; }
echo 'PASS: concurrent same-key requests serialize on the tenant and commit once'

# Preserve the previous tenant/branch locking contract after replacing the RPC.
for i in 6 7 8 9; do
  tenant="00000000-0000-0000-0000-00000000000$i"
  key="50000000-0000-0000-0000-00000000000$i"
  "${PSQL[@]}" -c "INSERT INTO public.tenants(id,name,slug) VALUES ('$tenant','Concurrency $i','concurrency-$i'); SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false); SELECT public.owner_set_subscription_idempotent_v1('$tenant','pro',now(),null,'$key');" >/dev/null
  if (( i < 8 )); then
    "${PSQL[@]}" -c "INSERT INTO public.branches(tenant_id,name,slug) VALUES ('$tenant','Second','second');" >/dev/null
  fi
done
race() {
  local i="$1" isolation="$2" kind="$3" tenant marker pid status count audit_count key
  tenant="00000000-0000-0000-0000-00000000000$i"
  key="60000000-0000-0000-0000-00000000000$i"
  marker="$TMP/ready-$i"
  "${PSQL[@]}" >"$TMP/a-$i.log" 2>&1 <<EOF &
BEGIN;
INSERT INTO public.branches(tenant_id,name,slug) VALUES ('$tenant','Concurrent A','concurrent-a');
\! touch '$marker'
SELECT pg_sleep(2);
COMMIT;
EOF
  pid=$!
  for _ in $(seq 1 100); do [[ -f "$marker" ]] && break; sleep 0.05; done
  if [[ ! -f "$marker" ]]; then cat "$TMP/a-$i.log"; wait "$pid" || true; echo 'race setup failed' >&2; exit 1; fi
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
SELECT public.owner_set_subscription_idempotent_v1('$tenant','starter',now(),null,'$key');
COMMIT;
EOF
  fi
  status=$?
  set -e
  if ! wait "$pid"; then cat "$TMP/a-$i.log"; exit 1; fi
  if [[ "$status" -eq 0 ]] || ! grep -Eqi 'Branch limit reached|Cannot downgrade to starter|could not serialize access' "$TMP/b-$i.log"; then
    cat "$TMP/b-$i.log"; echo "unexpected race outcome: $isolation $kind" >&2; exit 1
  fi
  count="$("${PSQL[@]}" -t -A -c "SELECT count(*) FROM public.branches WHERE tenant_id='$tenant'")"
  audit_count="$("${PSQL[@]}" -t -A -c "SELECT count(*) FROM public.platform_owner_audit WHERE target_tenant_id='$tenant' AND action='set_subscription' AND outcome='completed'")"
  [[ "$audit_count" == 1 ]] || { echo 'failed race produced a success audit' >&2; exit 1; }
  if [[ "$kind" == insert && "$count" != 3 ]] || [[ "$kind" == downgrade && "$count" != 2 ]]; then echo "incorrect race branch count: $count" >&2; exit 1; fi
  if [[ "$kind" == downgrade ]]; then
    [[ "$("${PSQL[@]}" -t -A -c "SELECT plan FROM public.tenant_subscriptions WHERE tenant_id='$tenant'")" == pro ]] || { echo 'unsafe downgrade' >&2; exit 1; }
  fi
  echo "PASS: $kind race under $isolation, audit unchanged"
}
race 6 'READ COMMITTED' insert
race 7 'REPEATABLE READ' insert
race 8 'READ COMMITTED' downgrade
race 9 'REPEATABLE READ' downgrade

SERVIO_AUDIT_TEST_PHASE=after SERVIO_AUDIT_TEST_SOCKET="$SOCKET" SERVIO_AUDIT_TEST_PSQL="$BIN/psql" SERVIO_AUDIT_TEST_USER="$(id -un)" node --test "$ROOT/supabase/tests/subscription_audit_edge.test.mjs"
echo 'PASS: disposable PostgreSQL subscription audit suite (no network database connection)'
