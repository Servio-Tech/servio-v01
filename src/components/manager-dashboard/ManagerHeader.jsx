import { Avatar, Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../context/StoreInfoContext";
import { useUser } from "../../context/UserContext";
import { logout } from "../../utils/logout";
import LanguageToggle from "../LanguageToggle";
import { useLanguage } from "../../context/LanguageContext";

function stringAvatar(name) {
  const parts = String(name || "M").trim().split(/\s+/).filter(Boolean);
  return { children: (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.[0] || "M").toUpperCase() };
}

export default function ManagerHeader({ onDrawerToggle }) {
  const { storeInfo } = useStore();
  const { user } = useUser();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const userName = user?.name || (language === "ar" ? "المدير" : "Manager");
  return <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", direction: language === "ar" ? "rtl" : "ltr", py: 1.25, px: { xs: 1.3, sm: 2 }, gap: 1.5 }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.3, minWidth: 0 }}>
      <IconButton aria-label={t("openMenu")} onClick={onDrawerToggle} sx={{ display: { md: "none" }, color: "#fff", border: "1px solid rgba(255,255,255,.14)", borderRadius: 2 }}><MenuIcon /></IconButton>
      <Box sx={{ minWidth: 0 }}><Typography sx={{ color: "#ff9569", fontSize: ".65rem", fontWeight: 900, letterSpacing: ".08em" }}>{t("managerHeader")}</Typography><Typography sx={{ color: "#f7f8fb", fontWeight: 850, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: { xs: 125, sm: 350, md: 520 } }}>{storeInfo?.store_name || t("storeFallback")}</Typography></Box>
    </Box>
    <Box sx={{ display: "flex", alignItems: "center", gap: { xs: .7, sm: 1.3 } }}><LanguageToggle compact dark /><Typography variant="body2" sx={{ color: "#c2cbd8", fontWeight: 750, display: { xs: "none", sm: "block" } }}>{userName}</Typography><Avatar {...stringAvatar(userName)} sx={{ width: { xs: 34, sm: 38 }, height: { xs: 34, sm: 38 }, fontSize: ".8rem", fontWeight: 850, bgcolor: "#d9541e", color: "#fff" }} /><Tooltip title={t("logout")}><IconButton aria-label={t("logout")} onClick={() => logout(navigate)} sx={{ color: "#c4ccda", border: "1px solid rgba(255,255,255,.14)", borderRadius: 2, "&:hover": { color: "#fff", bgcolor: "rgba(217,84,30,.2)" } }}><LogoutIcon fontSize="small" /></IconButton></Tooltip></Box>
  </Stack>;
}
