// مكوّن واجهة `SettingsLayout` ضمن مجموعة `settings`.
import { useState } from "react";
import { useLanguage } from "../../../context/LanguageContext";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PersonIcon from "@mui/icons-material/Person";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import StoreInfoSettings from "./StoreInfoSettings";
import UserProfileSettings from "./UserProfileSettings";
import CashierManagement from "./CashierManagement";
import ShiftSettings from "./ShiftSettings";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";

function CustomTabPanel({ children, value, index, ...other }) {
  return <div role="tabpanel" hidden={value !== index} id={`settings-tabpanel-${index}`} aria-labelledby={`settings-tab-${index}`} {...other}>{value === index && <Box sx={{ pt: { xs: 2, sm: 2.75 } }}>{children}</Box>}</div>;
}
function SettingsLayout() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState(0);
  return (
    <Box sx={{ width: "100%", maxWidth: 1180, mx: "auto", pb: 2 }}>
      <Box sx={{ mb: { xs: 2, sm: 2.75 } }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 850, mb: 0.4, color: "text.primary", textAlign: "start", fontSize: { xs: "1.65rem", sm: "2rem" } }}>
          {t("managerSettingsTitle")}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 550, textAlign: "start", maxWidth: 720 }}>
          {t("managerSettingsHint")}
        </Typography>
      </Box>
      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 1.25, sm: 2.25, md: 3 }, borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", mx: { xs: -1.25, sm: -2.25, md: -3 }, px: { xs: 1, sm: 1.5, md: 2 } }}>
          <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} aria-label={t("managerSettingsTitle")} textColor="primary" indicatorColor="primary" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab id="settings-tab-0" aria-controls="settings-tabpanel-0" icon={<StorefrontIcon />} iconPosition="start" label={t("managerStoreTab")} sx={{ fontWeight: 750, minHeight: 54, px: { xs: 1, sm: 1.5 } }} />
            <Tab id="settings-tab-1" aria-controls="settings-tabpanel-1" icon={<PersonIcon />} iconPosition="start" label={t("managerProfileTab")} sx={{ fontWeight: 750, minHeight: 54, px: { xs: 1, sm: 1.5 } }} />
            <Tab id="settings-tab-2" aria-controls="settings-tabpanel-2" icon={<PeopleAltIcon />} iconPosition="start" label={t("managerCashiersTab")} sx={{ fontWeight: 750, minHeight: 54, px: { xs: 1, sm: 1.5 } }} />
            <Tab id="settings-tab-3" aria-controls="settings-tabpanel-3" icon={<AccessTimeRoundedIcon />} iconPosition="start" label={language === "ar" ? "ساعات الدوام" : "Working hours"} sx={{ fontWeight: 750, minHeight: 54, px: { xs: 1, sm: 1.5 } }} />
          </Tabs>
        </Box>
        <CustomTabPanel value={activeTab} index={0}><StoreInfoSettings /></CustomTabPanel>
        <CustomTabPanel value={activeTab} index={1}><UserProfileSettings /></CustomTabPanel>
        <CustomTabPanel value={activeTab} index={2}><CashierManagement /></CustomTabPanel>
        <CustomTabPanel value={activeTab} index={3}><ShiftSettings /></CustomTabPanel>
      </Paper>
    </Box>
  );
}
export default SettingsLayout;
