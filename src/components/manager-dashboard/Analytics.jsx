import { useMemo } from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { useLanguage } from "../../context/LanguageContext";
import { createSalesSeries, getOperationalSaleDate, toLocalDateKey } from "../../utils/salesReportUtils";
import { createWorkdayScheduleHourBuckets, getWorkdayOffsetMinutes, getWorkdayScheduleBucketIndex, shiftBusinessDate } from "../../utils/workdayUtils";
import useSalesReport from "./reports/useSalesReport";
import { REPORT_COPY } from "./reports/reportData";
import { colors, money, Panel, PeriodControl, ReportHeading, StateBox } from "./reports/ReportUI";

const COPY = {
  en: { title: "Advanced analytics", subtitle: "Explore the patterns behind your recorded sales.", trend: "Sales trend", trendSub: "Recorded sales in the selected period", hourly: "Sales by operational hour", daily: "Sales by operational day", peak: "Peak hours", peakSub: "Sales orders by the start of each scheduled hour", distribution: "Payment method distribution", distributionSub: "Paid sales orders only · split payments are counted once", coverage: "paid sales orders with and without a recorded method, out of", salesOrders: "sales orders", cash: "Cash", card: "Card", split: "Split", wallet: "Wallet", transfer: "Transfer", other: "Other", unknown: "Not recorded", noPaid: "No paid sales orders in this period.", promos: "Promotion performance", promoNote: "Promotion redemptions are not recorded in the available order data, so performance cannot be measured yet.", locked: "Advanced analytics is not available for this plan", lockedNote: "Sales reports remain available. Contact your administrator about plan access.", loadingPlan: "Checking access…", count: "Orders", note: "Sales use the same period, branch, order eligibility and operational shifts as Reports. Payment distribution counts orders, not amounts. Peak hours reflect order counts by recorded sale time, not foot traffic." },
  ar: { title: "التحليلات المتقدمة", subtitle: "استكشف الأنماط وراء مبيعاتك المسجلة.", trend: "اتجاه المبيعات", trendSub: "المبيعات المسجلة في الفترة المحددة", hourly: "المبيعات حسب الساعة التشغيلية", daily: "المبيعات حسب اليوم التشغيلي", peak: "ساعات الذروة", peakSub: "عدد طلبات المبيعات حسب بداية كل ساعة مجدولة", distribution: "توزيع طرق الدفع", distributionSub: "طلبات المبيعات المدفوعة فقط · الدفع المقسّم يُحسب مرة واحدة", coverage: "طلب مبيعات مدفوع بطريقة مسجلة أو غير مسجلة، من أصل", salesOrders: "طلب مبيعات", cash: "نقدي", card: "بطاقة", split: "مقسّم", wallet: "محفظة", transfer: "تحويل", other: "أخرى", unknown: "غير مسجل", noPaid: "لا توجد طلبات مبيعات مدفوعة في هذه الفترة.", promos: "أداء العروض", promoNote: "لا تتوفر بيانات استخدام العروض ضمن الطلبات، لذلك لا يمكن قياس الأداء حالياً.", locked: "التحليلات المتقدمة غير متاحة في هذه الباقة", lockedNote: "تظل تقارير المبيعات متاحة. تواصل مع المسؤول بشأن الوصول إلى الباقة.", loadingPlan: "جارٍ التحقق من الصلاحية…", count: "الطلبات", note: "تعتمد التحليلات الفترة والفرع وحالات الطلبات والورديات التشغيلية نفسها كما في التقارير. توزيع الدفع يحسب الطلبات وليس المبالغ. الذروة تحسب الطلبات حسب وقت البيع المسجل وليس عدد الزوار." },
};

const chartSx = { ".MuiChartsAxis-tickLabel": { fill: "#9ba7ba", fontSize: ".7rem" }, ".MuiChartsAxis-line, .MuiChartsAxis-tick": { stroke: "#4a5463" }, ".MuiChartsGrid-line": { stroke: "rgba(255,255,255,.06)" }, ".MuiChartsLegend-root": { color: "#e5e9f0" } };
function SectionTitle({ title, subtitle }) {
  return <Box sx={{ mb: 1 }}><Typography component="h2" sx={{ color: colors.text, fontSize: "1rem", fontWeight: 850 }}>{title}</Typography><Typography sx={{ color: colors.muted, fontSize: ".76rem", mt: .4 }}>{subtitle}</Typography></Box>;
}

