import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import AnalyticsOverview from "./Analytics/AnalyticsOverview";
import SalesTrendChart from "./Analytics/SalesTrendChart";
import TopSellingProductsCard from "./Analytics/TopSellingProductsCard";
import RecentOrdersCard from "./Analytics/RecentOrdersCard";
import { useAnalytics } from "../../context/AnalyticsContext";
import { useLanguage } from "../../context/LanguageContext";

// A fragment used by Reports, not a second page or a second data request.
function Analytics() {
  const { ordersLoading, ordersLoadError, reloadOrders, analyticsReady } = useAnalytics();
  const { language } = useLanguage();
  const ar = language === "ar";
  return (
    <Stack spacing={2}>
      <Box data-pdf-section><AnalyticsOverview /></Box>
      {ordersLoading && <Stack data-pdf-section direction="row" spacing={1.5} sx={{ alignItems: "center", p: 3, color: "#c8bcae" }}><CircularProgress size={20} sx={{ color: "#ed8b4a" }} /><Typography>{ar ? "جارٍ تحميل اللمحة…" : "Loading overview…"}</Typography></Stack>}
      {ordersLoadError && <Alert data-pdf-section severity="error" action={<Button color="inherit" size="small" onClick={reloadOrders}>{ar ? "إعادة المحاولة" : "Retry"}</Button>}>{ar ? "تعذر تحميل بيانات اللمحة. أعد المحاولة." : "Could not load overview data. Please retry."}</Alert>}
      {analyticsReady && <>
        <Box data-pdf-section><SalesTrendChart /></Box>
        <Box className="reports-pdf-paired" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Box data-pdf-section sx={{ minWidth: 0 }}><TopSellingProductsCard /></Box>
          <Box data-pdf-section sx={{ minWidth: 0 }}><RecentOrdersCard /></Box>
        </Box>
      </>}
    </Stack>
  );
}
export default Analytics;
