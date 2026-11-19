import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { useOrders } from "../../../context/OrdersContext";
import { useLanguage } from "../../../context/LanguageContext";
import OrderItemCard from "./OrderItemCard";
import CashierQuickOrderDialog from "./CashierQuickOrderDialog";
import { buildOrderQueue, ORDER_STATUSES } from "../receiver/orderQueue";

export default function LiveOrders({ resetToken }) {
  const { orders = [], ordersLoading, ordersLoadError, reloadOrders } = useOrders();
  const { t, language } = useLanguage();
  const ar = language === "ar";
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // A table-order alert should always take the cashier back to the complete queue.
  useEffect(() => {
    if (resetToken) setStatusFilter("all");
  }, [resetToken]);

  const { groupedOrders, orderNumbers, allVisibleOrders } = useMemo(() => buildOrderQueue(orders), [orders]);
  const visibleOrders = statusFilter === "all" ? allVisibleOrders : groupedOrders[statusFilter];
  const filters = [{ key: "all", label: ar ? "كل الطلبات" : "All orders", accent: "#14213d", count: allVisibleOrders.length },
    ...ORDER_STATUSES.map((status) => ({ ...status, label: t(status.title), count: groupedOrders[status.key].length }))];
  const selectedLabel = filters.find((filter) => filter.key === statusFilter)?.label;

  return (
    <Box component="section" aria-labelledby="receiver-title" sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography id="receiver-title" component="h1" sx={{ color: "#f4f6fa", fontSize: { xs: "1.35rem", sm: "1.65rem" }, fontWeight: 950, lineHeight: 1.25 }}>{ar ? "الطلبات الواردة" : "Incoming orders"}</Typography>
          <Typography sx={{ color: "#b1bdd0", fontSize: ".85rem", mt: .4 }}>{ar ? "تابع الطلبات وحدث حالتها من مكان واحد" : "Follow orders and update their status in one place"}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setQuickOrderOpen(true)} disabled={ordersLoading} sx={{ bgcolor: "#d9541e", color: "#fff", minHeight: 44, borderRadius: 2, px: 2, fontWeight: 850, boxShadow: "none", "&:hover": { bgcolor: "#bd4516", boxShadow: "none" } }}>
          {ar ? "طلب كاشير جديد" : "New cashier order"}
        </Button>
      </Box>

      <Box role="group" aria-label={ar ? "تصفية الطلبات حسب الحالة" : "Filter orders by status"} sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1.25, mb: 1.5, overscrollBehaviorX: "contain" }}>
        {filters.map((filter) => {
          const selected = statusFilter === filter.key;
          return (
            <Button key={filter.key} aria-pressed={selected} onClick={() => setStatusFilter(filter.key)} sx={{ flex: "0 0 auto", minHeight: 42, px: 1.4, borderRadius: 1, border: "1px solid", borderColor: selected ? "#d9541e" : "rgba(255,255,255,.12)", bgcolor: selected ? "#d9541e" : "#14213d", color: "#fff", whiteSpace: "nowrap", fontSize: ".8rem", fontWeight: 800, "&:hover": { bgcolor: selected ? "#b94517" : "#283850", borderColor: "#d9541e" } }}>
              {filter.key !== "all" && <Box component="span" aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: filter.accent, marginInlineEnd: .8 }} />}
              {filter.label}
              <Box component="span" sx={{ marginInlineStart: 1, minWidth: 23, px: .6, py: .15, borderRadius: 1, bgcolor: "rgba(255,255,255,.12)", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{ordersLoading || ordersLoadError ? "—" : filter.count}</Box>
            </Button>
          );
        })}
      </Box>

      {ordersLoadError && (
        <Box role="alert" sx={{ mb: 2, p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, border: "1px solid #efc2bd", borderRadius: 2, bgcolor: "#fff4f2" }}>
          <Typography sx={{ color: "#a53329", fontSize: ".85rem", fontWeight: 700 }}>{ar ? "تعذر تحميل الطلبات. تحقق من الاتصال ثم أعد المحاولة." : "Orders could not load. Check the connection and retry."}</Typography>
          <Button size="small" onClick={reloadOrders} sx={{ color: "#a53329", fontWeight: 800 }}>{ar ? "إعادة المحاولة" : "Retry"}</Button>
        </Box>
      )}

      {ordersLoading ? (
        <Box sx={{ minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.2 }}><CircularProgress size={22} sx={{ color: "#d9541e" }} /><Typography sx={{ color: "#b1bdd0" }}>{ar ? "جارٍ تحميل الطلبات..." : "Loading orders..."}</Typography></Box>
      ) : visibleOrders.length ? (
        <>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 1.3 }}>
            <Typography sx={{ color: "#f4f6fa", fontWeight: 900, fontSize: ".9rem" }}>{selectedLabel}</Typography>
            <Typography sx={{ color: "#b1bdd0", fontSize: ".75rem" }}>{ar ? "مرتبة حسب حالة الطلب" : "Grouped by order status"}</Typography>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 }, alignItems: "start" }}>
            <AnimatePresence mode="popLayout">
              {visibleOrders.map((order) => <OrderItemCard key={order.id} order={{ ...order, displayOrderNumber: orderNumbers.get(order.id) }} />)}
            </AnimatePresence>
          </Box>
        </>
      ) : !ordersLoadError && (
        <Box sx={{ minHeight: 240, border: "1px dashed rgba(255,255,255,.16)", borderRadius: 1, bgcolor: "#14213d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", p: 3 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: "#283850", display: "grid", placeItems: "center", color: "#b1bdd0", mb: 1.3 }}><ReceiptLongOutlinedIcon /></Box>
          <Typography sx={{ color: "#f4f6fa", fontWeight: 900 }}>{ar ? "لا توجد طلبات هنا" : "No orders here"}</Typography>
          <Typography sx={{ color: "#b1bdd0", fontSize: ".82rem", mt: .5 }}>{statusFilter === "all" ? (ar ? "ستظهر الطلبات الجديدة هنا عند وصولها." : "New orders will appear here when they arrive.") : (ar ? "لا توجد طلبات بهذه الحالة حاليًا." : "There are currently no orders in this status.")}</Typography>
        </Box>
      )}
      <CashierQuickOrderDialog open={quickOrderOpen} onClose={() => setQuickOrderOpen(false)} />
    </Box>
  );
}
