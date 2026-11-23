import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { createTheme, ThemeProvider, useTheme } from "@mui/material/styles";
import Analytics from "./Analytics";
import { useAnalytics } from "../../context/AnalyticsContext";
import { buildReportExportModel, downloadCsv, downloadPdf, downloadXlsx } from "./Analytics/reportExport";
import { BarChart } from "@mui/x-charts/BarChart";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import LocalPrintshopOutlinedIcon from "@mui/icons-material/LocalPrintshopOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import supabase from "../../supabase";
import { useTenant } from "../../context/TenantContext";
import { useBranch } from "../../context/BranchContext";
import { useStore } from "../../context/StoreInfoContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  aggregateSalesReport,
  createSalesSeries,
  getPresetDateRange,
  getUtcDateBounds,
} from "../../utils/salesReportUtils";
import { getWorkdaySchedule } from "../../utils/workdayUtils";
import { aggregateTableTurnover, buildTableTurnoverDetails } from "../../utils/tableOrderUtils";

const PAGE_SIZE = 500;

const COPY = {
  ar: {
    title: "التقارير والتحليلات",
    subtitle: "كل ما تحتاجه لفهم أداء نشاطك، من اللمحة اليومية إلى تفاصيل المبيعات.",
    daily: "اليوم التشغيلي",
    weekly: "الأسبوع الكامل",
    monthly: "الشهر الكامل",
    range: "الفترة",
    gross: "إجمالي المبيعات شامل الضريبة",
    net: "صافي المبيعات قبل الضريبة",
    vat: "ضريبة القيمة المضافة المستخرجة · 15/115",
    orders: "الطلبات المكتملة",
    average: "متوسط قيمة الطلب",
    itemQuantity: "الوحدات المباعة",
    dailyTrend: "المبيعات حسب الساعة",
    periodTrend: "المبيعات حسب اليوم",
    topItems: "الأصناف الأعلى مبيعًا",
    tableRevenue: "إيرادات الطاولات", table: "الطاولة", tableOrders: "عدد الطلبات", unspecifiedTable: "غير محددة", tableTurnover: "سرعة دوران الطاولات", turnsPerTable: "متوسط الطلبات للطاولة", averageDuration: "متوسط مدة الطلب", minutes: "دقيقة", tableOrderDetails: "تفاصيل طلبات الطاولات", orderNumber: "رقم الطلب", orderTime: "وقت الطلب", previousOrderGap: "الفاصل عن الطلب السابق", orderDuration: "مدة الإكمال", noTableOrders: "لا توجد طلبات طاولات فعلية مكتملة في هذه الفترة.", printSize: "مقاس الطباعة", printA4: "A4", print58: "حراري 58mm", print80: "حراري 80mm", startPrint: "فتح نافذة الطباعة",
    rank: "الترتيب",
    item: "الصنف",
    quantity: "الكمية",
    itemSales: "مبيعات الصنف",
    saveCsv: "حفظ التقرير بصيغة CSV",
    print: "طباعة البيانات الظاهرة",
    refresh: "تحديث البيانات",
    loading: "جارٍ إعداد التقرير…",
    error: "تعذر تحميل بيانات التقرير. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.",
    noData: "لا توجد مبيعات مكتملة خلال هذه الفترة.",
    note: "يُحسب تاريخ البيع من وقت الدفع للطلبات المدفوعة، ثم وقت الإكمال، ثم الإنشاء للطلبات القديمة، حسب المنطقة الزمنية المحلية للجهاز. المبيعات تشمل الإجمالي المسجل بالأسعار النهائية الشاملة للضريبة، وتُستخرج VAT على مستوى كل طلب. لا يعرض التقرير توزيع طرق الدفع أو الخصومات/الاستردادات لأنها لا تُحفظ حاليًا كبيانات منظمة.",
    csvTitle: "تقرير مبيعات SERVIO",
    csvFrom: "من",
    csvTo: "إلى",
    currency: "ر.س",
    unknownItem: "صنف بدون اسم",
  },
  en: {
    title: "Reports and analytics",
    subtitle: "Understand your business, from the daily overview to detailed sales.",
    daily: "Operational day",
    weekly: "Full week",
    monthly: "Full month",
    range: "Period",
    gross: "Total sales incl. VAT",
    net: "Net sales before VAT",
    vat: "VAT extracted · 15/115",
    orders: "Completed orders",
    average: "Average order value",
    itemQuantity: "Items sold",
    dailyTrend: "Sales by hour",
    periodTrend: "Sales by day",
    topItems: "Top-selling items",
    tableRevenue: "Table revenue", table: "Table", tableOrders: "Order count", unspecifiedTable: "Unspecified", tableTurnover: "Table turnover", turnsPerTable: "Average orders per table", averageDuration: "Average order duration", minutes: "min", tableOrderDetails: "Table order details", orderNumber: "Order number", orderTime: "Order time", previousOrderGap: "Gap since previous order", orderDuration: "Completion time", noTableOrders: "No completed physical-table orders in this period.", printSize: "Print size", printA4: "A4", print58: "Thermal 58mm", print80: "Thermal 80mm", startPrint: "Open print dialog",
    rank: "Rank",
    item: "Item",
    quantity: "Quantity",
    itemSales: "Item sales",
    saveCsv: "Save report as CSV",
    print: "Print visible data",
    refresh: "Refresh data",
    loading: "Preparing report…",
    error: "Could not load report data. Check connection and permissions, then try again.",
    noData: "There are no completed sales in this period.",
    note: "Sales date uses payment time for paid orders, then completion time, then creation time for legacy orders, in the device's local time zone. Sales use stored final prices inclusive of VAT; VAT is extracted per order. Payment-method, discount, and refund breakdowns are not shown because these are not currently stored as structured order data.",
    csvTitle: "SERVIO sales report",
    csvFrom: "From",
    csvTo: "To",
    currency: "SAR",
    unknownItem: "Unnamed item",
  },
};

