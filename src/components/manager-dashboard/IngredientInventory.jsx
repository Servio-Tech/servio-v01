import { useEffect, useMemo, useRef, useState } from "react";
import { useMenu } from "../../context/MenuContext";
import { useLanguage } from "../../context/LanguageContext";
import { useBranch } from "../../context/BranchContext";
import { FullscreenDialog as Dialog } from "../common/FullscreenOverlays";
import {
  Alert, Box, Button, Chip, CircularProgress, DialogActions, DialogContent,
  DialogTitle, IconButton, InputAdornment, MenuItem, Stack, Switch, TextField, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import {
  filterAndSortAvailability, linkedItemsByIngredient, runScopedAction,
  scopeToBranch, summarizeAvailability,
} from "./out-of-stock/availabilityModel";

const palette = {
  ink: "#141513", panel: "#1d1f1b", raised: "#252722", line: "#393a33",
  cream: "#f5f0e5", muted: "#b8b3a6", orange: "#d77b4b", paleOrange: "#f0b28a",
  green: "#a8c7aa",
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    color: palette.cream, backgroundColor: "#191b18", borderRadius: 2,
    "& fieldset": { borderColor: palette.line },
    "&:hover fieldset": { borderColor: "#777367" },
    "&.Mui-focused fieldset": { borderColor: palette.orange },
  },
  "& .MuiInputLabel-root, & .MuiSvgIcon-root": { color: palette.muted },
  "& .MuiInputLabel-root.Mui-focused": { color: palette.paleOrange },
};

const switchSx = {
  "& .MuiSwitch-switchBase.Mui-checked": { color: palette.green },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: palette.green },
  "& .MuiSwitch-track": { backgroundColor: "#8b7f70" },
};

function StateChip({ available, children }) {
  return <Chip size="small" label={children} sx={{
    height: 25, fontWeight: 800, borderRadius: 1.25,
    color: available ? palette.green : palette.paleOrange,
    bgcolor: available ? "rgba(120,173,133,.12)" : "rgba(215,123,75,.14)",
    border: `1px solid ${available ? "rgba(168,199,170,.25)" : "rgba(215,123,75,.3)"}`,
  }} />;
}

function Stat({ label, value, detail, highlight }) {
  return (
    <Box sx={{ p: { xs: 1.75, sm: 2.1 }, border: `1px solid ${palette.line}`, borderRadius: 2.5, backgroundColor: palette.panel, minWidth: 0 }}>
      <Typography sx={{ color: palette.muted, fontSize: ".77rem", fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ color: highlight ? palette.paleOrange : palette.cream, fontSize: { xs: "1.7rem", sm: "2rem" }, lineHeight: 1.15, fontWeight: 900, mt: 1 }}>{value}</Typography>
      <Typography sx={{ color: palette.muted, fontSize: ".72rem", mt: 0.75 }}>{detail}</Typography>
    </Box>
  );
}

