import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import LanguageToggle from "../LanguageToggle";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import { useWaiterCalls } from "../../context/WaiterCallsContext";
import { logout } from "../../utils/logout";

function initials(name) {
  const parts = String(name || "Cashier").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
}

export default function DashboardHeader({ handleNotificationOpen }) {
  const { user } = useUser();
  const { calls } = useWaiterCalls();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const userName = user?.name || (ar ? "الكاشير" : "Cashier");
  const currentDate = new Date().toLocaleDateString(ar ? "ar-EG" : "en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
  const iconStyle = {
    color: "#e8edf5", border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 2, width: 40, height: 40,
    "&:hover": { bgcolor: "rgba(255,255,255,.1)", color: "#fff" },
  };

  return (
    <Stack direction="row" useFlexGap sx={{ alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
        <Box aria-hidden="true" sx={{ width: 41, height: 41, flexShrink: 0, borderRadius: 2, bgcolor: "#d9541e", display: "grid", placeItems: "center", color: "#fff", fontSize: "1.1rem", fontWeight: 950 }}>S</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: "#fff", fontWeight: 950, fontSize: { xs: ".95rem", sm: "1.02rem" }, letterSpacing: ".04em", lineHeight: 1.2 }}>SERVIO <Box component="span" sx={{ color: "#a5b1c5", fontWeight: 600, letterSpacing: 0 }}>/ {ar ? "الكاشير" : "Cashier"}</Box></Typography>
          <Typography sx={{ color: "#aab6c9", fontSize: ".73rem", mt: .35, lineHeight: 1.2 }}>{ar ? "استقبال ومتابعة الطلبات" : "Order receiving & operations"} · {currentDate}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" useFlexGap sx={{ alignItems: "center", gap: { xs: .7, sm: 1 }, marginInlineStart: "auto" }}>
        <LanguageToggle compact dark />
        <Tooltip title={t("waiterCalls")}>
          <IconButton aria-label={`${t("waiterCalls")} (${calls.length})`} onClick={handleNotificationOpen} sx={iconStyle}>
            <Badge badgeContent={calls.length} color="error"><NotificationsNoneRoundedIcon fontSize="small" /></Badge>
          </IconButton>
        </Tooltip>
        <Stack direction="row" spacing={.8} sx={{ alignItems: "center", paddingInlineStart: { sm: .5 }, display: { xs: "none", md: "flex" } }}>
          <Avatar sx={{ width: 35, height: 35, bgcolor: "#33425a", color: "#fff", fontSize: ".75rem", fontWeight: 800 }}>{initials(userName)}</Avatar>
          <Box sx={{ maxWidth: 130 }}>
            <Typography noWrap sx={{ color: "#fff", fontSize: ".77rem", fontWeight: 800, lineHeight: 1.25 }}>{userName}</Typography>
            <Typography sx={{ color: "#aab6c9", fontSize: ".68rem" }}>{ar ? "الكاشير" : "Cashier"}</Typography>
          </Box>
        </Stack>
        <Tooltip title={t("logout")}>
          <IconButton aria-label={t("logout")} onClick={() => logout(navigate)} sx={iconStyle}><LogoutRoundedIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
