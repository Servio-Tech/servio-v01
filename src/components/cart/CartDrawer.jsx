// COMPONENTS
import CartItemCard from "./CartItemCard";

// MUI COMPONENTS
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";

// HOOKS
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// CONTEXTS
import { useCart } from "../../context/CartContext";
import { useOrders } from "../../context/OrdersContext";
import { useTenant } from "../../context/TenantContext";
import { useBranch } from "../../context/BranchContext";
import { useLanguage } from "../../context/LanguageContext";
import { useMenu } from "../../context/MenuContext";
import supabase from "../../supabase";
import { saveCustomerOrder } from "../../utils/customerTracking";
import { getCartLineKey } from "../../utils/cartItemUtils";
import { getUnavailableCartItemNames, isUnavailableMenuOrderError } from "../../utils/publicOrderErrors";
import { preserveCustomerContext } from "../../utils/customerMenuNavigation";

function CartDrawer({ close, cashierMode = false }) {
  const { cartItems, tableNumber, clearCart } = useCart();
  const { addOrder } = useOrders();
  const { slug, storeInfo } = useTenant();
  const { branchSlug } = useBranch();
  const { refreshMenu } = useMenu();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [menuNeedsRefresh, setMenuNeedsRefresh] = useState(false);

  const totalPrice = cartItems.reduce(
    (acc, item) => acc + (Number(item.price) || 0) * Number(item.quantity || 0),
    0,
  );
  const itemCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const currency = storeInfo?.currency || (isEnglish ? "SAR" : "ر.س");
  const formatPrice = (value) => Number(value || 0).toLocaleString(
    isEnglish ? "en-SA" : "ar-SA",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
  const handleConfirmOrder = async () => {
    if (cartItems.length === 0 || sending) return;
    setSending(true);
    setSendError("");
    setMenuNeedsRefresh(false);

    const newOrder = {
      items: cartItems,
      total_price: totalPrice,
      table_number: cashierMode ? "كاشير" : (tableNumber || "غير محدد"),
      notes: notes,
    };

    try {
      const result = await addOrder(newOrder);
      if (result?.error || !result?.data) throw result?.error || new Error("لم يصل تأكيد حفظ الطلب");
      const { order_id: orderId, tracking_token: trackingToken } = result.data;
      if (!orderId || !trackingToken) throw new Error("لم يصل رمز تتبع الطلب");
      try {
        window.sessionStorage.setItem(`servio.orderTracking.${slug}.${orderId}`, trackingToken);
      } catch {
        // تمرير الرمز داخل حالة التنقل يبقي الصفحة الحالية قابلة للفتح إذا منع المتصفح التخزين.
      }
      saveCustomerOrder({ slug, branchSlug, orderId, trackingToken, tableNumber: tableNumber || null, createdAt: result.data.created_at });
      clearCart();
      setNotes("");
      // تمرير رقم الطاولة يتيح زر الرجوع إعادة فتح المنيو من نفس الطاولة فورًا.
      navigate(preserveCustomerContext(`/track/${encodeURIComponent(slug)}/${orderId}`, location.search), { state: { trackingToken, tableNumber: tableNumber || null } });
    } catch (error) {
      console.error("تعذر إرسال الطلب العام:", { code: error?.code, status: error?.status, message: error?.message });
      const errorMessage = String(error?.message || "");
      if (isUnavailableMenuOrderError(error)) {
        setMenuNeedsRefresh(true);
        let unavailableNames = [];
        try {
          if (slug && branchSlug) {
            const { data, error: menuError } = await supabase.rpc("get_public_menu_item_details", {
              p_slug: slug,
              p_branch_slug: branchSlug,
            });
            if (!menuError) unavailableNames = getUnavailableCartItemNames(cartItems, data || []);
          }
        } catch {
          // رسالة السبب تبقى مفهومة حتى عند تعذر تحديث المنيو وقت الخطأ.
        }
        const names = unavailableNames.slice(0, 3).map((name) => `“${name.slice(0, 80)}”`).join(isEnglish ? ", " : "، ");
        const additional = unavailableNames.length > 3 ? (isEnglish ? ", and other items" : "، وأصناف أخرى") : "";
        setSendError(names
          ? (isEnglish
            ? `Couldn’t place the order: ${names}${additional} ${unavailableNames.length > 1 ? "are" : "is"} no longer available. Remove them and try again. Your cart is saved.`
            : `تعذر إرسال الطلب: ${names}${additional} غير متاح حاليًا. أزل الصنف من السلة ثم حاول مجددًا؛ ستبقى بقية الأصناف محفوظة.`)
          : (isEnglish
            ? "One or more items are no longer available. Refresh the menu, remove unavailable items, and try again. Your cart is saved."
            : "تعذر إرسال الطلب لأن صنفًا أو أكثر لم يعد متاحًا. حدّث المنيو وأزل الصنف غير المتاح؛ ستبقى بقية الأصناف محفوظة."));
      } else if (/ORDER_ITEM_PRICE_MISMATCH|ORDER_TOTAL_MISMATCH/.test(errorMessage)) {
        setMenuNeedsRefresh(true);
        setSendError(isEnglish
          ? "An item price changed since you opened the menu. Refresh the menu and review your cart before trying again."
          : "تغيّر سعر صنف منذ فتح المنيو. حدّث المنيو وراجع السلة قبل المحاولة مجددًا.");
      } else {
        setSendError(isEnglish
          ? "Your order couldn’t be sent. Check your connection and try again; your cart is saved."
          : "تعذر إرسال الطلب الآن. تحقق من الاتصال وحاول مرة أخرى؛ سلتك محفوظة.");
      }
    } finally {
      setSending(false);
    }
  };

  const content = (
    <>
      <Box
        sx={{
          p: { xs: 1.8, sm: 2.5 },
          pb: 1.5,
        }}
      >
        <Box
          sx={{
            pb: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            mb: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6" component="h2" sx={{ fontWeight: 900 }}>
              {isEnglish ? `Items in your cart (${itemCount})` : `الأصناف في السلة (${itemCount})`}
            </Typography>
          </Box>
        </Box>

        {cartItems.length > 0 ? (
          <>
            <Stack spacing={1.2}>
            {cartItems.map((item) => (
              <CartItemCard key={getCartLineKey(item)} cartItemDetails={item} disabled={sending} />
            ))}
            </Stack>

            <TextField
              fullWidth
              multiline
              rows={2}
              label={isEnglish ? "Order notes (optional)" : "ملاحظات الطلب (اختيارية)"}
              placeholder={isEnglish ? "For example: no sugar, extra ice…" : "مثال: دون سكر، ثلج إضافي…"}
              variant="outlined"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              disabled={sending}
              helperText={`${notes.length}/500`}
              slotProps={{ htmlInput: { "aria-label": isEnglish ? "Optional order notes" : "ملاحظات الطلب الاختيارية", maxLength: 500 } }}
              sx={{ mt: 2, "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: ".9rem" }, "& .MuiFormHelperText-root": { textAlign: "end", mx: .5 } }}
            />
          </>
        ) : (
          <Stack sx={{ flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center", px: 2, py: 4 }} spacing={1.2}>
            <Box sx={{ width: 64, height: 64, display: "grid", placeItems: "center", mb: .5, borderRadius: "8px", bgcolor: "rgba(244,121,32,.1)", color: "primary.main" }}>
              <ShoppingBagOutlinedIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h6" component="h3" fontWeight={900}>
              {isEnglish ? "Your cart is empty" : "سلتك فارغة"}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 280, lineHeight: 1.65 }}>
              {isEnglish ? "Add something tasty from the menu to get started." : "أضف ما تشتهيه من المنيو للبدء."}
            </Typography>
          </Stack>
        )}
      </Box>

      {cartItems.length > 0 ? <Box
        sx={{
          flexShrink: 0,
          px: { xs: 2, sm: 2.5 },
          pt: 1.5,
          pb: "calc(16px + env(safe-area-inset-bottom, 0px))",
          borderTop: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontWeight: 800 }}
          >
            {isEnglish ? `Total · ${itemCount} items` : `الإجمالي · ${itemCount} صنف`}
          </Typography>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, color: "primary.main" }}
          >
            {formatPrice(totalPrice)} {currency}
          </Typography>
        </Box>

        {sendError && (
          <Alert
            severity="error"
            action={menuNeedsRefresh ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => { void refreshMenu(); }}
              >
                {isEnglish ? "Refresh menu" : "تحديث المنيو"}
              </Button>
            ) : undefined}
            sx={{ borderRadius: 2 }}
          >
            {sendError}
          </Alert>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={sending}
          onClick={handleConfirmOrder}
          sx={{ minHeight: 50, borderRadius: "8px", fontWeight: 850, fontSize: "1rem" }}
        >
          {sending
            ? (isEnglish ? "Sending order…" : "جارٍ إرسال الطلب…")
            : (isEnglish ? "Place order" : "تأكيد وإرسال الطلب")}
        </Button>
      </Box> : (
        <Box sx={{ px: 2, pb: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          <Divider sx={{ mb: 1.5 }} />
          <Button fullWidth variant="contained" onClick={close} sx={{ minHeight: 48, borderRadius: 2, fontWeight: 800 }}>
            {isEnglish ? "Continue browsing" : "متابعة التصفح"}
          </Button>
        </Box>
      )}
    </>
  );

  return (
    <Box
      component="section"
      className="customer-cart-page-content"
      sx={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        backgroundColor: "background.paper",
      }}
    >
      {content}
    </Box>
  );
}

export default CartDrawer;
