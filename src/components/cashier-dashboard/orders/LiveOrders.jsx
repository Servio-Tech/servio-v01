// COMPONENTS
import OrderItemCard from "./OrderItemCard";
import CashierQuickOrderDialog from "./CashierQuickOrderDialog";

// MUI COMPONENTS
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import { useMemo, useState } from "react";

// ANIMATION
import { AnimatePresence } from "framer-motion";

// CONTEXTS
import { useOrders } from "../../../context/OrdersContext";

// ICONS
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AddShoppingCartRoundedIcon from "@mui/icons-material/AddShoppingCartRounded";
import { useLanguage } from "../../../context/LanguageContext";
import { getOrderType } from "./orderBellLogic";

const COLUMNS = [
  { key: "pending", title: "newOrder", color: "warning", accent: "#e99462", soft: "rgba(233,148,98,.10)" },
  { key: "preparing", title: "preparing", color: "info", accent: "#91b6ce", soft: "rgba(145,182,206,.10)" },
  { key: "ready", title: "ready", color: "success", accent: "#77c6a0", soft: "rgba(119,198,160,.10)" },
  { key: "awaiting_payment", title: "unpaidOrders", color: "warning", accent: "#eebc6e", soft: "rgba(238,188,110,.10)" },
];

function LiveOrders({ orderTypeFilter = "all" }) {
  const { orders, ordersLoading, ordersLoadError, reloadOrders } = useOrders();
  const { t, language } = useLanguage();
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);

  const activeOrders = orders.filter((order) => (
    !order.is_completed &&
    (orderTypeFilter === "all" || getOrderType(order) === orderTypeFilter) &&
    Array.isArray(order.items) &&
    order.items.length > 0 &&
    order.items.every((item) => item && String(item.name || "").trim() && item.quantity != null && item.price != null)
  ));

  const orderNumbers = useMemo(() => new Map(
    [...orders]
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      .map((order, index) => [order.id, index + 1]),
  ), [orders]);

  const getOrdersByStatus = (status) => activeOrders.filter((order) => (
    status === "awaiting_payment"
      ? order.status === "awaiting_payment"
      : order.status === status && (status !== "ready" || order.payment_status === "paid")
  ));

  if (ordersLoading) {
    return (
      <Box sx={{ minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.2 }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">جاري تحميل الطلبات...</Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={{ xs: 1.5, sm: 2, lg: 2.5 }}>
      {ordersLoadError && (
        <Grid size={{ xs: 12 }}>
          <Paper elevation={0} role="status" sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, border: "1px solid", borderColor: "error.light" }}>
            <Typography color="error">{language === "ar" ? "تعذر تحميل الطلبات. تحقق من الاتصال ثم أعد المحاولة." : "Orders could not load. Check the connection and retry."}</Typography>
            <Button size="small" onClick={reloadOrders}>{language === "ar" ? "إعادة المحاولة" : "Retry"}</Button>
          </Paper>
        </Grid>
      )}
      {COLUMNS.map((col) => {
        const columnOrders = getOrdersByStatus(col.key);

        return (
          <Grid key={col.key} size={{ xs: 12, md: 6, xl: 3 }}>
            {/* عنوان العمود بنفس طابع لوحة التحكم */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.35, md: 1.55 },
                mb: 1.7,
                borderRadius: "15px",
                border: "1px solid",
                borderColor: `${col.accent}55`,
                borderTop: `3px solid ${col.accent}`,
                background: col.soft,
                boxShadow: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FiberManualRecordIcon
                  fontSize="small"
                  sx={{ color: `${col.color}.main`, fontSize: 14 }}
                />
                <Typography variant="subtitle1" fontWeight={950} sx={{ color: col.accent, fontSize: { xs: "1rem", sm: "1.08rem" } }}>
                  {t(col.title)}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                {col.key === "pending" && <Button size="small" variant="contained" startIcon={<AddShoppingCartRoundedIcon />} onClick={() => setQuickOrderOpen(true)} sx={{ borderRadius: 2, fontWeight: 850, whiteSpace: "nowrap" }}>
                  {language === "ar" ? "طلب كاشير" : "Cashier order"}
                </Button>}
                <Chip
                  label={columnOrders.length}
                  size="small"
                  sx={{
                    bgcolor: (theme) => theme.palette[col.color].main + "18",
                    color: `${col.color}.main`,
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    borderRadius: "8px",
                    px: 0.5,
                  }}
                />
              </Box>
            </Paper>

            {/* الحاوية ذات الانتقالات السلسة */}
            <Box sx={{ minHeight: "200px" }}>
              <AnimatePresence mode="popLayout">
                {columnOrders.map((order) => (
                  <OrderItemCard
                    key={order.id}
                    order={{ ...order, displayOrderNumber: orderNumbers.get(order.id) }}
                  />
                ))}
              </AnimatePresence>
            </Box>
          </Grid>
        );
      })}
      <CashierQuickOrderDialog open={quickOrderOpen} onClose={() => setQuickOrderOpen(false)} />
    </Grid>
  );
}

export default LiveOrders;
