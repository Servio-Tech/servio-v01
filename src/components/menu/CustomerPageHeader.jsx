import { Box, Chip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { useLanguage } from "../../context/LanguageContext";
import { useTenant } from "../../context/TenantContext";
import LanguageToggle from "../LanguageToggle";

export default function CustomerPageHeader({ tableNumber = "" }) {
  const { language } = useLanguage();
  const { tenant, storeInfo } = useTenant();
  const theme = useTheme();
  const isArabic = language === "ar";
  const isEnglish = language !== "ar";
  const storeName = storeInfo?.store_name || storeInfo?.name || tenant?.name
    || (isEnglish ? "Your restaurant" : "مطعمك");
  const isCashier = /^(cashier|كاشير)$/i.test(String(tableNumber || "").trim());

  return (
    <Box className="customer-page-header">
      <Box className="customer-page-header-brand">
        <Box component="img" className="customer-page-header-logo" src="/logo-icon.webp" alt="" />
        <Box sx={{ minWidth: 0 }}>
          <Typography className="customer-page-header-store" component="p" noWrap>
            {storeName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isEnglish ? "Powered by SERVIO" : "بدعم من SERVIO"}
          </Typography>
        </Box>
      </Box>
      <Box className="customer-page-header-actions">
        {tableNumber && (
          <Chip
            className="customer-page-table-chip"
            size="small"
            icon={<PlaceOutlinedIcon />}
            label={isCashier
              ? (isArabic ? "طلب الكاشير" : "Cashier order")
              : (isArabic ? `طاولة ${tableNumber}` : `Table ${tableNumber}`)}
          />
        )}
        <LanguageToggle compact dark={theme.palette.mode === "dark"} />
      </Box>
    </Box>
  );
}
