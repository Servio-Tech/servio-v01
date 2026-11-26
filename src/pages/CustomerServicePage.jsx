import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import ContactSupportRoundedIcon from "@mui/icons-material/ContactSupportRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import RoomServiceRoundedIcon from "@mui/icons-material/RoomServiceRounded";
import CustomerMenuBottomNav from "../components/menu/CustomerMenuBottomNav";
import CustomerPageHeader from "../components/menu/CustomerPageHeader";
import { useLanguage } from "../context/LanguageContext";
import { useTenant } from "../context/TenantContext";
import { useWaiterCalls } from "../context/WaiterCallsContext";
import { buildCustomerMenuPath } from "../utils/customerMenuNavigation";

const SERVICE_REASONS = [
  { value: "طلب الحساب", en: "Request the bill", icon: <ReceiptLongRoundedIcon /> },
  { value: "مساعدة بخصوص الطلب", en: "Help with my order", icon: <ContactSupportRoundedIcon /> },
  { value: "أدوات إضافية", en: "Extra utensils", icon: <RestaurantRoundedIcon /> },
  { value: "تنظيف الطاولة", en: "Clean the table", icon: <CleaningServicesRoundedIcon /> },
];

export default function CustomerServicePage() {
  const { language } = useLanguage();
  const { slug, tableNumber } = useTenant();
  const { addCall } = useWaiterCalls();
  const location = useLocation();
  const navigate = useNavigate();
  const isEnglish = language !== "ar";
  const cashierMode = new URLSearchParams(location.search).get("cashier") === "1";
  const displayTable = cashierMode ? (isEnglish ? "Cashier" : "كاشير") : tableNumber;
  const canCallService = Boolean(tableNumber) && !cashierMode;
  const [selectedReason, setSelectedReason] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const returnToMenu = () => navigate(buildCustomerMenuPath(slug, displayTable, location.search));

  const sendRequest = async () => {
    if (!canCallService || sending || sent) return;
    setSending(true);
    setSendError("");
    try {
      const result = await addCall(tableNumber, selectedReason);
      if (result?.error) throw result.error;
      setSent(true);
    } catch (error) {
      console.error("تعذر إرسال نداء الخدمة:", error);
      setSendError(isEnglish
        ? "Your request could not be sent. Check your connection and try again."
        : "تعذّر إرسال طلبك. تحقق من الاتصال وحاول مرة أخرى.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Box className="customer-experience-page customer-service-page">
      <Box className="customer-page-shell">
        <CustomerPageHeader tableNumber={displayTable} />
        <Stack className="customer-service-intro" spacing={2} sx={{ mb: 2.5 }}>
          <Chip
            icon={<RoomServiceRoundedIcon />}
            label={isEnglish ? "TABLE SERVICE" : "خدمة الطاولة"}
            color="primary"
            variant="outlined"
            sx={{ alignSelf: "flex-start", fontWeight: 900 }}
          />
          <Box>
            <Typography variant="h4" component="h1">
              {isEnglish ? "Need a hand?" : "كيف نقدر نساعدك؟"}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.6, lineHeight: 1.8 }}>
              {isEnglish
                ? "Choose a request and the service team will be notified."
                : "اختر ما تحتاجه وسنرسل طلبك مباشرة إلى فريق الخدمة."}
            </Typography>
          </Box>
        </Stack>

        {!canCallService ? (
          <Alert severity="info" sx={{ borderRadius: 1.5 }}>
            {isEnglish
              ? "Open this page from your table’s QR menu to request assistance."
              : "افتح هذه الصفحة من منيو الطاولة عبر رمز QR لطلب المساعدة."}
          </Alert>
        ) : sent ? (
          <Paper
            component="section"
            role="status"
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3.5 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2.5,
              bgcolor: "background.paper",
              textAlign: "center",
            }}
          >
            <Stack spacing={1.4} sx={{ alignItems: "center" }}>
              <CheckCircleRoundedIcon color="success" sx={{ fontSize: 54 }} />
              <Typography variant="h5" component="h2">
                {isEnglish ? "Your request is on its way" : "وصل طلبك إلى فريق الخدمة"}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 360, lineHeight: 1.8 }}>
                {isEnglish
                  ? `The team has been notified for table ${tableNumber}.`
                  : `تم تنبيه الفريق لمساعدتك على الطاولة ${tableNumber}.`}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={returnToMenu}
                sx={{ mt: 1, minHeight: 46, fontWeight: 850 }}
              >
                {isEnglish ? "Back to menu" : "العودة إلى المنيو"}
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Paper
            component="section"
            elevation={0}
            sx={{
              p: { xs: 1.25, sm: 2.5 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2.5,
              bgcolor: "background.paper",
            }}
          >
            <Stack spacing={1.25}>
              <Box>
                <Typography variant="h6" component="h2">
                  {isEnglish ? "What do you need?" : "ما الذي تحتاجه؟"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isEnglish ? "Choose one, or send a general request." : "اختر طلبًا أو أرسل نداءً عامًا."}
                </Typography>
              </Box>

              <Box
                role="group"
                aria-label={isEnglish ? "Assistance request" : "نوع طلب المساعدة"}
                sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}
              >
                {SERVICE_REASONS.map((reason) => {
                  const selected = selectedReason === reason.value;
                  return (
                    <Card
                      key={reason.value}
                      variant="outlined"
                      sx={{
                        borderColor: selected ? "primary.main" : "divider",
                        bgcolor: "background.paper",
                        boxShadow: selected ? "0 0 0 1px rgba(244,121,32,.18)" : "none",
                      }}
                    >
                      <CardActionArea
                        disabled={sending}
                        aria-pressed={selected}
                        onClick={() => setSelectedReason(selected ? "" : reason.value)}
                        sx={{
                          minHeight: { xs: 82, sm: 76 },
                          display: "flex",
                          flexDirection: { xs: "column", sm: "row" },
                          justifyContent: { xs: "center", sm: "flex-start" },
                          gap: { xs: 0.5, sm: 1.25 },
                          px: { xs: 0.75, sm: 1.5 },
                          textAlign: { xs: "center", sm: "start" },
                          bgcolor: selected ? "action.selected" : "transparent",
                          color: "text.primary",
                          "& .MuiSvgIcon-root": {
                            fontSize: { xs: 21, sm: 24 },
                            color: selected ? "primary.main" : "text.secondary",
                          },
                        }}
                      >
                        {reason.icon}
                        <Typography fontWeight={850} sx={{ fontSize: { xs: ".875rem", sm: "1rem" }, lineHeight: 1.25 }}>
                          {isEnglish ? reason.en : reason.value}
                        </Typography>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>

              {sendError && <Alert severity="error">{sendError}</Alert>}
              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled={sending}
                onClick={sendRequest}
                startIcon={<RoomServiceRoundedIcon />}
                sx={{ minHeight: 52, mt: 0.5, fontSize: "1rem", fontWeight: 900 }}
              >
                {sending
                  ? (isEnglish ? "Sending request…" : "جارٍ إرسال الطلب…")
                  : (isEnglish ? "Call the service team" : "إرسال طلب المساعدة")}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                {isEnglish
                  ? "Your table number is shared with the service team."
                  : "سيظهر رقم طاولتك لفريق الخدمة لمساعدتك بسرعة."}
              </Typography>
            </Stack>
          </Paper>
        )}
      </Box>
      <CustomerMenuBottomNav
        activePage="service"
        canCallWaiter={canCallService}
        tableNumber={displayTable}
      />
    </Box>
  );
}
