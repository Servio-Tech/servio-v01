// This diagnostic never grants access. RLS and RPC guards remain authoritative.
const SERVER_STATUSES = new Set(["active", "expired", "not_started", "missing", "unlinked"]);
export const SUBSCRIPTION_RECHECK_MS = 60_000;
export const SUBSCRIPTION_TIMEOUT_MS = 12_000;

export async function withSubscriptionTimeout(operation, ms = SUBSCRIPTION_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Subscription check timed out")), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function getOwnSubscriptionStatus(client) {
  try {
    const { data, error } = await withSubscriptionTimeout(() => client.rpc("platform_current_subscription_status"));
    return !error && SERVER_STATUSES.has(data) ? data : "unavailable";
  } catch {
    return "unavailable";
  }
}

// New registrations may have no profile yet. Provision only after the server
// says active or unlinked, and require an active status again before allowing UI.
export async function resolveSubscriptionProfile(client) {
  try {
    const { data, error } = await withSubscriptionTimeout(() => client.auth.getSession());
    if (error) return { status: "unavailable", profile: null };
    const userId = data?.session?.user?.id;
    if (!data?.session) return { status: "signed_out", profile: null };
    if (!userId) return { status: "unavailable", profile: null };
    const initial = await getOwnSubscriptionStatus(client);
    if (initial !== "active" && initial !== "unlinked") return { status: initial, profile: null };

    let profile = null;
    try {
      const result = await withSubscriptionTimeout(() => client.rpc("ensure_profile_for_current_user"));
      if (!result.error) profile = result.data;
    } catch { /* Status is rechecked; a timeout must not be called expiry. */ }
    const final = await getOwnSubscriptionStatus(client);
    if (final !== "active") return { status: final === "unlinked" ? "profile_unavailable" : final, profile: null };
    if (!profile?.id || profile.id !== userId || !profile.tenant_id) return { status: "profile_unavailable", profile: null };
    return { status: "active", profile };
  } catch {
    return { status: "unavailable", profile: null };
  }
}

export function subscriptionStatusMessage(status, arabic = true) {
  if (status === "expired") return arabic
    ? "انتهت مدة الاشتراك وتوقفت الخدمة مؤقتًا. حسابك وبياناتك محفوظة، ويعود الوصول بعد تجديد الاشتراك."
    : "The subscription has expired and service is temporarily suspended. Your account and data are retained, and access returns after renewal.";
  if (status === "not_started") return arabic
    ? "لم تبدأ مدة الاشتراك بعد، والخدمة متوقفة حاليًا. حسابك وبياناتك محفوظة؛ يعود الوصول عند بدء الاشتراك الساري."
    : "The subscription period has not started, so service is currently unavailable. Your account and data are retained; access returns when the subscription becomes active.";
  if (status === "missing") return arabic
    ? "لا يوجد سجل اشتراك لهذا الحساب حاليًا. حسابك وبياناتك محفوظة؛ تواصل مع الدعم للتحقق من الاشتراك."
    : "No subscription record is currently available for this account. Your account and data are retained; contact support to check the subscription.";
  return arabic
    ? "تعذر التحقق من حالة الحساب أو الاشتراك، لذلك لا يمكن فتح الخدمة الآن. هذا لا يعني أن الاشتراك انتهى ولا يحذف بياناتك. تحقق من الاتصال وحاول مجددًا."
    : "We could not verify your account or subscription, so service cannot be opened now. This does not mean the subscription has expired and does not delete your data. Check your connection and try again.";
}
