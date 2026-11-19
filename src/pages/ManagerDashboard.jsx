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
  return <Box data-language={language} sx={{ display: "flex", minHeight: "100vh", width: "100%", minWidth: 0, overflowX: "clip", bgcolor: "#111111" }}>
    <ManagerSidebar mobileOpen={mobileOpen} handleDrawerToggle={toggleDrawer} activeTab={activeTab} onSelectTab={setActiveTab} />
    <Box component="main" sx={{ flexGrow: 1, minWidth: 0, minHeight: "100vh", display: "flex", flexDirection: "column", background: insights ? "radial-gradient(circle at 85% 0%, rgba(20,33,61,.5), transparent 35%), #111111" : "linear-gradient(135deg, #fff8f1 0%, #f7f8fb 48%, #eef1f7 100%)" }}>
      <Box sx={{ position: "sticky", top: 0, zIndex: (theme) => theme.zIndex.appBar, px: { xs: 1.25, sm: 2.5, lg: 3 }, pt: { xs: 1, md: 1.5 } }}>
        <Box sx={{ bgcolor: "#14213d", border: "1px solid rgba(255,255,255,.08)", borderRadius: 1 }}><ManagerHeader onDrawerToggle={toggleDrawer} /></Box>
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0, width: "100%", p: { xs: 1.25, sm: 2.5, lg: 3 }, pt: 2 }}>
        <Box sx={insights ? { "& > .MuiBox-root": { bgcolor: "#191d24", borderColor: "rgba(255,255,255,.08)" }, "& .MuiTab-root": { color: "#a6b1c1", "&.Mui-selected": { color: "#ff9569" } }, "& .MuiTabs-indicator": { bgcolor: "#d9541e" }, "& .MuiButton-root": { bgcolor: "#d9541e", "&:hover": { bgcolor: "#bd4516" } } } : {}}><BranchTabs /></Box>
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
