import { useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Tab, Tabs, TextField, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useBranch } from "../../context/BranchContext";
import { useLanguage } from "../../context/LanguageContext";

export default function BranchTabs() {
  const {
    branches, selectedBranchId, selectBranch, createBranch, subscription,
    subscriptionLoading, subscriptionError, branchCount, branchLimit, reloadSubscription,
  } = useBranch();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const ar = language !== "en";

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await createBranch(name);
      if (result.error) { setError(result.error.message); return; }
      setName("");
      setError("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (subscriptionLoading) return null;
  if (subscriptionError) {
    return <Alert severity="warning" sx={{ mb: 2 }} action={
      <Button color="inherit" size="small" onClick={() => void reloadSubscription()}>
        {ar ? "إعادة المحاولة" : "Retry"}
      </Button>
    }>{ar ? "تعذّر تحميل معلومات الباقة. إضافة الفروع متوقفة مؤقتًا." : "Could not load your plan. Adding branches is temporarily unavailable."}</Alert>;
  }
  // Starter يحتفظ بالفرع الرئيسي وبكل الميزات، من دون شريط إدارة الفروع.
  if (subscription?.plan !== "pro") return null;

  const limitReached = branchCount == null || branchCount >= branchLimit;
  return <>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, p: .75, borderRadius: 3, bgcolor: "rgba(255,255,255,.72)", border: "1px solid", borderColor: "divider", overflowX: "auto" }}>
      <Tabs value={selectedBranchId || false} onChange={(_, value) => selectBranch(value)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 44, flex: 1, "& .MuiTab-root": { minHeight: 44, fontWeight: 850, whiteSpace: "nowrap" } }} aria-label={ar ? "فروع النشاط" : "Business branches"}>
        {branches.map((branch) => <Tab key={branch.id} value={branch.id} label={branch.name} />)}
      </Tabs>
      <Typography variant="caption" sx={{ flexShrink: 0, color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap" }}>
        {ar ? `${branchCount} من ${branchLimit} فروع` : `${branchCount} of ${branchLimit} branches`}
      </Typography>
      <Button size="small" variant="contained" disabled={limitReached} startIcon={<AddRoundedIcon />} onClick={() => { setError(""); setOpen(true); }} sx={{ flexShrink: 0, borderRadius: 2, fontWeight: 850, whiteSpace: "nowrap" }}>
        {ar ? "إضافة فرع" : "Add branch"}
      </Button>
    </Box>
    {limitReached && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1, mb: 2 }}>
      {ar ? "وصلت إلى الحد الأقصى للفروع في باقة Pro. تُحتسب الفروع غير النشطة أيضًا." : "Your Pro branch limit is reached. Inactive branches are also counted."}
    </Typography>}
    <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>{ar ? "إضافة فرع" : "Add branch"}</DialogTitle>
      <DialogContent><TextField autoFocus fullWidth margin="dense" label={ar ? "اسم الفرع" : "Branch name"} value={name} onChange={(event) => setName(event.target.value)} error={Boolean(error)} helperText={error} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} /></DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={() => setOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
        <Button disabled={saving} variant="contained" onClick={submit}>{ar ? "حفظ" : "Save"}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
