import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Link as RouterLink, Navigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useTenant } from "../context/TenantContext";
import { subscriptionStatusMessage } from "../utils/subscriptionStatus";

export default function RequireSession({ role, children }) {
  const { t, language } = useLanguage();
  const { loading, profile, subscriptionStatus, refreshSubscription } = useTenant();
  const arabic = language !== "en";
  if (loading) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><CircularProgress /><Typography sx={{ position: "absolute", mt: 10 }}>{t("loadingSession")}</Typography></Box>;
  if (subscriptionStatus === "signed_out") return <Navigate to="/login" replace />;
  if (subscriptionStatus !== "active") return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3 }}>
      <Stack spacing={2} sx={{ maxWidth: 560, textAlign: "center" }} role="alert">
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{arabic ? "الخدمة غير متاحة حاليًا" : "Service currently unavailable"}</Typography>
        <Typography>{subscriptionStatusMessage(subscriptionStatus, arabic)}</Typography>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="contained" onClick={refreshSubscription}>{arabic ? "إعادة التحقق" : "Check again"}</Button>
          <Button component={RouterLink} to="/login">{arabic ? "صفحة الدخول" : "Sign-in page"}</Button>
        </Stack>
      </Stack>
    </Box>
  );
  if (!profile || (role && profile.role !== role)) return <Navigate to="/login" replace />;
  return children;
}
