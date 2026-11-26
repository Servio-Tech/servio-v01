// مكوّن واجهة `ItemDetailsDrawer` ضمن مجموعة `menu`.
import { FullscreenSwipeableDrawer as SwipeableDrawer } from "../common/FullscreenOverlays";
import { useEffect, useState } from "react";
import MenuItemImage from "./MenuItemImage";

// MUI COMPONENTS

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";

// ICONS
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

// CONTEXTS
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTenant } from "../../context/TenantContext";
import { useMenu } from "../../context/MenuContext";
import { buildAddonChoices, normalizeAddonLimit, toggleSelectedAddon } from "../../utils/menuItemOptions";

function ItemDetailsDrawer({ open, onClose, itemDetails }) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const { language } = useLanguage();
  const { slug, storeInfo } = useTenant();
  const { loadItemImage, items = [] } = useMenu();
  const [selectedAddons, setSelectedAddons] = useState([]);
  const isEnglish = language === "en";
  const addonChoices = buildAddonChoices(itemDetails, items);
  const maxAddons = normalizeAddonLimit(itemDetails?.max_addons, addonChoices.length);
  const currency = storeInfo?.currency || (isEnglish ? "SAR" : "ر.س");

  const handleIncrease = () => setQuantity((prev) => prev + 1);
  const handleDecrease = () => setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
  const handleAddonToggle = (choice) => {
    setSelectedAddons((current) => toggleSelectedAddon(current, choice, addonChoices, maxAddons));
  };

  const hasAllergy = itemDetails?.allergens && itemDetails.allergens.length > 0;
  const hasDraftAllergenData =
    slug === "mzaj-ryfy" && itemDetails?.tags?.includes("وصفة مبدئية");

  const bottomBarHeight = "112px";
  const formatPrice = (value) => Number(value || 0).toLocaleString(
    isEnglish ? "en-SA" : "ar-SA",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );

  useEffect(() => {
    if (open) {
      setQuantity(1);
      setSelectedAddons([]);
    }
  }, [open, itemDetails?.id]);

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen={true}
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            maxHeight: "90dvh",
            backgroundColor: "background.paper",
            overflow: "hidden",
            direction: isEnglish ? "ltr" : "rtl",
          },
        },
      }}
    >
      <Box
        sx={{
          maxHeight: `calc(90dvh - ${bottomBarHeight})`,
          overflowY: "auto",
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 8,
            insetInlineStart: "50%",
            transform: "translateX(-50%)",
            width: "40px",
            height: "4px",
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            borderRadius: "2px",
            zIndex: 11,
          }}
        />

        <IconButton
          onClick={onClose}
          aria-label={isEnglish ? "Close item details" : "إغلاق تفاصيل الصنف"}
          sx={{
            position: "absolute",
            top: 12,
            insetInlineEnd: 12,
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(4px)",
            "&:hover": { backgroundColor: "rgba(255, 255, 255, 1)" },
            zIndex: 10,
          }}
        >
          <CloseIcon />
        </IconButton>

        <MenuItemImage
          src={itemDetails?.image}
          alt={itemDetails?.name}
          imageLoading={itemDetails?.imageLoading}
          imageError={itemDetails?.imageError}
          loadImage={() => loadItemImage(itemDetails?.id)}
          height={250}
        />

        <Box sx={{ p: 2.5, pb: 3 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              mb: 1.5,
            }}
          >
            <Typography variant="h5" component="h2" sx={{ fontWeight: 850, lineHeight: 1.3 }}>
              {itemDetails?.name}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: "primary.main",
                whiteSpace: "nowrap",
                marginInlineStart: 2,
              }}
            >
              {formatPrice(itemDetails?.price)} {currency}
            </Typography>
          </Box>

          <Typography
            variant="body1"
            sx={{ color: "text.secondary", lineHeight: 1.8, mb: 2.5 }}
          >
            {itemDetails?.description}
          </Typography>

          {maxAddons > 0 && addonChoices.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Box>
                  <Typography fontWeight={850}>
                    {isEnglish ? "Optional add-ons" : "إضافات اختيارية"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isEnglish ? `Free · choose up to ${maxAddons}` : `مجانية · اختر حتى ${maxAddons}`}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`${selectedAddons.length} / ${maxAddons}`}
                  color={selectedAddons.length >= maxAddons ? "primary" : "default"}
                  sx={{ fontWeight: 800 }}
                />
              </Stack>
              <Box
                role="group"
                aria-label={isEnglish ? "Choose optional add-ons" : "اختر الإضافات الاختيارية"}
                sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
              >
                {addonChoices.map((choice) => {
                  const selected = selectedAddons.some((addon) => (
                    addon.id ? addon.id === choice.id : addon.name === choice.name
                  ));
                  return (
                    <Chip
                      key={choice.key}
                      label={choice.name}
                      clickable
                      aria-pressed={selected}
                      disabled={!selected && selectedAddons.length >= maxAddons}
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      onClick={() => handleAddonToggle(choice)}
                    />
                  );
                })}
              </Box>
              {quantity > 1 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  {isEnglish
                    ? "The selected add-ons apply to each item."
                    : "تُطبّق الإضافات المختارة على كل الكمية."}
                </Typography>
              )}
            </Box>
          )}

          {hasDraftAllergenData ? (
            <Alert
              severity="warning"
              icon={<WarningAmberIcon />}
              sx={{ borderRadius: "8px", mb: 3, fontWeight: 600 }}
            >
              {hasAllergy ? (
                <>
                  {isEnglish ? "Potential allergens based on the suggested recipe:" : "مسببات حساسية محتملة وفق الوصفة المقترحة:"}{" "}
                  {itemDetails.allergens.join(isEnglish ? ", " : "، ")}.{" "}
                  {isEnglish ? "This estimate is not verified against the kitchen’s ingredients; ask staff about ingredients and cross-contact." : "هذه القائمة تقديرية وغير مؤكدة بمكونات المطبخ؛ اسأل الموظف عن المكونات والتلامس العرضي."}
                </>
              ) : (
                isEnglish
                  ? "No common allergen is listed for the suggested recipe, but actual ingredients and cross-contact are unverified. Please ask staff before ordering."
                  : "لم يُحدَّد مسبب شائع في الوصفة المقترحة، لكن مكونات التحضير والتلامس العرضي غير مؤكدة. اسأل الموظف قبل الطلب."
              )}
            </Alert>
          ) : (
            hasAllergy && (
              <Alert
                severity="error"
                icon={<WarningAmberIcon />}
                sx={{ borderRadius: "8px", mb: 3, fontWeight: 600 }}
              >
                {isEnglish ? "This item contains these allergens: " : "يحتوي هذا الصنف على مسببات الحساسية: "}
                {itemDetails.allergens.join(isEnglish ? ", " : "، ")}
              </Alert>
            )
          )}
        </Box>
      </Box>

      <Box
        sx={{
          minHeight: bottomBarHeight,
          px: 2,
          py: 1.5,
          pb: "calc(12px + env(safe-area-inset-bottom, 0px))",
          backgroundColor: "background.paper",
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton
            aria-label={isEnglish ? "Decrease quantity" : "تقليل الكمية"}
            onClick={handleDecrease}
            size="small"
            sx={{ border: "1px solid", borderColor: "divider" }}
          >
            <RemoveIcon />
          </IconButton>

          <Typography
            aria-live="polite"
            aria-label={isEnglish ? `Quantity ${quantity}` : `الكمية ${quantity}`}
            variant="h6"
            sx={{ fontWeight: 700, minWidth: "24px", textAlign: "center" }}
          >
            {quantity}
          </Typography>

          <IconButton
            aria-label={isEnglish ? "Increase quantity" : "زيادة الكمية"}
            onClick={handleIncrease}
            size="small"
            sx={{
              border: "1px solid",
              borderColor: "primary.main",
              color: "primary.main",
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={() => {
            addToCart({ ...itemDetails, selected_addons: selectedAddons }, quantity);
            onClose();
            setQuantity(1);
            setSelectedAddons([]);
          }}
          sx={{
            flex: 1,
            borderRadius: "8px",
            fontWeight: 800,
            py: 1.2,
          }}
        >
          {isEnglish
            ? `Add · ${formatPrice(itemDetails?.price * quantity)} ${currency}`
            : `أضف للسلة · ${formatPrice(itemDetails?.price * quantity)} ${currency}`}
        </Button>
      </Box>
    </SwipeableDrawer>
  );
}

export default ItemDetailsDrawer;
