import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useLocation, useNavigate } from "react-router-dom";
import CustomerMenuBottomNav from "../components/menu/CustomerMenuBottomNav";
import CustomerPageHeader from "../components/menu/CustomerPageHeader";
import { useLanguage } from "../context/LanguageContext";
import { useTenant } from "../context/TenantContext";
import { buildCustomerMenuPath, getCustomerReviewUrl } from "../utils/customerMenuNavigation";

export default function CustomerReviewPage() {
  const { language } = useLanguage();
  const { slug, tableNumber, storeInfo } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const isEnglish = language !== "ar";
  const cashierMode = new URLSearchParams(location.search).get("cashier") === "1";
  const displayTable = cashierMode ? (isEnglish ? "Cashier" : "كاشير") : tableNumber;
  const reviewUrl = getCustomerReviewUrl(storeInfo?.google_maps_review_url);
  const returnToMenu = () => navigate(buildCustomerMenuPath(slug, displayTable, location.search));

  return (
    <Box className="customer-experience-page customer-review-page">
      <Box className="customer-page-shell">
        <CustomerPageHeader tableNumber={displayTable} />
        <Paper
          component="main"
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: { xs: 2, sm: 2.5 },
            textAlign: "center",
            bgcolor: "background.paper",
          }}
        >
          <Stack spacing={1.5} sx={{ alignItems: "center" }}>
            <Box
              aria-hidden="true"
              sx={{
                display: "grid",
                width: 62,
                height: 62,
                placeItems: "center",
                borderRadius: 2,
                bgcolor: "action.selected",
                color: "primary.main",
              }}
            >
              <RateReviewOutlinedIcon sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="h5" component="h1">
              {isEnglish ? "How was your visit?" : "كيف كانت زيارتك؟"}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 360, lineHeight: 1.8 }}>
              {isEnglish
                ? `Share your experience with ${storeInfo?.store_name || storeInfo?.name || "the venue"}.`
                : `شاركنا تجربتك${storeInfo?.store_name || storeInfo?.name ? ` في ${storeInfo.store_name || storeInfo.name}` : ""}.`}
            </Typography>
            {reviewUrl ? (
              <Button
                component="a"
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                size="large"
                startIcon={<RateReviewOutlinedIcon />}
                sx={{ mt: 1, minHeight: 50, px: 3, fontWeight: 900 }}
              >
                {isEnglish ? "Write a review" : "اكتب تقييمك"}
              </Button>
            ) : (
              <Alert severity="info" sx={{ width: "100%", mt: 1, textAlign: "start" }}>
                {isEnglish
                  ? "Reviews are not available for this venue yet."
                  : "التقييم غير متاح لهذا المكان حاليًا."}
              </Alert>
            )}
            <Button
              variant="text"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={returnToMenu}
              sx={{ mt: 1, fontWeight: 850 }}
            >
              {isEnglish ? "Back to menu" : "العودة إلى المنيو"}
            </Button>
          </Stack>
        </Paper>
      </Box>
      <CustomerMenuBottomNav
        activePage="review"
        canCallWaiter={!cashierMode && Boolean(tableNumber)}
        tableNumber={displayTable}
      />
    </Box>
  );
}
