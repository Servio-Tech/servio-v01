// The backend must explicitly affirm owner access; a successful HTTP response alone is not enough.
export function isOwnerResponse(data) {
  if (!data || typeof data !== "object" || data.error || data.authorized === false || data.is_owner === false || data.owner === false || data.success === false || data.ok === false) return false;
  return data.authorized === true || data.is_owner === true || data.owner === true;
}

export function needsReconciliation(action, status, code) {
  const partialCodes = ["BAN_PARTIALLY_ENFORCED", "BLOCK_RECONCILIATION_REQUIRED", "DELETION_RECONCILIATION_REQUIRED", "AUDIT_INCOMPLETE", "SERVICE_UNAVAILABLE"];
  const noChangeCodes = ["GUARD_UNAVAILABLE", "AUDIT_UNAVAILABLE", "BLOCK_NOT_STARTED", "DELETION_NOT_STARTED", "NOT_CONFIGURED"];
  return !["me", "list"].includes(action) && (partialCodes.includes(code) || ((!status || status >= 500) && !noChangeCodes.includes(code)));
}

export function isBlocked(user, now = Date.now()) {
  if (user.blocked === true) return true;
  if (!user.banned_until) return false;
  const until = Date.parse(user.banned_until);
  return Number.isFinite(until) && until > now;
}

export function dateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function subscriptionPayload(tenantId, plan, start, end) {
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!tenantId || !["starter", "pro"].includes(plan) || !validDate(start) || !validDate(end) || start > end) return null;
  return { tenant_id: tenantId, plan, starts_at: `${start}T00:00:00.000Z`, ends_at: `${end}T23:59:59.999Z` };
}

export function matchesUser(user, search) {
  const query = String(search || "").trim().toLocaleLowerCase();
  if (!query) return true;
  return [user.id, user.email, user.tenant_name, user.tenant_slug, user.role, user.plan]
    .some((value) => String(value || "").toLocaleLowerCase().includes(query));
}

export function formatDate(value, arabic) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(arabic ? "ar-SA" : "en-GB", { year: "numeric", month: "short", day: "numeric", calendar: "gregory", timeZone: "UTC" }).format(date);
}