function IngredientInventory({ canManage = false }) {
  const {
    ingredients = [], items = [], addIngredient, updateIngredient,
    setIngredientAvailability, toggleAvailable, menuLoading, menuRefreshing,
    menuError, refreshMenu,
  } = useMenu();
  const { language } = useLanguage();
  const { selectedBranch, selectedBranchId, loading: branchLoading } = useBranch();
  const isArabic = language !== "en";
  const tr = (ar, en) => isArabic ? ar : en;
  const locale = isArabic ? "ar" : "en";
  const branchRef = useRef(selectedBranchId);
  branchRef.current = selectedBranchId;
  const [view, setView] = useState("items");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("unavailable");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBranchId, setDialogBranchId] = useState(null);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // MenuContext clears on branch changes in an effect, so filter immediately during render too.
  const branchIngredients = useMemo(() => scopeToBranch(ingredients, selectedBranchId), [ingredients, selectedBranchId]);
  const branchItems = useMemo(() => scopeToBranch(items, selectedBranchId), [items, selectedBranchId]);
  const linkedItems = useMemo(() => linkedItemsByIngredient(branchItems), [branchItems]);
  const summary = useMemo(() => summarizeAvailability(branchIngredients, branchItems), [branchIngredients, branchItems]);
  const displayedRows = useMemo(() => filterAndSortAvailability(view === "items" ? branchItems : branchIngredients, {
    type: view === "items" ? "item" : "ingredient", query: search, status, sort, linkedItems, locale,
  }), [view, branchItems, branchIngredients, search, status, sort, linkedItems, locale]);

  useEffect(() => {
    setDialogOpen(false);
    setEditingIngredient(null);
    setDraftName("");
    setError("");
  }, [selectedBranchId]);

  const writesDisabled = !selectedBranchId || branchLoading || menuLoading || menuRefreshing || Boolean(menuError) || Boolean(busyId) || saving;
  const hasRows = branchIngredients.length > 0 || branchItems.length > 0;
  const numbersReady = selectedBranchId && !branchLoading && !menuLoading && (!menuError || hasRows);
  const count = (value) => numbersReady ? value.toLocaleString(locale) : "—";

  const openAdd = () => {
    if (writesDisabled || !canManage) return;
    setEditingIngredient(null);
    setDialogBranchId(selectedBranchId);
    setDraftName("");
    setError("");
    setDialogOpen(true);
  };
  const openEdit = (ingredient) => {
    if (writesDisabled || !canManage || String(ingredient.branch_id) !== String(selectedBranchId)) return;
    setEditingIngredient(ingredient);
    setDialogBranchId(selectedBranchId);
    setDraftName(ingredient.name || "");
    setError("");
    setDialogOpen(true);
  };
  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingIngredient(null);
    setDraftName("");
    setError("");
  };
  const failureMessage = (operationError) => {
    const detail = operationError?.message ? ` (${operationError.message})` : "";
    return tr("تعذّر تأكيد التغيير. أعد تحميل البيانات وتحقق من الحالة قبل المحاولة مجددًا.", "Could not confirm the change. Reload and check the status before trying again.") + detail;
  };
  const handleSave = async (event) => {
    event.preventDefault();
    const name = draftName.trim().replace(/\s+/g, " ");
    if (!name || writesDisabled || !canManage || dialogBranchId !== selectedBranchId) return;
    const branchAtStart = selectedBranchId;
    setSaving(true);
    setError("");
    const result = await runScopedAction(branchAtStart, editingIngredient?.branch_id ?? dialogBranchId, () => editingIngredient
      ? updateIngredient({ ...editingIngredient, name }) : addIngredient(name));
    setSaving(false);
    if (branchRef.current !== branchAtStart) {
      void refreshMenu();
      return;
    }
    if (result.error) {
      setError(failureMessage(result.error));
      void refreshMenu();
      return;
    }
    setDialogOpen(false);
    setEditingIngredient(null);
    setDraftName("");
  };
  const changeAvailability = async (record, type) => {
    if (writesDisabled || String(record.branch_id) !== String(selectedBranchId)) return;
    const branchAtStart = selectedBranchId;
    setBusyId(`${type}:${record.id}`);
    setError("");
    const result = await runScopedAction(branchAtStart, record.branch_id, () => type === "ingredient"
      ? setIngredientAvailability(record.id, record.available !== true)
      : toggleAvailable(record.id));
    setBusyId(null);
    if (branchRef.current !== branchAtStart) {
      void refreshMenu();
      return;
    }
    if (result.error) {
      setError(failureMessage(result.error));
      void refreshMenu();
    }
  };

  return (
    <Box dir={isArabic ? "rtl" : "ltr"} sx={{ minWidth: 0, color: palette.cream, background: palette.ink, borderRadius: { xs: 2.5, md: 3.5 }, p: { xs: 2, sm: 2.75, lg: 3.5 } }}>
      <Stack spacing={2.5}>
        <Box component="header" sx={{ pb: 0.5 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "flex-end" } }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: palette.orange }} />
                <Typography sx={{ color: palette.paleOrange, fontSize: ".73rem", fontWeight: 900, letterSpacing: ".04em" }}>{tr("متابعة التوفر", "AVAILABILITY OVERVIEW")}</Typography>
                <Typography sx={{ color: "#6f7067", fontSize: ".8rem" }}>/</Typography>
                <Typography sx={{ color: palette.muted, fontSize: ".75rem", fontWeight: 700 }}>{selectedBranch?.name || tr("لم يُحدد فرع", "No branch selected")}</Typography>
              </Stack>
              <Typography component="h1" sx={{ color: palette.cream, fontWeight: 900, fontSize: { xs: "1.65rem", md: "2.15rem" }, lineHeight: 1.2 }}>{tr("إدارة النفاد", "Availability management")}</Typography>
              <Typography sx={{ color: palette.muted, fontSize: ".88rem", lineHeight: 1.9, mt: 1, maxWidth: 730 }}>
                {tr("تابع توفر الأصناف ومكوناتها في الفرع المحدد. نفاد أي مكون مرتبط يوقف الصنف عن الطلب، حتى لو كان مفعّلًا يدويًا.", "Monitor items and their ingredients in the selected branch. An unavailable linked ingredient stops an item from being ordered, even when it is manually enabled.")}
              </Typography>
            </Box>
            {canManage && <Button onClick={openAdd} disabled={writesDisabled} startIcon={<AddRoundedIcon />} variant="contained" sx={{ minHeight: 44, px: 2, borderRadius: 2, whiteSpace: "nowrap", fontWeight: 900, color: "#21140e", bgcolor: palette.orange, boxShadow: "none", "&:hover": { bgcolor: "#e68c5b", boxShadow: "none" }, "&.Mui-disabled": { color: "#77736a", bgcolor: "#393a33" } }}>{tr("إضافة مكون", "Add ingredient")}</Button>}
          </Stack>
        </Box>

        {menuError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void refreshMenu()}>{tr("إعادة المحاولة", "Retry")}</Button>} sx={{ borderRadius: 2 }}>
          {hasRows
            ? tr("تعذّر تحديث البيانات. المعروض هو آخر بيانات محمّلة وقد لا يعكس الحالة الحالية؛ التعديل متوقف حتى نجاح التحديث.", "Refresh failed. Showing the last loaded data, which may be outdated; changes are disabled until refresh succeeds.")
            : tr("تعذّر تحميل الأصناف والمكونات. تحقق من الاتصال ثم أعد المحاولة.", "Could not load items and ingredients. Check the connection and retry.")}
        </Alert>}
        {error && !dialogOpen && <Alert severity="error" onClose={() => setError("")} action={<Button color="inherit" size="small" onClick={() => void refreshMenu()}>{tr("تحديث البيانات", "Reload data")}</Button>} sx={{ borderRadius: 2 }}>{error}</Alert>}
        {!selectedBranchId && !branchLoading && <Alert severity="warning" sx={{ borderRadius: 2 }}>{tr("اختر فرعًا لعرض حالات التوفر وتعديلها.", "Select a branch to view and change availability.")}</Alert>}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
          <Stat label={tr("أصناف متاحة للطلب", "Items available")} value={count(summary.itemAvailable)} detail={tr(`من ${count(summary.itemTotal)} صنف`, `of ${count(summary.itemTotal)} items`)} />
          <Stat label={tr("أصناف غير متاحة", "Items unavailable")} value={count(summary.itemUnavailable)} detail={tr("لأي سبب", "For any reason")} highlight={summary.itemUnavailable > 0} />
          <Stat label={tr("مكونات نافدة", "Unavailable ingredients")} value={count(summary.ingredientUnavailable)} detail={tr(`من ${count(summary.ingredientTotal)} مكون`, `of ${count(summary.ingredientTotal)} ingredients`)} highlight={summary.ingredientUnavailable > 0} />
          <Stat label={tr("أصناف متأثرة بمكون نافد", "Items affected by ingredients")} value={count(summary.itemAffected)} detail={tr("يشمل الأصناف الموقوفة يدويًا", "Includes manually disabled items")} highlight={summary.itemAffected > 0} />
        </Box>

        <Box sx={{ border: `1px solid ${palette.line}`, borderRadius: 2.5, backgroundColor: palette.panel, overflow: "hidden" }}>
          <Box sx={{ p: { xs: 1.5, sm: 2.25 }, borderBottom: `1px solid ${palette.line}` }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
              <Box>
                <Typography component="h2" sx={{ fontSize: "1.08rem", fontWeight: 900 }}>{tr("حالة التوفر", "Availability status")}</Typography>
                <Typography sx={{ color: palette.muted, fontSize: ".77rem", mt: 0.5 }}>{tr("اختر عرض الأصناف أو المكونات لإدارة حالتها.", "Choose items or ingredients to manage their status.")}</Typography>
              </Box>
              <Stack direction="row" spacing={0.5} role="group" aria-label={tr("نوع العرض", "View type")} sx={{ p: 0.5, borderRadius: 2, bgcolor: "#141613", alignSelf: { xs: "stretch", sm: "auto" } }}>
                {[["items", tr("الأصناف", "Items"), summary.itemTotal], ["ingredients", tr("المكونات", "Ingredients"), summary.ingredientTotal]].map(([key, label, total]) => (
                  <Button key={key} onClick={() => setView(key)} aria-pressed={view === key} sx={{ flex: 1, color: view === key ? palette.cream : palette.muted, bgcolor: view === key ? palette.raised : "transparent", borderRadius: 1.5, minWidth: 105, fontWeight: 800, px: 1.5, "&:hover": { bgcolor: palette.raised } }}>{label} <Box component="span" sx={{ color: view === key ? palette.paleOrange : palette.muted, mx: 0.75, fontSize: ".75rem" }}>{count(total)}</Box></Button>
                ))}
              </Stack>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "minmax(0, 1fr) 180px 190px" }, gap: 1.25, mt: 2.25 }}>
              <TextField value={search} onChange={(event) => setSearch(event.target.value)} size="small" placeholder={view === "items" ? tr("ابحث عن صنف أو مكون", "Search an item or ingredient") : tr("ابحث عن مكون أو صنف مرتبط", "Search an ingredient or linked item")} sx={{ ...fieldSx, gridColumn: { xs: "1 / -1", md: "auto" } }} slotProps={{ htmlInput: { "aria-label": tr("البحث", "Search") }, input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }} />
              <TextField select value={status} onChange={(event) => setStatus(event.target.value)} size="small" label={tr("الحالة", "Status")} sx={fieldSx}>
                <MenuItem value="all">{tr("كل الحالات", "All statuses")}</MenuItem>
                <MenuItem value="unavailable">{tr("غير المتاح", "Unavailable")}</MenuItem>
                <MenuItem value="available">{tr("المتاح", "Available")}</MenuItem>
              </TextField>
              <TextField select value={sort} onChange={(event) => setSort(event.target.value)} size="small" label={tr("الترتيب", "Sort by")} sx={fieldSx}>
                <MenuItem value="unavailable">{tr("غير المتاح أولًا", "Unavailable first")}</MenuItem>
                <MenuItem value="name-asc">{tr("الاسم: أ–ي", "Name: A–Z")}</MenuItem>
                <MenuItem value="name-desc">{tr("الاسم: ي–أ", "Name: Z–A")}</MenuItem>
              </TextField>
            </Box>
          </Box>

          <Box sx={{ p: { xs: 1.5, sm: 2.25 } }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5, gap: 1 }}>
              <Typography sx={{ color: palette.muted, fontSize: ".75rem", fontWeight: 700 }}>{tr(`${displayedRows.length.toLocaleString(locale)} نتيجة`, `${displayedRows.length.toLocaleString(locale)} results`)}</Typography>
              {menuRefreshing && <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", color: palette.muted }}><CircularProgress size={14} sx={{ color: palette.orange }} /><Typography sx={{ fontSize: ".72rem" }}>{tr("جارٍ التحديث", "Refreshing")}</Typography></Stack>}
            </Stack>
            {(menuLoading || branchLoading) ? (
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", justifyContent: "center", py: 6 }}><CircularProgress size={22} sx={{ color: palette.orange }} /><Typography sx={{ color: palette.muted }}>{tr("جارٍ تحميل الحالات…", "Loading availability…")}</Typography></Stack>
            ) : !selectedBranchId || (menuError && !hasRows) ? null : displayedRows.length ? (
              <Stack spacing={1}>
                {displayedRows.map((record) => {
                  const isIngredient = view === "ingredients";
                  const available = isIngredient ? record.available === true : record.isAvailableForSale === true;
                  const linked = isIngredient ? (linkedItems.get(String(record.id)) || []) : (record.ingredients || []);
                  const unavailableIngredients = record.unavailableIngredients || [];
                  return (
                    <Box key={record.id} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, border: `1px solid ${available ? palette.line : "rgba(215,123,75,.38)"}`, bgcolor: available ? "#20221e" : "#28211d" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
                        <Stack direction="row" spacing={1.25} sx={{ minWidth: 0, alignItems: "flex-start" }}>
                          <Box sx={{ display: "grid", placeItems: "center", flexShrink: 0, width: 40, height: 40, borderRadius: 1.75, bgcolor: available ? "rgba(168,199,170,.09)" : "rgba(215,123,75,.12)", color: available ? palette.green : palette.paleOrange }}>{isIngredient ? <Inventory2OutlinedIcon fontSize="small" /> : <StorefrontOutlinedIcon fontSize="small" />}</Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: palette.cream, fontWeight: 900, overflowWrap: "anywhere" }}>{record.name}</Typography>
                            <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 0.7, alignItems: "center", flexWrap: "wrap" }}>
                              <StateChip available={available}>{isIngredient ? (available ? tr("متوفر", "Available") : tr("نافد", "Unavailable")) : (available ? tr("متاح للطلب", "Available to order") : tr("غير متاح للطلب", "Unavailable to order"))}</StateChip>
                              {isIngredient && <Typography sx={{ color: palette.muted, fontSize: ".75rem" }}>{tr(`${linked.length.toLocaleString(locale)} صنف مرتبط`, `${linked.length.toLocaleString(locale)} linked items`)}</Typography>}
                            </Stack>
                            {!isIngredient && !available && <Box sx={{ mt: 0.8, color: palette.paleOrange, fontSize: ".76rem", lineHeight: 1.7 }}>
                              {record.available !== true && <div>{tr("الصنف موقوف يدويًا.", "Item is manually disabled.")}</div>}
                              {unavailableIngredients.length > 0 && <div>{tr("مكونات نافدة: ", "Unavailable ingredients: ")}{unavailableIngredients.map((ingredient) => ingredient.name).join(isArabic ? "، " : ", ")}</div>}
                              {record.hasUnknownIngredient && <div>{tr("تعذّر التحقق من أحد المكونات المرتبطة.", "A linked ingredient could not be verified.")}</div>}
                            </Box>}
                          </Box>
                        </Stack>
                        <Stack direction="row" sx={{ alignItems: "center", justifyContent: { xs: "space-between", sm: "flex-end" }, flexShrink: 0, gap: 0.5 }}>
                          <Box sx={{ textAlign: { sm: "end" } }}>
                            <Typography sx={{ color: palette.cream, fontSize: ".75rem", fontWeight: 800 }}>{isIngredient ? tr("توفر المكون", "Ingredient availability") : tr("التفعيل اليدوي", "Manual availability")}</Typography>
                            <Typography sx={{ color: palette.muted, fontSize: ".7rem" }}>{record.available === true ? tr("مفعّل", "Enabled") : tr("موقوف", "Disabled")}</Typography>
                          </Box>
                          <Switch checked={record.available === true} onChange={() => changeAvailability(record, isIngredient ? "ingredient" : "item")} disabled={writesDisabled} sx={switchSx} slotProps={{ input: { "aria-label": isIngredient ? tr(`تغيير توفر المكون ${record.name}`, `Change availability of ingredient ${record.name}`) : tr(`تغيير التفعيل اليدوي للصنف ${record.name}`, `Change manual availability of item ${record.name}`) } }} />
                          {isIngredient && canManage && <IconButton onClick={() => openEdit(record)} disabled={writesDisabled} aria-label={tr(`تعديل ${record.name}`, `Edit ${record.name}`)} sx={{ color: palette.paleOrange, "&.Mui-disabled": { color: "#6b665f" } }}><EditOutlinedIcon fontSize="small" /></IconButton>}
                        </Stack>
                      </Stack>
                      <Box sx={{ borderTop: `1px solid ${palette.line}`, mt: 1.5, pt: 1.25 }}>
                        <Typography sx={{ color: palette.muted, fontSize: ".72rem", fontWeight: 800, mb: 0.8 }}>{isIngredient ? tr("الأصناف المرتبطة", "Linked items") : tr("المكونات المرتبطة", "Linked ingredients")}</Typography>
                        {linked.length ? <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>{linked.map((entry) => <Chip key={entry.id} size="small" label={entry.name} sx={{ maxWidth: "100%", color: !isIngredient && entry.available !== true ? palette.paleOrange : palette.cream, bgcolor: "#30312b", borderRadius: 1.25, fontSize: ".72rem" }} />)}</Stack> : <Typography sx={{ color: palette.muted, fontSize: ".75rem" }}>{isIngredient ? tr("لا توجد أصناف مرتبطة بهذا المكون.", "No items are linked to this ingredient.") : record.hasUnknownIngredient ? tr("تعذّر عرض المكون المرتبط.", "The linked ingredient could not be displayed.") : tr("لا توجد مكونات مرتبطة بهذا الصنف.", "No ingredients are linked to this item.")}</Typography>}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Box sx={{ textAlign: "center", py: { xs: 4, md: 6 }, px: 1 }}>
                <Inventory2OutlinedIcon sx={{ color: palette.orange, fontSize: 32, mb: 1 }} />
                <Typography sx={{ fontWeight: 900 }}>{search.trim() || status !== "all" ? tr("لا توجد نتائج مطابقة", "No matching results") : view === "items" ? tr("لا توجد أصناف في هذا الفرع", "No items in this branch") : tr("لا توجد مكونات في هذا الفرع", "No ingredients in this branch")}</Typography>
                <Typography sx={{ color: palette.muted, fontSize: ".8rem", mt: 0.75 }}>{search.trim() || status !== "all" ? tr("جرّب تغيير البحث أو الحالة.", "Try changing the search or status filter.") : view === "ingredients" ? (canManage ? tr("أضف مكونًا، ثم اربطه بالأصناف من نموذج تعديل الصنف.", "Add an ingredient, then link it to items in the item editor.") : tr("اطلب من المدير إضافة المكونات وربطها بالأصناف.", "Ask a manager to add and link ingredients.") ) : tr("تظهر هنا أصناف الفرع المحدد عند إضافتها إلى المنيو.", "Items for the selected branch will appear here when added to the menu.")}</Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Stack direction="row" spacing={1} sx={{ color: palette.muted, alignItems: "flex-start", px: 0.25 }}>
          <SyncRoundedIcon sx={{ fontSize: 17, color: palette.orange, mt: "2px" }} />
          <Typography sx={{ fontSize: ".76rem", lineHeight: 1.75 }}>{tr("تغيير حالة المكون يؤثر في كل الأصناف المرتبطة به. إعادة تفعيل الصنف لا تتجاوز حالة مكوناته، وربط المكونات يتم من تعديل الصنف.", "Changing an ingredient affects every linked item. Enabling an item does not override its ingredients; links are managed in the item editor.")}</Typography>
        </Stack>
      </Stack>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm" language={language} slotProps={{ paper: { dir: isArabic ? "rtl" : "ltr", sx: { bgcolor: palette.panel, color: palette.cream, border: `1px solid ${palette.line}`, borderRadius: 2.5 } } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, fontWeight: 900, paddingInlineEnd: 12 }}>
          {editingIngredient ? tr("تعديل اسم المكون", "Edit ingredient name") : tr("إضافة مكون جديد", "Add an ingredient")}
          <IconButton onClick={closeDialog} disabled={saving} aria-label={tr("إغلاق", "Close")} sx={{ color: palette.muted }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <Box component="form" onSubmit={handleSave}>
          <DialogContent dividers sx={{ borderColor: palette.line }}>
            {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void refreshMenu()}>{tr("تحديث البيانات", "Reload data")}</Button>} sx={{ mb: 2 }}>{error}</Alert>}
            <TextField autoFocus fullWidth required label={tr("اسم المكون", "Ingredient name")} placeholder={tr("مثال: حليب، قهوة، دجاج", "e.g. milk, coffee, chicken")} value={draftName} onChange={(event) => setDraftName(event.target.value)} helperText={tr("يمكن ربط هذا المكون بالأصناف من نموذج تعديل الصنف.", "Link this ingredient to items in the item editor.")} sx={{ ...fieldSx, "& .MuiFormHelperText-root": { color: palette.muted } }} slotProps={{ htmlInput: { maxLength: 120 } }} />
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={closeDialog} disabled={saving} sx={{ color: palette.muted }}>{tr("إلغاء", "Cancel")}</Button>
            <Button type="submit" variant="contained" disabled={writesDisabled || !draftName.trim()} sx={{ bgcolor: palette.orange, color: "#21140e", fontWeight: 900, "&:hover": { bgcolor: "#e68c5b" } }}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ", "Save")}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

export default IngredientInventory;
