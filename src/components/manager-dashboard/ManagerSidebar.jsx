import { FullscreenSwipeableDrawer as SwipeableDrawer } from "../common/FullscreenOverlays";
import SidebarItem from "./SidebarItem";
import { Box, List, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useLanguage } from "../../context/LanguageContext";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";

const sections = [
  { en: "INSIGHTS", ar: "البيانات", items: [
    { id: "reports", en: "Reports", ar: "التقارير", icon: <AssessmentOutlinedIcon /> },
    { id: "analytics", en: "Analytics", ar: "التحليلات", icon: <QueryStatsOutlinedIcon /> },
  ] },
  { en: "OPERATIONS", ar: "التشغيل", items: [
    { id: "history", en: "Order history", ar: "سجل الطلبات", icon: <ReceiptLongOutlinedIcon /> },
    { id: "shifts", en: "Shifts", ar: "الورديات", icon: <AccessTimeRoundedIcon /> },
    { id: "menu", en: "Menu control", ar: "التحكم في المنيو", icon: <TuneOutlinedIcon /> },
    { id: "inventory", en: "Inventory", ar: "إدارة المخزون", icon: <Inventory2OutlinedIcon /> },
    { id: "promotions", en: "Promotions & offers", ar: "إدارة العروض", icon: <LocalOfferOutlinedIcon /> },
    { id: "qrGen", en: "Table QR codes", ar: "أكواد الطاولات (QR)", icon: <QrCode2OutlinedIcon /> },
  ] },
  { en: "ACCOUNT", ar: "الحساب", items: [
    { id: "settings", en: "Settings", ar: "الإعدادات", icon: <SettingsOutlinedIcon /> },
  ] },
];

export default function ManagerSidebar({ mobileOpen, handleDrawerToggle, activeTab, onSelectTab }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { language } = useLanguage();
  const ar = language === "ar";
  const select = (id) => { onSelectTab(id); if (isMobile) handleDrawerToggle(); };
  return <SwipeableDrawer anchor={ar ? "right" : "left"} variant={isMobile ? "temporary" : "permanent"} open={isMobile ? mobileOpen : true} onClose={handleDrawerToggle} onOpen={() => {}} ModalProps={{ keepMounted: true }}
    sx={{ width: { xs: 0, md: 252 }, flexShrink: 0, "& .MuiDrawer-paper": { width: 252, boxSizing: "border-box", color: "#fff", background: "#14213d", border: 0, borderInlineEnd: "1px solid rgba(255,255,255,.07)", boxShadow: "0 18px 42px rgba(0,0,0,.18)" } }}>
    <Box dir={ar ? "rtl" : "ltr"} sx={{ p: 2, minHeight: "100%" }}>
      <Box sx={{ display: "flex", gap: 1.3, alignItems: "center", px: 1, py: 2, mb: 2, borderBottom: "1px solid rgba(255,255,255,.09)" }}>
        <Box component="img" src="/logo192.png" alt="SERVIO" sx={{ width: 38, height: 38, borderRadius: 1 }} />
        <Box><Typography component="div" sx={{ color: "white", fontWeight: 900, letterSpacing: ".05em", fontSize: "1.22rem", lineHeight: 1 }}>SERVIO</Typography><Typography sx={{ color: "#9daec8", fontSize: ".68rem", mt: .6, fontWeight: 700 }}>{ar ? "مساحة الإدارة" : "MANAGER WORKSPACE"}</Typography></Box>
      </Box>
      {sections.map((section) => <Box key={section.en} sx={{ mb: 2.2 }}>
        <Typography sx={{ px: 1.5, mb: .8, color: "#8a9bb6", fontWeight: 850, letterSpacing: ar ? 0 : ".12em", fontSize: ".65rem" }}>{ar ? section.ar : section.en}</Typography>
        <List disablePadding sx={{ "& .MuiListItemButton-root": { borderRadius: 2, py: 1, "&.Mui-selected": { bgcolor: "rgba(217,84,30,.18)", "&:hover": { bgcolor: "rgba(217,84,30,.24)" } } }, "& .MuiListItemText-primary": { textAlign: "start", fontSize: ".86rem" }, "& .Mui-selected .MuiListItemText-primary, & .Mui-selected .MuiListItemIcon-root": { color: "#ff9569" } }}>
          {section.items.map((item) => <SidebarItem key={item.id} navItem={{ ...item, label: ar ? item.ar : item.en }} isSelected={activeTab === item.id} onSelect={() => select(item.id)} />)}
        </List>
      </Box>)}
    </Box>
  </SwipeableDrawer>;
}
