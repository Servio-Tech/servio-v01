import { useMemo } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import "./DashboardTheme.css";

// The provider is deliberately independent of the application's public theme.
// It adds no CssBaseline or document-level styles; direction may be supplied by
// whichever language context owns the page (including the owner console).
const createDashboardTheme = (direction) => createTheme({
  direction,
  palette: {
    mode: "dark",
    primary: { main: "#e99462", light: "#f5b184", dark: "#d77b49", contrastText: "#20130d" },
    secondary: { main: "#35302b", light: "#51483e", dark: "#201e1b", contrastText: "#f8f3e9" },
    background: { default: "#111110", paper: "#1b1a18" },
    text: { primary: "#f4f0e8", secondary: "#bfb7a9", disabled: "#777168" },
    divider: "rgba(233, 222, 207, 0.12)",
    success: { main: "#77c6a0" },
    warning: { main: "#eebc6e" },
    error: { main: "#ef8d84" },
    info: { main: "#91b6ce" },
    action: { hover: "rgba(246, 235, 218, 0.055)", selected: "rgba(233, 148, 98, 0.14)", disabled: "rgba(244, 240, 232, 0.38)", disabledBackground: "rgba(244, 240, 232, 0.08)" },
  },
  typography: {
    fontFamily: "'Tajawal', 'Inter', sans-serif",
    fontSize: 14,
    h1: { fontWeight: 800 }, h2: { fontWeight: 800 }, h3: { fontWeight: 800 },
    h4: { fontWeight: 800, letterSpacing: "-0.025em" },
    h5: { fontWeight: 800, letterSpacing: "-0.02em" },
    h6: { fontWeight: 750 },
    body1: { lineHeight: 1.65 }, body2: { lineHeight: 1.6 },
    button: { fontWeight: 750, textTransform: "none", letterSpacing: 0 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 40, borderRadius: 10, paddingInline: 16, gap: 5, lineHeight: 1.3 }, containedPrimary: { boxShadow: "none" } },
    },
    MuiIconButton: { styleOverrides: { root: { flexShrink: 0 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: { styleOverrides: { root: { border: "1px solid rgba(233, 222, 207, 0.12)", boxShadow: "none", backgroundImage: "none" } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10, backgroundColor: "rgba(0,0,0,0.14)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(233, 222, 207, 0.2)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(233, 222, 207, 0.42)" } } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: "rgba(233, 222, 207, 0.1)" }, head: { color: "#c9c0b4", fontWeight: 750 } } },
    MuiTableRow: { styleOverrides: { root: { "&.MuiTableRow-hover:hover": { backgroundColor: "rgba(246, 235, 218, 0.045)" } } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 48 }, indicator: { height: 3, borderRadius: 3 } } },
    MuiTab: { styleOverrides: { root: { minHeight: 48, textTransform: "none", color: "#bfb7a9", fontWeight: 700, "&.Mui-selected": { color: "#f2a675" } } } },
    MuiDialog: { defaultProps: { className: "dashboard-theme-portal", dir: direction }, styleOverrides: { paper: { border: "1px solid rgba(233, 222, 207, 0.14)", borderRadius: 16, backgroundImage: "none" } } },
    MuiDrawer: { defaultProps: { className: "dashboard-theme-portal" }, styleOverrides: { paper: { backgroundImage: "none" } } },
    MuiPopover: { defaultProps: { className: "dashboard-theme-portal" } },
    MuiMenu: { defaultProps: { className: "dashboard-theme-portal" } },
    MuiDialogActions: { styleOverrides: { root: { gap: 8, flexWrap: "wrap", padding: 16 } } },
    MuiCardActions: { styleOverrides: { root: { gap: 8, flexWrap: "wrap" } } },
    MuiAlert: { styleOverrides: { root: { alignItems: "flex-start" }, message: { minWidth: 0, overflowWrap: "anywhere" } } },
  },
});

export function DashboardThemeProvider({ children, direction = "rtl" }) {
  const resolvedDirection = direction === "ltr" ? "ltr" : "rtl";
  const theme = useMemo(() => createDashboardTheme(resolvedDirection), [resolvedDirection]);

  return (
    <ThemeProvider theme={theme}>
      <div className="dashboard-theme-scope" dir={resolvedDirection}>
        {children}
      </div>
    </ThemeProvider>
  );
}

export default DashboardThemeProvider;
