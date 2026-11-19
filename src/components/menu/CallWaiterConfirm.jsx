// مكوّن واجهة `CallWaiterConfirm` ضمن مجموعة `menu`.
import { FullscreenSwipeableDrawer as SwipeableDrawer } from "../common/FullscreenOverlays";
// HOOKS
import { useState } from "react";

// MUI COMPONENTS
import { Box, Typography, Button, IconButton, Chip, Stack } from "@mui/material";

// ICONS
import CloseIcon from "@mui/icons-material/Close";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";

// CONTEXTS
import { useWaiterCalls } from "../../context/WaiterCallsContext";
import { useLanguage } from "../../context/LanguageContext";

const REASON_OPTIONS = [
  "طلب الحساب",
  "مساعدة بخصوص الطلب",
  "أدوات إضافية",
  "تنظيف الطاولة",
];
const REASON_LABELS_EN = ["Request the bill", "Help with an order", "Extra utensils", "Clean the table"];

function CallWaiterConfirm({ open, close, tableNumber = "1" }) {
  const [selectedReason, setSelectedReason] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { addCall } = useWaiterCalls(); 
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const handleReasonToggle = (reason) => {
    setSelectedReason((prev) => (prev === reason ? "" : reason));
  };

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    const result = await addCall(tableNumber, selectedReason);
    setLoading(false);
    if (result?.error) return;
    setIsSent(true);
    setTimeout(() => { if (close) close(); setTimeout(() => { setIsSent(false); setSelectedReason(""); }, 300); }, 1500);
  };

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={close}
      onOpen={() => {}}
      disableSwipeToOpen={true}
      slotProps={{
        paper: {
          dir: isEnglish ? "ltr" : "rtl",
          sx: {
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            maxHeight: "80dvh",
            backgroundColor: "background.paper",
          },
        },
      }}
    >
      <Box
        sx={{
          p: 3,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          gap: 3,
        }}
      >
        <Box
          sx={{
            width: "45px",
            height: "4px",
            backgroundColor: "grey.300",
            borderRadius: "2px",
            mx: "auto",
            mb: 2,
            flexShrink: 0,
          }}
        />

        {!isSent ? (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                {isEnglish ? "Ask staff for help" : "طلب مساعدة الموظف"}
              </Typography>
              <IconButton
                onClick={close}
                aria-label={isEnglish ? "Close" : "إغلاق"}
                size="small"
                sx={{ backgroundColor: "grey.100" }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            <Stack spacing={2.5} sx={{ py: 1 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "16px",
                    backgroundColor: "primary.50",
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
                    {tableNumber === "كاشير" ? (isEnglish ? "Cashier" : "كاشير") : `${isEnglish ? "Table" : "طاولة رقم"} ${tableNumber || "—"}`}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {isEnglish ? "Choose what you need and we'll notify the service team." : "اختر ما تحتاجه، وسنبلّغ فريق الخدمة."}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {REASON_OPTIONS.map((reason, index) => (
                  <Chip
                    key={reason}
                    label={isEnglish ? REASON_LABELS_EN[index] : reason}
                    clickable
                    onClick={() => handleReasonToggle(reason)}
                    color={selectedReason === reason ? "primary" : "default"}
                    variant={selectedReason === reason ? "filled" : "outlined"}
                    sx={{
                      borderRadius: "12px",
                      px: 0.5,
                      py: 2,
                      fontWeight: "500",
                    }}
                  />
                ))}
              </Box>
            </Stack>

            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
              onClick={handleConfirm}
              sx={{
                borderRadius: "14px",
                py: 1.8,
                fontWeight: "bold",
                fontSize: "1rem",
                mt: 3,
              }}
            >
              {loading ? (isEnglish ? "Sending..." : "جارٍ الإرسال...") : (isEnglish ? "Send request" : "إرسال طلب المساعدة")}
            </Button>
          </>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 6,
            }}
          >
            <CheckCircleOutlinedIcon
              color="success"
              sx={{ fontSize: "4rem", mb: 1.5 }}
            />
            <Typography variant="h6" sx={{ fontWeight: "bold" }} gutterBottom>
              {isEnglish ? "Your request was sent to the service team" : "تم إرسال طلبك إلى فريق الخدمة"}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              {isEnglish ? "The service team will follow up shortly." : "سيتابع فريق الخدمة طلبك قريبًا."}
            </Typography>
          </Box>
        )}
      </Box>
    </SwipeableDrawer>
  );
}

export default CallWaiterConfirm;
