import { useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tab, Tabs, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useBranch } from "../../context/BranchContext";
import { useLanguage } from "../../context/LanguageContext";

export default function BranchTabs() {
  const { branches, selectedBranch, selectedBranchId, selectBranch, createBranch, renameBranch, deleteBranch,
    creationReason, loading, error: loadError, reloadBranches } = useBranch();
  const { language } = useLanguage();
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const ar = language !== "en";

  const openDialog = (mode) => {
    setName(mode === "edit" ? selectedBranch?.name || "" : "");
    setError("");
    setDialog({ mode, branchId: mode === "create" ? null : selectedBranchId, branchName: selectedBranch?.name || "" });
  };
  const closeDialog = () => {
    if (submitting.current) return;
    setDialog(null);
    setName("");
    setError("");
  };
  const messageForError = (failure) => {
    if (failure?.message === "branch_has_records") return ar ? "لا يمكن حذف الفرع لأنه يحتوي على سجلات مرتبطة. لم تُحذف أي بيانات." : "This branch has linked records and cannot be deleted. No data was deleted.";
    if (failure?.message === "branch_main") return ar ? "لا يمكن حذف الفرع الرئيسي." : "The main branch cannot be deleted.";
    if (failure?.message === "branch_last") return ar ? "لا يمكن حذف الفرع الأخير." : "The last branch cannot be deleted.";
    if (failure?.message === "branch_not_found" || failure?.code === "unavailable") return ar ? "الفرع غير متاح أو تغيّر. أعد تحميل الفروع وحاول مجددًا." : "The branch is unavailable or has changed. Reload branches and try again.";
    if (failure?.message === "branch_reference_unprotected" || failure?.message === "branch_isolation_unsupported") return ar ? "تعذر التحقق من سلامة الحذف. لم يُحذف الفرع؛ تواصل مع الدعم." : "Deletion could not be verified as safe. The branch was not deleted; contact support.";
    if (failure?.code === "42501") return ar ? "يتطلب حذف الفرع صلاحية مدير النشاط." : "Deleting a branch requires business administrator permissions.";
    if (failure?.code === "40P01" || failure?.code === "55P03" || failure?.code === "40001") return ar ? "تعذر إتمام التغيير بسبب عملية أخرى جارية. حاول مجددًا." : "Another operation prevented this change. Please try again.";
    if (failure?.code === "invalid_name") return ar ? "يجب أن يتكون اسم الفرع من ٢ إلى ١٢٠ حرفًا." : "Branch name must be 2–120 characters.";
    if (failure?.code === "plan_unknown" || failure?.code === "plan_limit" || failure?.code === "branch_limit") return ar ? "لا يمكن إضافة فرع آخر بالخطة أو الحد المتاح حاليًا." : "Another branch is not available under the currently confirmed plan or branch limit.";
    if (failure?.code === "busy") return ar ? "يجري حفظ تغيير آخر للفرع. حاول مجددًا." : "Another branch change is being saved. Please try again.";
    return dialog?.mode === "delete"
      ? (ar ? "تعذر تأكيد حذف الفرع. أعد تحميل الفروع للتحقق قبل المحاولة مجددًا." : "Could not confirm branch deletion. Reload branches to check before trying again.")
      : (ar ? "تعذر حفظ الفرع. تحقق من الاتصال والصلاحيات ثم حاول مجددًا." : "Could not save the branch. Check your connection and permissions, then try again.");
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!dialog || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const result = dialog.mode === "delete"
        ? await deleteBranch(dialog.branchId)
        : dialog.mode === "edit"
        ? await renameBranch(dialog.branchId, name)
        : await createBranch(name);
      if (result?.error) {
        setError(messageForError(result.error));
        return;
      }
      setDialog(null);
      setName("");
    } catch {
      setError(messageForError(null));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return <>
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: .75, borderRadius: 3, bgcolor: "rgba(255,255,255,.72)", border: "1px solid", borderColor: "divider", overflowX: "auto" }}>
        <Tabs value={selectedBranchId || false} onChange={(_, value) => selectBranch(value)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 44, flex: 1, "& .MuiTab-root": { minHeight: 44, fontWeight: 850, whiteSpace: "nowrap" } }} aria-label={ar ? "فروع النشاط" : "Business branches"}>
          {branches.map((branch) => <Tab key={branch.id} value={branch.id} label={branch.name} />)}
        </Tabs>
        <IconButton aria-label={ar ? "تعديل اسم الفرع المحدد" : "Rename selected branch"} title={ar ? "تعديل اسم الفرع المحدد" : "Rename selected branch"} onClick={() => openDialog("edit")} disabled={!selectedBranch || loading}>
          <EditOutlinedIcon />
        </IconButton>
        <IconButton aria-label={ar ? "حذف الفرع المحدد" : "Delete selected branch"} title={ar ? "حذف الفرع المحدد" : "Delete selected branch"} onClick={() => openDialog("delete")} disabled={!selectedBranch || loading}>
          <DeleteOutlineRoundedIcon />
        </IconButton>
        <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openDialog("create")} disabled={creationReason !== "allowed"} sx={{ flexShrink: 0, borderRadius: 2, fontWeight: 850, whiteSpace: "nowrap" }}>{ar ? "إضافة فرع" : "Add branch"}</Button>
      </Box>
      {loadError && <Alert severity="error" sx={{ mt: 1 }} action={<Button color="inherit" size="small" onClick={() => void reloadBranches()}>{ar ? "إعادة المحاولة" : "Retry"}</Button>}>{ar ? "تعذر تحميل الفروع." : "Could not load branches."}</Alert>}
      {!loading && !loadError && creationReason === "plan_unknown" && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{ar ? "تعذّر التحقق من الخطة لإضافة فرع آخر. يمكنك متابعة استخدام الفروع الحالية." : "The plan could not be confirmed for adding another branch. Existing branches remain available."}</Typography>}
      {!loading && !loadError && creationReason === "plan_limit" && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{ar ? "إضافة فروع أخرى تتطلب تأكيد خطة Pro. يمكنك متابعة استخدام الفروع الحالية." : "Adding branches requires a confirmed Pro plan. Existing branches remain available."}</Typography>}
      {!loading && !loadError && creationReason === "branch_limit" && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{ar ? "الحد الأقصى ٣ فروع إجمالاً، بما في ذلك الفروع غير النشطة." : "The maximum is 3 branches in total, including inactive branches."}</Typography>}
      {!loading && !loadError && branches.length === 0 && creationReason === "allowed" && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{ar ? "أضف الفرع الأول للبدء." : "Add your first branch to get started."}</Typography>}
      {!loading && !loadError && branches.length === 0 && creationReason !== "allowed" && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{ar ? "لا توجد فروع نشطة. تواصل مع الدعم لاستعادة الوصول." : "There are no active branches. Contact support to restore access."}</Typography>}
    </Box>
    <Dialog open={Boolean(dialog)} onClose={closeDialog} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{dialog?.mode === "delete" ? (ar ? "حذف الفرع" : "Delete branch") : dialog?.mode === "edit" ? (ar ? "تعديل اسم الفرع" : "Rename branch") : (ar ? "إضافة فرع" : "Add branch")}</DialogTitle>
        <DialogContent>
          {dialog?.mode === "delete" && <>
            <Typography variant="body2" sx={{ mb: 1 }}>{ar ? `هل تريد حذف «${dialog.branchName}»؟` : `Delete “${dialog.branchName}”?`}</Typography>
            <Typography variant="body2" color="text.secondary">{ar ? "يمكن حذف فرع فارغ فقط، دون أي سجلات مرتبطة مثل الطلبات أو القائمة أو الطاولات أو الموظفين أو العروض أو الإشعارات. لا يمكن حذف الفرع الرئيسي أو الأخير." : "Only an empty branch can be deleted, with no linked records such as orders, menus, tables, staff, promotions or notifications. The main or last branch cannot be deleted."}</Typography>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </>}
          {dialog?.mode === "edit" && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{ar ? "يتغير الاسم فقط؛ يبقى رابط الفرع وبياناته كما هي." : "Only the name changes; the branch link and data stay the same."}</Typography>}
          {dialog?.mode !== "delete" && <TextField autoFocus fullWidth required margin="dense" label={ar ? "اسم الفرع" : "Branch name"} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} error={Boolean(error)} helperText={error || (ar ? "من ٢ إلى ١٢٠ حرفًا" : "2–120 characters")} disabled={saving} />}
        </DialogContent>
        <DialogActions>
          {dialog?.mode === "delete" && error && <Button disabled={saving} onClick={() => { closeDialog(); void reloadBranches(); }}>{ar ? "إعادة تحميل الفروع" : "Reload branches"}</Button>}
          <Button onClick={closeDialog} disabled={saving}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button type="submit" variant="contained" color={dialog?.mode === "delete" ? "error" : "primary"} disabled={saving}>{saving ? (ar ? "جارٍ التنفيذ..." : "Working...") : dialog?.mode === "delete" ? (ar ? "حذف الفرع الفارغ" : "Delete empty branch") : (ar ? "حفظ" : "Save")}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  </>;
}
