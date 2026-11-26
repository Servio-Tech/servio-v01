import { lazy, Suspense } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useLanguage } from "../context/LanguageContext";

const OrderTrackingPage = lazy(() => import("../pages/OrderTrackingPage"));

function TrackingLoading() {
  const { t } = useLanguage();
  return (
    <Box role="status" aria-live="polite" sx={{ minHeight: "70vh", display: "grid", placeContent: "center", justifyItems: "center", gap: 1.5 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{t("loading")}</Typography>
    </Box>
  );
}

export default function TrackingRoute() {
  return (
    <Suspense fallback={<TrackingLoading />}>
      <OrderTrackingPage />
    </Suspense>
  );
}
