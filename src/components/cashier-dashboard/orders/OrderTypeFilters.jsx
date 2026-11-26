import { Box, Button, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Tooltip, Typography } from "@mui/material";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import AddShoppingCartRoundedIcon from "@mui/icons-material/AddShoppingCartRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

const buttonSx = (selected) => ({
  minHeight: 40,
  px: 1.15,
  borderRadius: "10px",
  fontWeight: 850,
  fontSize: ".84rem",
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
  onRefresh,
  refreshing = false,
  bell,
  announcement,
  language,
}) {
  const ar = language === "ar";
  const statusFilters = [
    { value: "all", label: ar ? "الكل" : "All" },
    { value: "pending", label: ar ? "جديد" : "New" },
    { value: "preparing", label: ar ? "تحضير" : "Preparing" },
    { value: "ready", label: ar ? "جاهز" : "Ready" },
    { value: "awaiting_payment", label: ar ? "سداد" : "Payment" },
  ];
  const typeFilters = [
    { value: "all", label: ar ? "الكل" : "All" },
    { value: "table", label: ar ? "الطاولات" : "Tables" },
    { value: "cashier", label: ar ? "محلي" : "Dine-in" },
    { value: "takeaway", label: ar ? "سفري" : "Takeaway" },
  ];
  const order = announcement?.order;
  const orderDescription = order?.order_number ? `#${order.order_number}` : (order?.table_number || "");

  return (
    <Box sx={{ mb: 1.5, pb: 1.5, borderBottom: "1px solid rgba(233,222,207,.12)" }}>
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: .85, minWidth: 0 }}>
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
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 900, lineHeight: 1.25 }}>
                {ar ? "قائمة الطلبات" : "Order queue"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ar ? `${statusCounts.all ?? 0} طلب نشط · الأقدم أولًا` : `${statusCounts.all ?? 0} active · oldest first`}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" sx={{ alignItems: "center", gap: .6, flex: "0 0 auto" }}>
            {onRefresh && (
              <Tooltip title={ar ? "تحديث الطلبات" : "Refresh orders"}>
                <span>
                  <IconButton
                    aria-label={ar ? "تحديث الطلبات" : "Refresh orders"}
                    onClick={onRefresh}
                    disabled={refreshing}
                    sx={{ width: 42, height: 42, border: "1px solid", borderColor: "divider", borderRadius: 2.2, color: "text.secondary" }}
                  >
                    {refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshRoundedIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {onQuickOrder && (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddShoppingCartRoundedIcon />}
                onClick={onQuickOrder}
                sx={{ minHeight: 42, px: { xs: 1.1, sm: 1.5 }, borderRadius: 2.2, fontWeight: 900, whiteSpace: "nowrap" }}
              >
                {ar ? "طلب كاشير" : "New sale"}
              </Button>
            )}
          </Stack>
        </Stack>

        <Stack direction="row" sx={{ display: { xs: "flex", md: "none" }, gap: .8, minWidth: 0 }}>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <InputLabel id="cashier-status-filter-label">{ar ? "الحالة" : "Status"}</InputLabel>
            <Select
              labelId="cashier-status-filter-label"
              value={statusValue}
              label={ar ? "الحالة" : "Status"}
              aria-label={ar ? "فلترة حسب حالة الطلب" : "Filter by order status"}
              onChange={(event) => onStatusChange?.(event.target.value)}
            >
              {statusFilters.map((filter) => (
                <MenuItem key={filter.value} value={filter.value}>
                  {filter.label} ({statusCounts[filter.value] ?? 0})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <InputLabel id="cashier-type-filter-label">{ar ? "النوع" : "Type"}</InputLabel>
            <Select
              labelId="cashier-type-filter-label"
              value={value}
              label={ar ? "النوع" : "Type"}
              aria-label={ar ? "فلترة حسب نوع الطلب" : "Filter by order type"}
              onChange={(event) => onChange(event.target.value)}
            >
              {typeFilters.map((filter) => (
                <MenuItem key={filter.value} value={filter.value}>{filter.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0, overflowX: "auto", scrollbarWidth: "thin", overscrollBehaviorX: "contain" }}>
          <Stack direction="row" sx={{ width: "max-content", minWidth: "100%", alignItems: "center", gap: .75 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900, whiteSpace: "nowrap" }}>
              {ar ? "الحالة" : "Status"}
            </Typography>
            <Box role="group" aria-label={ar ? "فلترة حسب حالة الطلب" : "Filter by order status"}>
              <Stack direction="row" spacing={.55}>
                {statusFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    size="small"
                    variant={statusValue === filter.value ? "contained" : "outlined"}
                    aria-pressed={statusValue === filter.value}
                    onClick={() => onStatusChange?.(filter.value)}
                    sx={{ ...buttonSx(statusValue === filter.value), minHeight: 42, px: 1 }}
                  >
                    {filter.label} <Box component="span" sx={{ marginInlineStart: .45, opacity: .8, fontVariantNumeric: "tabular-nums" }}>{statusCounts[filter.value] ?? 0}</Box>
                  </Button>
                ))}
              </Stack>
            </Box>
            <Box aria-hidden="true" sx={{ height: 28, borderInlineStart: "1px solid", borderColor: "divider", mx: .25 }} />
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900, whiteSpace: "nowrap" }}>
              {ar ? "النوع" : "Type"}
            </Typography>
            <Box role="group" aria-label={ar ? "فلترة حسب نوع الطلب" : "Filter by order type"}>
              <Stack direction="row" spacing={.55}>
                {typeFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    size="small"
                    variant={value === filter.value ? "contained" : "outlined"}
                    aria-pressed={value === filter.value}
                    onClick={() => onChange(filter.value)}
                    sx={{ ...buttonSx(value === filter.value), minHeight: 42, px: 1 }}
                  >{filter.label}</Button>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Stack>
      <Box role="status" aria-live="polite" aria-atomic="true" sx={{ position: "absolute", width: 1, height: 1, p: 0, m: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
        {announcement && (ar ? `وصل طلب جديد ${orderDescription}، التنبيه ${announcement.number}` : `New order ${orderDescription}, alert ${announcement.number}`)}
      </Box>
    </Box>
  );
}
