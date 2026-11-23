import { Box, Card, CardContent, Chip, Typography } from "@mui/material";
import { useAnalytics } from "../../../context/AnalyticsContext";
import { useLanguage } from "../../../context/LanguageContext";

function AnalyticsOverview() {
  const { t, language } = useLanguage();
  const { todaysOrders, totalSalesToday, aovToday, salesGrowth, aovGrowth, ordersGrowth, analyticsReady } = useAnalytics();
  const ar = language === "ar";
  const metrics = [
    { label: ar ? "مبيعات اليوم التشغيلي" : "Operational day sales", value: totalSalesToday, unit: t("currencySar"), growth: salesGrowth },
    { label: t("managerAov"), value: aovToday, unit: t("currencySar"), growth: aovGrowth },
    { label: ar ? "طلبات اليوم التشغيلي" : "Operational day orders", value: todaysOrders.length, growth: ordersGrowth },
  ];
  return <Box>
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ color: "#ec8a4b", fontSize: ".72rem", fontWeight: 800, letterSpacing: ".12em", mb: .5 }}>SERVIO / {ar ? "اللمحة العامة" : "OVERVIEW"}</Typography>
      <Typography component="h2" sx={{ color: "#f7efe4", fontSize: { xs: "1.2rem", md: "1.4rem" }, fontWeight: 800 }}>{t("managerPerformance")}</Typography>
      <Typography sx={{ color: "#b4a99d", fontSize: ".84rem", mt: .4 }}>{ar ? "مقارنة اليوم التشغيلي باليوم السابق" : "Operational day compared with the previous day"}</Typography>
    </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0,1fr))" }, gap: 2 }}>
      {metrics.map((metric) => <Card key={metric.label} elevation={0} sx={{ bgcolor: "#24211e", border: "1px solid #3d3731", borderRadius: "14px", color: "#f7efe4" }}>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Typography sx={{ color: "#bdb0a2", fontSize: ".84rem", fontWeight: 600 }}>{metric.label}</Typography>
          <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 1, mt: 2 }}>
            <Typography sx={{ fontSize: { xs: "1.4rem", md: "1.75rem" }, fontWeight: 800, overflowWrap: "anywhere", lineHeight: 1.2 }}>{analyticsReady ? metric.value : "—"} <Box component="span" sx={{ fontSize: ".8rem", color: "#bdb0a2" }}>{metric.unit}</Box></Typography>
            {analyticsReady && <Chip size="small" label={`${Number(metric.growth) >= 0 ? "+" : ""}${metric.growth}%`} sx={{ direction: "ltr", bgcolor: Number(metric.growth) >= 0 ? "#28392e" : "#402b28", color: Number(metric.growth) >= 0 ? "#a9cea9" : "#f1a397", fontWeight: 700 }} />}
          </Box>
        </CardContent>
      </Card>)}
    </Box>
  </Box>;
}
export default AnalyticsOverview;
