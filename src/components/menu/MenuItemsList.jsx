// COMPONENTS
import MenuItemCard from "./MenuItemCard";

// MUI COMPONENTS
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";

// DATA
import { useMenu } from "../../context/MenuContext";
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../context/LanguageContext";

function MenuItemsList() {
  const { customerMenu, menuLoading, menuError, refreshMenu, searchQuery, setSearchQuery } = useMenu();
  const { cartItems } = useCart();
  const { language } = useLanguage();
  const isEnglish = language === "en";

  if (menuLoading && (!customerMenu || customerMenu.length === 0)) {
    return (
      <Box role="status" aria-label={isEnglish ? "Loading menu items" : "جارٍ تحميل الأصناف"} sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: cartItems.length > 0 ? "90px" : 0 }}>
        {[0, 1, 2].map((placeholder) => (
          <Box key={placeholder} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) 100px", sm: "minmax(0, 1fr) 124px" }, alignItems: "center", gap: 1.5, p: { xs: 1.25, sm: 1.5 }, minHeight: 126, border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", boxShadow: "0 5px 18px rgba(23,26,47,.04)" }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton width="55%" height={28} />
              <Skeleton width="90%" />
              <Skeleton width="75%" />
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1 }}>
                <Skeleton width="28%" height={30} />
                <Skeleton width="42%" height={36} variant="rounded" />
              </Box>
            </Box>
            <Skeleton variant="rounded" width={{ xs: 100, sm: 124 }} height={{ xs: 100, sm: 124 }} sx={{ borderRadius: "8px" }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (menuError && (!customerMenu || customerMenu.length === 0)) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={refreshMenu}>
            {isEnglish ? "Retry" : "إعادة المحاولة"}
          </Button>
        }
      >
        {isEnglish
          ? "We couldn’t load the menu. Check your connection and try again."
          : "تعذّر تحميل المنيو. تحقق من اتصالك وحاول مرة أخرى."}
      </Alert>
    );
  }

  if (!customerMenu || customerMenu.length === 0) {
    return (
      <Box sx={{ py: 5, px: 2, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 3 }}>
        <Typography component="h3" fontWeight={850}>
          {isEnglish ? "No items found" : "لا توجد أصناف هنا"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
          {searchQuery
            ? (isEnglish ? "Try another search or clear the search field." : "جرّب البحث بكلمات أخرى أو امسح البحث.")
            : (isEnglish ? "Try another category or check back later." : "جرّب تصنيفًا آخر أو عُد لاحقًا.")}
        </Typography>
        {searchQuery && (
          <Button onClick={() => setSearchQuery("")} sx={{ mt: 1 }}>
            {isEnglish ? "Clear search" : "مسح البحث"}
          </Button>
        )}
      </Box>
    );
  }

  const ItemList = customerMenu.map((item, index) => (
    <MenuItemCard key={item.id} itemDetails={item} priority={index < 2} />
  ));

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        pb: cartItems.length > 0 ? "90px" : "0",
      }}
    >
      {ItemList}
    </Box>
  );
}

export default MenuItemsList;
