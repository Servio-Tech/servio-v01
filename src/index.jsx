import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { createAppTheme } from "./theme/Theme";
import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";

function DirectionalTheme({ children }) {
  const { language } = useLanguage();
  const direction = language === "ar" ? "rtl" : "ltr";

  return (
    <ThemeProvider theme={createAppTheme(direction)}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <DirectionalTheme>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </DirectionalTheme>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
