import { Box, Button, ButtonGroup, Card, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { useAnalytics } from "../../../context/AnalyticsContext";
import { useLanguage } from "../../../context/LanguageContext";
function SalesTrendChart() {
  const { t, language } = useLanguage();
  const { setViewType, isDaily, currentLabels, currentSales } = useAnalytics();
  const view = isDaily ? t("managerDaily") : t("managerWeekly");
  return <Card elevation={0} sx={{ bgcolor: "#24211e", border: "1px solid #3d3731", borderRadius: "10px", color: "#f7efe4", p: { xs: 2, sm: 2.5 } }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
      <Box><Typography sx={{ fontWeight: 800, fontSize: "1.05rem" }}>{t("managerSalesTrend")} · {view}</Typography><Typography sx={{ color: "#b4a99d", fontSize: ".8rem", mt: .4 }}>{language === "ar" ? "اليومي لليوم التشغيلي؛ والأسبوعي لآخر ٧ أيام" : "Daily is the operational day; weekly covers the last 7 days"}</Typography></Box>
      <ButtonGroup className="reports-no-print" size="small" aria-label={language === "ar" ? "فترة اتجاه اللمحة" : "Overview trend period"} sx={{ direction: "ltr", "& .MuiButton-root": { color: "#eec9aa", borderColor: "#5c4b3f", fontWeight: 700 }, "& .MuiButton-contained": { bgcolor: "#b85f2e", color: "#fff8f1" } }}>
        <Button variant={!isDaily ? "contained" : "outlined"} onClick={() => setViewType("weekly")}>{t("managerWeekly")}</Button>
        <Button variant={isDaily ? "contained" : "outlined"} onClick={() => setViewType("daily")}>{t("managerDaily")}</Button>
      </ButtonGroup>
    </Box>
    <Box sx={{ width: "100%", height: { xs: 240, sm: 300 }, mt: 2 }}>
      <BarChart xAxis={[{ scaleType: "band", data: currentLabels, disableTicks: true, tickLabelInterval: (_value, index) => !isDaily || index % 3 === 0 || index === currentLabels.length - 1 }]} yAxis={[{ disableLine: true, disableTicks: true, valueFormatter: () => "" }]} series={[{ data: currentSales, label: t("managerSales"), color: "#d97a3b", valueFormatter: (value) => `${value} ${t("currencySar")}` }]} grid={{ horizontal: false }} margin={{ left: 0, right: 30, top: 10, bottom: 25 }} borderRadius={6} sx={{ ".MuiChartsAxis-bottom .MuiChartsAxis-tickLabel": { fill: "#b4a99d", fontSize: ".72rem" }, ".MuiChartsAxis-bottom .MuiChartsAxis-line": { stroke: "#5d5147" }, ".MuiChartsAxis-left": { display: "none" } }} />
    </Box>
  </Card>;
}
export default SalesTrendChart;
