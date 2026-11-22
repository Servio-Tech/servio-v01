import supabase from "../../supabase";
import { isOwnerResponse, needsReconciliation } from "./ownerUtils";

export async function callOwner(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("owner-admin", { body: { action, ...payload } });
  if (error || data?.error || data?.success === false || data?.ok === false) {
    let message = typeof data?.error === "string" ? data.error : "";
    let code = data?.code;
    const status = error?.context?.status;
    if (!message && error?.context && typeof error.context.json === "function") {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === "string") message = body.error;
      code = body?.code;
    }
    const failure = new Error(message || error?.message || "Owner service request failed");
    failure.status = status;
    failure.code = code;
    failure.requiresReconciliation = needsReconciliation(action, status, code);
    throw failure;
  }
  return data;
}

export async function verifyOwner() {
  const data = await callOwner("me");
  if (!isOwnerResponse(data)) {
    const failure = new Error("Owner authorization was not confirmed");
    failure.status = 403;
    throw failure;
  }
  return data;
}

export function ownerError(error, arabic) {
  const messages = {
    NOT_CONFIGURED: ["خدمة المالك غير مهيأة على الخادم.", "The owner service is not configured on the server."],
    LIST_UNAVAILABLE: ["تعذر تحميل حسابات المستخدمين من الخادم.", "The server could not load user accounts."],
    DETAILS_UNAVAILABLE: ["تعذر تحميل تفاصيل الحسابات والأنشطة من الخادم.", "The server could not load account and business details."],
    INVALID_PAGE: ["رقم الصفحة غير صالح.", "The page number is invalid."],
    INVALID_USER: ["معرف المستخدم غير صالح.", "The user ID is invalid."],
    OWNER_PROTECTED: ["حساب المالك محمي ولا يمكن تنفيذ هذا الإجراء عليه.", "The owner account is protected from this action."],
    INVALID_SUBSCRIPTION: ["بيانات الاشتراك غير صالحة. راجع الباقة والتواريخ.", "Invalid subscription details. Check the plan and dates."],
    SUBSCRIPTION_REJECTED: ["رفض الخادم تعديل الاشتراك. تحقق من النشاط والباقة وحالة الاشتراك قبل الإعادة.", "The server rejected the subscription change. Verify the business, plan, and subscription state before retrying."],
    SUBSCRIPTION_UNCERTAIN: ["نتيجة الاشتراك غير مؤكدة. أعد المحاولة من النافذة نفسها وبالحمولة والمفتاح نفسيهما.", "The subscription outcome is uncertain. Retry from this dialog with the same payload and key."],
    IDEMPOTENCY_KEY_CONFLICT: ["استُخدم مفتاح المحاولة سابقًا مع بيانات مختلفة. لا تغيّر المفتاح أو الحمولة عشوائيًا؛ طابق الحالة أولًا.", "This retry key was already used with different data. Do not change the key or payload blindly; reconcile the state first."],
    USER_NOT_FOUND: ["الحساب غير موجود أو لم يعد متاحًا.", "The account does not exist or is no longer available."],
    DELETION_BLOCKED: ["لا يمكن حذف الحساب لارتباطه ببيانات محفوظة أو عملية أخرى.", "The account cannot be deleted because it is referenced by retained data or another operation."],
    DELETION_NOT_STARTED: ["تعذر بدء حذف الحساب؛ لم تُنفذ عملية الحذف.", "Account deletion could not be started; no deletion was made."],
    GUARD_UNAVAILABLE: ["حماية الحسابات غير مفعّلة؛ لم تُنفذ العملية.", "Account protection is not active; no change was made."],
    BLOCK_NOT_STARTED: ["تعذر بدء عملية الحظر أو فك الحظر؛ قد تكون هناك عملية أخرى جارية.", "The ban or unban could not be started; another operation may be in progress."],
    BAN_PARTIALLY_ENFORCED: ["تم حظر الدخول وقاعدة البيانات، لكن قد تستمر قنوات Realtime والإشعارات القائمة. يلزم تدخل المسؤول لاستكمال الحماية؛ تحقق قبل الإعادة.", "Sign-in and database access were blocked, but existing Realtime and push channels may remain active. Operator action is needed; verify before retrying."],
    BLOCK_RECONCILIATION_REQUIRED: ["قد تكون حالة الحظر تغيرت جزئيًا. يلزم تدخل المسؤول لمطابقة الحالات قبل إعادة المحاولة.", "The ban state may have changed partially. Operator reconciliation is required before retrying."],
    DELETION_RECONCILIATION_REQUIRED: ["نتيجة الحذف غير مؤكدة. يلزم تدخل المسؤول للتحقق قبل إعادة المحاولة.", "The deletion outcome is uncertain. Operator reconciliation is required before retrying."],
    AUDIT_INCOMPLETE: ["قد تكون العملية نُفذت، لكن تعذر إكمال سجل التدقيق. تحقق من الحالة قبل إعادة المحاولة.", "The operation may have completed, but the audit did not. Verify the state before retrying."],
    SERVICE_UNAVAILABLE: ["الخدمة غير متاحة؛ تحقق من حالة الحساب قبل إعادة أي عملية.", "The service is unavailable; verify the account state before retrying any operation."],
    AUDIT_UNAVAILABLE: ["تعذر إنشاء سجل التدقيق؛ لم تُنفذ العملية.", "The audit record could not be created; no change was made."],
  };
  if (messages[error?.code]) return messages[error.code][arabic ? 0 : 1];
  if (error?.requiresReconciliation) return arabic ? "تعذر تأكيد نتيجة العملية؛ تحقق من الحالة قبل إعادة المحاولة." : "The operation outcome could not be confirmed. Verify the state before retrying.";
  if (error?.status === 401) return arabic ? "انتهت الجلسة أو لم تعد صالحة. سجّل الدخول مجددًا." : "Your session is invalid or expired. Please sign in again.";
  if (error?.status === 403) return arabic ? "هذا الحساب غير مصرح له بالوصول إلى لوحة المالك." : "This account is not authorized to access the owner console.";
  if (error?.message && !/^(Edge Function returned|Failed to fetch|Failed to send a request|Owner service request failed|Owner authorization was not confirmed)/i.test(error.message)) return error.message;
  return arabic ? "تعذر الاتصال بخدمة المالك. تحقق من الاتصال أو حاول مجددًا." : "Unable to reach the owner service. Check your connection and try again.";
}
