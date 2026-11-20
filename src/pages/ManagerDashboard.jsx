import { useState } from "react";
import { Box } from "@mui/material";
import { useLanguage } from "../context/LanguageContext";
import ManagerSidebar from "../components/manager-dashboard/ManagerSidebar";
import ManagerHeader from "../components/manager-dashboard/ManagerHeader";
import Analytics from "../components/manager-dashboard/Analytics";
import Reports from "../components/manager-dashboard/Reports";
import MenuControl from "../components/manager-dashboard/menu-control/MenuControl";
import QRCodeGenerate from "../components/manager-dashboard/settings/QRCodesGenerate";
import OrdersHistory from "../components/manager-dashboard/orders/OrdersHistory";
import SettingsLayout from "../components/manager-dashboard/settings/SettingsLayout";
import ShiftReports from "../components/manager-dashboard/ShiftReports";
import IngredientInventory from "../components/manager-dashboard/IngredientInventory";
import BranchTabs from "../components/manager-dashboard/BranchTabs";
import Promotions from "../components/manager-dashboard/Promotions";

export default function ManagerDashboard() {
  const { language } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("reports");
  const toggleDrawer = () => setMobileOpen((previous) => !previous);
  const insights = ["reports", "analytics", "qrGen", "promotions", "settings"].includes(activeTab);
  return <Box data-language={language} className="studio-workspace" sx={{ display: "flex", minHeight: "100vh", width: "100%", minWidth: 0, overflowX: "clip" }}>
    <ManagerSidebar mobileOpen={mobileOpen} handleDrawerToggle={toggleDrawer} activeTab={activeTab} onSelectTab={setActiveTab} />
    <Box component="main" sx={{ flexGrow: 1, minWidth: 0, minHeight: "100vh", display: "flex", flexDirection: "column", background: insights ? "radial-gradient(circle at 85% 0%, rgba(141,122,255,.14), transparent 35%), #16171b" : "#f7f7f5" }}>
      <Box sx={{ position: "sticky", top: 0, zIndex: (theme) => theme.zIndex.appBar, px: { xs: 1.25, sm: 2.5, lg: 3 }, pt: { xs: 1, md: 1.5 } }}>
        <Box sx={{ bgcolor: "#202127", border: "1px solid rgba(255,255,255,.09)", borderRadius: 2 }}><ManagerHeader onDrawerToggle={toggleDrawer} /></Box>
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0, width: "100%", p: { xs: 1.25, sm: 2.5, lg: 3 }, pt: 2 }}>
        <Box sx={insights ? { "& > .MuiBox-root": { bgcolor: "#202127", borderColor: "rgba(255,255,255,.09)" }, "& .MuiTab-root": { color: "#a6a7af", "&.Mui-selected": { color: "#ff8a6d" } }, "& .MuiTabs-indicator": { bgcolor: "#ff6038" }, "& .MuiButton-root": { bgcolor: "#ff6038", "&:hover": { bgcolor: "#e44b28" } } } : {}}><BranchTabs /></Box>
        {activeTab === "reports" && <Reports />}
        {activeTab === "analytics" && <Analytics />}
        {activeTab === "history" && <OrdersHistory />}
        {activeTab === "shifts" && <ShiftReports managerOnlyFeatures />}
        {activeTab === "menu" && <MenuControl />}
        {activeTab === "inventory" && <IngredientInventory canManage />}
        {activeTab === "settings" && <SettingsLayout />}
        {activeTab === "qrGen" && <QRCodeGenerate />}
        {activeTab === "promotions" && <Promotions />}
      </Box>
    </Box>
  </Box>;
}
