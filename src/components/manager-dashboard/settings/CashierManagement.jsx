// إدارة حسابات الكاشير المنفصلة التابعة لنشاط واحد.
import { useCallback, useEffect, useState } from "react";
import { Alert, Avatar, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import EditIcon from "@mui/icons-material/Edit";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import supabase from "../../../supabase";
import { useStore } from "../../../context/StoreInfoContext";
import { useTenant } from "../../../context/TenantContext";
import { useBranch } from "../../../context/BranchContext";
import { useLanguage } from "../../../context/LanguageContext";

const emptyForm = { full_name: "", username: "", pin: "", branch_id: "" };

function CashierManagement() {
  const { t, language } = useLanguage();
  const ar = language === "ar";
  const { storeInfo } = useStore();
  const { tenantId } = useTenant();
  const { branches, selectedBranchId: activeBranchId } = useBranch();
  const [cashiers, setCashiers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showPin, setShowPin] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [copied, setCopied] = useState(false);

  const loginLink = storeInfo?.store_slug ? `${window.location.origin}/cashier/${storeInfo.store_slug}` : "";
  const activeCashiers = cashiers.filter((cashier) => cashier.is_active);

  const loadCashiers = useCallback(async () => {
    if (!tenantId) {
      setCashiers([]);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      const { data, error: loadError } = await supabase.from("cashiers")
        .select("id, full_name, username, branch_id, created_at, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (loadError) setError(loadError.message);
      else setCashiers(data || []);
    } catch (loadFailure) {
      setError(loadFailure?.message || t("genericLoginError"));
    } finally {
      setListLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => { void loadCashiers(); }, [loadCashiers]);
  useEffect(() => {
    if (activeBranchId && !form.branch_id) setForm((previous) => ({ ...previous, branch_id: activeBranchId }));
  }, [activeBranchId, form.branch_id]);

  const generatePin = () => setForm((previous) => ({ ...previous, pin: String(Math.floor(1000 + Math.random() * 9000)) }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(loginLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(ar ? "تعذر نسخ الرابط. انسخه يدويًا من الحقل." : "Could not copy the link. Copy it manually from the field.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const username = form.username.trim().toLowerCase();
    if (!form.branch_id || form.full_name.trim().length < 2 || !username || !/^[a-z0-9._-]{3,40}$/.test(username) || (editingId ? (form.pin && !/^\d{4,6}$/.test(form.pin)) : !/^\d{4,6}$/.test(form.pin))) {
      setError(t("managerCashierValidation"));
      return;
    }

    setLoading(true);
    try {
      const cashierPayload = { p_full_name: form.full_name.trim(), p_username: username, p_pin: form.pin || null, p_branch_id: form.branch_id };
      const { data: savedCashier, error: saveError } = editingId
        ? await supabase.rpc("update_cashier", { p_cashier_id: editingId, ...cashierPayload })
        : await supabase.rpc("create_cashier", { ...cashierPayload, p_pin: form.pin });
      if (saveError) {
        setError(saveError.code === "23505" ? t("managerDuplicateUsername") : saveError.message || t("genericLoginError"));
      } else {
        const created = !editingId && (Array.isArray(savedCashier) ? savedCashier[0] : savedCashier);
        if (created?.id) setCashiers((previous) => [{ ...created, is_active: true }, ...previous.filter((cashier) => cashier.id !== created.id)]);
        setMessage(editingId
          ? (ar ? "تم حفظ تعديل الكاشير ونقله إلى الفرع المحدد." : "Cashier updated and assigned to the selected branch.")
          : `${t("managerCashierCreated")}: ${username} — PIN: ${form.pin}`);
        setForm({ ...emptyForm, branch_id: activeBranchId || "" });
        setEditingId(null);
        await loadCashiers();
        if (created?.id) setCashiers((previous) => previous.some((cashier) => cashier.id === created.id) ? previous : [{ ...created, is_active: true }, ...previous]);
      }
    } catch (createError) {
      setError(createError?.message || t("genericLoginError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cashier) => {
    const confirmation = `${t("managerCashierDeleteConfirm")} ${cashier.full_name}?`;
    if (!window.confirm(confirmation)) return;
    setDeletingId(cashier.id);
    setError("");
    setMessage("");
    try {
      const { data, error: functionError } = await supabase.functions.invoke("cashier-delete", {
        body: { cashier_id: cashier.id },
      });
      if (functionError || data?.error) {
        setError(data?.error || functionError?.message || t("managerCashierDeleteFailed"));
        await loadCashiers();
        return;
      }
      setMessage(t("managerCashierDeleted"));
      await loadCashiers();
    } catch (deleteError) {
      setError(deleteError?.message || t("managerCashierDeleteFailed"));
      await loadCashiers();
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (cashier) => {
    setEditingId(cashier.id);
    setForm({ full_name: cashier.full_name || "", username: cashier.username || "", pin: "", branch_id: cashier.branch_id || activeBranchId || "" });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...emptyForm, branch_id: activeBranchId || "" });
  };

  const cashierRow = (cashier) => (
    <Paper key={cashier.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "center", gap: 1.25 }}>
      <Avatar sx={{ bgcolor: "primary.main" }}>{(cashier.full_name || "?").trim().charAt(0)}</Avatar>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }} noWrap>{cashier.full_name}</Typography>
        <Stack direction="row" useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", columnGap: 1, rowGap: 0.4, mt: 0.25 }}>
          <Typography variant="body2" color="text.secondary" sx={{ direction: "ltr" }} noWrap>@{cashier.username}</Typography>
          <Chip size="small" label={branches.find((branch) => branch.id === cashier.branch_id)?.name || "—"} sx={{ maxWidth: "100%", height: 23, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }} />
        </Stack>
      </Box>
      <Stack direction="row" spacing={0.25}>
        <Tooltip title={ar ? "تعديل بيانات الكاشير والفرع" : "Edit cashier and branch"}>
          <span><IconButton color="primary" aria-label={ar ? "تعديل الكاشير" : "Edit cashier"} disabled={deletingId === cashier.id} onClick={() => startEdit(cashier)}><EditIcon fontSize="small" /></IconButton></span>
        </Tooltip>
        <Tooltip title={t("managerCashierDelete")}>
          <span>
            <IconButton color="error" aria-label={t("managerCashierDelete")} disabled={deletingId === cashier.id} onClick={() => handleDelete(cashier)}>
              {deletingId === cashier.id ? <AutorenewIcon fontSize="small" /> : <PersonRemoveIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );

  return (
    <Box sx={{ maxWidth: 920, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 1.5, mb: 2.25 }}>
        <Box>
          <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 850, letterSpacing: ar ? 0 : ".08em" }}>{ar ? "صلاحيات الفريق" : "TEAM ACCESS"}</Typography>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 900, mt: -0.5 }}>{t("managerCashierTitle")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{t("managerCashierHint")}</Typography>
        </Box>
        <Chip variant="outlined" color="primary" label={`${activeCashiers.length} ${ar ? "كاشير نشط" : "active cashiers"}`} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, fontWeight: 800 }} />
      </Stack>
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loginLink && <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">{t("managerCashierLink")}</Typography>
          <Typography variant="body2" sx={{ direction: "ltr", textAlign: "right", overflowWrap: "anywhere", fontWeight: 600 }}>{loginLink}</Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={copyLink}>{copied ? t("managerCopied") : t("managerCopy")}</Button>
      </Paper>}

      <Paper component="form" onSubmit={handleSubmit} variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3, mb: 3 }}>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 850, mb: 2 }}>{editingId ? (ar ? "تعديل بيانات الكاشير" : "Edit cashier details") : t("managerAddCashier")}</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <TextField size="small" fullWidth required select label={ar ? "فرع الكاشير" : "Cashier branch"} value={form.branch_id} onChange={(event) => setForm({ ...form, branch_id: event.target.value })} helperText={ar ? "ستظهر طلبات هذا الكاشير ووردياته ضمن الفرع المحدد." : "This cashier's orders and shifts are scoped to this branch."}>
            {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
          </TextField>
          <TextField name="full_name" size="small" fullWidth required label={t("managerFullName")} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
          <TextField name="username" size="small" fullWidth required label={t("managerUsername")} helperText={t("managerUsernameHint")}  value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase().replace(/\s/g, "") })}  slotProps={{ htmlInput: { dir: "ltr", minLength: 3, maxLength: 40 } }}/>
          <TextField name="pin" size="small" fullWidth required={!editingId} label={editingId ? (ar ? "PIN جديد (اختياري)" : "New PIN (optional)") : t("managerPin")} type={showPin ? "text" : "password"}  value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, "") })}   slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 6, dir: "ltr" }, input: { endAdornment: <InputAdornment position="end"><Tooltip title={t("managerGeneratePin")}><IconButton size="small" onClick={generatePin} color="primary"><AutorenewIcon fontSize="small" /></IconButton></Tooltip><IconButton size="small" onClick={() => setShowPin((value) => !value)} aria-label={showPin ? (ar ? "إخفاء PIN" : "Hide PIN") : (ar ? "إظهار PIN" : "Show PIN")}>{showPin ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> } }}/>
          <Stack direction="row" spacing={1}><Button type="submit" variant="contained" disabled={loading} startIcon={editingId ? <EditIcon /> : <PersonAddAltIcon />} sx={{ fontWeight: 700, py: 1 }}>{loading ? t("managerSaving") : editingId ? (ar ? "حفظ التعديل" : "Save changes") : t("managerAddCashier")}</Button>{editingId && <Button type="button" variant="outlined" onClick={cancelEdit}>{ar ? "إلغاء" : "Cancel"}</Button>}</Stack>
        </Box>
      </Paper>

      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.25 }}>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 850 }}>{t("managerRegisteredCashiers")}</Typography>
        <Typography variant="caption" color="text.secondary">{activeCashiers.length}</Typography>
      </Stack>
      {listLoading
        ? <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "center", py: 4 }}><CircularProgress size={20} /><Typography color="text.secondary">{ar ? "جارٍ تحميل الكاشير..." : "Loading cashiers..."}</Typography></Stack>
        : <Stack spacing={1}>
          {activeCashiers.map((cashier) => cashierRow(cashier))}
          {activeCashiers.length === 0 && <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderRadius: 3 }}>
            <Typography variant="body2" color="text.secondary">{t("managerNoCashiers")}</Typography>
          </Paper>}
        </Stack>}

    </Box>
  );
}

export default CashierManagement;
