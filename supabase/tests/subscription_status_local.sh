#!/usr/bin/env bash
# Disposable PostgreSQL over a Unix socket only; never reads production credentials.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(pg_config --bindir)"
for name in ${!PG@}; do unset "$name"; done
TMP="$(mktemp -d /tmp/servio-subscription-status.XXXXXX)"
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/server.log" -o "-F -c listen_addresses='' -k $TMP" start >/dev/null
PSQL=("$BIN/psql" -X -q -h "$TMP" -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
for file in \
  supabase/tests/subscriptions_fixture.sql \
  supabase/tests/subscription_dates_fixture.sql \
  supabase/tests/subscription_status_fixture.sql \
  supabase/migrations/20261121130000_tenant_subscriptions_and_branch_limits.sql \
  supabase/migrations/20261122020000_owner_user_blocks.sql \
  supabase/migrations/20261122030000_enforce_subscription_dates.sql \
  supabase/migrations/20261122040000_account_deletion_guards.sql \
  supabase/migrations/20261122050000_subscription_audit.sql \
  supabase/migrations/20261122070000_subscription_status.sql \
  supabase/tests/subscription_status_checks.sql; do
  "${PSQL[@]}" -f "$ROOT/$file" >/dev/null
done
echo 'PASS: isolated self-only subscription status, ACLs, boundaries, block guard, data retention and renewal'
