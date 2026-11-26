import { FullscreenDrawer as Drawer } from "../../common/FullscreenOverlays";
// MUI COMPONENTS
import { Box, Card, CardContent, Typography, Button, Chip, Stack, IconButton, Grid } from "@mui/material";

// ICONS
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

// CONTEXTS
import { useWaiterCalls } from "../../../context/WaiterCallsContext";
import { useLanguage } from "../../../context/LanguageContext";

// OTHERS
import { formatTimeAgo } from "../../../utils/helpers";
import { useState } from "react";

function WaiterCallNotification({ open, close }) {
  const { calls, resolveCall } = useWaiterCalls();
  const [resolvingId, setResolvingId] = useState(null);
  const { language, t } = useLanguage();

  return (
    <Drawer
      anchor={language === "ar" ? "right" : "left"}
      open={open}
      onClose={close}
      slotProps={{
        paper: {
          dir: language === "ar" ? "rtl" : "ltr",
          sx: {
            width: { xs: "100%", sm: 520 },
            p: { xs: 2, sm: 3 },
            background: "#171614",
          },
        },
      }}
    >
      {/* هيدر النافذة */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: "900", color: "text.primary" }}>
            {t("waiterHeader")}
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: "700", color: "text.secondary" }}>
            {t("waiterPending")}: {calls.length}
          </Typography>
        </Box>
        <IconButton aria-label={language === "ar" ? "إغلاق" : "Close"} onClick={() => close()} sx={{ backgroundColor: "rgba(255,255,255,.06)" }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* المحتوى */}
      {calls.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            p: 4,
            textAlign: "center",
            borderRadius: "10px",
            border: "1px dashed rgba(233,222,207,.20)",
            backgroundColor: "#211f1c",
            mt: 2,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 48, color: "success", mb: 1 }} />
          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
            {t("waiterEmpty")}
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {calls.map((call) => (
            <Grid size={12} key={call.id}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: "8px",
                  border: "1px solid rgba(233,222,207,.12)",
                  backgroundColor: "#211f1c",
                }}
              >
                <CardContent sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                      <TableRestaurantIcon sx={{ color: "primary.main" }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: "700" }}>
                        {t("table")} {call.table_number}
                      </Typography>
                    </Stack>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                      <AccessTimeIcon sx={{ fontSize: 14 }} />
                      <Typography variant="caption">{formatTimeAgo(call.created_at, language, t)}</Typography>
                    </Stack>
                  </Box>

                  <Chip label={call.reason} size="small" sx={{ alignSelf: "flex-start", fontWeight: "500" }} />

                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    onClick={async () => { if (resolvingId) return; setResolvingId(call.id); await resolveCall(call.id); setResolvingId(null); }}
                    disabled={resolvingId === call.id}
                    sx={{
                      borderRadius: "8px",
                      backgroundColor: "success.main",
                      color: "#122219",
                      fontWeight: "bold",
                      boxShadow: "none",
                      "&:hover": { backgroundColor: "success.dark" },
                    }}
                  >
                    {resolvingId === call.id ? "جاري الإرسال..." : t("waiterFulfilled")}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Drawer>
  );
}

export default WaiterCallNotification;
