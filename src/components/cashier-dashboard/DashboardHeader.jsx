// مكوّن واجهة `DashboardHeader` ضمن مجموعة `cashier-dashboard`.
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LogoutIcon from "@mui/icons-material/Logout";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import LanguageToggle from "../LanguageToggle";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import { useWaiterCalls } from "../../context/WaiterCallsContext";
import { logout } from "../../utils/logout";

function stringAvatar(name) {
  if (!name) return { children: "C" };
  const parts = name.trim().split(" ");
  return { children: (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0][0]).toUpperCase() };
}

function DashboardHeader({ handleNotificationOpen, totalSales = 0, currency = "SAR", salesLoading = false, onOpenSalesHistory }) {
  const { user } = useUser();
  const { calls } = useWaiterCalls();
  const navigate = useNavigate();
  const userName = user?.name || "Cashier";
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const currentDate = new Date().toLocaleDateString(ar ? "ar-EG" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const salesLabel = ar ? "إجمالي المبيعات اليوم" : "Today's sales";

  return (
    <Box sx={{ width: "100%" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, width: "100%", gap: { xs: 1, sm: 1.5 } }}
      >
        <Box sx={{ textAlign: "start", minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 900, letterSpacing: 1.2 }}>
            {t("liveOperations")}
          </Typography>
          <Typography
            variant="h5"
            component="h2"
            sx={{ fontSize: { xs: "1.2rem", sm: "1.45rem", md: "1.7rem" }, fontWeight: 900, color: "text.primary", letterSpacing: "-0.03em", lineHeight: 1.15 }}
          >
            {t("currentOrders")}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontSize: { xs: "0.74rem", sm: "0.84rem" }, fontWeight: 600, color: "text.secondary", mt: 0.45, display: { xs: "none", sm: "block" } }}
          >
            {currentDate} · {t("cashierKitchen")}
          </Typography>
        </Box>

        <Stack
          direction="row"
          useFlexGap
          sx={{
            alignItems: "center",
            justifyContent: { xs: "flex-start", sm: "flex-end" },
            gap: { xs: 0.55, sm: 0.8 },
            flex: { xs: "1 1 auto", sm: "0 0 auto" },
            minWidth: 0,
            overflowX: { xs: "auto", sm: "visible" },
            pb: { xs: 0.2, sm: 0 },
          }}
        >
          <Tooltip title={salesLabel}>
            <Box
              role="group"
              aria-label={`${salesLabel}: ${salesLoading ? "—" : Number(totalSales || 0).toFixed(2)} ${currency}`}
              sx={{ display: "flex", alignItems: "center", gap: 0.65, px: 1, py: 0.55, flex: "0 0 auto", border: "1px solid", borderColor: "rgba(244,121,32,.3)", borderRadius: 2.4, bgcolor: "rgba(244,121,32,.08)", whiteSpace: "nowrap" }}
            >
              <PointOfSaleRoundedIcon sx={{ color: "primary.main", fontSize: 19 }} />
              <Box>
                <Typography sx={{ color: "text.secondary", fontSize: ".62rem", lineHeight: 1.15, fontWeight: 800 }}>
                  {ar ? "مبيعات اليوم" : "Today"}
                </Typography>
                <Typography dir="ltr" sx={{ color: "text.primary", fontSize: ".88rem", lineHeight: 1.2, fontWeight: 950, fontVariantNumeric: "tabular-nums" }}>
                  {salesLoading ? "—" : Number(totalSales || 0).toFixed(2)} <Box component="span" sx={{ fontSize: ".68rem", color: "text.secondary" }}>{currency}</Box>
                </Typography>
              </Box>
            </Box>
          </Tooltip>

          <Tooltip title={ar ? "فتح سجل المبيعات" : "Open sales history"}>
            <Button
              aria-label={ar ? "فتح سجل المبيعات" : "Open sales history"}
              variant="outlined"
              onClick={onOpenSalesHistory}
              startIcon={<ReceiptLongRoundedIcon />}
              sx={{ minWidth: { xs: 38, sm: "auto" }, width: { xs: 38, sm: "auto" }, minHeight: 38, px: { xs: 0, sm: 1.2 }, borderRadius: 2.4, fontWeight: 850, whiteSpace: "nowrap", flex: "0 0 auto", "& .MuiButton-startIcon": { mx: { xs: 0, sm: 0.7 } } }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{t("orderHistory")}</Box>
            </Button>
          </Tooltip>

          <Box sx={{ flex: "0 0 auto", "& .MuiToggleButton-root.Mui-selected": { color: "#20130d" } }}>
            <LanguageToggle compact dark />
          </Box>
          <IconButton
            aria-label={ar ? "نداءات النادل" : "Waiter calls"}
            onClick={handleNotificationOpen}
            sx={{ color: "text.secondary", border: "1px solid", borderColor: "divider", borderRadius: 2.4, p: 1, flex: "0 0 auto", "&:hover": { color: "primary.main", backgroundColor: "rgba(244,121,32,.06)" } }}
          >
            <Badge badgeContent={calls.length} color="error">
              <NotificationsIcon sx={{ fontSize: { xs: 19, md: 21 } }} />
            </Badge>
          </IconButton>
          <Avatar
            {...stringAvatar(userName)}
            sx={{ width: { xs: 36, md: 40 }, height: { xs: 36, md: 40 }, fontSize: { xs: "0.875rem", md: "0.95rem" }, fontWeight: 800, backgroundColor: "primary.main", color: "primary.contrastText", boxShadow: "0 8px 20px rgba(244,121,32,.16)", flex: "0 0 auto" }}
          />
          <Tooltip title={t("logout")}>
            <IconButton
              aria-label={t("logout")}
              onClick={() => logout(navigate)}
              sx={{ color: "text.secondary", border: "1px solid", borderColor: "divider", borderRadius: 2.4, p: 1, flex: "0 0 auto", "&:hover": { color: "primary.main", borderColor: "primary.light" } }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

export default DashboardHeader;
