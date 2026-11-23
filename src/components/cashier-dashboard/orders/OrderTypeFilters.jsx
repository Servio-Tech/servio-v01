import { Box, Button, Stack, Tooltip, Typography } from "@mui/material";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";

const buttonSx = (selected) => ({
  minHeight: 34,
  px: 1.15,
  borderRadius: "10px",
  fontWeight: 850,
  fontSize: ".78rem",
  whiteSpace: "nowrap",
  flex: "0 0 auto",
  ...(selected
    ? { bgcolor: "#f47920", color: "#171a2f", borderColor: "#f47920", "&:hover": { bgcolor: "#d96816", borderColor: "#d96816" } }
    : { color: "#e9dac7", borderColor: "#4a4e62", "&:hover": { borderColor: "#fdba74", bgcolor: "#292e43" } }),
});

export default function OrderTypeFilters({
  value,
  onChange,
  statusValue = "all",
  onStatusChange,
  statusCounts = {},
  onQuickOrder,
  bell,
  announcement,
  language,
}) {
  const ar = language === "ar";
  const statusFilters = [
    { value: "all", label: ar ? "الكل" : "All" },
    { value: "pending", label: ar ? "جديد" : "New" },
    { value: "preparing", label: ar ? "جاري التحضير" : "Preparing" },
    { value: "ready", label: ar ? "جاهز للاستلام" : "Ready for pickup" },
    { value: "awaiting_payment", label: ar ? "في انتظار السداد" : "Awaiting payment" },
  ];
  const typeFilters = [
    { value: "all", label: ar ? "كل الأنواع" : "All types" },
    { value: "table", label: ar ? "الطاولات" : "Tables" },
    { value: "cashier", label: ar ? "الكاشير / محلي" : "Cashier / dine-in" },
    { value: "takeaway", label: ar ? "سفري" : "Takeaway" },
  ];
  const order = announcement?.order;
  const orderDescription = order?.order_number ? `#${order.order_number}` : (order?.table_number || "");

  return (
    <Box sx={{ mb: 1.4, pb: 1.25, borderBottom: "1px solid rgba(233,222,207,.12)" }}>
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: "center", gap: .8, minWidth: 0 }}>
          {bell && (
            <Tooltip title={ar ? "تنبيه الطلبات الجديدة" : "New order alert"}>
              <Box
                role="img"
                aria-label={ar ? "جرس تنبيه الطلبات الجديدة" : "New order alert bell"}
                data-testid="new-order-bell"
                data-active={bell.active ? "true" : "false"}
                data-lit={bell.lit ? "true" : "false"}
                sx={{
                  width: 36, height: 36, flex: "0 0 auto", display: "grid", placeItems: "center",
                  borderRadius: "11px", border: "1px solid", borderColor: bell.lit ? "#fdba74" : "#4a4e62",
                  color: bell.lit ? "#171a2f" : "#c4c8d2", backgroundColor: bell.lit ? "#f47920" : "#292e43",
                  boxShadow: bell.lit ? "0 0 0 3px rgba(244,121,32,.18), 0 0 18px rgba(244,121,32,.3)" : "none",
                  transition: "none",
                  "@media (prefers-reduced-motion: reduce)": {
                    borderColor: bell.active ? "#fdba74" : "#4a4e62",
                    color: bell.active ? "#171a2f" : "#c4c8d2", backgroundColor: bell.active ? "#f47920" : "#292e43", boxShadow: "none",
                  },
                }}
              ><NotificationsNoneRoundedIcon fontSize="small" /></Box>
            </Tooltip>
          )}
          <Typography variant="caption" sx={{ color: "#c2b3a3", fontWeight: 850, flex: "0 0 auto" }}>
            {ar ? "الحالة" : "Status"}
          </Typography>
          <Box role="group" aria-label={ar ? "فلترة حسب حالة الطلب" : "Filter by order status"} sx={{ minWidth: 0, flex: 1, overflowX: "auto", scrollbarWidth: "thin" }}>
            <Stack direction="row" spacing={.65} sx={{ width: "max-content", minWidth: "100%" }}>
              {statusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  size="small"
                  variant={statusValue === filter.value ? "contained" : "outlined"}
                  aria-pressed={statusValue === filter.value}
                  onClick={() => onStatusChange?.(filter.value)}
                  sx={buttonSx(statusValue === filter.value)}
                >
                  {filter.label} <Box component="span" sx={{ marginInlineStart: .55, opacity: .8, fontVariantNumeric: "tabular-nums" }}>{statusCounts[filter.value] ?? 0}</Box>
                </Button>
              ))}
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" useFlexGap sx={{ alignItems: "center", gap: .8, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: "#c2b3a3", fontWeight: 850, flex: "0 0 auto" }}>
            {ar ? "نوع الطلب" : "Order type"}
          </Typography>
          <Box role="group" aria-label={ar ? "فلترة حسب نوع الطلب" : "Filter by order type"} sx={{ minWidth: 0, flex: 1, overflowX: { xs: "auto", sm: "visible" }, scrollbarWidth: "thin" }}>
            <Stack direction="row" useFlexGap sx={{ width: { xs: "max-content", sm: "auto" }, minWidth: { sm: "100%" }, flexWrap: { xs: "nowrap", sm: "wrap" }, gap: .65 }}>
              {typeFilters.map((filter) => (
                <Button
                  key={filter.value}
                  size="small"
                  variant={value === filter.value ? "contained" : "outlined"}
                  aria-pressed={value === filter.value}
                  onClick={() => onChange(filter.value)}
                  sx={buttonSx(value === filter.value)}
                >{filter.label}</Button>
              ))}
            </Stack>
          </Box>
          {onQuickOrder && (
            <Button size="small" variant="outlined" onClick={onQuickOrder} sx={{ ...buttonSx(false), flex: "0 0 auto" }}>
              {ar ? "طلب كاشير" : "Cashier order"}
            </Button>
          )}
        </Stack>
      </Stack>
      <Box role="status" aria-live="polite" aria-atomic="true" sx={{ position: "absolute", width: 1, height: 1, p: 0, m: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
        {announcement && (ar ? `وصل طلب جديد ${orderDescription}، التنبيه ${announcement.number}` : `New order ${orderDescription}, alert ${announcement.number}`)}
      </Box>
    </Box>
  );
}
