import { FullscreenDialog as Dialog } from "../../common/FullscreenOverlays";
import { useEffect, useId, useState } from "react";

// MUI COMPONENTS
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

// ANIMATION
import { motion } from "framer-motion";

// ICONS
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";

// HELPERS
import { formatTimeAgo } from "../../../utils/helpers";

// CONTEXTS
import { useOrders } from "../../../context/OrdersContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useStore } from "../../../context/StoreInfoContext";
import InvoiceModal from "../../manager-dashboard/orders/OrderPill";
import PaymentStatusControl from "./PaymentStatusControl";
import { getOrderType } from "./orderBellLogic.js";

function OrderItemCard({ order }) {
  const { updateOrderStatus, updateOrderPaymentStatus } = useOrders();
  const { t, language } = useLanguage();
  const { storeInfo = {} } = useStore();
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDialogMethod, setPaymentDialogMethod] = useState("");
  const [confirmingStatus, setConfirmingStatus] = useState(null);
  const paymentMethodFieldId = useId();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(order.payment_method || null);
  const [, setTimeTick] = useState(0);
  const isPaid = order.payment_status === "paid";
  const isAwaitingPayment = order.status === "awaiting_payment" || (order.status === "ready" && !isPaid);
  const isReady = order.status === "ready";
  const currency = storeInfo.currency || (language === "ar" ? "ر.س" : "SAR");
  const formatMoney = (value) => `${new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} ${currency}`;
  const orderType = getOrderType(order);
  const tableNumber = String(order.table_number || "").replace(/^(?:table|طاولة)\s*/i, "");
  const orderTypeLabel = orderType === "table"
    ? `${language === "ar" ? "طاولة" : "Table"} ${tableNumber || "—"}`
    : orderType === "takeaway"
      ? (language === "ar" ? "سفري" : "Takeaway")
      : (language === "ar" ? "طلب كاشير" : "Cashier sale");
  const statusVisual = order.status === "pending"
    ? { accent: "#e99462", soft: "rgba(233,148,98,.10)", label: language === "ar" ? "جديد" : "New" }
    : order.status === "preparing"
      ? { accent: "#91b6ce", soft: "rgba(145,182,206,.10)", label: language === "ar" ? "قيد التحضير" : "Preparing" }
      : isAwaitingPayment
      ? { accent: "#eebc6e", soft: "rgba(238,188,110,.10)", label: language === "ar" ? "ينتظر السداد" : "Awaiting payment" }
      : { accent: "#77c6a0", soft: "rgba(119,198,160,.10)", label: language === "ar" ? "جاهز" : "Ready" };
  useEffect(() => {
    setSelectedPaymentMethod(order.payment_method || null);
  }, [order.id, order.payment_method]);
  useEffect(() => {
    const timer = window.setInterval(() => setTimeTick((tick) => tick + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const performStatusChange = async (status) => {
    if (sending) return;
    setSending(true);
    setPaymentError("");
    // لا نغيّر الصف لمجرد تعديل حالة الدفع؛ الانتقال يتم فقط عند ضغط جاهز للتسليم.
    const nextStatus = !isPaid && status === "ready" ? "awaiting_payment" : status;
    try {
      const result = await updateOrderStatus(order.id, nextStatus);
      if (result?.error) setPaymentError(language === "ar" ? "تعذر تحديث حالة الطلب. أعد المحاولة." : "Could not update the order status. Retry.");
    } catch {
      setPaymentError(language === "ar" ? "تعذر تحديث حالة الطلب. تحقق من الاتصال ثم أعد المحاولة." : "Could not update the order status. Check the connection and retry.");
    } finally {
      setSending(false);
    }
  };
  const changeStatus = (status) => {
    if (status === "served") {
      setConfirmingStatus(status);
      return;
    }
    void performStatusChange(status);
  };
  const openPaymentDialog = () => {
    if (sending || paymentSaving) return;
    setPaymentError("");
    setPaymentDialogMethod("");
    setPaymentDialogOpen(true);
  };
  const recordSelectedPayment = async () => {
    if (sending || paymentSaving) return;
    const method = paymentDialogMethod;
    if (!method) {
      setPaymentError(language === "ar" ? "اختر طريقة الدفع لتسجيل السداد." : "Choose a payment method to record payment.");
      return;
    }
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const paymentResult = await updateOrderPaymentStatus(order.id, "paid", { method });
      if (paymentResult?.error) {
        setPaymentError(language === "ar" ? "تعذر تسجيل السداد. تحقق من طريقة الدفع ثم أعد المحاولة." : "Could not record payment. Check the payment method and retry.");
      } else {
        setSelectedPaymentMethod(method);
        setPaymentDialogOpen(false);
      }
    } catch {
      setPaymentError(language === "ar" ? "تعذر تسجيل السداد. تحقق من الاتصال ثم أعد المحاولة." : "Could not record payment. Check the connection and retry.");
    } finally {
      setPaymentSaving(false);
    }
  };
  const confirmReceiptAction = async () => {
    const action = confirmingStatus;
    setConfirmingStatus(null);
    await performStatusChange(action);
  };
  const changePaymentStatus = async (status) => {
    if (paymentSaving) return;
    if (status === "paid") {
      openPaymentDialog();
      return;
    }
    if (isReady && status !== "paid") {
      setPaymentError(language === "ar"
        ? "لا يمكن تحويل طلب جاهز للاستلام إلى غير مدفوع. أعده إلى انتظار السداد قبل تعديل الدفع."
        : "A ready-for-pickup order cannot be changed to unpaid. Move it to the payment queue first.");
      return;
    }
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const result = await updateOrderPaymentStatus(order.id, status);
      if (result?.error) setPaymentError(language === "ar" ? "تعذر حفظ حالة الدفع. أعد المحاولة." : "Could not save payment status. Retry.");
    } catch {
      setPaymentError(language === "ar" ? "تعذر حفظ حالة الدفع. تحقق من الاتصال ثم أعد المحاولة." : "Could not save payment status. Check the connection and retry.");
    } finally {
      setPaymentSaving(false);
    }
  };
  const changePaymentMethod = async (method) => {
    if (paymentSaving) return;
    setPaymentError("");
    setSelectedPaymentMethod(method);
    if (!isPaid) return;
    setPaymentSaving(true);
    try {
      const result = await updateOrderPaymentStatus(order.id, "paid", { method });
      if (result?.error) {
        setPaymentError(language === "ar" ? "تعذر حفظ طريقة الدفع. أعد المحاولة." : "Could not save payment method. Retry.");
        setSelectedPaymentMethod(order.payment_method || null);
      }
    } catch {
      setPaymentError(language === "ar" ? "تعذر حفظ طريقة الدفع. تحقق من الاتصال ثم أعد المحاولة." : "Could not save payment method. Check the connection and retry.");
      setSelectedPaymentMethod(order.payment_method || null);
    } finally {
      setPaymentSaving(false);
    }
  };
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const paymentMethodOptions = language === "ar"
    ? [["cash", "نقد"], ["card", "شبكة/بطاقة"], ["wallet", "محفظة رقمية"], ["transfer", "تحويل بنكي"], ["other", "أخرى"]]
    : [["cash", "Cash"], ["card", "Card / network"], ["wallet", "Digital wallet"], ["transfer", "Bank transfer"], ["other", "Other"]];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      style={{ height: "100%" }}
    >
      <Card
        component="article"
        aria-labelledby={`cashier-order-${order.id}`}
        elevation={0}
        sx={{
          width: "100%",
          height: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          border: "1px solid",
          borderColor: statusVisual.accent,
          borderTopWidth: 3,
          borderRadius: "10px",
          background: "#211f1c",
          boxShadow: "none",
          transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
          overflow: "hidden",
          "&:hover": {
            boxShadow: "0 10px 26px rgba(0,0,0,.16)",
            borderColor: "primary.light",
          },
        }}
      >
        {/* هيدر الكارت */}
        <Box
          sx={{
            p: { xs: 1.4, sm: 1.65 },
            pb: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            minWidth: 0,
            gap: 0.8,
          }}
        >
          <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: .75, flexWrap: "wrap" }}>
            <Typography id={`cashier-order-${order.id}`} component="h3" variant="subtitle1" sx={{ fontWeight: 950, color: "text.primary", fontSize: { xs: "1.08rem", sm: "1.15rem" }, minWidth: 0, overflowWrap: "anywhere" }}>
              #{order.displayOrderNumber || order.order_number || "—"} · {orderTypeLabel}
            </Typography>
            <Chip label={statusVisual.label} size="small" sx={{ height: 28, bgcolor: statusVisual.soft, color: statusVisual.accent, border: `1px solid ${statusVisual.accent}55`, fontWeight: 950, fontSize: ".78rem" }} />
          </Box>

          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontSize: "0.8rem",
              bgcolor: "rgba(244,121,32,.09)",
              color: "warning.main",
              border: "1px solid",
              borderColor: "warning.100",
              px: 1,
              py: 0.45,
              borderRadius: "999px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {formatTimeAgo(order.created_at, language, t)}
          </Typography>
        </Box>

        <Box sx={{ mx: { xs: 1.4, sm: 1.65 }, mb: 1.2, p: 1.25, borderRadius: "12px", border: `1px solid ${statusVisual.accent}30`, bgcolor: statusVisual.soft, display: "flex", flexDirection: "column", gap: 0.7, minWidth: 0, "& .MuiToggleButton-root": { minHeight: 40, px: 1.25, fontSize: ".85rem" }, "& .MuiInputBase-root": { minHeight: 44 }, "& .MuiInputLabel-root, & .MuiTypography-caption": { fontSize: ".82rem" } }}>
          {!isAwaitingPayment && <PaymentStatusControl value={order.payment_status} method={selectedPaymentMethod} onChange={changePaymentStatus} onMethodChange={changePaymentMethod} disabled={sending || paymentSaving || (isReady && isPaid)} language={language} />}
          {isAwaitingPayment && <Typography variant="caption" color="warning.main" sx={{ fontWeight: 800 }}>{t("paymentRequired")}</Typography>}
          {isReady && isPaid && <Typography variant="caption" color="success.main" sx={{ fontWeight: 800 }}>
            {language === "ar" ? "جاهز للاستلام — حالة الدفع مثبتة حتى يتم التسليم." : "Ready for pickup — payment status is locked until delivery."}
          </Typography>}
          {paymentError && <Typography role="alert" variant="caption" color="error" sx={{ px: 0.25, overflowWrap: "anywhere" }}>{paymentError}</Typography>}
        </Box>

        <Divider sx={{ borderStyle: "dashed" }} />

        {/* عناصر الطلب */}
        <CardContent sx={{ flexGrow: 1, p: { xs: 1.4, sm: 1.65 }, pt: 1.25, pb: 1.4, "&:last-child": { pb: 1.4 } }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
            {orderItems.map((item) => (
              <Box
                key={item.cartItemId || item.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 0.85,
                  alignItems: "start",
                  minWidth: 0,
                  py: 0.3,
                }}
              >
                <Typography
                  variant="body2"
                    sx={{ fontWeight: 700, color: "text.primary", fontSize: ".92rem", minWidth: 0, lineHeight: 1.5, overflowWrap: "anywhere" }}
                >
                  <Box
                    component="span"
                    sx={{ color: "primary.main", fontWeight: 900, mr: 0.5, whiteSpace: "nowrap" }}
                  >
                    {item.quantity}x
                  </Box>{" "}
                  {item.name}
                  {Array.isArray(item.selected_addons) && item.selected_addons.length > 0 && (
                    <Box component="span"                     sx={{ display: "block", color: "text.secondary", fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.5, mt: 0.3, overflowWrap: "anywhere" }}>
                      {language === "ar" ? "إضافات: " : "Add-ons: "}
                      {item.selected_addons.map((addon) => typeof addon === "string" ? addon : addon?.name).filter(Boolean).join(language === "ar" ? "، " : ", ")}
                    </Box>
                  )}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", fontWeight: 800, fontSize: "0.86rem", whiteSpace: "nowrap", pt: 0.15 }}
                >
                  {formatMoney(Number(item.price || 0) * Number(item.quantity || 0))}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 1.25, pt: 1.2, borderTop: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={800} sx={{ fontSize: ".9rem" }}>
              {language === "ar" ? "إجمالي الطلب" : "Order total"}
            </Typography>
            <Typography variant="subtitle1" fontWeight={950} color="primary.light" dir="ltr">
              {formatMoney(order.total_price)}
            </Typography>
          </Box>

          {/* الملاحظات */}
          {order.notes && (
            <Box
              sx={{
                mt: 1.1,
                p: 1,
                borderRadius: "10px",
                bgcolor: "rgba(238,188,110,.10)",
                border: "1px solid",
                borderColor: "warning.100",
                display: "flex",
                alignItems: "flex-start",
                gap: 0.8,
                minWidth: 0,
              }}
            >
              <FiberManualRecordIcon
                sx={{ fontSize: 8, color: "warning.main" }}
              />
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: "warning.main", fontSize: ".82rem", lineHeight: 1.5, minWidth: 0, overflowWrap: "anywhere" }}
              >
                {t("note")}: {order.notes}
              </Typography>
            </Box>
          )}
        </CardContent>

        {/* أزرار الإجراءات */}
        <CardActions sx={{ mt: "auto", p: { xs: 1.4, sm: 1.65 }, pt: 0.3, minWidth: 0, "& .MuiButton-root": { minHeight: 50, borderRadius: "11px", fontWeight: 800, fontSize: ".88rem", lineHeight: 1.25, px: 1.1 } }}>
          {order.status === "pending" && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "minmax(0,1fr) auto auto" }, gap: 0.8, width: "100%", minWidth: 0, "& .MuiButton-root": { minWidth: 0, whiteSpace: "normal" } }}>
              <Button
                color="primary"
                fullWidth
                size="medium"
                variant="contained"
                disableElevation
                onClick={() => changeStatus("preparing")} disabled={sending}
                sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, minWidth: 0, minHeight: 48, py: 0.9 }}
              >
                {sending ? (language === "ar" ? "جارٍ التحديث…" : "Updating…") : (language === "ar" ? "بدء التحضير" : "Start preparing")}
              </Button>
              <Button
                size="medium"
                variant="outlined"
                startIcon={<PrintRoundedIcon />}
                onClick={() => setIsInvoiceOpen(true)}
                sx={{ minWidth: 0, whiteSpace: "normal" }}
              >
                {language === "ar" ? "طباعة تذكرة المطبخ" : "Print kitchen ticket"}
              </Button>
              <Button
                color="error"
                size="medium"
                variant="outlined"
                onClick={() => changeStatus("cancelled")} disabled={sending}
                sx={{ minWidth: 0 }}
              >
                {t("cancel")}
              </Button>
            </Box>
          )}

          {order.status === "preparing" && (
            <Button
              color="info"
              fullWidth
              size="medium"
              variant="contained"
              disableElevation
              onClick={() => changeStatus("ready")} disabled={sending}
              sx={{
                minHeight: 48,
                py: 0.9,
                color: "white",
              }}
            >
              {sending ? (language === "ar" ? "جارٍ التحديث…" : "Updating…") : (language === "ar" ? "جاهز للاستلام" : "Ready for pickup")}
            </Button>
          )}

          {order.status === "ready" && isPaid && (
            <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", gap: 0.8, width: "100%", minWidth: 0, "& .MuiButton-root": { minWidth: 0, whiteSpace: "normal" } }}>
              <Button
                color="success"
                fullWidth
                size="medium"
                variant="contained"
                disableElevation
                onClick={() => changeStatus("served")} disabled={sending}
                sx={{ minWidth: 0, minHeight: 48, py: 0.9 }}
              >
                {t("received")}
              </Button>
              <Button
                color={isPaid ? "primary" : "inherit"}
                size="medium"
                variant="outlined"
                startIcon={<PrintRoundedIcon />}
                onClick={() => setIsInvoiceOpen(true)}
                disabled={!isPaid || sending}
                title={!isPaid ? (language === "ar" ? "سجّل السداد أولًا لطباعة فاتورة الكاشير" : "Record payment before printing the cashier invoice") : undefined}
                sx={{ minHeight: 48, minWidth: 0, whiteSpace: "normal" }}
              >
                {t("printInvoice")}
              </Button>
              <Button
                color="warning"
                size="medium"
                variant="outlined"
                onClick={() => changeStatus("unclaimed")} disabled={sending}
                sx={{ minHeight: 48, minWidth: 0, whiteSpace: "normal" }}
              >
                {t("unclaimed")}
              </Button>
            </Box>
          )}
          {isAwaitingPayment && (
            <Box sx={{ width: "100%", display: "grid", gap: 0.8 }}>
              {!isPaid && <Button color="success" variant="contained" onClick={openPaymentDialog} disabled={sending || paymentSaving}>
                {language === "ar" ? "تسجيل السداد" : "Record payment"}
              </Button>}
            </Box>
          )}
        </CardActions>
      </Card>
      <InvoiceModal open={isInvoiceOpen} onClose={() => setIsInvoiceOpen(false)} order={order} autoPrint={order.status === "pending" ? "kitchen" : false} printMode={order.status === "pending" ? "order" : "cashier"} hideKitchenReprint={order.status === "ready"} />
      <Dialog open={Boolean(confirmingStatus)} onClose={() => !sending && setConfirmingStatus(null)} fullWidth maxWidth="xs" language={language}>
        <DialogTitle>{language === "ar" ? "تأكيد الاستلام" : "Confirm receipt"}</DialogTitle>
        <DialogContent>
          {language === "ar" ? "هل تؤكد أن العميل استلم الطلب؟ سيتم نقل الطلب غير المدفوع إلى انتظار السداد." : "Confirm that the customer received the order? Unpaid orders will remain awaiting payment."}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingStatus(null)} disabled={sending}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button variant="contained" color="success" onClick={confirmReceiptAction} disabled={sending}>{language === "ar" ? "تأكيد الاستلام" : "Confirm receipt"}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={paymentDialogOpen} onClose={() => !paymentSaving && setPaymentDialogOpen(false)} fullWidth maxWidth="xs" language={language}>
        <DialogTitle>{language === "ar" ? "تسجيل سداد الطلب" : "Record order payment"}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth required error={Boolean(paymentError)} sx={{ mt: 1 }}>
            <InputLabel id={`${paymentMethodFieldId}-label`}>{language === "ar" ? "طريقة الدفع" : "Payment method"}</InputLabel>
            <Select
              labelId={`${paymentMethodFieldId}-label`}
              id={paymentMethodFieldId}
              value={paymentDialogMethod}
              label={language === "ar" ? "طريقة الدفع" : "Payment method"}
              onChange={(event) => { setPaymentDialogMethod(event.target.value); setPaymentError(""); }}
            >
              <MenuItem value=""><em>{language === "ar" ? "اختر طريقة الدفع" : "Select a payment method"}</em></MenuItem>
              {paymentMethodOptions.map(([method, label]) => <MenuItem key={method} value={method}>{label}</MenuItem>)}
            </Select>
            <FormHelperText role={paymentError ? "alert" : undefined}>
              {paymentError || (language === "ar" ? "اختيار الطريقة مطلوب لتسجيل السداد." : "A payment method is required to record payment.")}
            </FormHelperText>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)} disabled={paymentSaving}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button variant="contained" color="success" onClick={recordSelectedPayment} disabled={!paymentDialogMethod || paymentSaving}>
            {paymentSaving ? (language === "ar" ? "جارٍ التسجيل…" : "Recording…") : (language === "ar" ? "تأكيد السداد" : "Confirm payment")}
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
}

export default OrderItemCard;