export default function Analytics() {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const text = REPORT_COPY[ar ? "ar" : "en"];
  const copy = COPY[ar ? "ar" : "en"];
  // Both Starter and Pro include analytics. Authentication and branch/tenant
  // isolation remain enforced by the existing route, queries and RLS.
  const data = useSalesReport();
  const { report, range, schedule, period, storeInfo, loading, error } = data;
  const locale = ar ? "ar-SA" : "en-SA";
  const currency = storeInfo?.currency || t("currencySar") || (ar ? "ر.س" : "SAR");
  const trend = useMemo(() => {
    const now = new Date();
    const today = toLocalDateKey(shiftBusinessDate(now, schedule.startMinutes));
    const series = createSalesSeries(report.salesOrders, range.from, range.to, period, locale, schedule);
    if (period !== "daily") return series.filter((point) => point.key <= today);
    if (range.from !== today) return series;
    const elapsed = getWorkdayOffsetMinutes(now, schedule.startMinutes);
    const buckets = createWorkdayScheduleHourBuckets(schedule);
    return series.filter((_, index) => buckets[index]?.offsetMinutes <= elapsed);
  }, [report.salesOrders, range.from, range.to, period, locale, schedule]);
  const peak = useMemo(() => {
    const buckets = createWorkdayScheduleHourBuckets(schedule).map((bucket) => ({ label: bucket.label, count: 0 }));
    report.salesOrders.forEach((order) => {
      const index = getWorkdayScheduleBucketIndex(getOperationalSaleDate(order), schedule);
      if (index != null && buckets[index]) buckets[index].count += 1;
    });
    const now = new Date();
    const today = toLocalDateKey(shiftBusinessDate(now, schedule.startMinutes));
    if (period !== "daily" || range.from !== today) return buckets;
    const elapsed = getWorkdayOffsetMinutes(now, schedule.startMinutes);
    const scheduled = createWorkdayScheduleHourBuckets(schedule);
    return buckets.filter((_, index) => scheduled[index]?.offsetMinutes <= elapsed);
  }, [report.salesOrders, schedule, period, range.from]);
  const payment = useMemo(() => {
    const counts = { cash: 0, card: 0, split: 0, wallet: 0, transfer: 0, other: 0, unknown: 0 };
    report.salesOrders.filter((order) => order.payment_status === "paid").forEach((order) => {
      const method = order.payment_method;
      counts[Object.prototype.hasOwnProperty.call(counts, method) && method !== "unknown" ? method : "unknown"] += 1;
    });
    return Object.entries(counts).filter(([, count]) => count > 0);
  }, [report.salesOrders]);
  const paidCount = payment.reduce((sum, [, count]) => sum + count, 0);
  return <Box dir={ar ? "rtl" : "ltr"} sx={{ width: "100%", minWidth: 0, pb: 5 }}><Stack spacing={2.5}>
    <ReportHeading eyebrow={ar ? "مساحة الإدارة / التحليلات" : "MANAGEMENT / ANALYTICS"} title={copy.title} subtitle={copy.subtitle} />
      <PeriodControl {...data} text={text} />
      <StateBox loading={loading} error={error} text={text} refresh={data.refresh} />
      {!loading && !error && <>
        {!report.orderCount && <Panel sx={{ color: colors.muted, textAlign: "center", py: 3 }}>{text.noData}</Panel>}
        {report.orderCount > 0 && <>
          <Panel><SectionTitle title={copy.trend} subtitle={`${period === "daily" ? copy.hourly : copy.daily} · ${currency}`} /><Box sx={{ height: { xs: 250, sm: 300 }, width: "100%", minWidth: 0 }}><BarChart xAxis={[{ scaleType: "band", data: trend.map((point) => point.label), disableTicks: true, tickLabelInterval: (_value, index) => period === "daily" || period === "monthly" ? index % 3 === 0 || index === trend.length - 1 : true }]} yAxis={[{ disableTicks: true }]} series={[{ data: trend.map((point) => point.total), label: copy.trend, color: colors.orange, valueFormatter: (value) => money(value, locale, currency) }]} grid={{ horizontal: true }} margin={{ left: 58, right: 12, top: 15, bottom: 35 }} borderRadius={5} sx={chartSx} /></Box></Panel>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.4fr) minmax(0,1fr)" }, gap: 1.5 }}>
            <Panel><SectionTitle title={copy.peak} subtitle={copy.peakSub} /><Box sx={{ height: 260, width: "100%", minWidth: 0 }}><BarChart xAxis={[{ scaleType: "band", data: peak.map((point) => point.label), disableTicks: true, tickLabelInterval: (_value, index) => index % 3 === 0 || index === peak.length - 1 }]} yAxis={[{ disableTicks: true, min: 0, valueFormatter: (value) => Number.isInteger(value) ? String(value) : "" }]} series={[{ data: peak.map((point) => point.count), label: copy.count, color: "#7589aa" }]} grid={{ horizontal: true }} margin={{ left: 40, right: 12, top: 15, bottom: 35 }} borderRadius={5} sx={chartSx} /></Box></Panel>
            <Panel><SectionTitle title={copy.distribution} subtitle={copy.distributionSub} /><Typography sx={{ color: colors.muted, fontSize: ".73rem", mb: 2 }}>{paidCount} {copy.coverage} {report.orderCount} {copy.salesOrders}</Typography>{paidCount ? <Stack spacing={1.6}>{payment.map(([method, count]) => <Box key={method}><Stack direction="row" sx={{ justifyContent: "space-between", color: "#e5e9f0", gap: 1, mb: .7 }}><Typography sx={{ fontSize: ".8rem", fontWeight: 700 }}>{copy[method]}</Typography><Typography sx={{ fontSize: ".8rem", fontWeight: 800 }}>{new Intl.NumberFormat(locale).format(count)} · {new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(count / paidCount)}</Typography></Stack><LinearProgress variant="determinate" value={count / paidCount * 100} sx={{ height: 6, borderRadius: 9, bgcolor: "#303947", "& .MuiLinearProgress-bar": { bgcolor: colors.orange, borderRadius: 9 } }} /></Box>)}</Stack> : <Typography sx={{ color: colors.muted, fontSize: ".85rem", py: 2 }}>{copy.noPaid}</Typography>}</Panel>
          </Box>
        </>}
        <Panel sx={{ borderStyle: "dashed", background: "transparent" }}><SectionTitle title={copy.promos} subtitle={copy.promoNote} /></Panel>
        <Typography sx={{ color: colors.muted, fontSize: ".76rem", lineHeight: 1.8, px: .3 }}>{copy.note}</Typography>
      </>}
  </Stack></Box>;
}
