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
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import StoreInfoSettings from "./StoreInfoSettings";
import UserProfileSettings from "./UserProfileSettings";
import CashierManagement from "./CashierManagement";
import ShiftSettings from "./ShiftSettings";

function CustomTabPanel({ children, value, index }) {
  return <div role="tabpanel" hidden={value !== index} id={`settings-tabpanel-${index}`} aria-labelledby={`settings-tab-${index}`}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>;
}

export default function SettingsLayout() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    { icon: <StorefrontIcon />, label: t("managerStoreTab"), content: <StoreInfoSettings /> },
    { icon: <PersonIcon />, label: t("managerProfileTab"), content: <UserProfileSettings /> },
    { icon: <PeopleAltIcon />, label: t("managerCashiersTab"), content: <CashierManagement /> },
    { icon: <AccessTimeRoundedIcon />, label: language === "ar" ? "ساعات الدوام" : "Working hours", content: <ShiftSettings /> },
  ];
  return <Box sx={{ maxWidth: 1100, mx: "auto", minWidth: 0 }}>
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="overline" sx={{ color: "#ff9569", letterSpacing: ".1em", fontWeight: 800 }}>{language === "ar" ? "الإدارة / الإعدادات" : "MANAGEMENT / SETTINGS"}</Typography>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 900, mb: .4, color: "#f4f6fa", textAlign: "start" }}>{t("managerSettingsTitle")}</Typography>
      <Typography variant="body2" sx={{ color: "#b1bdd0", textAlign: "start" }}>{t("managerSettingsHint")}</Typography>
    </Box>
    <Paper variant="outlined" sx={{ borderRadius: 1, p: { xs: 1.5, sm: 3 }, bgcolor: "#fff", borderColor: "rgba(255,255,255,.08)" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} aria-label={t("managerSettingsTitle")} textColor="primary" indicatorColor="primary" variant="scrollable" scrollButtons="auto">
          {tabs.map(({ icon, label }, index) => <Tab key={label} id={`settings-tab-${index}`} aria-controls={`settings-tabpanel-${index}`} icon={icon} iconPosition="start" label={label} sx={{ fontWeight: 700, minHeight: 48 }} />)}
        </Tabs>
      </Box>
      {tabs.map(({ label, content }, index) => <CustomTabPanel key={label} value={activeTab} index={index}>{content}</CustomTabPanel>)}
    </Paper>
  </Box>;
}
