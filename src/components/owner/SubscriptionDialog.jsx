import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { dateInputValue, subscriptionPayload } from "./ownerUtils";
import { ownerError } from "./ownerApi";
import { useOwnerLanguage } from "./OwnerLocale";

export default function SubscriptionDialog({ user, busy, error, pendingAttempt, onClose, onSave }) {
  const { text, arabic } = useOwnerLanguage();
  const [plan, setPlan] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!user) return;
    const currentPlan = String(user.plan || "").toLowerCase();
    setPlan(["starter", "pro"].includes(currentPlan) ? currentPlan : "");
    setStart(dateInputValue(user.starts_at));
    setEnd(dateInputValue(user.ends_at));
    setInvalid(false);
    if (pendingAttempt?.payload?.tenant_id === user.tenant_id) {
      setPlan(pendingAttempt.payload.plan);
      setStart(dateInputValue(pendingAttempt.payload.starts_at));
      setEnd(dateInputValue(pendingAttempt.payload.ends_at));
    }
  }, [user, pendingAttempt]);

  function submit(event) {
    event.preventDefault();
    const payload = subscriptionPayload(user?.tenant_id, plan, start, end);
    if (!payload) { setInvalid(true); return; }
    setInvalid(false);
    onSave(payload);
  }

  return <Dialog className="owner-dialog" open={Boolean(user)} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="subscription-dialog-title">
    <Box component="form" onSubmit={submit}>
      <DialogTitle id="subscription-dialog-title" sx={{ fontWeight: 900 }}>{text("تعديل الاشتراك", "Edit subscription")}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>{user?.tenant_name || user?.email || "—"}</Typography>
        {!user?.tenant_id && <Alert severity="warning" sx={{ mb: 2 }}>{text("هذا المستخدم غير مرتبط بنشاط؛ لا يمكن تعديل اشتراكه.", "This user has no business; its subscription cannot be edited.")}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{ownerError(error, arabic)}</Alert>}
        {pendingAttempt && <Alert severity="warning" sx={{ mb: 2 }}>{text("هناك محاولة محفوظة. أعد إرسال الحمولة الأصلية بالمفتاح نفسه؛ لا تغيّر الحقول حتى تتأكد من النتيجة.", "A pending attempt is saved. Retry the original payload with the same key; do not change fields until its outcome is confirmed.")}</Alert>}
        {invalid && <Alert severity="warning" sx={{ mb: 2 }}>{text("اختر باقة وتاريخين صالحين، على أن يكون تاريخ النهاية بعد البداية أو مساويًا لها.", "Choose a plan and valid dates; the end date must not precede the start date.")}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>{text("يستبدل الحفظ الفترة الحالية فورًا ولا يجدول تجديدًا مستقلًا. إذا كانت البداية مستقبلية، تتجمد خدمة المنشأة حتى يحين موعدها.", "Saving immediately replaces the current period; it does not schedule a separate renewal. A future start freezes the business service until that date.")}</Alert>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select required fullWidth label={text("الباقة", "Plan")} value={plan} onChange={(event) => setPlan(event.target.value)} disabled={busy || Boolean(pendingAttempt) || !user?.tenant_id}>
            <MenuItem value="starter">Starter</MenuItem><MenuItem value="pro">Pro</MenuItem>
          </TextField>
          <TextField required fullWidth type="date" label={text("تاريخ البداية", "Start date")} value={start} onChange={(event) => setStart(event.target.value)} disabled={busy || Boolean(pendingAttempt) || !user?.tenant_id} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField required fullWidth type="date" label={text("تاريخ النهاية", "End date")} value={end} onChange={(event) => setEnd(event.target.value)} disabled={busy || Boolean(pendingAttempt) || !user?.tenant_id} slotProps={{ inputLabel: { shrink: true } }} />
          <Typography variant="caption" color="text.secondary">{text("التواريخ بالتوقيت العالمي UTC؛ يشمل الاشتراك يوم النهاية كاملًا.", "Dates use UTC; the subscription includes the full end date.")}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={busy}>{text("إغلاق", "Close")}</Button><Button type="submit" variant="contained" disabled={busy || !user?.tenant_id || error?.code === "IDEMPOTENCY_KEY_CONFLICT" || (error?.requiresReconciliation && !pendingAttempt)}>{busy ? text("جارٍ الحفظ...", "Saving...") : pendingAttempt ? text("إعادة المحاولة بالمفتاح نفسه", "Retry same attempt") : text("حفظ التغييرات", "Save changes")}</Button></DialogActions>
    </Box>
  </Dialog>;
}
