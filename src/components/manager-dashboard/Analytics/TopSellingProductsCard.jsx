import { Avatar, Box, Card, Typography } from "@mui/material";
import { useAnalytics } from "../../../context/AnalyticsContext";
import { useLanguage } from "../../../context/LanguageContext";
function TopSellingProductsCard() {
  const { topProducts } = useAnalytics();
  const { t, language } = useLanguage();
  return <Card elevation={0} sx={{ height: "100%", bgcolor: "#24211e", color: "#f7efe4", border: "1px solid #3d3731", borderRadius: "10px", p: 2.5 }}>
    <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", mb: .5 }}>{t("managerTopItems")}</Typography>
    <Typography sx={{ color: "#b4a99d", fontSize: ".8rem", mb: 1 }}>{language === "ar" ? "اليوم التشغيلي" : "Operational day"}</Typography>
    {!topProducts.length ? <Typography sx={{ color: "#b4a99d", py: 3 }}>{language === "ar" ? "لا توجد مبيعات أصناف خلال الفترة." : "No item sales in this period."}</Typography> : topProducts.map((product, index) => <Box key={`${product.name}-${index}`} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, py: 1.5, borderTop: "1px solid #3d3731" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}><Avatar sx={{ width: 34, height: 34, fontSize: ".8rem", bgcolor: "#3b2c22", color: "#ec9a65" }}>{index + 1}</Avatar><Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{product.name}</Typography><Typography sx={{ color: "#b4a99d", fontSize: ".78rem" }}>{product.quantity} {t("managerItemCount")}</Typography></Box></Box>
      <Typography sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{Number(product.totalRevenue).toFixed(2)} <Box component="span" sx={{ color: "#b4a99d", fontSize: ".75rem" }}>{t("currencySar")}</Box></Typography>
    </Box>)}
  </Card>;
}
export default TopSellingProductsCard;
