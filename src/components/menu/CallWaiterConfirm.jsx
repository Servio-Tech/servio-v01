// مكوّن واجهة `CallWaiterConfirm` ضمن مجموعة `menu`.
import { FullscreenSwipeableDrawer as SwipeableDrawer } from "../common/FullscreenOverlays";
// HOOKS
import { useEffect, useState } from "react";

// MUI COMPONENTS
import { Alert, Box, Typography, Button, IconButton, Chip, Stack } from "@mui/material";

// ICONS
import CloseIcon from "@mui/icons-material/Close";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";

// CONTEXTS
import { useWaiterCalls } from "../../context/WaiterCallsContext";
import { useLanguage } from "../../context/LanguageContext";

const REASON_OPTIONS = [
  { value: "طلب الحساب", en: "Request the bill" },
  { value: "مساعدة بخصوص الطلب", en: "Help with my order" },
  { value: "أدوات إضافية", en: "Extra utensils" },
  { value: "تنظيف الطاولة", en: "Clean the table" },
];

function CallWaiterConfirm({ open, close, tableNumber = "1", fullPage = false }) {
  const [selectedReason, setSelectedReason] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState("");

  const { addCall } = useWaiterCalls(); 
  const { language } = useLanguage();
  const isEnglish = language === "en";

  useEffect(() => {
    if (!fullPage && !open) {
      setIsSent(false);
      setSelectedReason("");
      setSendError("");
    }
  }, [fullPage, open]);

  const handleClose = () => {
    if (!loading && close) close();
  };

  const handleReasonToggle = (reason) => {
    setSelectedReason((prev) => (prev === reason ? "" : reason));
  };

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    setSendError("");
    try {
      const result = await addCall(tableNumber, selectedReason);
      if (result?.error) throw result.error;
      setIsSent(true);
    } catch (error) {
      console.error("تعذر إرسال نداء الخدمة:", error);
      setSendError(isEnglish
        ? "Your request could not be sent. Please try again."
        : "تعذّر إرسال طلبك. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <Box
        sx={{
          p: { xs: 2, sm: 3 },
          pb: "calc(20px + env(safe-area-inset-bottom, 0px))",
          maxHeight: fullPage ? "none" : "80dvh",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          gap: { xs: 2, sm: 2.5 },
        }}
      >
        {!fullPage && <Box
          sx={{
            width: "45px",
            height: "4px",
            backgroundColor: "divider",
            borderRadius: "2px",
            mx: "auto",
            mb: 0,
            flexShrink: 0,
          }}
        />}

        {!isSent ? (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h5" component="h2" sx={{ fontWeight: 850 }}>
                {isEnglish ? "Call for assistance" : "طلب مساعدة الموظف"}
              </Typography>
              <IconButton
                onClick={handleClose}
                disabled={loading}
                aria-label={isEnglish ? "Close" : "إغلاق"}
                size="small"
                sx={{ backgroundColor: "action.hover" }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            <Stack spacing={2} sx={{ py: .5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "16px",
                    backgroundColor: "action.selected",
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <NotificationsActiveIcon fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                    {isEnglish ? `Table ${tableNumber}` : `طاولة رقم ${tableNumber}`}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {isEnglish
                      ? "Choose what you need and we’ll let the team know."
                      : "اختر ما تحتاجه، وسنبلّغ فريق الخدمة."}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {REASON_OPTIONS.map((reason) => (
                  <Chip
                    key={reason.value}
                    label={isEnglish ? reason.en : reason.value}
                    clickable
                    aria-pressed={selectedReason === reason.value}
                    disabled={loading}
                    onClick={() => handleReasonToggle(reason.value)}
                    color={selectedReason === reason.value ? "primary" : "default"}
                    variant={selectedReason === reason.value ? "filled" : "outlined"}
                    sx={{
                      minHeight: 42,
                      borderRadius: "13px",
                      px: 0.7,
                      fontWeight: 700,
                    }}
                  />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {isEnglish ? "Choose a reason if helpful, or send a general request." : "يمكنك اختيار سبب، أو إرسال طلب مساعدة عام."}
              </Typography>
            </Stack>

            {sendError && <Alert severity="error">{sendError}</Alert>}

            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
              onClick={handleConfirm}
              sx={{
                borderRadius: "14px",
                minHeight: 52,
                py: 1.2,
                fontWeight: 850,
                fontSize: "1rem",
                mt: .5,
              }}
            >
              {loading
                ? (isEnglish ? "Sending…" : "جارٍ الإرسال…")
                : (isEnglish ? "Send request" : "إرسال طلب المساعدة")}
            </Button>
          </>
        ) : (
          <Box role="status" sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", py: { xs: 3, sm: 5 }, gap: 1 }}>
            <CheckCircleOutlinedIcon color="success" sx={{ fontSize: "4rem", mb: .5 }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {isEnglish ? "Your request was sent" : "تم إرسال طلبك إلى فريق الخدمة"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 340, lineHeight: 1.7 }}>
              {isEnglish ? "The service team will be with you shortly. You can close this screen now." : "سيتابع فريق الخدمة طلبك قريبًا. يمكنك إغلاق هذه الشاشة الآن."}
            </Typography>
            <Button fullWidth variant="contained" onClick={handleClose} sx={{ mt: 1, minHeight: 48, borderRadius: "13px", fontWeight: 850 }}>
              {isEnglish ? "Done" : "تم"}
            </Button>
          </Box>
        )}
      </Box>
  );

  if (fullPage) {
    return (
      <Box component="section" className="customer-service-form" dir={isEnglish ? "ltr" : "rtl"}>
        {content}
      </Box>
    );
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      onOpen={() => {}}
      disableSwipeToOpen={true}
      slotProps={{
        paper: {
          dir: isEnglish ? "ltr" : "rtl",
          sx: {
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            maxHeight: "80dvh",
            overflowY: "auto",
            backgroundColor: "background.paper",
          },
        },
      }}
    >
      {content}
    </SwipeableDrawer>
  );
}

export default CallWaiterConfirm;
