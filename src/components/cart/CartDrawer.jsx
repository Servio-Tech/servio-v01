import { FullscreenSwipeableDrawer as SwipeableDrawer } from "../common/FullscreenOverlays";
// COMPONENTS
import CartItemCard from "./CartItemCard";

// MUI COMPONENTS
import Alert from "@mui/material/Alert";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";

// ICONS
import CloseIcon from "@mui/icons-material/Close";

// HOOKS
import { useState } from "react";
import { useNavigate } from "react-router-dom";

// CONTEXTS
import { useCart } from "../../context/CartContext";
import { useOrders } from "../../context/OrdersContext";
import { useTenant } from "../../context/TenantContext";
import { useBranch } from "../../context/BranchContext";
import { useLanguage } from "../../context/LanguageContext";
import supabase from "../../supabase";
import { saveCustomerOrder } from "../../utils/customerTracking";
import { getCartLineKey } from "../../utils/cartItemUtils";
import { getUnavailableCartItemNames, isUnavailableMenuOrderError } from "../../utils/publicOrderErrors";

function CartDrawer({ open, close, cashierMode = false, currency = "SAR" }) {
  const { cartItems, tableNumber, clearCart } = useCart();
  const { addOrder } = useOrders();
  const { slug } = useTenant();
  const { branchSlug } = useBranch();
  const { language } = useLanguage();
  const isArabic = language !== "en";
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const totalPrice = cartItems.reduce(
    (acc, item) => acc + (Number(item.price) || 0) * Number(item.quantity || 0),
    0,
  );
  const itemCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const handleConfirmOrder = async () => {
    if (cartItems.length === 0 || sending) return;
    setSending(true);
    setSendError(null);

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
      close();
      // تمرير رقم الطاولة يتيح زر الرجوع إعادة فتح المنيو من نفس الطاولة فورًا.
      navigate(`/track/${encodeURIComponent(slug)}/${orderId}`, { state: { trackingToken, tableNumber: tableNumber || null } });
    } catch (error) {
      console.error("تعذر إرسال الطلب العام:", { code: error?.code, status: error?.status, message: error?.message });
      const errorMessage = String(error?.message || "");
      if (isUnavailableMenuOrderError(error)) {
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
        setSendError({
          type: "unavailable",
          names: unavailableNames.map((name) => ({
            ar: name,
            en: String(cartItems.find((item) => String(item?.name || "").trim() === name)?.name_en || name),
          })),
        });
      } else if (/ORDER_ITEM_PRICE_MISMATCH|ORDER_TOTAL_MISMATCH/.test(errorMessage)) {
        setSendError({ type: "price" });
      } else {
        setSendError({ type: "generic" });
      }
    } finally {
      setSending(false);
    }
  };

  let errorText = "";
  if (sendError?.type === "unavailable") {
    const names = sendError.names.slice(0, 3)
      .map((name) => isArabic ? `«${name.ar.slice(0, 80)}»` : `“${name.en.slice(0, 80)}”`)
      .join(isArabic ? "، " : ", ");
    const additional = sendError.names.length > 3 ? (isArabic ? "، وأصناف أخرى" : ", and other items") : "";
    errorText = names
      ? (isArabic
        ? `تعذر إرسال الطلب: ${names}${additional} غير متاح حاليًا؛ أوقفه المدير أو نفد أحد مكوناته. أزل الصنف من السلة ثم حاول مجددًا. ستبقى أصنافك في السلة.`
        : `Unable to send your order: ${names}${additional} ${sendError.names.length === 1 ? "is" : "are"} currently unavailable because the manager disabled ${sendError.names.length === 1 ? "it" : "them"} or an ingredient ran out. Remove the unavailable items from your cart and try again. Your items will remain in the cart.`)
      : (isArabic
        ? "تعذر إرسال الطلب لأن صنفًا أو أكثر لم يعد متاحًا (أوقفه المدير أو نفد أحد مكوناته). حدّث المنيو وأزل الصنف غير المتاح. ستبقى أصنافك في السلة."
        : "Unable to send your order because one or more items are no longer available (disabled by the manager or an ingredient ran out). Refresh the menu and remove the unavailable items. Your items will remain in the cart.");
  } else if (sendError?.type === "price") {
    errorText = isArabic
      ? "تغيّر سعر صنف أو إجمالي الطلب منذ فتح المنيو. حدّث الصفحة وراجع الأسعار ثم حاول مجددًا؛ ستبقى أصنافك في السلة."
      : "An item price or the order total has changed since you opened the menu. Refresh the page, review the prices, and try again. Your items will remain in the cart.";
  } else if (sendError?.type === "generic") {
    errorText = isArabic
      ? "تعذر إرسال الطلب الآن. تحقق من الاتصال ثم حاول مرة أخرى؛ ستبقى أصنافك في السلة."
      : "Unable to send your order right now. Check your connection and try again. Your items will remain in the cart.";
  }

  const bottomBarHeight = "220px";

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={close}
      onOpen={() => {}}
      disableSwipeToOpen={true}
      slotProps={{
        paper: {
          dir: isArabic ? "rtl" : "ltr",
          sx: {
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            maxHeight: "90dvh",
            backgroundColor: "background.paper",
            overflow: "hidden",
          },
        },
      }}
    >
      <Box
        sx={{
          maxHeight: `calc(90dvh - ${bottomBarHeight})`,
          overflowY: "auto",
          p: 2,
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
              width: "40px",
              height: "4px",
              backgroundColor: "grey.300",
              borderRadius: "2px",
              mx: "auto",
              mb: 1.5,
            }}
          />
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {isArabic ? "ملخص الطلب" : "Order summary"} ({itemCount})
            </Typography>
            <IconButton size="small" onClick={close} aria-label={isArabic ? "إغلاق السلة" : "Close cart"}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {cartItems.map((item) => (
          <CartItemCard key={getCartLineKey(item)} cartItemDetails={item} currency={currency} />
        ))}

        <TextField
          fullWidth
          multiline
          rows={2}
          placeholder={isArabic ? "ملاحظات على الطلب (مثل: دون سكر، ثلج إضافي...)" : "Order notes (e.g. no sugar, extra ice...)"}
          slotProps={{ htmlInput: { "aria-label": isArabic ? "ملاحظات على الطلب" : "Order notes" } }}
          variant="outlined"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          sx={{
            mt: 2,
            "& .MuiOutlinedInput-root": {
              borderRadius: "12px",
              fontSize: "0.9rem",
            },
          }}
        />
      </Box>

      <Box
        sx={{
          minHeight: bottomBarHeight,
          height: "auto",
          p: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
          boxShadow: "0px -4px 12px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "start",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
          <Typography
            variant="body1"
            sx={{ color: "text.secondary", fontWeight: 600 }}
          >
            {isArabic ? "الإجمالي:" : "Total:"}
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, color: "primary.main" }}
          >
            {String(totalPrice)} {isArabic && currency === "SAR" ? "ر.س" : currency}
          </Typography>
        </Box>

        {errorText && <Alert severity="error" sx={{ mb: 1 }}>{errorText}</Alert>}

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={cartItems.length === 0 || sending}
          onClick={handleConfirmOrder}
          sx={{
            py: 1.4,
            borderRadius: "12px",
            fontWeight: 800,
            fontSize: "1rem",
          }}
        >
          {sending ? (isArabic ? "جارٍ الإرسال..." : "Sending...") : (isArabic ? "تأكيد وإرسال الطلب" : "Confirm and send order")}
        </Button>
      </Box>
    </SwipeableDrawer>
  );
}

export default CartDrawer;
