// مكوّن واجهة `OrdersHistory` ضمن مجموعة `orders`.
import { useState, useMemo } from "react";
import dayjs from "dayjs";

import InvoiceModal from "./OrderPill";

// CONTEXTS
import { useOrders } from "../../../context/OrdersContext";
import { useStore } from "../../../context/StoreInfoContext";
import { useBranch } from "../../../context/BranchContext";
import { useLanguage } from "../../../context/LanguageContext";

// MUI COMPONENTS
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";

// ICONS
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import LocalPrintshopIcon from "@mui/icons-material/LocalPrintshop";
import ManagerExportMenu from "../ManagerExportMenu";
import { downloadCsv, downloadXlsx } from "../Analytics/reportExport";
import { openManagerPrintableReport } from "../../../utils/managerPrintableReport";

// DATE PICKER
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

const renderStatusChip = (status, t) => {
  const statusMap = {
    served: { label: t("managerServed"), color: "success" },
    unclaimed: { label: t("managerUnclaimed"), color: "warning" },
    cancelled: { label: t("managerCancelled"), color: "error" },
  };

  const config = statusMap[status] || { label: status, color: "default" };

  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 700 }}
    />
  );
};

const orderLocation = (order) => {
  const value = String(order.table_number || "").toLowerCase();
  if (/سفري|takeaway/.test(value)) return "takeaway";
  if (/محلي|كاشير|cashier|pos|محل/.test(value)) return "cashier";
  return "table";
};

