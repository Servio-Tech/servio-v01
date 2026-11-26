import { useEffect, useMemo, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useLanguage } from "../context/LanguageContext";
import "./CustomerExperience.css";
import "../pages/CustomerMenu.css";

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function getDeviceColorScheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.(COLOR_SCHEME_QUERY)?.matches ? "dark" : "light";
}

export default function CustomerExperienceTheme({ children }) {
  const { language } = useLanguage();
  const [mode, setMode] = useState(getDeviceColorScheme);
  const direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);
    const updateMode = (event) => setMode(event.matches ? "dark" : "light");
    if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", updateMode);
    else mediaQuery.addListener(updateMode);
    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener("change", updateMode);
      else mediaQuery.removeListener(updateMode);
    };
  }, []);

  const theme = useMemo(() => createTheme({
    direction,
    palette: {
      mode,
      primary: { main: "#f47920", light: "#ffad68", dark: "#d96816", contrastText: "#171a2f" },
      secondary: { main: "#171a2f", light: "#343955", dark: "#0b0d1a", contrastText: "#fffaf1" },
      background: mode === "dark"
        ? { default: "#111214", paper: "#1d1f24" }
        : { default: "#f6f5f1", paper: "#ffffff" },
      text: mode === "dark"
        ? { primary: "#f4f0e8", secondary: "#b8b5ad", disabled: "#77746f" }
        : { primary: "#171a2f", secondary: "#626a7a", disabled: "#8a8e98" },
      divider: mode === "dark" ? "rgba(255,255,255,.11)" : "rgba(23,26,47,.1)",
      action: {
        selected: mode === "dark" ? "rgba(244,121,32,.18)" : "rgba(244,121,32,.12)",
      },
      info: mode === "dark"
        ? { main: "#70b5d5", light: "#b4e2f2", dark: "#4188a6" }
        : { main: "#2f7894", light: "#66a0b6", dark: "#20566e" },
      success: { main: "#25845d" },
      warning: { main: "#a65a10" },
      error: { main: "#c33e37" },
    },
    typography: {
      fontFamily: "'Tajawal', 'Inter', system-ui, 'Segoe UI', sans-serif",
      button: { fontWeight: 800, textTransform: "none" },
      h1: { fontWeight: 900 },
      h2: { fontWeight: 900 },
      h3: { fontWeight: 900 },
      h4: { fontWeight: 900 },
      h5: { fontWeight: 850 },
      h6: { fontWeight: 850 },
    },
    shape: { borderRadius: 4 },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiCard: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiButton: { styleOverrides: { root: { minHeight: 42, borderRadius: 8, textTransform: "none" } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: mode === "dark" ? "#292b31" : "#ffffff",
            borderRadius: 8,
          },
        },
      },
    },
  }), [direction, mode]);

  return (
    <ThemeProvider theme={theme}>
      <div className="customer-experience-theme" data-color-scheme={mode} dir={direction}>
        {children}
      </div>
    </ThemeProvider>
  );
}
