import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import TrialNotice from "../components/TrialNotice";
import CustomerMenuBottomNav from "../components/menu/CustomerMenuBottomNav";
import CustomerPageHeader from "../components/menu/CustomerPageHeader";
import supabase from "../supabase";
import { useTenant } from "../context/TenantContext";
import { useLanguage } from "../context/LanguageContext";
import { buildCustomerMenuPath } from "../utils/customerMenuNavigation";
import { getCustomerTrackingPath, getRecentCustomerOrdersForSlug } from "../utils/customerTracking";

const POLL_INTERVAL_MS = 5_000;
const FINISHED_STATUSES = new Set(["awaiting_payment", "ready", "served", "unclaimed", "cancelled"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRACKING_STORAGE_PREFIX = "servio.orderTracking.";

const copy = {
  ar: {
    eyebrow: "متابعة الطلب",
    title: "طلبك، خطوة بخطوة",
    subtitle: "تابع حالة طلبك فقط؛ تتحدث تلقائيًا دون عرض أي طلبات أخرى.",
    order: "رقم الطلب",
    submitted: "وقت الإرسال",
    dineIn: "رقم الطاولة",
    progress: "تقدم الطلب",
    pending: "تم استلام الطلب",
    preparing: "قيد التحضير",
    ready: "جاهز للتسليم",
    awaiting_payment: "جاهز، بانتظار السداد",
    served: "تم التسليم",
    cancelled: "تم إلغاء الطلب",
    unclaimed: "لم يُستلم الطلب",
    steps: ["استلام الطلب", "التحضير", "جاهز"],
    cancelledText: "تم إلغاء هذا الطلب. يرجى مراجعة فريق المتجر للمساعدة.",
    unclaimedText: "تم تسجيل الطلب على أنه لم يُستلم.",
    loading: "جارٍ تحميل حالة الطلب…",
    unavailable: "تعذر تحميل حالة الطلب الآن. سنحاول مجددًا تلقائيًا.",
    invalidTitle: "تعذر فتح التتبع",
    invalidBody: "رابط التتبع غير صالح أو لا يخص هذا الطلب. افتح صفحة التتبع من الجهاز الذي أرسل منه الطلب.",
    emptyTitle: "لا يوجد طلب حديث للتتبع",
    emptyBody: "بعد إرسال طلب من هذا الجهاز، سيظهر مرجعه هنا لتتمكن من متابعة حالته.",
    back: "العودة إلى منيو الطاولة",
    retry: "إعادة المحاولة",
    live: "تتحدث الحالة تلقائيًا كل 5 ثوانٍ أثناء التحضير.",
    terminal: "وصل الطلب إلى هذه المرحلة؛ لن تحتاج إلى إبقاء الصفحة مفتوحة.",
    liveBadge: "مباشر",
    updatedBadge: "تم التحديث",
    lastUpdated: "آخر تحديث",
    refreshStatus: "تحديث",
    refreshing: "جارٍ التحديث",
    storeFallback: "طلبك لدى",
    statusLabel: "الحالة الحالية",
    unavailableStatus: "حالة الطلب",
  },
  en: {
    eyebrow: "ORDER TRACKING",
    title: "Your order, step by step",
    subtitle: "Track this order only. Its status refreshes automatically; no other orders are shown.",
    order: "Order reference",
    submitted: "Submitted",
    dineIn: "Table number",
    progress: "Order progress",
    pending: "Order received",
    preparing: "Preparing",
    ready: "Ready for pickup",
    awaiting_payment: "Ready, awaiting payment",
    served: "Delivered",
    cancelled: "Order cancelled",
    unclaimed: "Not collected",
    steps: ["Received", "Preparing", "Ready"],
    cancelledText: "This order was cancelled. Please contact the store team for help.",
    unclaimedText: "This order was marked as not collected.",
    loading: "Loading order status…",
    unavailable: "The order status could not be loaded. We will retry automatically.",
    invalidTitle: "Tracking unavailable",
    invalidBody: "This tracking link is invalid or does not belong to this order. Open tracking on the device used to place the order.",
    emptyTitle: "No recent order to track",
    emptyBody: "After you place an order on this device, its reference will appear here so you can follow its status.",
    back: "Back to this table's menu",
    retry: "Try again",
    live: "Status refreshes automatically every 5 seconds while your order is being prepared.",
    terminal: "Your order reached this stage; you do not need to keep this page open.",
    liveBadge: "LIVE",
    updatedBadge: "UPDATED",
    lastUpdated: "Last updated",
    refreshStatus: "Refresh",
    refreshing: "Refreshing",
    storeFallback: "Your order at",
    statusLabel: "Current status",
    unavailableStatus: "Order status",
  },
};

const statusText = (status, text) => text[status] || text.unavailableStatus;

function InvoiceDetails({ order, language, currency, id }) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const money = (value) => `${Number(value || 0).toLocaleString(language === "ar" ? "ar-SA" : "en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  return (
    <Paper id={id} role="region" aria-label={language === "ar" ? "فاتورة الطلب" : "Order invoice"} elevation={0} sx={{ mt: 1.2, p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: "background.paper", border: "1px solid rgba(244,121,32,.3)" }}>
      <Stack spacing={.75}>
        {items.map((item, index) => {
          const addons = Array.isArray(item.selected_addons)
            ? item.selected_addons.map((addon) => addon?.name).filter(Boolean)
            : [];
          return (
            <Stack key={`${item.id || item.name}-${index}`} direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{item.name} × {item.quantity || 1}</Typography>
                {addons.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .2, lineHeight: 1.5 }}>
                    {language === "ar" ? "الإضافات: " : "Add-ons: "}{addons.join(language === "ar" ? "، " : ", ")}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" fontWeight={850} whiteSpace="nowrap">{money(Number(item.price || 0) * Number(item.quantity || 1))}</Typography>
            </Stack>
          );
        })}
        <Box sx={{ borderTop: "1px dashed", borderColor: "divider", pt: .9, mt: .35 }}>
          <Stack direction="row"  sx={{ justifyContent: "space-between" }}><Typography fontWeight={900}>{language === "ar" ? "الإجمالي" : "Total"}</Typography><Typography fontWeight={950} color="primary.main">{money(order?.total_price)}</Typography></Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function OrderTrackingPage() {
  const { slug = "", orderId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, storeInfo, loading: tenantLoading } = useTenant();
  const { language } = useLanguage();
  const text = copy[language] || copy.ar;
  const currency = storeInfo?.currency || (language === "ar" ? "ر.س" : "SAR");
  const storageKey = `${TRACKING_STORAGE_PREFIX}${slug}.${orderId}`;

  const [trackingToken, setTrackingToken] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invalidLink, setInvalidLink] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrdersReady, setCustomerOrdersReady] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [openInvoice, setOpenInvoice] = useState(null);
  const [trackingTokenReady, setTrackingTokenReady] = useState(false);
  const [trackingTokenKey, setTrackingTokenKey] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    let token = location.state?.trackingToken || "";
    try {
      if (token) window.sessionStorage.setItem(storageKey, token);
      else token = window.sessionStorage.getItem(storageKey) || "";
    } catch {
      // إذا منع المتصفح التخزين، يستمر التتبع باستخدام رمز حالة التنقل الحالية.
    }
    setTrackingToken(token);
    setTrackingTokenKey(storageKey);
    setTrackingTokenReady(true);
  }, [location.state?.trackingToken, storageKey]);

  useEffect(() => {
    setOrder(null);
    setLoading(true);
    setInvalidLink(false);
    setLoadError("");
    setLastUpdatedAt(null);
    setOpenInvoice(null);
  }, [slug, orderId]);

  useEffect(() => {
    const records = getRecentCustomerOrdersForSlug(slug);
    setCustomerOrders(records);
    setCustomerOrdersReady(true);
    if (!orderId && records[0]) {
      navigate(getCustomerTrackingPath(slug, records[0]), { replace: true, state: { trackingToken: records[0].trackingToken, tableNumber: records[0].tableNumber } });
    }
  }, [slug, orderId, navigate]);

  useEffect(() => {
    const records = getRecentCustomerOrdersForSlug(slug);
    let active = true;
    if (!records.length) { setHistoryOrders([]); return () => { active = false; }; }
    Promise.all(records.map(async (record) => {
      const { data } = await supabase.rpc("get_public_order_tracking", { p_slug: slug, p_order_id: record.orderId, p_tracking_token: record.trackingToken });
      return data ? { ...data, localRecord: record } : null;
    })).then((orders) => { if (active) setHistoryOrders(orders.filter(Boolean)); }).catch(() => { if (active) setHistoryOrders([]); });
    return () => { active = false; };
  }, [slug, orderId]);

  useEffect(() => {
    if (!trackingTokenReady || trackingTokenKey !== storageKey) {
      setLoading(true);
      return undefined;
    }
    if (!trackingToken) {
      setLoading(false);
      return undefined;
    }
    if (invalidLink) {
      setLoading(false);
      return undefined;
    }
    if (!UUID_PATTERN.test(orderId)) {
      setLoading(false);
      setInvalidLink(true);
      return undefined;
    }

    let active = true;
    let inFlight = false;

    const refreshStatus = async (showSpinner = false) => {
      if (!active || inFlight) return;
      inFlight = true;
      if (showSpinner) setLoading(true);
      setLoadError("");
      try {
        const { data, error } = await supabase.rpc("get_public_order_tracking", {
          p_slug: slug,
          p_order_id: orderId,
          p_tracking_token: trackingToken,
        });
        if (!active) return;
        if (error) {
          setLoadError(text.unavailable);
        } else if (!data) {
          setInvalidLink(true);
          setLoadError("");
        } else {
          setOrder(data);
          setInvalidLink(false);
          setLoadError("");
          setLastUpdatedAt(new Date());
        }
      } catch {
        if (active) setLoadError(text.unavailable);
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };

    void refreshStatus(true);
    const terminal = FINISHED_STATUSES.has(order?.status) || invalidLink;
    const timer = terminal ? null : window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refreshStatus(false);
    }, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !terminal) void refreshStatus(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [trackingToken, trackingTokenReady, trackingTokenKey, storageKey, slug, orderId, order?.status, invalidLink, text.unavailable, refreshKey]);

  const steps = text.steps;
  // انتظار السداد والجاهز نقطتان نهائيتان للعميل؛ لا نعرض مرحلة تم التسليم.
  const trackingStatus = order?.status === "awaiting_payment" || order?.status === "served" ? "ready" : order?.status;
  const currentStatusLabel = order?.status === "awaiting_payment"
    ? text.awaiting_payment
    : statusText(order?.status, text);
  const currentStep = Math.max(0, ["pending", "preparing", "ready"].indexOf(trackingStatus));
  const orderReference = orderId ? orderId.slice(-6).toUpperCase() : "—";
  const createdAt = order?.created_at
    ? new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))
    : "—";
  // نستخدم رقم الطاولة الذي أعادته RPC المقيدة، ونحتفظ بما مرره تدفق الطلب قبل اكتمال أول قراءة.
  const returnTable = order?.table_number || location.state?.tableNumber || "";
  const menuReturnPath = buildCustomerMenuPath(slug, returnTable, location.search);
  const storeName = storeInfo?.store_name || storeInfo?.name || tenant?.name || "SERVIO";
  const orderStatusColor = order?.status === "cancelled" ? "error" : order?.status === "unclaimed" || order?.status === "awaiting_payment" ? "warning" : trackingStatus === "ready" ? "success" : "primary";
  const progressValue = trackingStatus === "ready" ? 100 : Math.max(8, (currentStep / (steps.length - 1)) * 100);
  const isPolling = Boolean(order && !FINISHED_STATUSES.has(order.status));
  const lastUpdated = lastUpdatedAt
    ? new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-SA", { timeStyle: "short" }).format(lastUpdatedAt)
    : "";

  return (
    <Box
      component="main"
      className="customer-experience-page customer-tracking-page"
      dir={language === "ar" ? "rtl" : "ltr"}
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.default",
        pt: { xs: 1.5, md: 3 },
        px: 1.2,
        pb: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <Container maxWidth="sm" sx={{ flex: 1, display: "flex", flexDirection: "column", px: { xs: 0, sm: 1 } }}>
        <Stack spacing={{ xs: 2, sm: 2.5 }} sx={{ width: "100%", my: "auto" }}>
          <CustomerPageHeader tableNumber={returnTable} />

          <Box>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 900, letterSpacing: ".08em" }}>
              {text.eyebrow}
            </Typography>
            <Typography variant="h4" component="h1" fontWeight={950} letterSpacing="-.035em" sx={{ fontSize: { xs: "1.8rem", sm: "2.2rem" } }}>
              {text.title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: .7, lineHeight: 1.8 }}>{text.subtitle}</Typography>
          </Box>

          {tenantLoading || !trackingTokenReady || (!orderId && !customerOrdersReady) ? (
            <Paper elevation={0} sx={{ p: 5, textAlign: "center", borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 1.2 }}>{text.loading}</Typography>
            </Paper>
          ) : !orderId && customerOrders.length > 0 ? (
            <Paper elevation={0} sx={{ p: 5, textAlign: "center", borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 1.2 }}>{text.loading}</Typography>
            </Paper>
          ) : !orderId && !customerOrders.length ? (
            <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, textAlign: "center", borderRadius: 2.5, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Box sx={{ width: 52, height: 52, display: "grid", placeItems: "center", mx: "auto", mb: 1.5, borderRadius: 2, bgcolor: "rgba(244,121,32,.10)", color: "primary.main" }}><ReceiptLongRoundedIcon /></Box>
              <Typography component="h2" variant="h6" fontWeight={900}>{text.emptyTitle}</Typography>
              <Typography color="text.secondary" sx={{ mt: .7, lineHeight: 1.8 }}>{text.emptyBody}</Typography>
            </Paper>
          ) : invalidLink || !trackingToken ? (
            <Alert severity="warning" sx={{ borderRadius: 1.5, alignItems: "flex-start" }}>
              <Typography fontWeight={900}>{text.invalidTitle}</Typography>
              <Typography variant="body2" sx={{ mt: .5, lineHeight: 1.8 }}>{text.invalidBody}</Typography>
            </Alert>
          ) : (
            <Card elevation={0} sx={{ borderRadius: { xs: 2, sm: 2.5 }, border: "1px solid", borderColor: "divider", boxShadow: "0 14px 36px rgba(0,0,0,.1)", overflow: "hidden" }}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, "&:last-child": { pb: { xs: 1.5, sm: 2.5 } } }}>
                <Stack spacing={{ xs: 1.5, sm: 2 }}>
                  <Box sx={{ p: { xs: 1.8, sm: 2.4 }, borderRadius: 1.5, color: "#fff", background: "linear-gradient(125deg, #252a46 0%, #363d62 100%)", position: "relative", overflow: "hidden" }}>
                    <Box aria-hidden="true" sx={{ position: "absolute", width: 150, height: 150, borderRadius: "50%", bgcolor: "rgba(255,255,255,.06)", insetInlineEnd: -48, top: -75 }} />
                    <Stack direction={{ xs: "column", sm: "row" }}    sx={{ position: "relative" , alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 1.3}}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ display: "block", opacity: .72, mb: .35 }}>{storeName}</Typography>
                        <Typography variant="caption" sx={{ opacity: .72 }}>{text.order}</Typography>
                        <Typography variant="h4" fontWeight={950} sx={{ lineHeight: 1.1, mt: .2, letterSpacing: ".03em" }}>#{orderReference}</Typography>
                      </Box>
                      {order && <Chip color={orderStatusColor} label={currentStatusLabel} sx={{ fontWeight: 850, maxWidth: "100%" }} />}
                    </Stack>
                  </Box>

                  {loading && !order ? (
                    <Stack  spacing={1.2} sx={{ py: 3 , alignItems: "center"}}><CircularProgress /><Typography color="text.secondary">{text.loading}</Typography></Stack>
                  ) : order ? (
                    <>
                      {order.status === "cancelled" || order.status === "unclaimed" ? (
                        <Alert severity={order.status === "cancelled" ? "error" : "warning"} sx={{ borderRadius: 2.5, lineHeight: 1.7 }}>
                          {order.status === "cancelled" ? text.cancelledText : text.unclaimedText}
                        </Alert>
                      ) : (
                        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1.5, bgcolor: "background.default", border: "1px solid", borderColor: "divider" }}>
                          <Stack direction="row"    sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">{text.progress}</Typography>
                              <Typography fontWeight={900} sx={{ mt: .25 }}>{currentStatusLabel}</Typography>
                            </Box>
                            <Chip
                              size="small"
                              color={isPolling ? "success" : "default"}
                              variant="outlined"
                              icon={isPolling ? undefined : <DoneAllRoundedIcon />}
                              label={isPolling ? text.liveBadge : text.updatedBadge}
                              sx={{ fontWeight: 900, letterSpacing: ".03em" }}
                            />
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={progressValue}
                            sx={{ mt: 1.5, mb: 2, height: 7, borderRadius: 8, bgcolor: "rgba(244,121,32,.12)", "& .MuiLinearProgress-bar": { borderRadius: 8 } }}
                          />
                          <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: .5 }}>
                            {steps.map((label, index) => {
                              const complete = index < currentStep;
                              const active = index === currentStep;
                              return (
                                <Box key={label} sx={{ minWidth: 0, textAlign: "center" }}>
                                  <Box
                                    aria-current={active ? "step" : undefined}
                                    sx={{
                                      width: { xs: 30, sm: 34 }, height: { xs: 30, sm: 34 }, mx: "auto", mb: .7,
                                      borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 900,
                                      color: complete || active ? "#fff" : "text.secondary",
                                      bgcolor: complete || active ? "primary.main" : "action.hover",
                                      boxShadow: active ? "0 0 0 4px rgba(244,121,32,.14)" : "none",
                                    }}
                                  >
                                    {complete ? "✓" : index + 1}
                                  </Box>
                                  <Typography variant="caption" sx={{ display: "block", fontSize: { xs: ".62rem", sm: ".72rem" }, fontWeight: active ? 850 : 650, color: active ? "text.primary" : "text.secondary", lineHeight: 1.45, overflowWrap: "anywhere" }}>
                                    {label}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Paper>
                      )}

                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: order?.table_number ? "1fr 1fr" : "1fr" }, gap: 1 }}>
                        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
                          <Typography variant="caption" color="text.secondary">{text.submitted}</Typography>
                          <Typography variant="body2" fontWeight={800} sx={{ mt: .35 }}>{createdAt}</Typography>
                        </Paper>
                        {order.table_number && (
                          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
                            <Typography variant="caption" color="text.secondary">{text.dineIn}</Typography>
                            <Typography variant="body2" fontWeight={800} sx={{ mt: .35 }}>{order.table_number}</Typography>
                          </Paper>
                        )}
                      </Box>
                      <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: .75 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.6 }}>
                            {isPolling ? text.live : text.terminal}
                          </Typography>
                          {lastUpdated && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .25, fontWeight: 700 }}>
                              {text.lastUpdated}: {lastUpdated}
                            </Typography>
                          )}
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={loading ? <CircularProgress size={15} color="inherit" /> : <RefreshRoundedIcon />}
                          disabled={loading}
                          onClick={() => setRefreshKey((key) => key + 1)}
                          sx={{ alignSelf: { xs: "flex-start", sm: "center" }, minHeight: 38, flexShrink: 0, borderRadius: 2, fontWeight: 800 }}
                        >
                          {loading ? text.refreshing : text.refreshStatus}
                        </Button>
                      </Stack>
                      <Button
                        variant="outlined"
                        startIcon={<ReceiptLongRoundedIcon />}
                        endIcon={<ExpandMoreRoundedIcon sx={{ transform: openInvoice === orderId ? "rotate(180deg)" : "none", transition: "transform .18s ease" }} />}
                        aria-expanded={openInvoice === orderId}
                        aria-controls={`order-invoice-${orderId}`}
                        onClick={() => setOpenInvoice(openInvoice === orderId ? null : orderId)}
                        sx={{ minHeight: 46, borderRadius: 2.2, fontWeight: 850 }}
                      >
                        {language === "ar" ? "عرض فاتورة الطلب" : "View order invoice"}
                      </Button>
                      {openInvoice === orderId && <InvoiceDetails id={`order-invoice-${orderId}`} order={order} language={language} currency={currency} />}
                    </>
                  ) : null}

                  {loadError && (
                    <Alert
                      severity="warning"
                      action={<Button color="inherit" size="small" startIcon={<RefreshRoundedIcon />} disabled={loading} onClick={() => setRefreshKey((key) => key + 1)}>{text.retry}</Button>}
                      sx={{ borderRadius: 2.5 }}
                    >
                      {loadError}
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {customerOrders.length > 1 && historyOrders.filter((item) => item.order_id !== orderId).length > 0 && (
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Typography fontWeight={950} sx={{ mb: 1 }}>{language === "ar" ? "طلباتك خلال الساعة الأخيرة" : "Your orders from the last hour"}</Typography>
              <Stack spacing={1}>
                {historyOrders.filter((item) => item.order_id !== orderId).map((item) => {
                  const record = item.localRecord;
                  const isOpen = openInvoice === item.order_id;
                  return <Box key={item.order_id} sx={{ p: 1.2, borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row"    sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                      <Box><Typography fontWeight={850}>#{String(item.order_id).slice(-6).toUpperCase()}</Typography><Typography variant="caption" color="text.secondary">{statusText(item.status, text)}</Typography></Box>
                      <Button size="small" variant="text" aria-expanded={isOpen} aria-controls={`order-invoice-${item.order_id}`} onClick={() => setOpenInvoice(isOpen ? null : item.order_id)}>{language === "ar" ? "الفاتورة" : "Invoice"}</Button>
                    </Stack>
                    {isOpen && <InvoiceDetails id={`order-invoice-${item.order_id}`} order={item} language={language} currency={currency} />}
                    <Button size="small" onClick={() => navigate(getCustomerTrackingPath(slug, record), { state: { trackingToken: record.trackingToken, tableNumber: record.tableNumber } })}>{language === "ar" ? "فتح التتبع" : "Open tracking"}</Button>
                  </Box>;
                })}
              </Stack>
            </Paper>
          )}

          <Button
            variant="outlined"
            fullWidth
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => navigate(menuReturnPath)}
            sx={{ minHeight: 48, borderRadius: 2.5, fontWeight: 850 }}
          >
            {text.back}
          </Button>
        </Stack>
        <TrialNotice />
      </Container>
      <CustomerMenuBottomNav
        activePage="track"
        canCallWaiter={Boolean(returnTable) && !/^(cashier|كاشير)$/i.test(String(returnTable).trim())}
        tableNumber={returnTable}
      />
    </Box>
  );
}

export default OrderTrackingPage;
