import { FullscreenDialog as Dialog } from "../../common/FullscreenOverlays";
import { useEffect, useState } from "react";
import { useMenu } from "../../../context/MenuContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useStore } from "../../../context/StoreInfoContext";
import { useBranch } from "../../../context/BranchContext";
import AddItemDrawer from "./AddItemDrawer";
import CategoryPrintRoutingDrawer from "./CategoryPrintRoutingDrawer";
import AddonComplementDrawer from "./AddonComplementDrawer";
import MenuItemImage from "../../menu/MenuItemImage";
import { formatMenuPrice, getAvailabilityState, getComplementSummary, getOrderedItems, moveMenuItem } from "./menuControlUtils";

import { alpha } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import CategoryIcon from "@mui/icons-material/Category";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import SpaRoundedIcon from "@mui/icons-material/SpaRounded";
import CloseIcon from "@mui/icons-material/Close";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { v4 as uuidV4 } from "uuid";
import ManagerExportMenu from "../ManagerExportMenu";
import { downloadCsv, downloadXlsx } from "../Analytics/reportExport";
import { openManagerPrintableReport } from "../../../utils/managerPrintableReport";

function MenuControl() {
  const { t, language } = useLanguage();
  const { storeInfo } = useStore();
  const { selectedBranch, selectedBranchId } = useBranch();
  const isArabic = language === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [imageEditError, setImageEditError] = useState("");
  const [itemError, setItemError] = useState("");
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [isPrinterRoutingOpen, setPrinterRoutingOpen] = useState(false);
  const [isComplementDrawerOpen, setComplementDrawerOpen] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [sortSaving, setSortSaving] = useState(false);
  const [sortError, setSortError] = useState("");
  const [exportBusy, setExportBusy] = useState("");
  const [exportError, setExportError] = useState("");

  const {
    filteredMenu = [], items = [], reorderMenuItems, categoriesList = [], addonComplements = [],
    searchQuery, setSearchQuery, deleteItem, toggleAvailable, addCategory, updateCategory,
    updateCategoryPrintRoutes, deleteCategory, addAddonComplement, deleteAddonComplement,
    menuLoading, menuRefreshing, menuError, refreshMenu, loadItemImage,
  } = useMenu();

  useEffect(() => { refreshMenu(); }, [refreshMenu]);

  const visibleItems = categoryFilter === "all"
    ? filteredMenu
    : filteredMenu.filter((item) => String(item.category_id) === categoryFilter);
  const orderedItems = getOrderedItems(items);
  const categoryNames = new Map(categoriesList.map((category) => [String(category.id), category.name]));
  const availabilityLabel = (item) => {
    const state = getAvailabilityState(item);
    return state === "available"
      ? t("menuAvailable")
      : state === "paused"
        ? (isArabic ? "متوقف بسبب المكونات" : "Paused by ingredients")
        : t("menuUnavailable");
  };
  const menuExportColumns = isArabic
    ? ["الفرع", "الصنف", "التصنيف", "السعر", "العملة", "التوفر", "المكونات", "المكونات النافدة", "عدد المكملات", "الحد الأقصى للمكملات"]
    : ["Branch", "Item", "Category", "Price", "Currency", "Availability", "Ingredients", "Unavailable ingredients", "Complement count", "Complement limit"];
  const menuExportRows = visibleItems.map((product) => {
    const { count, limit } = getComplementSummary(product);
    return [
      selectedBranch?.name || "",
      product.name || "—",
      categoryNames.get(String(product.category_id)) || "—",
      product.price != null && String(product.price).trim() !== "" && Number.isFinite(Number(product.price)) ? Number(product.price) : "",
      storeInfo?.currency || "",
      availabilityLabel(product),
      (product.ingredients || []).map((ingredient) => ingredient.name).filter(Boolean).join(isArabic ? "، " : ", "),
      (product.unavailableIngredients || []).map((ingredient) => ingredient.name).filter(Boolean).join(isArabic ? "، " : ", "),
      count,
      limit,
    ];
  });
  const menuExportModel = {
    rtl: isArabic,
    title: isArabic ? "قائمة أصناف المنيو" : "Menu item catalog",
    filename: `servio-menu-${selectedBranchId || "branch"}-${new Date().toISOString().slice(0, 10)}`,
    sections: [{
      name: isArabic ? "قائمة الأصناف" : "Menu items",
      title: isArabic ? "الأصناف الظاهرة حسب البحث والتصنيف الحالي" : "Items visible under the current search and category filters",
      columns: menuExportColumns,
      rows: menuExportRows,
    }],
  };

  const handleExport = async (format) => {
    setExportError("");
    if (format === "pdf") {
      try {
        openManagerPrintableReport({
          title: menuExportModel.title,
          subtitle: menuExportModel.sections[0].title,
          columns: menuExportColumns,
          rows: menuExportRows,
          summary: [
            [isArabic ? "الفرع" : "Branch", selectedBranch?.name || "—"],
            [isArabic ? "عدد الأصناف" : "Items", visibleItems.length],
          ],
          language,
        });
      } catch (error) {
        console.error("Menu catalog print failed:", error);
        setExportError(isArabic ? "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة." : "Could not open the print window. Allow pop-ups and retry.");
      }
      return;
    }

    setExportBusy(format);
    try {
      if (format === "csv") downloadCsv(menuExportModel);
      else await downloadXlsx(menuExportModel);
    } catch (error) {
      console.error("Menu export failed:", error);
      setExportError(isArabic ? "تعذر إعداد ملف التصدير. أعد المحاولة أو اختر صيغة أخرى." : "Could not prepare the export. Retry or choose another format.");
    } finally {
      setExportBusy("");
    }
  };

  const handleOpenAdd = () => {
    setImageEditError("");
    setItemToEdit(null);
    setIsOpen(true);
  };

  const handleOpenEdit = async (product) => {
    setImageEditError("");
    let editProduct = product;
    if (product.imageLoading || product.imageError) {
      try {
        const imageResult = await loadItemImage(product.id);
        if (!imageResult || imageResult.error) throw imageResult?.error;
        editProduct = { ...product, image: imageResult.image, imageLoading: false, imageError: false };
      } catch {
        setImageEditError(isArabic
          ? "تعذر تحميل صورة الصنف. أعد المحاولة قبل تعديل بياناته حتى لا تُستبدل الصورة الحالية."
          : "Could not load the current item image. Retry before editing so the existing photo is not replaced.");
        return;
      }
    }
    setItemToEdit(editProduct);
    setIsOpen(true);
  };

  const runItemAction = async (id, action) => {
    if (busyId) return;
    setBusyId(id);
    setItemError("");
    try {
      const result = await action(id);
      if (result?.error) throw result.error;
    } catch (error) {
      setItemError(error?.message || (isArabic ? "تعذر تنفيذ العملية. أعد المحاولة." : "The action failed. Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (id, targetIndex) => {
    if (sortSaving) return;
    const ids = moveMenuItem(items, id, targetIndex);
    if (!ids) return;
    setSortSaving(true);
    setSortError("");
    try {
      const result = await reorderMenuItems(ids);
      if (result?.error) throw result.error;
    } catch (error) {
      setSortError(error?.message || (isArabic ? "تعذر حفظ الترتيب." : "Could not save the order."));
    } finally {
      setSortSaving(false);
      setDraggedId(null);
    }
  };

  const handleSaveCategory = async () => {
    if (!newCategoryTitle.trim() || categorySaving) return;
    setCategoryError("");
    setCategorySaving(true);
    try {
      const result = editingCategory
        ? await updateCategory({ ...editingCategory, name: newCategoryTitle.trim() })
        : await addCategory({ id: uuidV4(), name: newCategoryTitle.trim(), separate_print: false });
      if (result?.error) throw result.error;
      setEditingCategory(null);
      setNewCategoryTitle("");
    } catch (error) {
      setCategoryError(error?.message || (isArabic ? "تعذر حفظ التصنيف" : "Could not save category"));
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (busyId) return;
    setBusyId(id);
    setCategoryError("");
    try {
      const result = await deleteCategory(id);
      if (result?.error) throw result.error;
      if (categoryFilter === String(id)) setCategoryFilter("all");
    } catch (error) {
      setCategoryError(error?.message || (isArabic ? "تعذر حذف التصنيف" : "Could not delete category"));
    } finally {
      setBusyId(null);
    }
  };

  const stickyAction = {
    position: { xs: "sticky", md: "static" },
    insetInlineEnd: 0,
    zIndex: 1,
    bgcolor: "background.paper",
    boxShadow: { xs: (theme) => `-4px 0 10px ${alpha(theme.palette.common.black, 0.08)}`, md: "none" },
  };

  return (
    <Box dir={isArabic ? "rtl" : "ltr"} sx={{ minWidth: 0, color: "text.primary" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-end" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 2.5 }}>
        <Box>
          <Typography variant="overline" sx={{ display: "block", color: "primary.main", fontWeight: 900, letterSpacing: ".12em", lineHeight: 1.3 }}>
            {isArabic ? "إدارة المنيو" : "MENU MANAGEMENT"}
          </Typography>
          <Typography component="h1" variant="h5" sx={{ color: "text.primary", fontWeight: 900, mt: .5 }}>
            {isArabic ? "قائمة الطعام" : "Menu items"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
            {isArabic ? "أدر الأصناف وأسعارها وتوفرها من مكان واحد." : "Manage items, prices and availability in one place."}
          </Typography>
        </Box>
        <Button onClick={handleOpenAdd} variant="contained" startIcon={<AddIcon />} sx={{ fontWeight: 850, px: 2.25, alignSelf: { xs: "stretch", sm: "auto" } }}>
          {t("menuAddItem")}
        </Button>
      </Box>

      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden" }}>
        <Box sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.75 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "text.primary" }}>{isArabic ? "الأصناف" : "Items"}</Typography>
              <Typography variant="caption" color="text.secondary">
                {menuLoading && !items.length
                  ? (isArabic ? "جارٍ تحميل الأصناف…" : "Loading items…")
                  : (isArabic ? `${visibleItems.length} صنف ظاهر من ${items.length}` : `${visibleItems.length} shown of ${items.length} items`)}
              </Typography>
            </Box>
            {menuRefreshing && <CircularProgress size={18} aria-label={isArabic ? "جارٍ تحديث المنيو" : "Refreshing menu"} />}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <TextField
              placeholder={t("menuSearch")}
              aria-label={t("menuSearch")}
              size="small"
              value={searchQuery || ""}
              onChange={(event) => setSearchQuery(event.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }, htmlInput: { "aria-label": t("menuSearch") } }}
              sx={{ flex: "1 1 230px", minWidth: 0 }}
            />
            <TextField select size="small" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label={isArabic ? "تصفية حسب التصنيف" : "Filter by category"}
              slotProps={{ select: { inputProps: { "aria-label": isArabic ? "تصفية حسب التصنيف" : "Filter by category" } } }}
              sx={{ flex: { xs: "1 1 150px", sm: "0 1 190px" } }}>
              <MenuItem value="all">{isArabic ? "كل التصنيفات" : "All categories"}</MenuItem>
              {categoriesList.map((category) => <MenuItem key={category.id} value={String(category.id)}>{category.name}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: .75, mt: 1.25 }}>
            <Button onClick={() => setCategoryModalOpen(true)} size="small" variant="outlined" color="inherit" startIcon={<CategoryIcon />}>{t("menuCategories")}</Button>
            <Button onClick={() => { setSortError(""); setSortMode((value) => !value); }} size="small" variant={sortMode ? "contained" : "outlined"} color={sortMode ? "primary" : "inherit"} startIcon={<SortRoundedIcon />}>
              {isArabic ? (sortMode ? "إنهاء الترتيب" : "ترتيب الأصناف") : (sortMode ? "Done sorting" : "Reorder items")}
            </Button>
            <Button onClick={() => setPrinterRoutingOpen(true)} size="small" variant="outlined" color="inherit" startIcon={<PrintRoundedIcon />}>{isArabic ? "طابعات التصنيفات" : "Category printers"}</Button>
            <Button onClick={() => setComplementDrawerOpen(true)} size="small" variant="outlined" color="inherit" startIcon={<SpaRoundedIcon />}>
              {isArabic ? `المكملات (${addonComplements.length})` : `Complements (${addonComplements.length})`}
            </Button>
            <ManagerExportMenu
              language={language}
              disabled={!menuExportRows.length || menuLoading || Boolean(menuError)}
              busy={exportBusy}
              onExport={handleExport}
            />
          </Box>
        </Box>

        {sortMode && <Box sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: "1px solid", borderColor: "divider" }}>
          <Alert severity="info" sx={{ mb: 1.25 }}>
            {isArabic ? "اسحب الأصناف أو استخدم الأسهم لتغيير ترتيب ظهورها في المنيو العامة. يُحفظ الترتيب للفرع الحالي ويشمل جميع الأصناف." : "Drag items or use the arrows to change their public menu order. The order includes all items and is saved for this branch."}
          </Alert>
          {sortError && <Alert severity="error" sx={{ mb: 1 }}>{sortError}</Alert>}
          <List disablePadding aria-label={isArabic ? "ترتيب أصناف المنيو" : "Menu item order"} sx={{ maxHeight: 360, overflowY: "auto" }}>
            {orderedItems.map((item, index) => <ListItem key={item.id} draggable={!sortSaving}
              onDragStart={() => setDraggedId(item.id)} onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); if (draggedId) void handleMove(draggedId, index); }}
              sx={{ mb: .5, px: 1, py: .5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default", cursor: sortSaving ? "wait" : "grab", gap: .5 }}>
              <DragIndicatorRoundedIcon aria-hidden="true" sx={{ color: "text.secondary" }} />
              <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 700 }} />
              <IconButton size="small" disabled={sortSaving || index === 0} aria-label={isArabic ? `نقل ${item.name} للأعلى` : `Move ${item.name} up`} onClick={() => handleMove(item.id, index - 1)}><KeyboardArrowUpRoundedIcon /></IconButton>
              <IconButton size="small" disabled={sortSaving || index === orderedItems.length - 1} aria-label={isArabic ? `نقل ${item.name} للأسفل` : `Move ${item.name} down`} onClick={() => handleMove(item.id, index + 1)}><KeyboardArrowDownRoundedIcon /></IconButton>
            </ListItem>)}
          </List>
        </Box>}

        <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: (menuError || itemError || imageEditError) ? 1.5 : 0 }}>
          {menuError && <Alert severity="error" sx={{ mb: 1 }} action={<Button color="inherit" size="small" onClick={refreshMenu}>{isArabic ? "إعادة المحاولة" : "Retry"}</Button>}>
            {isArabic ? "تعذر تحميل المنيو أو مزامنته. تحقق من الاتصال ثم أعد المحاولة." : "The menu could not be loaded or synced. Check the connection and retry."}
          </Alert>}
          {exportError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setExportError("")}>{exportError}</Alert>}
          {itemError && <Alert severity="error" sx={{ mb: 1 }}>{itemError}</Alert>}
          {imageEditError && <Alert severity="error" sx={{ mb: 1 }}>{imageEditError}</Alert>}
        </Box>

        {menuLoading && visibleItems.length === 0 ? <Box role="status" sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, py: 6 }}>
          <CircularProgress size={22} /><Typography color="text.secondary">{isArabic ? "جارٍ تحميل أصناف المنيو…" : "Loading menu items…"}</Typography>
        </Box> : visibleItems.length === 0 ? <Box sx={{ textAlign: "center", px: 2, py: 6 }}>
          <Typography fontWeight={800} color="text.primary">{menuError ? (isArabic ? "تعذر عرض الأصناف" : "Items could not be shown") : (isArabic ? "لا توجد أصناف مطابقة" : "No matching items")}</Typography>
          {!menuError && <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{isArabic ? "أضف صنفًا أو غيّر البحث أو التصنيف." : "Add an item or change your search or category."}</Typography>}
        </Box> : <>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", md: "none" }, px: 1.5, py: 1 }}>
            {isArabic ? "مرّر الجدول أفقيًا لعرض التفاصيل؛ الإجراءات ثابتة في الطرف." : "Scroll horizontally for details; actions stay visible at the edge."}
          </Typography>
          <TableContainer tabIndex={0} role="region" aria-label={isArabic ? "جدول أصناف قائمة الطعام" : "Menu items table"} sx={{ maxWidth: "100%", overflowX: "auto" }}>
            <Table sx={{ minWidth: 850, "& .MuiTableCell-root": { borderColor: "divider", textAlign: "start" } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.text.primary, .035) }}>
                  <TableCell sx={{ fontWeight: 850, width: "30%" }}>{isArabic ? "الصنف" : "Item"}</TableCell>
                  <TableCell sx={{ fontWeight: 850 }}>{isArabic ? "التصنيف" : "Category"}</TableCell>
                  <TableCell sx={{ fontWeight: 850 }}>{isArabic ? "السعر" : "Price"}</TableCell>
                  <TableCell sx={{ fontWeight: 850 }}>{isArabic ? "المكملات" : "Complements"}</TableCell>
                  <TableCell sx={{ fontWeight: 850 }}>{isArabic ? "التوفر" : "Availability"}</TableCell>
                  <TableCell sx={{ ...stickyAction, zIndex: 2, fontWeight: 850, whiteSpace: "nowrap" }}>{isArabic ? "الإجراءات" : "Actions"}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleItems.map((product, index) => {
                  const { count, limit } = getComplementSummary(product);
                  const availability = getAvailabilityState(product);
                  return <TableRow key={product.id} sx={{ "&:last-child td, &:last-child th": { borderBottom: 0 }, "&:hover td:not(:last-child), &:hover th": { bgcolor: "action.hover" } }}>
                    <TableCell component="th" scope="row" sx={{ minWidth: 230 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <MenuItemImage src={product.image} alt={product.name} imageLoading={product.imageLoading} imageError={product.imageError} loadImage={() => loadItemImage(product.id)} priority={index < 2} width={52} height={52} borderRadius={1.5} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 850, color: "text.primary", overflowWrap: "anywhere" }}>{product.name}</Typography>
                          {product.description && <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{product.description}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}><Typography variant="body2">{categoryNames.get(String(product.category_id)) || "—"}</Typography></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}><Typography variant="body2" sx={{ fontWeight: 850 }} dir="auto">{formatMenuPrice(product.price)} {storeInfo?.currency || ""}</Typography></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2">{isArabic ? `${count} · الحد ${limit}` : `${count} · max ${limit}`}</Typography>
                      <Button size="small" onClick={() => handleOpenEdit(product)} sx={{ p: 0, minWidth: 0, minHeight: 30, fontSize: ".8rem" }}>{isArabic ? "إدارة المكملات" : "Manage complements"}</Button>
                    </TableCell>
                    <TableCell sx={{ minWidth: 190 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: .25 }}>
                        <Switch checked={Boolean(product.available)} onChange={() => runItemAction(product.id, toggleAvailable)} disabled={Boolean(busyId)} color="success" size="small" slotProps={{ input: { "aria-label": isArabic ? `تغيير توفر ${product.name}` : `Change availability of ${product.name}` } }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, color: availability === "available" ? "success.main" : availability === "paused" ? "warning.main" : "text.secondary" }}>
                          {availability === "available" ? t("menuAvailable") : availability === "paused" ? (isArabic ? "متوقف بسبب المكونات" : "Paused by ingredients") : t("menuUnavailable")}
                        </Typography>
                      </Box>
                      {product.unavailableIngredients?.length > 0 && <Typography variant="caption" color="warning.main" sx={{ display: "block", lineHeight: 1.4 }}>
                        {isArabic ? `نفاد: ${product.unavailableIngredients.map((ingredient) => ingredient.name).join("، ")}` : `Out of stock: ${product.unavailableIngredients.map((ingredient) => ingredient.name).join(", ")}`}
                      </Typography>}
                      {product.hasUnknownIngredient && <Typography variant="caption" color="error.main" sx={{ display: "block", lineHeight: 1.4 }}>{isArabic ? "تعذر التحقق من أحد المكونات." : "An ingredient could not be verified."}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...stickyAction, whiteSpace: "nowrap", minWidth: 100 }}>
                      <IconButton size="small" color="primary" sx={{ width: 40, height: 40 }} title={t("menuEdit")} aria-label={isArabic ? `تعديل ${product.name}` : `Edit ${product.name}`} onClick={() => handleOpenEdit(product)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" sx={{ width: 40, height: 40 }} title={t("menuDelete")} aria-label={isArabic ? `حذف ${product.name}` : `Delete ${product.name}`} onClick={() => runItemAction(product.id, deleteItem)} disabled={Boolean(busyId)}><DeleteOutlinedIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>}
      </Box>

      <AddItemDrawer open={isOpen} onClose={() => { setIsOpen(false); setItemToEdit(null); }} itemToEdit={itemToEdit} />
      <CategoryPrintRoutingDrawer open={isPrinterRoutingOpen} onClose={() => setPrinterRoutingOpen(false)} categories={categoriesList} onUpdateCategories={updateCategoryPrintRoutes} />
      <AddonComplementDrawer open={isComplementDrawerOpen} onClose={() => setComplementDrawerOpen(false)} items={addonComplements} onAdd={addAddonComplement} onDelete={deleteAddonComplement} />

      <Dialog open={isCategoryModalOpen} onClose={() => setCategoryModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
          {t("menuDialogTitle")}
          <IconButton size="small" aria-label={t("menuClose")} onClick={() => setCategoryModalOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {categoryError && <Alert severity="error" sx={{ mb: 2 }}>{categoryError}</Alert>}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
            <TextField size="small" sx={{ flex: "1 1 180px" }} label={editingCategory ? t("menuEditCategory") : t("menuAddCategory")} placeholder={t("menuCategoryExample")} value={newCategoryTitle} onChange={(event) => setNewCategoryTitle(event.target.value)} />
            <Button variant="contained" onClick={handleSaveCategory} disabled={categorySaving || !newCategoryTitle.trim()} sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
              {categorySaving ? (isArabic ? "جارٍ الحفظ…" : "Saving…") : (editingCategory ? t("menuSave") : t("menuAdd"))}
            </Button>
            {editingCategory && <Button color="inherit" onClick={() => { setEditingCategory(null); setNewCategoryTitle(""); }}>{t("menuCancel")}</Button>}
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{t("menuCurrentCategories")} ({categoriesList.length})</Typography>
          <List disablePadding sx={{ maxHeight: 240, overflowY: "auto" }}>
            {categoriesList.map((category) => <ListItem key={category.id || category.name} disableGutters sx={{ display: "flex", alignItems: "center", gap: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.5, mb: 1, py: .75, px: 1 }}>
              <ListItemText primary={category.name} sx={{ minWidth: 0, my: 0 }} />
              <IconButton size="small" aria-label={isArabic ? `تعديل ${category.name}` : `Edit ${category.name}`} onClick={() => { setEditingCategory(category); setNewCategoryTitle(category.name); }} disabled={Boolean(busyId)}><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" color="error" aria-label={isArabic ? `حذف ${category.name}` : `Delete ${category.name}`} onClick={() => handleDeleteCategory(category.id)} disabled={Boolean(busyId)}><DeleteOutlinedIcon fontSize="small" /></IconButton>
            </ListItem>)}
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setCategoryModalOpen(false)}>{t("menuClose")}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default MenuControl;
