import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../context/StoreInfoContext";
import { useUser } from "../../context/UserContext";
import { logout } from "../../utils/logout";
import LanguageToggle from "../LanguageToggle";
import { useLanguage } from "../../context/LanguageContext";

function stringAvatar(name) {
  const parts = (name || "Manager").trim().split(/\s+/).filter(Boolean);
  return { children: (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.[0] || "M").toUpperCase() };
}

function ManagerHeader({ onDrawerToggle, activeTab }) {
  const { storeInfo } = useStore();
  const { user } = useUser();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const userName = user?.name || (language === "ar" ? "المدير" : "Manager");
  const sectionName = {
    reports: language === "ar" ? "نظرة عامة" : "Overview",
    history: t("orderHistory"),
    shifts: language === "ar" ? "الورديات" : "Shifts",
    menu: t("menuControl"),
    inventory: language === "ar" ? "إدارة التوفر" : "Availability",
    settings: t("settings"),
    qrGen: t("qrCodes"),
  }[activeTab] || t("managerHeader");

  return (
    <Stack direction="row" sx={{ minHeight: { xs: 72, md: 80 }, justifyContent: "space-between", alignItems: "center", direction: language === "ar" ? "rtl" : "ltr", px: { xs: 2, sm: 3, lg: 4 }, py: 1.1, gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <IconButton aria-label={t("openMenu")} onClick={onDrawerToggle} sx={{ display: { md: "none" }, color: "text.primary", border: "1px solid", borderColor: "divider", borderRadius: 2 }}><MenuRoundedIcon /></IconButton>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ color: "#c2b7a9", fontSize: ".75rem", fontWeight: 800, letterSpacing: language === "ar" ? 0 : ".1em", lineHeight: 1.4, maxWidth: { xs: 170, sm: 300 } }}>{t("managerHeader")} · {sectionName}</Typography>
          <Typography component="div" sx={{ color: "text.primary", fontWeight: 800, fontSize: { xs: ".95rem", sm: "1.08rem" }, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: { xs: 125, sm: 280, md: 420 } }}>{storeInfo?.store_name || t("storeFallback")}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.75, sm: 1.2 }, flexShrink: 0 }}>
        <Box className="dashboard-manager-language"><LanguageToggle compact dark /></Box>
        <Box sx={{ display: { xs: "none", lg: "block" }, textAlign: "end", maxWidth: 160 }}>
          <Typography noWrap sx={{ color: "text.primary", fontWeight: 750, fontSize: ".82rem", lineHeight: 1.3 }}>{userName}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: ".7rem", lineHeight: 1.3 }}>{language === "ar" ? "مدير النشاط" : "Manager"}</Typography>
        </Box>
        <Avatar {...stringAvatar(userName)} sx={{ width: { xs: 34, sm: 38 }, height: { xs: 34, sm: 38 }, fontSize: ".78rem", fontWeight: 800, bgcolor: "#403027", color: "#f4bd99", border: "1px solid rgba(233,148,98,.22)" }} />
        <Tooltip title={t("logout")}>
          <IconButton aria-label={t("logout")} onClick={() => logout(navigate)} sx={{ color: "text.secondary", border: "1px solid", borderColor: "divider", borderRadius: 2, "&:hover": { color: "primary.light", borderColor: "primary.dark", bgcolor: "rgba(233,148,98,.08)" } }}><LogoutRoundedIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
    </Stack>
  );
}
export default ManagerHeader;
