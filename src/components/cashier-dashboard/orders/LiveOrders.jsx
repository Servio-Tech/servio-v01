import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import OrderItemCard from "./OrderItemCard";
import CashierQuickOrderDialog from "./CashierQuickOrderDialog";
import OrderTypeFilters from "./OrderTypeFilters";
import { useOrders } from "../../../context/OrdersContext";
import { useLanguage } from "../../../context/LanguageContext";
import { filterCashierOrders, getActiveCashierOrders, getCashierOrderStatusCounts, sortCashierOrdersByPriority } from "./orderFilterLogic";

function LiveOrders({
  orderTypeFilter = "all",
  onOrderTypeChange,
  statusFilter = "all",
  onStatusChange,
  bell,
  announcement,
}) {
  const { orders = [], ordersLoading, ordersLoadError, reloadOrders } = useOrders();
  const { language } = useLanguage();
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);

  const typedOrders = useMemo(() => filterCashierOrders(orders, orderTypeFilter, "all"), [orders, orderTypeFilter]);
  const visibleOrders = useMemo(
    () => sortCashierOrdersByPriority(filterCashierOrders(typedOrders, "all", statusFilter)),
    [typedOrders, statusFilter],
  );
  const statusCounts = useMemo(() => getCashierOrderStatusCounts(typedOrders), [typedOrders]);
  const activeOrderCount = useMemo(() => getActiveCashierOrders(typedOrders).length, [typedOrders]);
  const hasActiveFilters = orderTypeFilter !== "all" || statusFilter !== "all";

  const orderNumbers = useMemo(() => new Map(
    [...orders]
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      .map((order, index) => [order.id, index + 1]),
  ), [orders]);

  return (
    <Box sx={{ minWidth: 0 }}>
      <OrderTypeFilters
        value={orderTypeFilter}
        onChange={onOrderTypeChange}
        statusValue={statusFilter}
        onStatusChange={onStatusChange}
        statusCounts={statusCounts}
        onQuickOrder={() => setQuickOrderOpen(true)}
        onRefresh={reloadOrders}
        refreshing={ordersLoading}
        bell={bell}
        announcement={announcement}
        language={language}
      />

      {ordersLoadError && (
        <Paper elevation={0} role="alert" sx={{ p: 2, mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, border: "1px solid", borderColor: "error.light", borderRadius: 2.5 }}>
          <Typography color="error">{language === "ar" ? "تعذر تحميل الطلبات. تحقق من الاتصال ثم أعد المحاولة." : "Orders could not load. Check the connection and retry."}</Typography>
          <Button size="small" onClick={reloadOrders} disabled={ordersLoading}>{language === "ar" ? "إعادة المحاولة" : "Retry"}</Button>
        </Paper>
      )}

      {ordersLoading ? (
        <Box sx={{ minHeight: 170, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.2 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">{language === "ar" ? "جاري تحميل الطلبات..." : "Loading orders…"}</Typography>
        </Box>
      ) : visibleOrders.length ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, alignItems: "stretch", gap: { xs: 1.25, md: 1.5 }, minWidth: 0 }}>
          <AnimatePresence mode="popLayout">
            {visibleOrders.map((order) => (
              <OrderItemCard
                key={order.id}
                order={{ ...order, displayOrderNumber: orderNumbers.get(order.id) }}
              />
            ))}
          </AnimatePresence>
        </Box>
      ) : (
        <Paper elevation={0} sx={{ minHeight: 180, display: "grid", placeItems: "center", p: 3, border: "1px dashed rgba(233,222,207,.22)", borderRadius: 3, bgcolor: "rgba(255,255,255,.018)" }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography fontWeight={850} color="text.primary">
              {hasActiveFilters
                ? (language === "ar" ? "لا توجد طلبات مطابقة للفلاتر" : "No orders match these filters")
                : (language === "ar" ? "لا توجد طلبات نشطة الآن" : "No active orders right now")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>
              {hasActiveFilters
                ? (language === "ar" ? `الطلبات النشطة ضمن النوع المختار: ${activeOrderCount}` : `Active orders for this type: ${activeOrderCount}`)
                : (language === "ar" ? "ستظهر الطلبات الجديدة هنا تلقائيًا." : "New orders will appear here automatically.")}
            </Typography>
            {hasActiveFilters ? (
              <Button sx={{ mt: 1.25 }} onClick={() => { onOrderTypeChange?.("all"); onStatusChange?.("all"); }}>
                {language === "ar" ? "عرض كل الطلبات" : "Show all orders"}
              </Button>
            ) : (
              <Button sx={{ mt: 1.25 }} onClick={() => setQuickOrderOpen(true)}>
                {language === "ar" ? "إنشاء طلب كاشير" : "Create cashier order"}
              </Button>
            )}
          </Box>
        </Paper>
      )}

      <CashierQuickOrderDialog open={quickOrderOpen} onClose={() => setQuickOrderOpen(false)} />
    </Box>
  );
}

export default LiveOrders;
