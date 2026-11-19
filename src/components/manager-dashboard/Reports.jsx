import { useMemo, useState } from "react";
import { Box, Button, Menu, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import { useLanguage } from "../../context/LanguageContext";
import useSalesReport from "./reports/useSalesReport";
import { buildReportRecords, REPORT_COPY } from "./reports/reportData";
import { exportReport, printReport } from "./reports/reportExport";
import { colors, money, Panel, PeriodControl, ReportHeading, StateBox } from "./reports/ReportUI";

const tableSx = {
  minWidth: 530,
  "& th": { color: colors.muted, fontSize: ".72rem", fontWeight: 800, borderColor: colors.border, whiteSpace: "nowrap" },
  "& td": { color: "#e9edf2", fontSize: ".84rem", borderColor: colors.border, py: 1.6 },
  "& tr:last-child td": { borderBottom: 0 },
};

function Metric({ label, value, icon, highlight }) {
  return <Panel sx={{ background: highlight ? "linear-gradient(135deg, #263653, #14213d)" : colors.panel, minHeight: 132, position: "relative", overflow: "hidden" }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}><Typography sx={{ color: highlight ? "#b9c5d6" : colors.muted, fontSize: ".77rem", fontWeight: 750 }}>{label}</Typography><Box sx={{ color: highlight ? "#ff9a6b" : "#8393ab", opacity: .9 }}>{icon}</Box></Box>
    <Typography sx={{ color: colors.text, fontSize: { xs: "1.25rem", md: "1.5rem" }, fontWeight: 900, mt: 2, overflowWrap: "anywhere", lineHeight: 1.25 }}>{value}</Typography>
  </Panel>;
}

function SectionTitle({ title, subtitle }) {
  return <Box sx={{ mb: 1.6 }}><Typography component="h2" sx={{ color: colors.text, fontWeight: 850, fontSize: "1rem" }}>{title}</Typography>{subtitle && <Typography sx={{ color: colors.muted, fontSize: ".76rem", mt: .4 }}>{subtitle}</Typography>}</Box>;
}

export default function Reports() {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const text = REPORT_COPY[ar ? "ar" : "en"];
  const locale = ar ? "ar-SA" : "en-SA";
  const data = useSalesReport();
  const { report, turnover, turnoverDetails, range, storeInfo, selectedBranch, loading, error } = data;
  const currency = storeInfo?.currency || t("currencySar") || (ar ? "ر.س" : "SAR");
  const branch = selectedBranch?.name || text.noBranch;
  const [menu, setMenu] = useState(null);
  const [exportError, setExportError] = useState("");
  const records = useMemo(() => buildReportRecords({ report, turnover, turnoverDetails, range, branch, currency, text }), [report, turnover, turnoverDetails, range, branch, currency, text]);
  const number = (value) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const exportData = { records, text, range, branch, language };
  const onExport = async (format) => {
    setMenu(null);
    setExportError("");
    try {
      if (format === "pdf") {
        if (!printReport(exportData)) setExportError(text.popupError);
      } else await exportReport(format, exportData);
    } catch (err) {
      console.error("Report export failed", err);
      setExportError(text.exportError);
    }
  };
  const metrics = [
    { label: text.gross, value: money(report.gross, locale, currency), icon: <PaymentsOutlinedIcon fontSize="small" />, highlight: true },
    { label: text.orders, value: number(report.orderCount), icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
    { label: text.average, value: report.orderCount ? money(report.averageOrder, locale, currency) : "—", icon: <PaymentsOutlinedIcon fontSize="small" /> },
    { label: text.net, value: money(report.net, locale, currency), icon: <PaymentsOutlinedIcon fontSize="small" /> },
    { label: text.vat, value: money(report.vat, locale, currency), icon: <PaymentsOutlinedIcon fontSize="small" /> },
    { label: text.quantitySold, value: report.itemQuantity == null ? "—" : number(report.itemQuantity), icon: <ShoppingBagOutlinedIcon fontSize="small" /> },
  ];
  return <Box dir={ar ? "rtl" : "ltr"} sx={{ width: "100%", minWidth: 0, pb: 5 }}>
    <Stack spacing={2.5}>
      <ReportHeading eyebrow={ar ? "مساحة الإدارة / التقارير" : "MANAGEMENT / REPORTS"} title={text.title} subtitle={text.subtitle} action={<Box><Button variant="contained" startIcon={<DownloadRoundedIcon />} disabled={loading || Boolean(error)} onClick={(event) => setMenu(event.currentTarget)} aria-haspopup="menu" aria-expanded={Boolean(menu)} sx={{ bgcolor: colors.orange, color: "white", px: 2.5, minHeight: 44, borderRadius: 2, fontWeight: 850, "&:hover": { bgcolor: "#bd4516" }, "&:disabled": { bgcolor: "#51433f", color: "#b2a7a2" } }}>{text.export}</Button><Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>{[["pdf", text.pdf], ["xlsx", text.xlsx], ["docx", text.docx], ["csv", text.csv]].map(([key, label]) => <MenuItem key={key} onClick={() => onExport(key)}>{label}</MenuItem>)}</Menu></Box>} />
      <PeriodControl {...data} text={text} />
      {exportError && <Panel role="alert" sx={{ color: "#ffb2a2", borderColor: "rgba(255,128,102,.35)" }}>{exportError}</Panel>}
      <StateBox loading={loading} error={error} text={text} refresh={data.refresh} />
      {!loading && !error && <>
        <Box><SectionTitle title={text.overview} subtitle={`${text.overviewSub} · ${branch}`} /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(3, minmax(0,1fr))", xl: "repeat(6, minmax(0,1fr))" }, gap: 1.5 }}>{metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</Box></Box>
        {report.orderCount === 0 && <Panel sx={{ color: colors.muted, textAlign: "center", py: 3 }}>{text.noData}</Panel>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" }, gap: 1.5 }}>
          <Panel><SectionTitle title={text.topItems} subtitle={text.topItemsSub} />{report.topItems.length ? <TableContainer><Table size="small" sx={tableSx}><TableHead><TableRow><TableCell>#</TableCell><TableCell>{ar ? "الصنف" : "Item"}</TableCell><TableCell align="right">{text.count}</TableCell><TableCell align="right">{text.amount}</TableCell></TableRow></TableHead><TableBody>{report.topItems.map((item, index) => <TableRow key={item.key}><TableCell sx={{ color: colors.muted }}>{String(index + 1).padStart(2, "0")}</TableCell><TableCell>{item.name}</TableCell><TableCell align="right">{number(item.quantity)}</TableCell><TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{money(item.revenue, locale, currency)}</TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Typography sx={{ color: colors.muted, py: 3, fontSize: ".85rem" }}>{text.noItems}</Typography>}</Panel>
          <Panel><SectionTitle title={text.tableRevenue} subtitle={text.gross} />{report.tableRevenue.length ? <TableContainer><Table size="small" sx={tableSx}><TableHead><TableRow><TableCell>{ar ? "الطاولة / الخدمة" : "Table / service"}</TableCell><TableCell align="right">{text.orders}</TableCell><TableCell align="right">{text.amount}</TableCell></TableRow></TableHead><TableBody>{report.tableRevenue.map((table) => <TableRow key={table.key}><TableCell>{table.tableNumber || text.unspecified}</TableCell><TableCell align="right">{number(table.orderCount)}</TableCell><TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{money(table.revenue, locale, currency)}</TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Typography sx={{ color: colors.muted, py: 3, fontSize: ".85rem" }}>{text.noData}</Typography>}</Panel>
        </Box>
        <Panel><SectionTitle title={text.tableTurnover} subtitle={text.tableDetailsSub} /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3,minmax(0,1fr))" }, gap: 1.5 }}>{[[text.tables, number(turnover.tableCount)], [text.turns, turnover.tableCount ? number(turnover.averageTurnsPerTable) : "—"], [text.duration, turnover.averageMinutes == null ? "—" : `${number(turnover.averageMinutes)} ${text.minutes}`]].map(([label, value]) => <Box key={label} sx={{ p: 1.6, bgcolor: "#111821", borderRadius: 2 }}><Typography sx={{ color: colors.muted, fontSize: ".76rem" }}>{label}</Typography><Typography sx={{ color: colors.text, fontWeight: 850, mt: .6, fontSize: "1.1rem" }}>{value}</Typography></Box>)}</Box></Panel>
        <Panel><SectionTitle title={text.tableDetails} subtitle={text.tableDetailsSub} />{turnoverDetails.length ? <TableContainer><Table size="small" sx={{ ...tableSx, minWidth: 950 }}><TableHead><TableRow><TableCell>{ar ? "الطاولة" : "Table"}</TableCell><TableCell>{text.sequence}</TableCell><TableCell>{ar ? "وقت الإنشاء (محلي)" : "Created (local)"}</TableCell><TableCell>{text.gap}</TableCell><TableCell>{text.completion}</TableCell><TableCell align="right">{text.amount}</TableCell></TableRow></TableHead><TableBody>{turnoverDetails.flatMap((table) => table.orders.map((order) => <TableRow key={order.id}><TableCell>{table.table}</TableCell><TableCell>{number(order.orderNumber)}</TableCell><TableCell>{new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(order.createdAt)}</TableCell><TableCell>{order.gapMinutes == null ? "—" : number(order.gapMinutes)}</TableCell><TableCell>{order.durationMinutes == null ? "—" : number(order.durationMinutes)}</TableCell><TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{money(order.totalPrice, locale, currency)}</TableCell></TableRow>))}</TableBody></Table></TableContainer> : <Typography sx={{ color: colors.muted, py: 2, fontSize: ".85rem" }}>{text.noTables}</Typography>}</Panel>
        <Typography sx={{ color: "#9da9b9", fontSize: ".76rem", lineHeight: 1.8, px: .3 }}>{text.note}{report.itemDataComplete === false ? ` ${text.incompleteItemData}` : ""}</Typography>
      </>}
    </Stack>
  </Box>;
}
