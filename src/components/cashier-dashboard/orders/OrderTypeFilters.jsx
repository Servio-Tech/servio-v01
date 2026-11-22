import { Box, Button, Stack, Tooltip, Typography } from "@mui/material";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";

export default function OrderTypeFilters({ value, onChange, bell, announcement, language }) {
  const ar = language === "ar";
  const filters = [
    { value: "all", label: ar ? "كل الطلبات" : "All orders" },
    { value: "table", label: ar ? "الطاولات" : "Table" },
    { value: "cashier", label: ar ? "الكاشير / محلي" : "Cashier / dine-in" },
    { value: "takeaway", label: ar ? "سفري" : "Takeaway" },
  ];
  const order = announcement?.order;
  const orderDescription = order?.order_number ? `#${order.order_number}` : (order?.table_number || "");

  return (
    <Box sx={{ mb: 2.5, pt: 0.4 }}>
      <Stack direction="row" useFlexGap sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Tooltip title={ar ? "تنبيه الطلبات الجديدة" : "New order alert"}>
          <Box
            role="img"
            aria-label={ar ? "جرس تنبيه الطلبات الجديدة" : "New order alert bell"}
            data-testid="new-order-bell"
            data-active={bell.active ? "true" : "false"}
            data-lit={bell.lit ? "true" : "false"}
            sx={{
              width: 43, height: 43, flex: "0 0 auto", display: "grid", placeItems: "center",
              borderRadius: "12px", border: "1px solid", borderColor: bell.lit ? "#f49a5a" : "#68513e",
              color: bell.lit ? "#fff6e9" : "#ce8a59", backgroundColor: bell.lit ? "#cf6128" : "#2a231e",
              boxShadow: bell.lit ? "0 0 0 4px rgba(226,116,50,.20), 0 0 22px rgba(226,116,50,.38)" : "none",
              transition: "none",
              "@media (prefers-reduced-motion: reduce)": {
                borderColor: bell.active ? "#f49a5a" : "#68513e",
                color: bell.active ? "#fff6e9" : "#ce8a59",
                backgroundColor: bell.active ? "#cf6128" : "#2a231e",
                boxShadow: "none",
              },
            }}
          ><NotificationsNoneRoundedIcon /></Box>
        </Tooltip>
        <Typography variant="caption" sx={{ color: "#c2b3a3", fontWeight: 800, mx: 0.25 }}>
          {ar ? "نوع الطلب" : "Order type"}
        </Typography>
        {filters.map((filter) => (
          <Button
            key={filter.value}
            size="small"
            variant={value === filter.value ? "contained" : "outlined"}
            aria-pressed={value === filter.value}
            onClick={() => onChange(filter.value)}
            sx={{
              minHeight: 38, borderRadius: "10px", fontWeight: 800, whiteSpace: "nowrap",
              ...(value === filter.value
                ? { bgcolor: "#cf6128", color: "#fffaf2", "&:hover": { bgcolor: "#ae4d1e" } }
                : { color: "#e9dac7", borderColor: "#514338", "&:hover": { borderColor: "#d8793e", bgcolor: "#362920" } }),
            }}
          >{filter.label}</Button>
        ))}
      </Stack>
      <Box role="status" aria-live="polite" aria-atomic="true" sx={{ position: "absolute", width: 1, height: 1, p: 0, m: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
        {announcement && (ar ? `وصل طلب جديد ${orderDescription}، التنبيه ${announcement.number}` : `New order ${orderDescription}, alert ${announcement.number}`)}
      </Box>
    </Box>
  );
}
