import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { ownerError } from "./ownerApi";
import { useOwnerLanguage } from "./OwnerLocale";

export default function AccountActionDialog({ action, user, busy, error, onClose, onConfirm }) {
  const { text, arabic } = useOwnerLanguage();
  const deleting = action === "delete_user";
  const banning = action === "ban_user";
  const title = deleting ? text("حذف حساب المستخدم؟", "Delete this user account?") : banning ? text("حظر هذا الحساب؟", "Ban this account?") : text("فك حظر هذا الحساب؟", "Unban this account?");
  const label = deleting ? text("نعم، احذف الحساب", "Yes, delete account") : banning ? text("تأكيد الحظر", "Confirm ban") : text("تأكيد فك الحظر", "Confirm unban");
  return <Dialog className="owner-dialog" open={Boolean(action && user)} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="account-action-title">
    <DialogTitle id="account-action-title" sx={{ fontWeight: 900 }}>{title}</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 2, overflowWrap: "anywhere" }} dir="auto">{user?.email || user?.id}</Typography>
      <Alert severity={deleting ? "error" : "warning"} sx={{ mb: 2 }}>{deleting
        ? text("تحذير: هذا الإجراء يحذف حساب المستخدم وقد يؤثر في البيانات المرتبطة به. قد يتعذر التراجع عنه. تأكد من الحساب قبل المتابعة.", "Warning: this deletes the user account and may affect related data. It may not be reversible. Verify the account before proceeding.")
        : banning ? text("سيُمنع هذا المستخدم من تسجيل الدخول إلى حسابه.", "This user will be prevented from signing in.") : text("ستتم إزالة حظر هذا المستخدم والسماح له بتسجيل الدخول مجددًا.", "This removes the ban and allows the user to sign in again.")}</Alert>
      {error && <Alert severity="error">{ownerError(error, arabic)}</Alert>}
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>{text("إغلاق", "Close")}</Button><Button variant="contained" color={deleting || banning ? "error" : "primary"} disabled={busy || error?.requiresReconciliation} onClick={onConfirm}>{busy ? text("جارٍ التنفيذ...", "Processing...") : label}</Button></DialogActions>
  </Dialog>;
}
