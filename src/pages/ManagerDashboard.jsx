import { useState } from "react";
import Box from "@mui/material/Box";
import { useLanguage } from "../context/LanguageContext";
import { DashboardThemeProvider } from "../theme/DashboardTheme";
import ManagerSidebar from "../components/manager-dashboard/ManagerSidebar";
import ManagerHeader from "../components/manager-dashboard/ManagerHeader";
import Reports from "../components/manager-dashboard/Reports";
import MenuControl from "../components/manager-dashboard/menu-control/MenuControl";
import QRCodeGenerate from "../components/manager-dashboard/settings/QRCodesGenerate";
import OrdersHistory from "../components/manager-dashboard/orders/OrdersHistory";
import SettingsLayout from "../components/manager-dashboard/settings/SettingsLayout";
import ShiftReports from "../components/manager-dashboard/ShiftReports";
import IngredientInventory from "../components/manager-dashboard/IngredientInventory";
import BranchTabs from "../components/manager-dashboard/BranchTabs";

function ManagerDashboard() {
  const { language } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("reports");
  const handleDrawerToggle = () => setMobileOpen((open) => !open);

  return (
    <DashboardThemeProvider direction={language === "ar" ? "rtl" : "ltr"}>
      <Box data-language={language} sx={{ display: "flex", minHeight: "100vh", width: "100%", minWidth: 0, bgcolor: "background.default" }}>
        <ManagerSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} activeTab={activeTab} onSelectTab={setActiveTab} />
        <Box component="main" sx={{ flex: "1 1 0", minWidth: 0, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <Box sx={{ position: "sticky", top: 0, zIndex: (theme) => theme.zIndex.appBar, borderBottom: "1px solid", borderColor: "divider", bgcolor: "rgba(17,17,16,.94)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <ManagerHeader onDrawerToggle={handleDrawerToggle} />
          </Box>
          <Box sx={{ flexGrow: 1, width: "100%", minWidth: 0, px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
            <Box className="dashboard-manager-branches"><BranchTabs /></Box>
            <Box className={`dashboard-manager-content dashboard-manager-content--${activeTab}`} sx={{ minWidth: 0 }}>
              {activeTab === "reports" && <Reports />}
              {activeTab === "history" && <OrdersHistory />}
              {activeTab === "shifts" && <ShiftReports managerOnlyFeatures />}
              {activeTab === "menu" && <MenuControl />}
              {activeTab === "inventory" && <IngredientInventory canManage />}
              {activeTab === "settings" && <SettingsLayout />}
              {activeTab === "qrGen" && <QRCodeGenerate />}
            </Box>
          </Box>
        </Box>
      </Box>
    </DashboardThemeProvider>
  );
}

export default ManagerDashboard;
