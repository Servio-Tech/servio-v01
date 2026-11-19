import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogContentText, DialogTitle, Divider,
  FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import supabase from "../../supabase";
import { useBranch } from "../../context/BranchContext";
import { useLanguage } from "../../context/LanguageContext";
import { useMenu } from "../../context/MenuContext";
import { useStore } from "../../context/StoreInfoContext";
import { useTenant } from "../../context/TenantContext";
import { isPromotionsUnavailableError, normalizePromotion, promotionStatus } from "../../utils/promotions";

const orange = "#d9541e";
const panel = { bgcolor: "#14213d", color: "#f7f8fc", border: "1px solid rgba(255,255,255,.09)", borderRadius: 3 };
const fieldSx = {
  "& .MuiInputLabel-root": { color: "#b8c1d4" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#ff9b72" },
  "& .MuiOutlinedInput-root": { color: "#fff", bgcolor: "rgba(0,0,0,.13)", "& fieldset": { borderColor: "rgba(255,255,255,.24)" }, "&:hover fieldset": { borderColor: "#ff9b72" }, "&.Mui-focused fieldset": { borderColor: orange } },
  "& .MuiFormHelperText-root": { color: "#b8c1d4" },
  "& .MuiSvgIcon-root": { color: "#b8c1d4" },
};
const blankForm = () => ({ title_ar: "", title_en: "", description_ar: "", description_en: "", discount_type: "percentage", discount_value: "", starts_at: "", ends_at: "", is_active: false, target_item_ids: [] });

function localInputDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  const millis = date.getMilliseconds() ? `.${String(date.getMilliseconds()).padStart(3, "0")}` : "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${millis}`;
}

