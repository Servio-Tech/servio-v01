import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Button } from "@mui/material";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import { DashboardThemeProvider } from "../../theme/DashboardTheme";
import "./ownerStyles.css";

const OwnerLanguageContext = createContext(null);

function initialLanguage() {
  try {
    return (localStorage.getItem("servio_owner_language") || localStorage.getItem("servio_language")) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export default function OwnerLocale({ children }) {
  const [language, setLanguage] = useState(initialLanguage);
  const value = useMemo(() => ({
    language,
    arabic: language === "ar",
    text: (ar, en) => language === "ar" ? ar : en,
    toggle: () => setLanguage((current) => current === "ar" ? "en" : "ar"),
  }), [language]);

  useEffect(() => {
    const oldLang = document.documentElement.lang;
    const oldDir = document.documentElement.dir;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem("servio_owner_language", language); } catch { /* storage is optional */ }
    return () => {
      document.documentElement.lang = oldLang;
      document.documentElement.dir = oldDir;
    };
  }, [language]);

  return <OwnerLanguageContext.Provider value={value}><DashboardThemeProvider direction={language === "ar" ? "rtl" : "ltr"}><div dir={language === "ar" ? "rtl" : "ltr"} style={{ textAlign: "start", minHeight: "100vh" }}>{children}</div></DashboardThemeProvider></OwnerLanguageContext.Provider>;
}

export function useOwnerLanguage() {
  const value = useContext(OwnerLanguageContext);
  if (!value) throw new Error("Owner language provider is missing");
  return value;
}

export function OwnerLanguageToggle() {
  const { language, toggle } = useOwnerLanguage();
  return <Button onClick={toggle} color="inherit" startIcon={<LanguageRoundedIcon />} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"} sx={{ color: "#d4c7b8", border: "1px solid rgba(235,220,198,.16)", borderRadius: 2, fontWeight: 800, whiteSpace: "nowrap", px: 1.5 }}>{language === "ar" ? "English" : "العربية"}</Button>;
}
