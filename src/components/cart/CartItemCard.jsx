// مكوّن واجهة `CartItemCard` ضمن مجموعة `cart`.
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ControlPointDuplicateRoundedIcon from "@mui/icons-material/ControlPointDuplicateRounded";
import RemoveIcon from "@mui/icons-material/Remove";
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../context/LanguageContext";
import { useMenu } from "../../context/MenuContext";
import { useTenant } from "../../context/TenantContext";
import { getCartLineKey } from "../../utils/cartItemUtils";
import {
  buildAddonChoices,
  normalizeAddonLimit,
  normalizeSelectedAddons,
} from "../../utils/menuItemOptions";

function CartItemCard({ cartItemDetails, disabled = false }) {
  const { updatedQuantity, toggleCartItemAddon, addSeparateCartItem, separateCartLineIntoUnits } = useCart();
  const { language } = useLanguage();
  const { items = [] } = useMenu();
  const { storeInfo } = useTenant();
  const isArabic = language === "ar";
  const currency = storeInfo?.currency || (isArabic ? "ر.س" : "SAR");
  const formattedPrice = Number(cartItemDetails.price || 0).toLocaleString(
    isArabic ? "ar-SA" : "en-SA",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
  const addonChoices = buildAddonChoices(cartItemDetails, items);
  const maxAddons = normalizeAddonLimit(cartItemDetails.max_addons, addonChoices.length);
  const selectedAddons = normalizeSelectedAddons(cartItemDetails.selected_addons, addonChoices, maxAddons);
  const selectedKeys = new Set(selectedAddons.map((addon) => addon.id ? `item:${addon.id}` : `text:${addon.name.toLocaleLowerCase()}`));
  const lineId = getCartLineKey(cartItemDetails);
  const quantity = Math.max(1, Math.floor(Number(cartItemDetails.quantity) || 1));
  const formattedLineTotal = (Number(cartItemDetails.price || 0) * quantity).toLocaleString(
    isArabic ? "ar-SA" : "en-SA",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );

  return (
    <Card
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        gridTemplateAreas: '"details image" "addons addons" "custom custom" "price price"',
        alignItems: "start",
        p: { xs: 1.25, sm: 1.5 },
        gap: 1,
        borderRadius: "10px",
        boxShadow: "0 5px 18px rgba(23,26,47,.045)",
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Box sx={{ display: "contents" }}>
        <Box sx={{ textAlign: "start", gridArea: "details", minWidth: 0, pl: 1.2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5, fontSize: "1rem" }}>
            {cartItemDetails.name}
          </Typography>
          {cartItemDetails.description && (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontSize: "0.8rem",
                fontWeight: 500,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {cartItemDetails.description}
            </Typography>
          )}
        </Box>

        {maxAddons > 0 && addonChoices.length > 0 && (
          <Box data-testid="cart-item-addon-box" sx={{ gridArea: "addons", gridColumn: "1 / -1", width: "100%", boxSizing: "border-box", mt: 1.25, p: 1.1, border: "1px solid rgba(244,121,32,.24)", borderRadius: "8px", bgcolor: "background.default", overflow: "hidden" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 0.8 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ display: "block", fontWeight: 900, color: "text.primary" }}>
                  {isArabic ? "إضافات اختيارية" : "Optional add-ons"}
                </Typography>
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontSize: "0.66rem" }}>
                  {isArabic ? "مجانية — اختر حتى " : "Free — choose up to "}{maxAddons}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={selectedAddons.length >= maxAddons ? "primary" : "default"}
                label={`${selectedAddons.length} / ${maxAddons}`}
                sx={{ height: 24, borderRadius: "6px", fontSize: "0.69rem", fontWeight: 900, bgcolor: selectedAddons.length >= maxAddons ? undefined : "background.paper" }}
              />
            </Box>

            <Box
              role="group"
              aria-label={isArabic ? "خيارات الإضافات" : "Add-on choices"}
              sx={{ display: "flex", flexWrap: "wrap", gap: 0.7, py: 0.85 }}
            >
              {addonChoices.map((choice) => {
                const selected = selectedKeys.has(choice.key);
                const atLimit = selectedAddons.length >= maxAddons;
                return (
                  <Chip
                    key={choice.key}
                    size="medium"
                    variant={selected ? "filled" : "outlined"}
                    color={selected ? "primary" : "default"}
                    aria-pressed={selected}
                    disabled={disabled || (!selected && atLimit)}
                    onClick={() => toggleCartItemAddon(lineId, choice, addonChoices)}
                    icon={selected ? <CheckCircleRoundedIcon /> : <AddCircleOutlineRoundedIcon />}
                    label={choice.name}
                    sx={{ flex: "0 0 auto", whiteSpace: "nowrap", borderRadius: "6px", fontSize: "0.73rem", fontWeight: 800, borderColor: "rgba(244,121,32,.36)", bgcolor: selected ? undefined : "background.paper", "& .MuiChip-icon": { fontSize: 17 } }}
                  />
                );
              })}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.66rem", lineHeight: 1.4 }}>
              {quantity > 1
                ? (isArabic
                  ? `الإضافات الحالية تنطبق على كامل الكمية (${quantity}). استخدم «تخصيص إضافات كل قطعة» لاختيار إضافات مستقلة.`
                  : `Current add-ons apply to all ${quantity} units. Use “Customize each unit’s add-ons” to choose independently.`)
                : (isArabic
                  ? "إضافات هذه القطعة مستقلة. اضغط على إضافة محددة لإزالتها."
                  : "This unit’s add-ons are independent. Tap a selected add-on to remove it.")}
            </Typography>
          </Box>
        )}

        {maxAddons > 0 && addonChoices.length > 0 && (
          <Button
            size="small"
            variant={quantity > 1 ? "outlined" : "text"}
            disabled={disabled}
            startIcon={<ControlPointDuplicateRoundedIcon fontSize="small" />}
            onClick={() => (quantity > 1 ? separateCartLineIntoUnits(lineId) : addSeparateCartItem(lineId))}
            aria-label={isArabic
              ? (quantity > 1 ? `فصل ${quantity} وحدات من ${cartItemDetails.name} لتخصيص إضافات كل قطعة` : `طلب وحدة أخرى من ${cartItemDetails.name} بإضافات مستقلة`)
              : (quantity > 1 ? `Separate all ${quantity} ${cartItemDetails.name} units to customize each unit’s add-ons` : `Order another ${cartItemDetails.name} unit with independent add-ons`)}
            sx={{
              gridArea: "custom",
              width: "100%",
              alignSelf: "stretch",
              mt: 0.5,
              px: 1,
              py: 0.6,
              borderRadius: "8px",
              fontSize: "0.72rem",
              fontWeight: 850,
              minHeight: 36,
              justifyContent: "flex-start",
              textAlign: "start",
              textTransform: "none",
              whiteSpace: "normal",
              lineHeight: 1.35,
              ...(quantity > 1 ? { borderColor: "primary.main" } : {}),
            }}
          >
            {isArabic
              ? (quantity > 1 ? "تخصيص إضافات كل قطعة" : "اطلب وحدة بإضافات مستقلة")
              : (quantity > 1 ? "Customize each unit’s add-ons" : "Order a unit with independent add-ons")}
          </Button>
        )}

        <Box sx={{ display: "flex", gridArea: "price", justifyContent: "space-between", alignItems: "center", mt: 1, gap: 1.25 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: ".69rem", lineHeight: 1.3 }}>
              {isArabic ? "سعر الوحدة" : "Unit price"} · {formattedPrice} {currency}
            </Typography>
            <Typography variant="subtitle1" sx={{ mt: .2, fontWeight: 950, color: "primary.main", fontSize: "1rem", whiteSpace: "nowrap" }}>
              {formattedLineTotal} {currency}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.7, sm: 1.2 } }}>
            <IconButton aria-label={isArabic ? "تقليل الكمية" : "Decrease quantity"} onClick={() => updatedQuantity(lineId, cartItemDetails.quantity - 1)} disabled={disabled} size="small" sx={{ width: 44, height: 44, border: "1px solid", borderColor: "divider" }}>
              <RemoveIcon />
            </IconButton>
            <Typography variant="h6" aria-live="polite" sx={{ fontWeight: 850, minWidth: "24px", textAlign: "center" }}>{cartItemDetails.quantity}</Typography>
            <IconButton aria-label={isArabic ? "زيادة الكمية" : "Increase quantity"} onClick={() => updatedQuantity(lineId, cartItemDetails.quantity + 1)} disabled={disabled} size="small" sx={{ width: 44, height: 44, border: "1px solid", borderColor: "primary.main", color: "primary.main" }}>
              <AddIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <CardMedia
        component="img"
        image={cartItemDetails.image || "/logo-icon.webp"}
        alt={cartItemDetails.name}
        sx={{ gridArea: "image", justifySelf: "end", alignSelf: "start", width: { xs: 80, sm: 98 }, height: { xs: 80, sm: 98 }, flexShrink: 0, borderRadius: "8px", objectFit: "cover", bgcolor: "action.hover" }}
      />
    </Card>
  );
}

export default CartItemCard;
