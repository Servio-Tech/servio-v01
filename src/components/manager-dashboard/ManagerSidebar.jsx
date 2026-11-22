import { FullscreenSwipeableDrawer as SwipeableDrawer } from "../common/FullscreenOverlays";
import SidebarItem from "./SidebarItem";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useLanguage } from "../../context/LanguageContext";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

const sidebarWidth = 260;
const groups = [
  {
    ar: "المتابعة", en: "OVERVIEW",
    items: [
      { id: "reports", ar: "التقارير", en: "Reports", icon: <AssessmentOutlinedIcon /> },
      { id: "history", key: "orderHistory", icon: <ReceiptLongOutlinedIcon /> },
      { id: "shifts", ar: "الورديات", en: "Shifts", icon: <AccessTimeRoundedIcon /> },
    ],
  },
  {
    ar: "إدارة النشاط", en: "MANAGE",
    items: [
      { id: "menu", key: "menuControl", icon: <TuneOutlinedIcon /> },
      { id: "inventory", ar: "إدارة النفاد", en: "Availability", icon: <Inventory2OutlinedIcon /> },
      { id: "qrGen", key: "qrCodes", icon: <QrCode2OutlinedIcon /> },
    ],
  },
  {
    ar: "الحساب", en: "ACCOUNT",
    items: [{ id: "settings", key: "settings", icon: <SettingsOutlinedIcon /> }],
  },
];

function ManagerSidebar({ mobileOpen, handleDrawerToggle, activeTab, onSelectTab }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { language, t } = useLanguage();
  const ar = language === "ar";

  const handleItemClick = (id) => {
    onSelectTab(id);
    if (isMobile) handleDrawerToggle();
  };

  return (
    <SwipeableDrawer
      className="dashboard-theme-portal dashboard-manager-sidebar"
      anchor={ar ? "right" : "left"}
      variant={isMobile ? "temporary" : "permanent"}
      open={isMobile ? mobileOpen : true}
      onClose={handleDrawerToggle}
      onOpen={handleDrawerToggle}
      ModalProps={{ keepMounted: true }}
      sx={{
        ...(isMobile ? {} : { width: sidebarWidth, flexShrink: 0 }),
        "& .MuiDrawer-paper": {
          width: sidebarWidth,
          boxSizing: "border-box",
          color: "text.primary",
          backgroundColor: "#161615",
          border: 0,
          borderInlineEnd: "1px solid rgba(233,222,207,.12)",
          boxShadow: "none",
        },
      }}
    >
      <Box component="nav" aria-label={ar ? "التنقل في لوحة المدير" : "Manager dashboard navigation"} dir={ar ? "rtl" : "ltr"} sx={{ display: "flex", flexDirection: "column", minHeight: "100%", p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.3, px: 0.75, pt: 1.1, pb: 3.2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box component="img" src="/logo192.png" alt="" sx={{ width: 38, height: 38, objectFit: "contain", borderRadius: 1.4, flexShrink: 0 }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography component="div" sx={{ color: "#f5f0e8", fontSize: "1.18rem", fontWeight: 900, letterSpacing: ".09em", lineHeight: 1.15 }}>SERVIO</Typography>
            <Typography component="div" sx={{ color: "#a9a095", fontSize: ".68rem", fontWeight: 700, letterSpacing: ar ? 0 : ".1em", mt: 0.35 }}>{ar ? "مساحة الإدارة" : "MANAGEMENT"}</Typography>
          </Box>
          {isMobile && <IconButton aria-label={ar ? "إغلاق القائمة" : "Close menu"} onClick={handleDrawerToggle} size="small" sx={{ color: "text.secondary" }}><CloseRoundedIcon /></IconButton>}
        </Box>
        <Box sx={{ flexGrow: 1, pt: 2.5 }}>
          {groups.map((group) => (
            <Box key={group.en} sx={{ mb: 2.7 }}>
              <Typography component="div" sx={{ px: 1.4, mb: 0.9, color: "#a69e93", fontSize: ".68rem", fontWeight: 800, letterSpacing: ar ? 0 : ".12em" }}>
                {ar ? group.ar : group.en}
              </Typography>
              <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.35 }}>
                {group.items.map((item) => (
                  <SidebarItem key={item.id} navItem={{ ...item, label: item.key ? t(item.key) : ar ? item.ar : item.en }} isSelected={activeTab === item.id} onSelect={() => handleItemClick(item.id)} />
                ))}
              </List>
            </Box>
          ))}
        </Box>
        <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2, px: 1.1, pb: 0.5 }}>
          <Typography sx={{ fontSize: ".7rem", color: "#a69e93", lineHeight: 1.6 }}>
            {ar ? "كل ما تحتاجه لإدارة نشاطك في مكان واحد." : "Your business, all in one place."}
          </Typography>
        </Box>
      </Box>
    </SwipeableDrawer>
  );
}

export default ManagerSidebar;