function Promotions() {
  const { language } = useLanguage();
  const ar = language !== "en";
  const text = (arabic, english) => ar ? arabic : english;
  const { tenantId } = useTenant();
  const { selectedBranchId: branchId, selectedBranch } = useBranch();
  const { items = [], menuLoading, menuError, refreshMenu } = useMenu();
  const { storeInfo } = useStore();
  const scope = `${tenantId || ""}:${branchId || ""}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const requestRef = useRef(0);
  const operationRef = useRef(false);
  const [result, setResult] = useState({ scope: "", rows: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [now, setNow] = useState(Date.now());

  const rows = result.scope === scope ? result.rows : [];
  const branchItems = useMemo(() => items.filter((item) => item.tenant_id === tenantId && item.branch_id === branchId), [items, tenantId, branchId]);
  const itemsById = useMemo(() => new Map(branchItems.map((item) => [String(item.id), item])), [branchItems]);
  const selectedItems = useMemo(() => form.target_item_ids.map((id) => itemsById.get(String(id))).filter(Boolean), [form.target_item_ids, itemsById]);
  const currency = storeInfo?.currency || "SAR";
  const dateLabel = (value) => value ? new Intl.DateTimeFormat(ar ? "ar-SA" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : text("بدون تحديد", "No limit");
  const missingMessage = text("إدارة العروض غير متاحة بعد. يلزم تطبيق ترحيل قاعدة البيانات الخاص بالعروض بواسطة المسؤول.", "Promotions are unavailable until an administrator applies the promotions database migration.");
  const errorMessage = (error) => isPromotionsUnavailableError(error) ? missingMessage : text("تعذرت العملية. تحقق من الاتصال والصلاحيات ثم حاول مجدداً.", "The operation failed. Check your connection and permissions, then try again.");

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    const requestedScope = `${tenantId || ""}:${branchId || ""}`;
    if (!tenantId || !branchId) { setLoading(false); setLoadError(null); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.rpc("get_branch_promotions", { p_branch_id: branchId });
      if (error) throw error;
      if (data != null && !Array.isArray(data)) throw new Error("Invalid promotions response");
      if (scopeRef.current === requestedScope && requestRef.current === request) {
        setResult({ scope: requestedScope, rows: (data || []).map(normalizePromotion) });
      }
    } catch (error) {
      if (scopeRef.current === requestedScope && requestRef.current === request) setLoadError(error);
    } finally {
      if (scopeRef.current === requestedScope && requestRef.current === request) setLoading(false);
    }
  }, [tenantId, branchId]);

  useEffect(() => {
    setResult({ scope, rows: [] });
    setActionError(null); setNotice(""); setDialogOpen(false); setDeleting(null); setFormError("");
    void load();
    return () => { requestRef.current += 1; };
  }, [scope, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const statuses = {
    active: text("نشط الآن", "Active now"), scheduled: text("مجدول", "Scheduled"),
    expired: text("منتهٍ", "Expired"), disabled: text("متوقف", "Disabled"),
    noItems: text("لا توجد أصناف مرتبطة", "No linked items"),
    noAvailableItems: text("الأصناف غير متاحة", "No available items"),
  };
  const getStatus = (row) => {
    if (!row.target_item_ids.length) return "noItems";
    const status = promotionStatus(row, now);
    if (status === "active" && !menuLoading && !menuError
      && !row.target_item_ids.some((id) => {
        const item = itemsById.get(id);
        return item && (item.isAvailableForSale ?? item.available) === true;
      })) return "noAvailableItems";
    return status;
  };
  const activeCount = rows.filter((row) => getStatus(row) === "active").length;
  const scheduledCount = rows.filter((row) => getStatus(row) === "scheduled").length;
  const canManage = Boolean(tenantId && branchId && result.scope === scope && !loadError && !loading && !busy);

  const openCreate = () => { setEditing(null); setForm(blankForm()); setFormError(""); setActionError(null); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...row, discount_value: String(row.discount_value), starts_at: localInputDate(row.starts_at), ends_at: localInputDate(row.ends_at) });
    setFormError(""); setActionError(null); setDialogOpen(true);
  };
  const closeDialog = () => { if (!busy) { setDialogOpen(false); setFormError(""); } };
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const runMutation = async (operation, onSuccess) => {
    if (operationRef.current || !tenantId || !branchId) return;
    operationRef.current = true;
    const requestedScope = scope;
    setBusy(true); setActionError(null); setNotice("");
    try {
      const { error } = await operation();
      if (error) throw error;
      if (scopeRef.current !== requestedScope) return;
      onSuccess();
      await load();
    } catch (error) {
      if (scopeRef.current === requestedScope) setActionError(error);
    } finally {
      operationRef.current = false;
      setBusy(false);
    }
  };

  const save = (event) => {
    event.preventDefault();
    const value = Number(form.discount_value);
    const validMoney = /^\d+(?:\.\d{1,2})?$/.test(String(form.discount_value).trim());
    // Preserve the original instant for unchanged fields, including ambiguous DST times.
    const unchangedStart = editing?.starts_at && form.starts_at === localInputDate(editing.starts_at);
    const unchangedEnd = editing?.ends_at && form.ends_at === localInputDate(editing.ends_at);
    const start = form.starts_at ? new Date(unchangedStart ? editing.starts_at : form.starts_at) : null;
    const end = form.ends_at ? new Date(unchangedEnd ? editing.ends_at : form.ends_at) : null;
    if (!form.title_ar.trim() && !form.title_en.trim()) return setFormError(text("أدخل اسم العرض بالعربية أو الإنجليزية.", "Enter a title in Arabic or English."));
    if (!validMoney || !Number.isFinite(value) || value <= 0 || value > 9999999999.99 || (form.discount_type === "percentage" && value > 100)) return setFormError(text("أدخل خصماً أكبر من صفر وبحد أقصى منزلتين عشريتين؛ النسبة لا تتجاوز 100٪.", "Enter a positive discount with up to two decimals; percentages cannot exceed 100%."));
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime())) || (start && end && end <= start)) return setFormError(text("يجب أن يكون وقت انتهاء العرض بعد بدايته.", "The end time must be after the start time."));
    if (menuLoading || menuError) return setFormError(text("انتظر تحميل أصناف الفرع بنجاح قبل الحفظ.", "Wait for the branch menu to load successfully before saving."));
    if (!form.target_item_ids.length || form.target_item_ids.length > 500 || selectedItems.length !== form.target_item_ids.length) return setFormError(text("اختر من 1 إلى 500 صنف صالح من هذا الفرع.", "Select 1 to 500 valid items from this branch."));
    setFormError("");
    void runMutation(() => supabase.rpc("save_branch_promotion", {
      p_id: editing?.id || null, p_branch_id: branchId,
      p_title_ar: form.title_ar.trim(), p_title_en: form.title_en.trim(),
      p_description_ar: form.description_ar.trim(), p_description_en: form.description_en.trim(),
      p_discount_type: form.discount_type, p_discount_value: value,
      p_starts_at: start ? (unchangedStart ? editing.starts_at : start.toISOString()) : null,
      p_ends_at: end ? (unchangedEnd ? editing.ends_at : end.toISOString()) : null,
      p_is_active: form.is_active, p_target_item_ids: form.target_item_ids,
    }), () => { setDialogOpen(false); setNotice(text("تم حفظ العرض.", "Promotion saved.")); });
  };

  const toggle = (row, enabled) => void runMutation(
    () => supabase.rpc("set_branch_promotion_active", { p_id: row.id, p_branch_id: branchId, p_is_active: enabled }),
    () => setNotice(text("تم تحديث حالة العرض.", "Promotion status updated.")),
  );
  const remove = () => {
    if (!deleting) return;
    void runMutation(() => supabase.rpc("delete_branch_promotion", { p_id: deleting.id, p_branch_id: branchId }),
      () => { setDeleting(null); setNotice(text("تم حذف العرض.", "Promotion deleted.")); });
  };

  return (
    <Box dir={ar ? "rtl" : "ltr"} sx={{ bgcolor: "#111", color: "#f7f8fc", borderRadius: 4, p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" } }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ display: "grid", placeItems: "center", width: 50, height: 50, borderRadius: 2.5, bgcolor: "rgba(217,84,30,.18)", color: "#ff9b72" }}><LocalOfferOutlinedIcon /></Box>
            <Box>
              <Typography variant="overline" sx={{ color: "#ff9b72", letterSpacing: ".12em", fontWeight: 800 }}>{text("التسويق · العروض", "MARKETING · PROMOTIONS")}</Typography>
              <Typography variant="h5" fontWeight={800}>{text("إدارة العروض", "Promotions & offers")}</Typography>
              <Typography variant="body2" sx={{ color: "#b8c1d4", mt: 0.5 }}>{text("أنشئ عروضاً لفرعك وحدد أصنافها ومواعيدها.", "Create branch offers and choose their items and schedule.")}</Typography>
            </Box>
          </Stack>
          <Button variant="contained" startIcon={<AddRoundedIcon />} disabled={!canManage} onClick={openCreate} sx={{ bgcolor: orange, color: "white", fontWeight: 800, px: 2.5, minHeight: 46, "&:hover": { bgcolor: "#b94517" }, "&.Mui-disabled": { bgcolor: "#56382d", color: "#b3a7a3" } }}>{text("إنشاء عرض", "Create promotion")}</Button>
        </Stack>

        <Alert severity="info" sx={{ bgcolor: "#1b2d4c", color: "#dce7fa", "& .MuiAlert-icon": { color: "#8cb6f0" } }}>
          {text("هذه الصفحة تدير بيانات العروض فقط؛ الخصومات لا تُطبّق تلقائياً على الطلبات أو المدفوعات.", "This page manages offer information only; discounts are not automatically applied to orders or payments.")}
        </Alert>
        {!branchId && <Alert severity="warning">{text("اختر فرعاً لإدارة عروضه.", "Select a branch to manage its promotions.")}</Alert>}
        {loadError && <Alert severity={isPromotionsUnavailableError(loadError) ? "warning" : "error"} action={<Button color="inherit" size="small" onClick={() => void load()}>{text("إعادة المحاولة", "Retry")}</Button>}>{errorMessage(loadError)}</Alert>}
        {actionError && <Alert severity={isPromotionsUnavailableError(actionError) ? "warning" : "error"} onClose={() => setActionError(null)}>{errorMessage(actionError)}</Alert>}
        {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          {[[text("عروض الفرع", "Branch offers"), rows.length], [text("نشطة الآن", "Active now"), activeCount], [text("قادمة", "Scheduled"), scheduledCount]].map(([label, count]) => (
            <Card key={label} elevation={0} sx={{ ...panel, p: 2, flex: 1 }}><Typography variant="body2" sx={{ color: "#b8c1d4" }}>{label}</Typography><Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>{loading || loadError ? "—" : count}</Typography></Card>
          ))}
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box><Typography variant="h6" fontWeight={800}>{text("عروض هذا الفرع", "Offers in this branch")}</Typography><Typography variant="body2" sx={{ color: "#b8c1d4" }}>{selectedBranch?.name || text("لم يتم تحديد فرع", "No branch selected")}</Typography></Box>
          <IconButton onClick={() => void load()} disabled={!tenantId || !branchId || loading || busy} aria-label={text("تحديث العروض", "Refresh promotions")} sx={{ color: "#e3e8f2" }}><RefreshRoundedIcon /></IconButton>
        </Stack>
        {loading ? <Box sx={{ py: 5, textAlign: "center" }}><CircularProgress size={28} sx={{ color: orange }} /><Typography sx={{ mt: 1, color: "#b8c1d4" }}>{text("جارٍ تحميل العروض...", "Loading promotions...")}</Typography></Box>
          : !loadError && branchId && !rows.length ? <Card sx={{ ...panel, p: 4, textAlign: "center" }}><LocalOfferOutlinedIcon sx={{ color: "#ff9b72", fontSize: 36 }} /><Typography fontWeight={800} sx={{ mt: 1 }}>{text("لا توجد عروض بعد", "No promotions yet")}</Typography><Typography variant="body2" sx={{ color: "#b8c1d4", mt: 0.5 }}>{text("أنشئ أول عرض لهذا الفرع للبدء.", "Create the first promotion for this branch to get started.")}</Typography></Card>
          : !loadError && rows.map((row) => {
            const status = getStatus(row);
            const title = ar ? row.title_ar || row.title_en : row.title_en || row.title_ar;
            const description = ar ? row.description_ar || row.description_en : row.description_en || row.description_ar;
            const itemNames = row.target_item_ids.map((id) => itemsById.get(id)?.name).filter(Boolean);
            return <Card key={row.id} elevation={0} sx={{ ...panel, p: { xs: 2, sm: 2.5 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center"><Typography variant="h6" fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{title}</Typography><Chip size="small" label={statuses[status]} sx={{ bgcolor: status === "active" ? "rgba(69,180,125,.18)" : status === "scheduled" ? "rgba(242,171,73,.18)" : "rgba(255,255,255,.1)", color: status === "active" ? "#85e2af" : status === "scheduled" ? "#ffd08a" : "#c7cfdf", fontWeight: 700 }} /></Stack>
                  {description && <Typography variant="body2" sx={{ color: "#c2cada", mt: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{description}</Typography>}
                  <Typography sx={{ color: "#ff9b72", fontWeight: 800, mt: 1.5 }}>{row.discount_type === "percentage" ? `${row.discount_value}%` : `${row.discount_value} ${currency}`} {text("خصم", "off")}</Typography>
                  <Typography variant="body2" sx={{ color: "#b8c1d4", mt: 1 }}>{text("الأصناف", "Items")}: {menuLoading ? text("جارٍ التحميل...", "Loading...") : itemNames.length ? itemNames.join("، ") : text("لا توجد أصناف متاحة للعرض", "No linked items to display")}</Typography>
                  <Typography variant="body2" sx={{ color: "#b8c1d4", mt: 0.5 }}>{text("من", "From")}: {dateLabel(row.starts_at)} · {text("إلى", "Until")}: {dateLabel(row.ends_at)}</Typography>
                </Box>
                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={{ xs: "flex-end", sm: "flex-start" }}>
                  <Switch checked={row.is_active} disabled={!canManage} onChange={(event) => toggle(row, event.target.checked)} inputProps={{ "aria-label": text(`تفعيل ${title}`, `Enable ${title}`) }} sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#ff8351" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: orange } }} />
                  <IconButton disabled={!canManage} onClick={() => openEdit(row)} aria-label={text(`تعديل ${title}`, `Edit ${title}`)} sx={{ color: "#cbd4e4" }}><EditOutlinedIcon /></IconButton>
                  <IconButton disabled={!canManage} onClick={() => { setActionError(null); setDeleting(row); }} aria-label={text(`حذف ${title}`, `Delete ${title}`)} sx={{ color: "#f39a85" }}><DeleteOutlineRoundedIcon /></IconButton>
                </Stack>
              </Stack>
            </Card>;
          })}
      </Stack>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm" dir={ar ? "rtl" : "ltr"} PaperProps={{ sx: { ...panel, bgcolor: "#14213d", backgroundImage: "none" } }}>
        <Box component="form" onSubmit={save}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editing ? text("تعديل العرض", "Edit promotion") : text("إنشاء عرض", "Create promotion")}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ color: "#b8c1d4" }}>{text("العرض خاص بالفرع الحالي. يكفي اسم واحد على الأقل.", "This offer belongs to the current branch. Enter at least one title.")}</Typography>
              {formError && <Alert severity="error">{formError}</Alert>}
              {actionError && <Alert severity={isPromotionsUnavailableError(actionError) ? "warning" : "error"}>{errorMessage(actionError)}</Alert>}
              {menuError && <Alert severity="warning" action={<Button size="small" color="inherit" onClick={() => refreshMenu?.()}>{text("إعادة المحاولة", "Retry")}</Button>}>{text("تعذر تحميل أصناف الفرع؛ لا يمكن حفظ العرض حتى تُحمّل بنجاح.", "The branch menu could not be loaded; saving is unavailable until it loads.")}</Alert>}
              <TextField fullWidth label={text("اسم العرض بالعربية", "Arabic title")} value={form.title_ar} onChange={(event) => setField("title_ar", event.target.value)} inputProps={{ maxLength: 120, dir: "rtl" }} sx={fieldSx} />
              <TextField fullWidth label={text("اسم العرض بالإنجليزية", "English title")} value={form.title_en} onChange={(event) => setField("title_en", event.target.value)} inputProps={{ maxLength: 120, dir: "ltr" }} sx={fieldSx} />
              <TextField fullWidth multiline minRows={2} label={text("الوصف بالعربية (اختياري)", "Arabic description (optional)")} value={form.description_ar} onChange={(event) => setField("description_ar", event.target.value)} inputProps={{ maxLength: 2000, dir: "rtl" }} sx={fieldSx} />
              <TextField fullWidth multiline minRows={2} label={text("الوصف بالإنجليزية (اختياري)", "English description (optional)")} value={form.description_en} onChange={(event) => setField("description_en", event.target.value)} inputProps={{ maxLength: 2000, dir: "ltr" }} sx={fieldSx} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth select label={text("نوع الخصم", "Discount type")} value={form.discount_type} onChange={(event) => setField("discount_type", event.target.value)} sx={fieldSx}>
                  <MenuItem value="percentage">{text("نسبة مئوية", "Percentage")}</MenuItem><MenuItem value="fixed">{text("مبلغ ثابت", "Fixed amount")}</MenuItem>
                </TextField>
                <TextField fullWidth required label={form.discount_type === "percentage" ? text("الخصم (%)", "Discount (%)") : text(`الخصم (${currency})`, `Discount (${currency})`)} type="number" value={form.discount_value} onChange={(event) => setField("discount_value", event.target.value)} inputProps={{ min: "0.01", max: form.discount_type === "percentage" ? "100" : "9999999999.99", step: "0.01" }} sx={fieldSx} />
              </Stack>
              <Autocomplete multiple options={branchItems} value={selectedItems} onChange={(_, next) => setField("target_item_ids", next.map((item) => String(item.id)))} getOptionLabel={(option) => option.name || String(option.id)} isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)} loading={menuLoading} disabled={menuLoading || Boolean(menuError)} noOptionsText={text("لا توجد أصناف في هذا الفرع", "No items in this branch")} loadingText={text("جارٍ تحميل الأصناف...", "Loading items...")} renderInput={(params) => <TextField {...params} label={text("الأصناف المشمولة", "Target menu items")} helperText={text("اختر صنفاً واحداً على الأقل؛ تظهر للعملاء الأصناف المتاحة فقط.", "Select at least one item; customers only see available items.")} sx={fieldSx} />} sx={{ "& .MuiChip-root": { bgcolor: "#314260", color: "white" } }} />
              <Divider sx={{ borderColor: "rgba(255,255,255,.12)" }} />
              <Typography variant="subtitle2" fontWeight={800}>{text("جدولة العرض", "Schedule")}</Typography>
              <Typography variant="body2" sx={{ color: "#b8c1d4" }}>{text("اترك التاريخ فارغاً لعدم تحديد حد. الأوقات حسب توقيت جهازك.", "Leave a date blank for no limit. Times use your device's time zone.")}</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth type="datetime-local" label={text("البداية", "Starts")} value={form.starts_at} onChange={(event) => setField("starts_at", event.target.value)} inputProps={{ step: "0.001" }} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                <TextField fullWidth type="datetime-local" label={text("النهاية", "Ends")} value={form.ends_at} onChange={(event) => setField("ends_at", event.target.value)} inputProps={{ step: "0.001" }} InputLabelProps={{ shrink: true }} sx={fieldSx} />
              </Stack>
              <FormControlLabel control={<Switch checked={form.is_active} onChange={(event) => setField("is_active", event.target.checked)} sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#ff8351" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: orange } }} />} label={text("تفعيل العرض حسب الجدول", "Enable offer according to its schedule")} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}><Button onClick={closeDialog} disabled={busy} sx={{ color: "#d3dbea" }}>{text("إلغاء", "Cancel")}</Button><Button type="submit" variant="contained" disabled={busy || menuLoading || Boolean(menuError)} sx={{ bgcolor: orange, "&:hover": { bgcolor: "#b94517" } }}>{busy ? text("جارٍ الحفظ...", "Saving...") : text("حفظ العرض", "Save promotion")}</Button></DialogActions>
        </Box>
      </Dialog>
      <Dialog open={Boolean(deleting)} onClose={() => { if (!busy) setDeleting(null); }} dir={ar ? "rtl" : "ltr"} PaperProps={{ sx: { ...panel, backgroundImage: "none" } }}>
        <DialogTitle>{text("حذف العرض؟", "Delete promotion?")}</DialogTitle>
        <DialogContent><DialogContentText sx={{ color: "#c2cada" }}>{text("سيُحذف العرض نهائياً ولن يظهر للعملاء. لا يمكن التراجع عن ذلك.", "This promotion will be permanently deleted and no longer visible to customers. This cannot be undone.")}</DialogContentText>{actionError && <Alert sx={{ mt: 2 }} severity="error">{errorMessage(actionError)}</Alert>}</DialogContent>
        <DialogActions sx={{ p: 2 }}><Button disabled={busy} onClick={() => setDeleting(null)} sx={{ color: "#d3dbea" }}>{text("إلغاء", "Cancel")}</Button><Button disabled={busy} color="error" variant="contained" onClick={remove}>{busy ? text("جارٍ الحذف...", "Deleting...") : text("حذف", "Delete")}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default Promotions;