function localDateForDisplay(value, locale) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(year, month - 1, day));
}

function formatOrderDateTime(value, locale) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatDuration(value, locale, minutesLabel) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(value))} ${minutesLabel}`;
}

const printSafe = (value) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function MetricCard({ title, value, detail }) {
  return (
    <Card className="reports-print-card" elevation={0} sx={{ height: "100%", borderRadius: "16px", border: "1px solid", borderColor: "divider", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ lineHeight: 1.5, minHeight: 42 }}>{title}</Typography>
        <Typography variant="h5" fontWeight={800} sx={{ mt: 1, fontSize: { xs: "1.2rem", sm: "1.45rem" }, color: "text.primary", overflowWrap: "anywhere" }}>{value}</Typography>
        {detail && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .5 }}>{detail}</Typography>}
      </CardContent>
    </Card>
  );
}

function Reports() {
  const theme = useTheme();
  const darkTheme = useMemo(() => createTheme(theme, { palette: { mode: "dark", primary: { main: "#dd7b3b", dark: "#b85f2e", contrastText: "#fff8ef" }, secondary: { main: "#302923" }, background: { default: "#191714", paper: "#24211e" }, text: { primary: "#f7efe4", secondary: "#bdb0a2" }, divider: "#433a33" } }), [theme]);
  const reportRef = useRef(null);
  const analytics = useAnalytics();
  const [exportBusy, setExportBusy] = useState("");
  const [exportError, setExportError] = useState("");
  const { tenantId, loading: tenantLoading } = useTenant();
  const { selectedBranchId: branchId } = useBranch();
  const { storeInfo = {} } = useStore();
  const { language, t } = useLanguage();
  const text = COPY[language] || COPY.ar;
  const locale = language === "ar" ? "ar-SA" : "en-SA";
  const [period, setPeriod] = useState("daily");
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportClock, setReportClock] = useState(() => new Date());
  const schedule = useMemo(() => getWorkdaySchedule(storeInfo), [storeInfo]);
  const range = useMemo(() => getPresetDateRange(period, reportClock, schedule.startMinutes), [period, reportClock, schedule.startMinutes]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshReport = () => {
    setReportClock(new Date());
    setRefreshKey((key) => key + 1);
  };

  useEffect(() => {
    if (tenantLoading) return undefined;
    if (!tenantId) {
      setOrders([]);
      setLoading(false);
      setError(text.error);
      return undefined;
    }

    if (!branchId) { setOrders([]); setLoading(true); setError(""); return undefined; }

    let active = true;
    const loadReportOrders = async () => {
      setLoading(true);
      setError("");
      setOrders([]);
      try {
        const { start, endExclusive } = getUtcDateBounds(range.from, range.to, schedule.startMinutes);
        // نقرأ الأعمدة الضرورية فقط ونقسم النتائج؛ لا نحمّل تاريخًا خارج الفترة ولا نطلب صور الأصناف.
        const saleDateFilter = `and(payment_status.eq.paid,paid_at.gte.${start},paid_at.lt.${endExclusive}),and(or(payment_status.neq.paid,payment_status.is.null,paid_at.is.null),completed_at.gte.${start},completed_at.lt.${endExclusive}),and(or(payment_status.neq.paid,payment_status.is.null,paid_at.is.null),completed_at.is.null,created_at.gte.${start},created_at.lt.${endExclusive})`;
        const allRows = [];
        for (let offset = 0; active; offset += PAGE_SIZE) {
          const { data, error: queryError } = await supabase
            .from("orders")
            .select("id,created_at,completed_at,paid_at,payment_status,status,total_price,items,table_number")
            .eq("tenant_id", tenantId).eq("branch_id", branchId)
            .in("status", ["ready", "served", "unclaimed"])
            .or("status.neq.ready,payment_status.eq.paid")
            .or(saleDateFilter)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
          if (queryError) throw queryError;
          const page = data || [];
          allRows.push(...page);
          if (page.length < PAGE_SIZE) break;
        }
        if (active) setOrders(allRows);
      } catch (loadError) {
        if (active) {
          setOrders([]);
          setError(text.error);
          console.error("تعذر تحميل تقرير المبيعات:", { code: loadError?.code, status: loadError?.status, message: loadError?.message });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReportOrders();
    return () => { active = false; };
  }, [tenantId, branchId, tenantLoading, range.from, range.to, refreshKey, text.error, schedule.startMinutes]);

  const report = useMemo(() => aggregateSalesReport(orders, schedule), [orders, schedule]);
  const tableTurnover = useMemo(() => aggregateTableTurnover(orders, schedule), [orders, schedule]);
  const tableTurnoverDetails = useMemo(() => buildTableTurnoverDetails(orders, schedule), [orders, schedule]);
  const series = useMemo(() => createSalesSeries(orders, range.from, range.to, period, locale, schedule), [orders, range.from, range.to, period, locale, schedule]);
  const currency = storeInfo?.currency || t("currencySar") || text.currency;
  const formatMoney = (value) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} ${currency}`;
  const fromLabel = localDateForDisplay(range.from, locale);
  const toLabel = localDateForDisplay(range.to, locale);
  const rangeLabel = range.from === range.to ? fromLabel : `${fromLabel} – ${toLabel}`;
  const handleExport = async (kind) => {
    setExportBusy(kind);
    setExportError("");
    try {
      const model = buildReportExportModel({ report, tableTurnover, tableTurnoverDetails, series, range, text, currency, analyticsCurrency: t("currencySar"), analytics, language });
      if (kind === "csv") downloadCsv(model);
      else if (kind === "xlsx") await downloadXlsx(model);
      else await downloadPdf(reportRef.current, model.filename);
    } catch (exportFailure) {
      console.error("Report export failed:", exportFailure);
      setExportError(language === "ar" ? "تعذر تصدير التقرير. حاول مرة أخرى أو جرّب صيغة أخرى." : "Could not export the report. Try again or choose another format.");
    } finally {
      setExportBusy("");
    }
  };

  const printReportTable = () => {
    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (!printWindow) return;
    const metrics = [[text.gross, formatMoney(report.gross)], [text.net, formatMoney(report.net)], [text.vat, formatMoney(report.vat)], [text.orders, new Intl.NumberFormat(locale).format(report.orderCount)], [text.average, formatMoney(report.averageOrder)], [text.itemQuantity, new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(report.itemQuantity)]]
      .map(([label, value]) => `<tr><th>${printSafe(label)}</th><td>${printSafe(value)}</td></tr>`).join("");
    const items = report.topItems.map((item, index) => `<tr><td data-label="${printSafe(text.rank)}">${index + 1}</td><td data-label="${printSafe(text.item)}">${printSafe(item.name || text.unknownItem)}</td><td data-label="${printSafe(text.quantity)}">${printSafe(item.quantity)}</td><td data-label="${printSafe(text.itemSales)}">${printSafe(formatMoney(item.revenue))}</td></tr>`).join("");
    const tableRows = report.tableRevenue.map((table) => `<tr><td data-label="${printSafe(text.table)}">${printSafe(table.tableNumber || text.unspecifiedTable)}</td><td data-label="${printSafe(text.tableOrders)}">${printSafe(table.orderCount)}</td><td data-label="${printSafe(text.gross)}">${printSafe(formatMoney(table.revenue))}</td></tr>`).join("");
    const turnoverRows = tableTurnoverDetails.flatMap((table) => table.orders.map((order) => `<tr><td data-label="${printSafe(text.table)}">${printSafe(table.table)}</td><td data-label="${printSafe(text.orderNumber)}">${printSafe(order.orderNumber)}</td><td data-label="${printSafe(text.orderTime)}">${printSafe(formatOrderDateTime(order.createdAt, locale))}</td><td data-label="${printSafe(text.previousOrderGap)}">${printSafe(formatDuration(order.gapMinutes, locale, text.minutes))}</td><td data-label="${printSafe(text.orderDuration)}">${printSafe(formatDuration(order.durationMinutes, locale, text.minutes))}</td><td data-label="${printSafe(text.gross)}">${printSafe(formatMoney(order.totalPrice))}</td></tr>`)).join("");
    const printCss = `@page thermal58{size:58mm auto;margin:2mm}@page thermal80{size:80mm auto;margin:2mm}body[data-paper="58"]{page:thermal58}body[data-paper="80"]{page:thermal80}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171A2F;margin:0}h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:24px 0 8px}.meta{color:#606778;font-size:12px;margin-bottom:18px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;table-layout:fixed;overflow-wrap:anywhere}th{background:#171A2F;color:#fff;font-weight:700;text-align:start}th,td{border:1px solid #d9dde5;padding:9px 8px;text-align:start}table.metrics th{background:#f0f2f5;color:#171A2F;width:55%}tbody tr:nth-child(even){background:#f7f8fa}.print-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:18px}.print-tools button,.print-tools select{font:inherit;padding:8px 10px;border:1px solid #f47920;border-radius:5px;background:#fff}.print-tools button{background:#f47920;color:white;font-weight:bold;cursor:pointer}@media print{.print-tools{display:none!important}.metrics{page-break-inside:avoid}body[data-paper="58"],body[data-paper="80"]{font-size:8pt}body[data-paper="58"] h1,body[data-paper="80"] h1{font-size:13pt}body[data-paper="58"] h2,body[data-paper="80"] h2{font-size:10pt;margin:12px 0 5px}.thermal-table,.thermal-table tbody,.thermal-table tr,.thermal-table td{display:block;width:100%}.thermal-table thead{display:none}.thermal-table tr{margin:0 0 5px;padding:2px;border:1px solid #cbd5e1;break-inside:avoid}.thermal-table td{display:flex;justify-content:space-between;gap:6px;padding:2px;border:0;text-align:start}.thermal-table td::before{content:attr(data-label);font-weight:700;max-width:48%}.metrics{display:table}.metrics tbody{display:table-row-group}.metrics tr{display:table-row}.metrics th,.metrics td{display:table-cell;padding:3px;font-size:8pt}}`;
    printWindow.document.write(`<!doctype html><html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${printSafe(text.csvTitle)}</title><style>${printCss}</style></head><body data-paper="system"><div class="print-tools"><label for="paper-size">${printSafe(text.printSize)}</label><select id="paper-size" aria-label="${printSafe(text.printSize)}"><option value="system">${language === "ar" ? "افتراضي النظام" : "System default"}</option><option value="58">${printSafe(text.print58)}</option><option value="80">${printSafe(text.print80)}</option></select><button type="button" onclick="window.print()">${printSafe(text.startPrint)}</button></div><h1>${printSafe(text.title)}</h1><div class="meta">${printSafe(text.range)}: ${printSafe(rangeLabel)}</div><h2>${printSafe(text.title)}</h2><table class="metrics"><tbody>${metrics}</tbody></table><h2>${printSafe(text.tableRevenue)}</h2><table class="thermal-table"><thead><tr><th>${printSafe(text.table)}</th><th>${printSafe(text.tableOrders)}</th><th>${printSafe(text.gross)}</th></tr></thead><tbody>${tableRows || `<tr><td colspan="3">${printSafe(text.noData)}</td></tr>`}</tbody></table><h2>${printSafe(text.topItems)}</h2><table class="thermal-table"><thead><tr><th>${printSafe(text.rank)}</th><th>${printSafe(text.item)}</th><th>${printSafe(text.quantity)}</th><th>${printSafe(text.itemSales)}</th></tr></thead><tbody>${items || `<tr><td colspan="4">${printSafe(text.noData)}</td></tr>`}</tbody></table><h2>${printSafe(text.tableOrderDetails)}</h2><table class="thermal-table"><thead><tr><th>${printSafe(text.table)}</th><th>${printSafe(text.orderNumber)}</th><th>${printSafe(text.orderTime)}</th><th>${printSafe(text.previousOrderGap)}</th><th>${printSafe(text.orderDuration)}</th><th>${printSafe(text.gross)}</th></tr></thead><tbody>${turnoverRows || `<tr><td colspan="6">${printSafe(text.noTableOrders)}</td></tr>`}</tbody></table><script>document.getElementById('paper-size').addEventListener('change',event=>{document.body.dataset.paper=event.target.value});window.onafterprint=()=>window.close()</script></body></html>`);
    printWindow.document.close();
  };

  const metricCards = [
    { title: text.gross, value: formatMoney(report.gross) },
    { title: text.net, value: formatMoney(report.net) },
    { title: text.vat, value: formatMoney(report.vat) },
    { title: text.orders, value: new Intl.NumberFormat(locale).format(report.orderCount) },
    { title: text.average, value: formatMoney(report.averageOrder) },
    { title: text.itemQuantity, value: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(report.itemQuantity) },
  ];

  return (
    <ThemeProvider theme={darkTheme}>
    <Box ref={reportRef} component="section" dir={language === "ar" ? "rtl" : "ltr"} className="reports-print-page" sx={{ width: "100%", minWidth: 0, bgcolor: "#191714", color: "#f7efe4", borderRadius: { xs: 2, md: 3 }, p: { xs: 2, sm: 3, lg: 4 }, "& .MuiCard-root": { bgcolor: "#24211e", borderColor: "#433a33" }, "& .MuiTableCell-root": { borderColor: "#433a33" }, "& .MuiDivider-root": { borderColor: "#433a33" } }}>
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } .reports-no-print { display: none !important; } .reports-print-page { background: #fff !important; padding: 0 !important; } .reports-print-card { box-shadow: none !important; break-inside: avoid; } }`}</style>
      <Stack spacing={{ xs: 2, md: 2.5 }}>
        <Stack data-pdf-section direction={{ xs: "column", md: "row" }}    sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 1.5 }}>
          <Stack direction="row"  spacing={1.2} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: "12px", bgcolor: "rgba(244,121,32,.10)", color: "primary.main", flexShrink: 0 }}>
              <AssessmentOutlinedIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h4" component="h1" fontWeight={800} sx={{ fontSize: { xs: "1.5rem", sm: "2rem" }, color: "text.primary", textAlign: "start" }}>{text.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .3 }}>{text.subtitle}</Typography>
            </Box>
          </Stack>
          <Chip label={`${text.range}: ${rangeLabel}`} variant="outlined" sx={{ alignSelf: { xs: "flex-start", md: "center" }, fontWeight: 700, maxWidth: "100%", bgcolor: "background.paper", borderColor: "divider", color: "text.secondary" }} />
        </Stack>

        <Analytics />

        <Box data-pdf-section sx={{ borderTop: "1px solid #433a33", pt: 3, mt: 1 }}>
          <Typography sx={{ color: "#ec8a4b", fontSize: ".72rem", letterSpacing: ".12em", fontWeight: 800, mb: .5 }}>SERVIO / {language === "ar" ? "تفاصيل التقرير" : "REPORT DETAILS"}</Typography>
          <Typography component="h2" sx={{ fontSize: "1.35rem", fontWeight: 800 }}>{language === "ar" ? "تقرير المبيعات" : "Sales report"}</Typography>
          <Typography sx={{ fontSize: ".84rem", color: "text.secondary", mt: .5 }}>{language === "ar" ? "اختر فترة التقرير للاطلاع على المبيعات والطاولات والأصناف." : "Choose a report period to explore sales, tables and items."}</Typography>
        </Box>

        <Stack className="reports-no-print" direction={{ xs: "column", sm: "row" }}    sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1.2 }}>
          <ToggleButtonGroup
            exclusive
            value={period}
            onChange={(_, value) => { if (value) setPeriod(value); }}
            aria-label={text.range}
            size="small"
            sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, bgcolor: "background.paper", borderRadius: "9px", border: "1px solid #f47920", p: "2px", flexWrap: "wrap", "& .MuiToggleButtonGroup-grouped": { border: 0, borderRadius: "6px !important", m: "1px" }, "& .MuiToggleButton-root": { minWidth: 0, px: { xs: 0.75, sm: 1.5 }, py: { xs: 0.85, sm: 0.95 }, fontSize: { xs: ".82rem", sm: ".9rem" }, lineHeight: 1.2, fontWeight: 750, flex: { xs: 1, sm: "initial" }, whiteSpace: "nowrap" }, "& .MuiToggleButton-root.Mui-selected": { bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } } }}
          >
            <ToggleButton value="daily">{text.daily}</ToggleButton>
            <ToggleButton value="weekly">{text.weekly}</ToggleButton>
            <ToggleButton value="monthly">{text.monthly}</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }} useFlexGap sx={{ width: { xs: "100%", sm: "auto" }, flexWrap: "wrap" }}>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={refreshReport} disabled={loading} sx={{ minWidth: 0, flex: { xs: "1 1 calc(50% - 6px)", sm: "0 0 auto" }, fontWeight: 750, borderRadius: "8px", border: "1px solid #f47920", px: { xs: 1, sm: 1.5 }, py: { xs: 0.8, sm: 0.9 }, fontSize: { xs: ".8rem", sm: ".875rem" }, lineHeight: 1.25, whiteSpace: "nowrap" }}>
              {text.refresh}
            </Button>
            {["pdf", "xlsx", "csv"].map((kind) => <Button key={kind} variant={kind === "pdf" ? "contained" : "outlined"} startIcon={exportBusy === kind ? <CircularProgress size={16} color="inherit" /> : <FileDownloadOutlinedIcon />} onClick={() => handleExport(kind)} disabled={loading || analytics.ordersLoading || Boolean(error) || Boolean(exportBusy)} sx={{ minWidth: 0, flex: { xs: "1 1 calc(50% - 6px)", sm: "0 0 auto" }, fontWeight: 750, borderRadius: "8px", px: { xs: 1, sm: 1.5 }, py: { xs: 0.8, sm: 0.9 }, fontSize: { xs: ".8rem", sm: ".875rem" }, lineHeight: 1.25, whiteSpace: "nowrap" }}>
              {language === "ar" ? "تصدير" : "Export"} {kind.toUpperCase()}
            </Button>)}
            <Button variant="contained" startIcon={<LocalPrintshopOutlinedIcon />} onClick={printReportTable} disabled={loading || Boolean(error)} sx={{ minWidth: 0, flex: { xs: "1 1 100%", sm: "0 0 auto" }, fontWeight: 750, borderRadius: "8px", border: "1px solid #f47920", px: { xs: 1, sm: 1.5 }, py: { xs: 0.8, sm: 0.9 }, fontSize: { xs: ".8rem", sm: ".875rem" }, lineHeight: 1.25, whiteSpace: "nowrap" }}>
              {text.print}
            </Button>
          </Stack>
        </Stack>

        <Typography data-pdf-section variant="caption" color="text.secondary" className="reports-print-card" sx={{ mt: -1, fontWeight: 700 }}>
          {text.csvFrom}: {fromLabel} · {text.csvTo}: {toLabel}
        </Typography>

        {exportError && <Alert className="reports-no-print" severity="error" onClose={() => setExportError("")}>{exportError}</Alert>}
        {exportBusy && <Typography className="reports-no-print" role="status" sx={{ color: "text.secondary", fontSize: ".85rem" }}>{language === "ar" ? "جارٍ إعداد ملف التصدير…" : "Preparing export…"}</Typography>}
        {error && <Alert data-pdf-section severity="error" action={<Button color="inherit" size="small" onClick={refreshReport}>{text.refresh}</Button>}>{error}</Alert>}
        {loading ? (
          <Card data-pdf-section elevation={0} className="reports-print-card" sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
            <CardContent><Stack direction="row"   spacing={1.2} sx={{ py: 4 , alignItems: "center", justifyContent: "center"}}><CircularProgress size={24} /><Typography color="text.secondary">{text.loading}</Typography></Stack></CardContent>
          </Card>
        ) : !error && report.orderCount === 0 ? (
          <Alert data-pdf-section severity="info" className="reports-print-card" sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider" }}>{text.noData}</Alert>
        ) : !error ? (
          <>
            <Box data-pdf-section sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, gap: 2.5 }}>
              {metricCards.map((metric) => <MetricCard key={metric.title} {...metric} />)}
            </Box>

            <Card data-pdf-section elevation={0} className="reports-print-card" sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                <Stack direction="row"    sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="h6" fontWeight={800} color="text.primary">{period === "daily" ? text.dailyTrend : text.periodTrend}</Typography>
                  <Typography variant="caption" color="text.secondary">{currency}</Typography>
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ width: "100%", minWidth: 0, height: { xs: 260, sm: 300 } }}>
                  <BarChart
                    xAxis={[{
                      scaleType: "band",
                      data: series.map((point) => point.label),
                      disableTicks: true,
                      tickLabelInterval: (_value, index) => (period === "daily" || period === "monthly")
                        ? index % 3 === 0 || index === series.length - 1
                        : true,
                    }]}
                    yAxis={[{ disableLine: true, disableTicks: true, valueFormatter: () => "" }]}
                    series={[{
                      data: series.map((point) => point.total),
                      label: period === "daily" ? text.dailyTrend : text.periodTrend,
                      color: "#d97a3b",
                      valueFormatter: (value) => formatMoney(Number(value) || 0),
                    }]}
                    grid={{ horizontal: false }}
                    margin={{ left: 0, right: 24, top: 12, bottom: 24 }}
                    borderRadius={8}
                    sx={{
                      ".MuiChartsAxis-bottom .MuiChartsAxis-tickLabel": { fill: "#b4a99d", fontSize: "0.72rem", fontWeight: 600, fontFamily: theme.typography.fontFamily },
                      ".MuiChartsAxis-bottom .MuiChartsAxis-line": { stroke: "#5d5147", strokeWidth: 1, opacity: 0.7 },
                      ".MuiChartsAxis-left": { display: "none" },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>

            <Card data-pdf-section elevation={0} className="reports-print-card" sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1, mb: 1.5 }}>
                  <Box><Typography variant="h6" fontWeight={900} color="text.primary">{text.tableTurnover}</Typography><Typography variant="body2" color="text.secondary">{text.tableOrders}</Typography></Box>
                  <Chip size="small" label={tableTurnover.tableCount} variant="outlined" />
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0,1fr))" }, gap: 1.25 }}>
                  <MetricCard title={text.table} value={tableTurnover.tableCount} />
                  <MetricCard title={text.turnsPerTable} value={tableTurnover.averageTurnsPerTable} />
                  <MetricCard title={text.averageDuration} value={tableTurnover.averageMinutes == null ? "—" : `${tableTurnover.averageMinutes} ${text.minutes}`} />
                </Box>
              </CardContent>
            </Card>
            <Card data-pdf-section elevation={0} className="reports-print-card" sx={{ width: "100%", borderRadius: "16px", border: "1px solid", borderColor: "divider", boxShadow: "0px 8px 28px rgba(10,25,47,0.05)", overflow: "hidden" }}>
              <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Box sx={{ px: { xs: 1.75, sm: 3 }, py: { xs: 1.5, sm: 2 }, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: "rgba(244,121,32,.06)" }}>
                  <Box>
                    <Typography variant="h6" fontWeight={900} color="text.primary">{text.tableOrderDetails}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>{text.previousOrderGap} · {text.orderDuration}</Typography>
                  </Box>
                  <Chip size="small" label={tableTurnoverDetails.reduce((count, table) => count + table.orders.length, 0)} variant="outlined" sx={{ fontWeight: 800, borderColor: "primary.main", color: "primary.main", bgcolor: "background.paper" }} />
                </Box>
                <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
                  <Table size="small" sx={{ width: "100%", minWidth: 850, tableLayout: "fixed", "& th, & td": { px: { xs: 1.25, sm: 2 }, py: 1.4 }, "& tbody tr:nth-of-type(even)": { bgcolor: "rgba(255,244,231,.025)" }, "& tbody tr:hover": { bgcolor: "rgba(244,121,32,.08)" } }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "secondary.main", "& th": { color: "#fff", fontWeight: 900, borderBottom: 0 } }}>
                        <TableCell sx={{ width: "13%" }}>{text.table}</TableCell>
                        <TableCell align="right" sx={{ width: "11%" }}>{text.orderNumber}</TableCell>
                        <TableCell align="right" sx={{ width: "21%" }}>{text.orderTime}</TableCell>
                        <TableCell align="right" sx={{ width: "21%" }}>{text.previousOrderGap}</TableCell>
                        <TableCell align="right" sx={{ width: "18%" }}>{text.orderDuration}</TableCell>
                        <TableCell align="right" sx={{ width: "16%" }}>{text.gross}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableTurnoverDetails.flatMap((table) => table.orders.map((order) => (
                        <TableRow key={order.id} hover>
                          <TableCell sx={{ fontWeight: 850 }}>{table.table}</TableCell>
                          <TableCell align="right"><Chip size="small" label={`#${order.orderNumber}`} sx={{ fontWeight: 850, bgcolor: "rgba(244,121,32,.1)", color: "primary.dark" }} /></TableCell>
                          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{formatOrderDateTime(order.createdAt, locale)}</TableCell>
                          <TableCell align="right">{formatDuration(order.gapMinutes, locale, text.minutes)}</TableCell>
                          <TableCell align="right">{formatDuration(order.durationMinutes, locale, text.minutes)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 850, whiteSpace: "nowrap", color: "primary.main" }}>{formatMoney(order.totalPrice)}</TableCell>
                        </TableRow>
                      )))}
                      {!tableTurnoverDetails.some((table) => table.orders.length > 0) && (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>{text.noTableOrders}</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
            <Card data-pdf-section elevation={0} className="reports-print-card" sx={{ width: "100%", borderRadius: "18px", border: "1px solid", borderColor: "divider", boxShadow: "0px 8px 28px rgba(10,25,47,0.05)", overflow: "hidden" }}>
              <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Box sx={{ px: { xs: 1.75, sm: 3 }, py: { xs: 1.5, sm: 2 }, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: "rgba(244,121,32,.06)" }}>
                  <Box><Typography variant="h6" fontWeight={900} color="text.primary">{text.tableRevenue}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>{text.gross}</Typography></Box>
                  <Chip size="small" label={report.tableRevenue.length} variant="outlined" sx={{ fontWeight: 800, borderColor: "primary.main", color: "primary.main", bgcolor: "background.paper" }} />
                </Box>
                <TableContainer sx={{ width: "100%", overflowX: "auto" }}><Table size="small" sx={{ width: "100%", minWidth: 520, tableLayout: "fixed", "& th, & td": { px: { xs: 1.5, sm: 3 }, py: 1.55 }, "& tbody tr:nth-of-type(even)": { bgcolor: "rgba(255,244,231,.025)" }, "& tbody tr:hover": { bgcolor: "rgba(244,121,32,.08)" } }}><TableHead><TableRow sx={{ bgcolor: "secondary.main", "& th": { color: "#fff", fontWeight: 900, borderBottom: 0 } }}><TableCell sx={{ width: "42%" }}>{text.table}</TableCell><TableCell align="right" sx={{ width: "25%" }}>{text.tableOrders}</TableCell><TableCell align="right" sx={{ width: "33%" }}>{text.gross}</TableCell></TableRow></TableHead><TableBody>{report.tableRevenue.map((table) => <TableRow key={table.key}><TableCell sx={{ fontWeight: 800 }}>{table.tableNumber || text.unspecifiedTable}</TableCell><TableCell align="right">{new Intl.NumberFormat(locale).format(table.orderCount)}</TableCell><TableCell align="right" sx={{ fontWeight: 900, whiteSpace: "nowrap", color: "primary.main" }}>{formatMoney(table.revenue)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
              </CardContent>
            </Card>

            <Card data-pdf-section elevation={0} className="reports-print-card" sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                <Stack direction="row"    sx={{ mb: 1.2 , alignItems: "center", justifyContent: "space-between", gap: 1}}>
                  <Typography variant="h6" fontWeight={800} color="text.primary">{text.topItems}</Typography>
                  <Chip size="small" label={report.topItems.length} variant="outlined" />
                </Stack>
                {report.topItems.length ? (
                  <TableContainer sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 440 }}>
                      <TableHead sx={{ bgcolor: "background.default" }}>
                        <TableRow>
                          <TableCell align="center">{text.rank}</TableCell>
                          <TableCell>{text.item}</TableCell>
                          <TableCell align="right">{text.quantity}</TableCell>
                          <TableCell align="right">{text.itemSales}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {report.topItems.map((item, index) => (
                          <TableRow key={item.key} hover>
                            <TableCell align="center"><Chip size="small" label={index + 1} /></TableCell>
                            <TableCell sx={{ fontWeight: 750, maxWidth: 220, overflowWrap: "anywhere" }}>{item.name || text.unknownItem}</TableCell>
                            <TableCell align="right">{new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(item.quantity)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{formatMoney(item.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : <Typography color="text.secondary" sx={{ py: 2 }}>{text.noData}</Typography>}
              </CardContent>
            </Card>
          </>
        ) : null}

        <Alert data-pdf-section severity="info" icon={false} className="reports-print-card" sx={{ borderRadius: 2.5, lineHeight: 1.75, fontSize: ".82rem" }}>
          {text.note}
        </Alert>
      </Stack>
    </Box>
    </ThemeProvider>
  );
}

export default Reports;
