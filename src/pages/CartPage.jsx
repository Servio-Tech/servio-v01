import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import CartDrawer from "../components/cart/CartDrawer";
import CustomerMenuBottomNav from "../components/menu/CustomerMenuBottomNav";
import CustomerPageHeader from "../components/menu/CustomerPageHeader";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../context/LanguageContext";
import { useTenant } from "../context/TenantContext";
import { buildCustomerMenuPath } from "../utils/customerMenuNavigation";

export default function CartPage() {
  const { language } = useLanguage();
  const { slug, tableNumber } = useTenant();
  const { setTable } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const isEnglish = language !== "ar";
  const cashierMode = new URLSearchParams(location.search).get("cashier") === "1";
  const displayTable = cashierMode ? (isEnglish ? "Cashier" : "كاشير") : tableNumber;

  useEffect(() => {
    setTable(tableNumber || null);
  }, [setTable, tableNumber]);

  const returnToMenu = () => navigate(buildCustomerMenuPath(slug, displayTable, location.search));

  return (
    <Box className="customer-experience-page customer-cart-page">
      <Box className="customer-page-shell customer-cart-page-shell">
        <CustomerPageHeader tableNumber={displayTable} />
        <Typography variant="h5" component="h1" sx={{ mb: 1.5, fontWeight: 950 }}>
          {isEnglish ? "Your cart" : "سلتك"}
        </Typography>
        <CartDrawer
          close={returnToMenu}
          cashierMode={cashierMode}
        />
      </Box>
      <CustomerMenuBottomNav
        activePage="cart"
        canCallWaiter={!cashierMode && Boolean(tableNumber)}
        tableNumber={displayTable}
      />
    </Box>
  );
}
