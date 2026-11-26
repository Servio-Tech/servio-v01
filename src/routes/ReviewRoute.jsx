import { lazy, Suspense } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useLanguage } from "../context/LanguageContext";

const CustomerReviewPage = lazy(() => import("../pages/CustomerReviewPage"));

function ReviewLoading() {
  const { language } = useLanguage();
  return (
    <Box role="status" aria-live="polite" sx={{ minHeight: "70vh", display: "grid", placeContent: "center", justifyItems: "center", gap: 1.5 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{language === "ar" ? "جارٍ التحميل…" : "Loading…"}</Typography>
    </Box>
  );
}

export default function ReviewRoute() {
  return (
    <Suspense fallback={<ReviewLoading />}>
      <CustomerReviewPage />
    </Suspense>
  );
}