const printSafe = (value) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function OrderRow({ order, currency, t, language }) {
  const [open, setOpen] = useState(false);
  const [openInvoice, setOpenInvoice] = useState(false);
  const shortOrderId = order.order_number || order.displayOrderNumber || "—";

  return (
    <>
      <TableRow
        sx={{
          "& > *": { borderBottom: "unset" },
          "&:hover": { bgcolor: "rgba(244,121,32,.025)" },
        }}
      >
        <TableCell width={50}>
          <IconButton className="orders-history-no-print" size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          <Chip
            label={`#${shortOrderId}`}
            size="small"
            sx={{
              borderRadius: 2,
              fontWeight: 900,
              bgcolor: "rgba(244,121,32,.08)",
              color: "primary.dark",
              letterSpacing: ".04em",
            }}
          />
        </TableCell>
        <TableCell align="center">{t("managerTable")} {order.table_number}</TableCell>
        <TableCell align="center">
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: "text.secondary", whiteSpace: "nowrap" }}
          >
            {dayjs(order.created_at).format("DD/MM/YY")}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "text.disabled", fontWeight: 700, display: "block" }}
          >
            {dayjs(order.created_at).format("hh:mm A")}
          </Typography>
        </TableCell>
        <TableCell align="center">{renderStatusChip(order.status, t)}</TableCell>
        <TableCell align="center" sx={{ fontWeight: 700 }}>
          {order.total_price} {currency}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1.5,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t("managerItems")}
                </Typography>

                <Button
                  className="orders-history-no-print"
                  size="small"
                  variant="outlined"
                  startIcon={<ReceiptLongIcon />}
                  onClick={() => setOpenInvoice(true)}
                >
                  استعراض الفاتورة
                </Button>
              </Box>

              <Stack spacing={1} sx={{ mb: 2 }}>
                {order.items?.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      maxWidth: 400,
                      p: 1,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2">
                        {item.name} × {item.quantity}
                      </Typography>
                      {Array.isArray(item.selected_addons) && item.selected_addons.length > 0 && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {language === "ar" ? "إضافات: " : "Add-ons: "}
                          {item.selected_addons.map((addon) => typeof addon === "string" ? addon : addon?.name).filter(Boolean).join(language === "ar" ? "، " : ", ")}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {item.price * item.quantity} {currency}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              {order.notes && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {t("managerNotes")}: {order.notes}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <InvoiceModal
        open={openInvoice}
        onClose={() => setOpenInvoice(false)}
        order={order}
      />
    </>
  );
}

function OrdersHistory() {
  const { t, language } = useLanguage();
  const { orders = [] } = useOrders();
  const { storeInfo } = useStore();
  const { selectedBranch, selectedBranchId } = useBranch();
  const currency = storeInfo?.currency || t("currencySar");
  const filterCopy = language === "ar"
    ? {
      subtitle: "ابحث عن الطلبات المكتملة وراجع تفاصيلها أو اطبع السجل.",
      payment: "طريقة الدفع", all: "الكل", paid: "مدفوع", unpaid: "غير مدفوع",
      cash: "نقد", card: "شبكة", split: "نقدًا + شبكة", location: "نوع الطلب",
      table: "طاولة", takeaway: "سفري", cashier: "كاشير", range: "نطاق السجل",
      day: "اليوم", week: "الأسبوع", month: "الشهر", print: "طباعة السجل",
      count: "طلب", total: "الإجمالي",
    }
    : {
      subtitle: "Find completed orders, review their details, or print the filtered log.",
      payment: "Payment method", all: "All", paid: "Paid", unpaid: "Unpaid",
      cash: "Cash", card: "Card", split: "Cash + card", location: "Order type",
      table: "Dine-in", takeaway: "Takeaway", cashier: "Cashier", range: "Log range",
      day: "Day", week: "Week", month: "Month", print: "Print log",
      count: "orders", total: "Total",
    };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [rangeMode, setRangeMode] = useState("day");
  const [exportBusy, setExportBusy] = useState("");
  const [exportError, setExportError] = useState("");

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => order.is_completed)
      .filter((order) => {
        const matchesSearch =
          String(order.order_number || order.displayOrderNumber || "").includes(searchQuery.trim()) ||
          String(order.table_number).includes(searchQuery);

        const matchesStatus =
          statusFilter === "all" ? true : order.status === statusFilter;

        const matchesDate = selectedDate
          ? dayjs(order.created_at).isSame(selectedDate, rangeMode)
          : true;

        const matchesPayment = paymentFilter === "all"
          ? true
          : paymentFilter === "paid" ? order.payment_status === "paid"
            : paymentFilter === "unpaid" ? order.payment_status !== "paid"
              : order.payment_method === paymentFilter;
        const matchesLocation = locationFilter === "all" || orderLocation(order) === locationFilter;

        return matchesSearch && matchesStatus && matchesDate && matchesPayment && matchesLocation;
      });
  }, [orders, searchQuery, statusFilter, selectedDate, paymentFilter, locationFilter, rangeMode]);

  const paymentMethodLabel = (method) => ({
    cash: filterCopy.cash,
    card: filterCopy.card,
    split: filterCopy.split,
  })[String(method || "").toLowerCase()] || method || "—";
  const orderStatusLabel = (status) => ({
    served: t("managerServed"),
    unclaimed: t("managerUnclaimed"),
    cancelled: t("managerCancelled"),
  })[status] || status || "—";
  const exportModel = {
    rtl: language === "ar",
    title: language === "ar" ? "سجل الطلبات" : "Order history",
    filename: `servio-orders-${selectedBranchId || "branch"}-${selectedDate?.format("YYYY-MM-DD") || dayjs().format("YYYY-MM-DD")}`,
    sections: [{
      name: language === "ar" ? "سجل الطلبات" : "Order history",
      title: filterCopy.subtitle,
      columns: language === "ar"
        ? ["الفرع", "رقم الطلب", "الطاولة / النوع", "التاريخ والوقت", "الحالة", "حالة الدفع", "طريقة الدفع", "الأصناف", "ملاحظات", "الإجمالي", "العملة"]
        : ["Branch", "Order number", "Table / type", "Date and time", "Status", "Payment status", "Payment method", "Items", "Notes", "Total", "Currency"],
      rows: filteredOrders.map((order) => [
        selectedBranch?.name || "",
        order.order_number || order.displayOrderNumber || "—",
        order.table_number || "—",
        dayjs(order.created_at).isValid() ? dayjs(order.created_at).format("YYYY-MM-DD HH:mm") : "—",
        orderStatusLabel(order.status),
        order.payment_status === "paid" ? filterCopy.paid : filterCopy.unpaid,
        paymentMethodLabel(order.payment_method),
        (order.items || []).map((item) => `${item.name || (language === "ar" ? "صنف" : "Item")} × ${item.quantity ?? 1}`).join("، "),
        order.notes || "",
        Number(order.total_price) || 0,
        currency,
      ]),
    }],
  };

  const handleExport = async (format) => {
    if (format === "pdf") {
      const total = filteredOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
      try {
        openManagerPrintableReport({
          title: exportModel.title,
          subtitle: `${filterCopy.subtitle} · ${filteredOrders.length} ${filterCopy.count}`,
          columns: exportModel.sections[0].columns,
          rows: exportModel.sections[0].rows,
          summary: [
            [language === "ar" ? "الفرع" : "Branch", selectedBranch?.name || "—"],
            [filterCopy.count, filteredOrders.length],
            [filterCopy.total, `${new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)} ${currency}`],
          ],
          language,
        });
      } catch (error) {
        console.error("Order history PDF print failed:", error);
        setExportError(language === "ar" ? "تعذر فتح نافذة التقرير. اسمح بالنوافذ المنبثقة ثم أعد المحاولة." : "Could not open the report window. Allow pop-ups and retry.");
      }
      return;
    }
    setExportBusy(format);
    setExportError("");
    try {
      if (format === "csv") downloadCsv(exportModel);
      else await downloadXlsx(exportModel);
    } catch (error) {
      console.error("Order history export failed:", error);
      setExportError(language === "ar" ? "تعذر إعداد الملف. أعد المحاولة أو اختر صيغة أخرى." : "Could not prepare the file. Retry or choose another format.");
    } finally {
      setExportBusy("");
    }
  };

  const printFilteredOrders = () => {
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      setExportError(language === "ar" ? "اسمح بالنوافذ المنبثقة للطباعة أو حفظ التقرير PDF." : "Allow pop-ups to print or save this report as PDF.");
      return;
    }
    const rows = filteredOrders.map((order) => `<tr><td>${printSafe(order.order_number || order.displayOrderNumber || "—")}</td><td>${printSafe(order.table_number)}</td><td>${printSafe(dayjs(order.created_at).format("DD/MM/YYYY HH:mm"))}</td><td>${printSafe(order.status)}</td><td>${printSafe(order.payment_status === "paid" ? (language === "ar" ? "مدفوع" : "Paid") : (language === "ar" ? "غير مدفوع" : "Unpaid"))}</td><td>${printSafe(order.total_price)} ${printSafe(currency)}</td></tr>`).join("");
    const tableLabel = language === "ar" ? "الطاولة" : "Table";
    const orderLabel = language === "ar" ? "رقم الطلب" : "Order";
    const dateLabel = language === "ar" ? "التاريخ والوقت" : "Date & time";
    const statusLabel = language === "ar" ? "الحالة" : "Status";
    const paymentLabel = language === "ar" ? "الدفع" : "Payment";
    const totalLabel = language === "ar" ? "الإجمالي" : "Total";
    const thermalRows = filteredOrders.map((order) => `<article class="thermal-record"><header><strong>${printSafe(orderLabel)} #${printSafe(order.order_number || order.displayOrderNumber || "—")}</strong><strong>${printSafe(order.total_price)} ${printSafe(currency)}</strong></header><div>${printSafe(tableLabel)}: ${printSafe(order.table_number)}</div><div>${printSafe(dateLabel)}: ${printSafe(dayjs(order.created_at).format("DD/MM/YYYY HH:mm"))}</div><div>${printSafe(statusLabel)}: ${printSafe(order.status)}</div><div>${printSafe(paymentLabel)}: ${printSafe(order.payment_status === "paid" ? (language === "ar" ? "مدفوع" : "Paid") : (language === "ar" ? "غير مدفوع" : "Unpaid"))}</div></article>`).join("");
    const printCss = `@page{size:A4 landscape;margin:12mm}@page thermal58{size:58mm auto;margin:3mm}@page thermal80{size:80mm auto;margin:4mm}body[data-paper="58"]{page:thermal58}body[data-paper="80"]{page:thermal80}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171A2F;margin:0}h1{font-size:22px;margin:0 0 6px}p{color:#606778;margin:0 0 18px;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#171A2F;color:#fff;font-weight:700}th,td{border:1px solid #d9dde5;padding:9px 8px;text-align:start}tbody tr:nth-child(even){background:#f7f8fa}.meta{display:flex;justify-content:space-between;gap:8px;margin-bottom:18px;color:#606778;font-size:12px}.print-tools{display:flex;align-items:center;gap:8px;padding:10px;margin-bottom:16px;background:#fff7ed;border:1px solid #f47920;border-radius:8px}.print-tools label{font-weight:bold}.print-tools select,.print-tools button{font:inherit;padding:7px;border:1px solid #f47920;border-radius:5px;background:#fff}.print-tools button{background:#f47920;color:#fff;font-weight:bold}.thermal-list{display:none}body[data-paper="58"] .desktop-table,body[data-paper="80"] .desktop-table{display:none}body[data-paper="58"] .thermal-list,body[data-paper="80"] .thermal-list{display:block}.thermal-record{padding:7px 0;border-bottom:1px dashed #777;overflow-wrap:anywhere}.thermal-record header{display:flex;justify-content:space-between;gap:4px;margin-bottom:4px}.thermal-record div{margin:2px 0}@media print{.print-tools{display:none!important}body[data-paper="58"],body[data-paper="80"]{width:100%;font-size:8pt}body[data-paper="58"] h1,body[data-paper="80"] h1{font-size:12pt}body[data-paper="58"] .meta,body[data-paper="80"] .meta{display:block;font-size:8pt;margin-bottom:8px}body[data-paper="58"] .thermal-record,body[data-paper="80"] .thermal-record{break-inside:avoid}}`;
    printWindow.document.write(`<!doctype html><html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${language === "ar" ? "سجل الطلبات" : "Order history"}</title><style>${printCss}</style></head><body data-paper="a4"><div class="print-tools"><label for="paper-size">${language === "ar" ? "مقاس الطباعة" : "Print size"}</label><select id="paper-size"><option value="a4">A4</option><option value="58">${language === "ar" ? "حراري 58mm" : "Thermal 58mm"}</option><option value="80">${language === "ar" ? "حراري 80mm" : "Thermal 80mm"}</option></select><button type="button" onclick="window.print()">${language === "ar" ? "طباعة" : "Print"}</button></div><h1>${language === "ar" ? "سجل الطلبات" : "Order history"}</h1><div class="meta"><span>${language === "ar" ? "البيانات الظاهرة بعد الفلترة" : "Data shown after filters"}</span><span>${filteredOrders.length} ${language === "ar" ? "طلب" : "orders"}</span></div><table class="desktop-table"><thead><tr><th>${orderLabel}</th><th>${tableLabel}</th><th>${dateLabel}</th><th>${statusLabel}</th><th>${paymentLabel}</th><th>${totalLabel}</th></tr></thead><tbody>${rows || `<tr><td colspan="6" style="text-align:center">${language === "ar" ? "لا توجد بيانات" : "No data"}</td></tr>`}</tbody></table><section class="thermal-list">${thermalRows || `<p>${language === "ar" ? "لا توجد بيانات" : "No data"}</p>`}</section><script>document.getElementById('paper-size').addEventListener('change',event=>{document.body.dataset.paper=event.target.value});window.onafterprint=()=>window.close()</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } .orders-history-no-print { display: none !important; } .orders-history-print-summary { display: block !important; } .orders-history-print-table { box-shadow: none !important; border: 1px solid #d7dbe2 !important; overflow: visible !important; } .orders-history-print-table table { min-width: 0 !important; width: 100% !important; } .orders-history-print-table th, .orders-history-print-table td { padding: 6px 8px !important; font-size: 10pt !important; } } .orders-history-print-summary { display: none; }`}</style>
      <Box className="orders-history-no-print" sx={{ mb: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 1.5, mb: 1.75 }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 900, fontSize: { xs: "1.55rem", sm: "2rem" } }}>
              {language === "ar" ? "سجل الطلبات" : "Order history"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{filterCopy.subtitle}</Typography>
          </Box>
          <Chip color="primary" variant="outlined" label={`${filteredOrders.length.toLocaleString(language === "ar" ? "ar-SA" : "en-SA")} ${filterCopy.count}`} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, fontWeight: 800, fontVariantNumeric: "tabular-nums" }} />
        </Stack>

        <Paper variant="outlined" sx={{ p: { xs: 1.25, sm: 1.75 }, borderRadius: 3, borderColor: "divider", bgcolor: "background.paper" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
            <TextField
              placeholder={t("managerHistorySearch")}
              aria-label={t("managerHistorySearch")}
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ gridColumn: "1 / -1" }}
            />
            <FormControl size="small" sx={{ minWidth: 0 }}>
              <InputLabel id="status-filter-label">{t("managerStatus")}</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                label={t("managerStatus")}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">{t("managerAllStatuses")}</MenuItem>
                <MenuItem value="served">{t("managerServed")}</MenuItem>
                <MenuItem value="unclaimed">{t("managerUnclaimed")}</MenuItem>
                <MenuItem value="cancelled">{t("managerCancelled")}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 0 }}>
              <InputLabel id="payment-filter-label">{filterCopy.payment}</InputLabel>
              <Select labelId="payment-filter-label" value={paymentFilter} label={filterCopy.payment} onChange={(e) => setPaymentFilter(e.target.value)}>
                <MenuItem value="all">{filterCopy.all}</MenuItem><MenuItem value="paid">{filterCopy.paid}</MenuItem><MenuItem value="unpaid">{filterCopy.unpaid}</MenuItem><MenuItem value="cash">{filterCopy.cash}</MenuItem><MenuItem value="card">{filterCopy.card}</MenuItem><MenuItem value="split">{filterCopy.split}</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 0 }}>
              <InputLabel id="location-filter-label">{filterCopy.location}</InputLabel>
              <Select labelId="location-filter-label" value={locationFilter} label={filterCopy.location} onChange={(e) => setLocationFilter(e.target.value)}>
                <MenuItem value="all">{filterCopy.all}</MenuItem><MenuItem value="table">{filterCopy.table}</MenuItem><MenuItem value="takeaway">{filterCopy.takeaway}</MenuItem><MenuItem value="cashier">{filterCopy.cashier}</MenuItem>
              </Select>
            </FormControl>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label={t("managerDate")}
              value={selectedDate}
              onChange={(newValue) => setSelectedDate(newValue)}
              format="YYYY/MM/DD"
              slotProps={{
                field: { clearable: true, onClear: () => setSelectedDate(null) },
                textField: {
                  size: "small",
                  slotProps: { inputLabel: { shrink: true } },
                  sx: { width: "100%" },
                },
              }}
            />
          </LocalizationProvider>
          <FormControl size="small" sx={{ minWidth: 0 }}>
            <InputLabel id="history-range-label">{filterCopy.range}</InputLabel>
            <Select labelId="history-range-label" value={rangeMode} label={filterCopy.range} onChange={(e) => setRangeMode(e.target.value)}>
              <MenuItem value="day">{filterCopy.day}</MenuItem>
              <MenuItem value="week">{filterCopy.week}</MenuItem>
              <MenuItem value="month">{filterCopy.month}</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, display: "flex", gap: 1, flexWrap: "wrap" }}>
            <ManagerExportMenu
              language={language}
              disabled={!filteredOrders.length}
              busy={exportBusy}
              onExport={handleExport}
            />
            <Button variant="contained" startIcon={<LocalPrintshopIcon />} onClick={printFilteredOrders} disabled={!filteredOrders.length} sx={{ flex: 1, minHeight: 42, fontWeight: 800, whiteSpace: "nowrap" }}>
              {filterCopy.print}
            </Button>
          </Box>
        </Box>
        </Paper>
        {exportError && <Alert severity="error" onClose={() => setExportError("")} sx={{ mt: 1.25 }}>{exportError}</Alert>}
      </Box>

      <Box className="orders-history-print-summary" sx={{ mb: 2, textAlign: "start" }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 900 }}>{language === "ar" ? "سجل الطلبات" : "Order history"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
          {language === "ar" ? `البيانات الظاهرة بعد الفلترة · ${filteredOrders.length} طلب` : `Data currently shown after filters · ${filteredOrders.length} orders`}
        </Typography>
      </Box>

      <Typography className="orders-history-no-print" variant="caption" color="text.secondary" sx={{ display: { xs: "block", md: "none" }, mb: .7, textAlign: "start" }}>
        {language === "ar" ? "اسحب الجدول أفقيًا لعرض بقية التفاصيل." : "Swipe the table horizontally to view all details."}
      </Typography>
      <TableContainer component={Paper} className="orders-history-print-table" sx={{ maxWidth: "100%", borderRadius: { xs: 2.5, md: 3.5 }, boxShadow: "none", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
        <Table sx={{ minWidth: { xs: 680, sm: 760 } }}>
          <TableHead sx={{ bgcolor: "action.hover" }}>
            <TableRow>
              <TableCell width={50} />
              <TableCell sx={{ fontWeight: 700 }}>{t("managerOrderNumber")}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {t("managerTable")}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {t("managerDateTime")}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {t("managerStatus")}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {t("managerTotal")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <OrderRow key={order.id} order={order} currency={currency} t={t} language={language} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {t("managerNoMatches")}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default OrdersHistory;
