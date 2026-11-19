import { Box, Button, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

export const colors = { canvas: "#111111", panel: "#171c24", navy: "#14213d", border: "rgba(255,255,255,.08)", muted: "#9ba7ba", text: "#f5f6f8", orange: "#d9541e" };

export function Panel({ children, sx = {}, ...props }) {
  return <Box {...props} sx={{ minWidth: 0, borderRadius: 3, border: `1px solid ${colors.border}`, bgcolor: colors.panel, p: { xs: 2, sm: 2.5 }, ...sx }}>{children}</Box>;
}

export function ReportHeading({ eyebrow, title, subtitle, action }) {
  return <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, alignItems: { xs: "stretch", md: "flex-end" }, justifyContent: "space-between" }}>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ color: "#ff8a59", fontSize: ".69rem", fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", mb: .6 }}>{eyebrow}</Typography>
      <Typography component="h1" sx={{ color: colors.text, fontSize: { xs: "1.7rem", sm: "2.15rem" }, lineHeight: 1.2, fontWeight: 900, letterSpacing: "-.025em" }}>{title}</Typography>
      <Typography sx={{ color: colors.muted, fontSize: ".9rem", mt: .7 }}>{subtitle}</Typography>
    </Box>
    {action}
  </Stack>;
}

export function PeriodControl({ period, setPeriod, text, range, refresh, loading }) {
  return <Stack direction={{ xs: "column", lg: "row" }} sx={{ gap: 1.5, alignItems: { xs: "stretch", lg: "center" }, justifyContent: "space-between" }}>
    <ToggleButtonGroup exclusive size="small" value={period} onChange={(_, value) => value && setPeriod(value)} aria-label={text.period}
      sx={{ p: .5, bgcolor: "#191d24", border: `1px solid ${colors.border}`, borderRadius: 2.5, flexWrap: "wrap", alignSelf: { xs: "stretch", sm: "flex-start" }, "& .MuiToggleButtonGroup-grouped": { border: 0, borderRadius: "7px !important", m: 0 }, "& .MuiToggleButton-root": { color: colors.muted, px: 2, minHeight: 38, flex: { xs: 1, sm: "none" }, fontWeight: 800, fontSize: ".8rem", whiteSpace: "nowrap" }, "& .MuiToggleButton-root.Mui-selected": { bgcolor: "#354159", color: "#fff", "&:hover": { bgcolor: "#42516b" } } }}>
      <ToggleButton value="daily">{text.daily}</ToggleButton><ToggleButton value="weekly">{text.weekly}</ToggleButton><ToggleButton value="monthly">{text.monthly}</ToggleButton>
    </ToggleButtonGroup>
    <Stack direction="row" sx={{ gap: 1.5, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <Typography variant="body2" sx={{ color: colors.muted, fontWeight: 700 }}><span dir="ltr">{range.from}</span> &nbsp;–&nbsp; <span dir="ltr">{range.to}</span></Typography>
      <Button onClick={refresh} disabled={loading} startIcon={<RefreshRoundedIcon />} sx={{ color: "#e1e7ef", border: `1px solid ${colors.border}`, borderRadius: 2, fontWeight: 800, "&:disabled": { color: "#697282" } }}>{text.refresh}</Button>
    </Stack>
  </Stack>;
}

export function StateBox({ loading, error, text, refresh }) {
  if (loading) return <Panel role="status"><Stack direction="row" sx={{ gap: 1.5, alignItems: "center", justifyContent: "center", py: 4 }}><CircularProgress size={22} sx={{ color: colors.orange }} /><Typography sx={{ color: colors.muted }}>{text.loading}</Typography></Stack></Panel>;
  if (error) return <Panel role="alert" sx={{ borderColor: "rgba(255,128,102,.35)" }}><Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, gap: 1 }}><Typography sx={{ color: "#ffb2a2" }}>{error === "scope" ? text.scopeError : text.error}</Typography><Button onClick={refresh} sx={{ color: "#ff9b77" }}>{text.retry}</Button></Stack></Panel>;
  return null;
}

export function money(value, locale, currency) {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} ${currency}`;
}
