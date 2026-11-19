// مكوّن واجهة `ErrorBoundary` ضمن مجموعة `components`.
import { Component } from "react";
import { Box, Button, Typography } from "@mui/material";

function ErrorBoundaryView({ error }) {
  const language = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar";
  const title = language === "en" ? "Unexpected error" : "حدث خطأ غير متوقع";
  const reload = language === "en" ? "Reload page" : "إعادة تحميل الصفحة";
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", p: 3 }} dir={language === "ar" ? "rtl" : "ltr"}>
      <Box>
        <Typography variant="h5" fontWeight={800} mb={1}>{title}</Typography>
        <Typography color="text.secondary" mb={2}>{String(error?.message || "")}</Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>{reload}</Button>
      </Box>
    </Box>
  );
}

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("SERVIO UI error:", error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorBoundaryView error={this.state.error} />;
  }
}
