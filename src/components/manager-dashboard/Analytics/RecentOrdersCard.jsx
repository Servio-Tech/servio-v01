import { Avatar, Box, Card, Chip, Typography } from "@mui/material";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import { useAnalytics } from "../../../context/AnalyticsContext";
import { useLanguage } from "../../../context/LanguageContext";
function RecentOrdersCard() {
  const { recentOrders } = useAnalytics();
  const { t, language } = useLanguage();
  const status = (value) => ["completed", "served", "unclaimed"].includes(value) ? t("managerComplete") : value === "pending" ? t("managerPending") : t("managerNew");
  return <Card elevation={0} sx={{ height: "100%", bgcolor: "#24211e", color: "#f7efe4", border: "1px solid #3d3731", borderRadius: "14px", p: 2.5 }}>
    <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", mb: .5 }}>{t("managerRecent")}</Typography>
    <Typography sx={{ color: "#b4a99d", fontSize: ".8rem", mb: 1 }}>{language === "ar" ? "اليوم التشغيلي" : "Operational day"}</Typography>
    {!recentOrders?.length ? <Typography sx={{ color: "#b4a99d", py: 3 }}>{t("managerNoRecent")}</Typography> : recentOrders.map((order, index) => <Box key={order.id || index} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, py: 1.5, borderTop: "1px solid #3d3731", flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><Avatar sx={{ width: 34, height: 34, bgcolor: "#3b2c22", color: "#ec9a65" }}><ReceiptLongRoundedIcon fontSize="small" /></Avatar><Box><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Typography sx={{ fontWeight: 700 }}>{t("table")} {order.table_number || order.table || "—"}</Typography><Chip size="small" label={status(order.status)} sx={{ bgcolor: "#35352d", color: "#c6c8a6", height: 22 }} /></Box><Typography sx={{ color: "#b4a99d", fontSize: ".78rem" }}>{order.items?.length || 0} {t("managerItemCount")} · {order.created_at ? new Date(order.created_at).toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : t("managerNow")}</Typography></Box></Box>
      <Typography sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{Number(order.total_price || 0).toFixed(2)} <Box component="span" sx={{ color: "#b4a99d", fontSize: ".75rem" }}>{t("currencySar")}</Box></Typography>
    </Box>)}
  </Card>;
}
export default RecentOrdersCard;
