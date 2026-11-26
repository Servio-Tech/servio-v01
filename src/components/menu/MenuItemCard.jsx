// مكوّن واجهة `MenuItemCard` ضمن مجموعة `menu`.
// HOOKS
import { useState } from "react";

// COMPONENTS
import ItemDetailsDrawer from "./ItemDetailsDrawer";
import MenuItemImage from "./MenuItemImage";
import { useMenu } from "../../context/MenuContext";

// MUI COMPONENTS
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";

// ICONS
import AddIcon from "@mui/icons-material/Add";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

// CONTEXTS
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTenant } from "../../context/TenantContext";
import { buildAddonChoices, normalizeAddonLimit } from "../../utils/menuItemOptions";

function MenuItemCard({ itemDetails, priority = false }) {
  const { addToCart } = useCart();
  const { loadItemImage, items = [] } = useMenu();
  const { language } = useLanguage();
  const { storeInfo } = useTenant();
  const isArabic = language !== "en";
  const currency = storeInfo?.currency || (isArabic ? "ر.س" : "SAR");
  const formattedPrice = Number(itemDetails.price || 0).toLocaleString(
    isArabic ? "ar-SA" : "en-SA",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );

  const hasAllergy = itemDetails.allergens && itemDetails.allergens.length > 0;
  const addonChoices = buildAddonChoices(itemDetails, items);
  const needsCustomization =
    normalizeAddonLimit(itemDetails.max_addons, addonChoices.length) > 0 &&
    addonChoices.length > 0;

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <Card
        id={`customer-menu-item-${itemDetails.id}`}
        className="customer-menu-item-card"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr) 100px", sm: "minmax(0, 1fr) 124px" },
          gap: 1.5,
        }}
      >
        <Box
          className="customer-menu-item-content"
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <Box
            component="button"
            type="button"
            className="customer-menu-item-open"
            onClick={() => setIsDrawerOpen(true)}
            aria-haspopup="dialog"
          >
            <Typography
              variant="subtitle1"
              component="span"
              className="customer-menu-item-title"
              sx={{
                fontWeight: 850,
                mb: 0.55,
                fontSize: "1.02rem",
                lineHeight: 1.35,
                color: "text.primary",
                overflowWrap: "anywhere",
              }}
            >
              {itemDetails.name}
            </Typography>
            <Typography
              variant="body2"
              component="span"
              className="customer-menu-item-description"
              sx={{
                color: "text.secondary",
                fontSize: "0.82rem",
                fontWeight: 550,
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {itemDetails.description}
            </Typography>
          </Box>

          <Box
            className="customer-menu-item-actions"
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1,
              mt: 1.4,
            }}
          >
            <Typography
              variant="subtitle2"
              className="customer-menu-item-price"
              sx={{
                fontWeight: 900,
                color: "primary.main",
                fontSize: ".96rem",
                whiteSpace: "nowrap",
              }}
            >
              {formattedPrice} {currency}
            </Typography>

            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (needsCustomization) {
                  setIsDrawerOpen(true);
                  return;
                }
                addToCart(itemDetails);
              }}
              variant="contained"
              size="small"
              startIcon={<AddIcon sx={{ ml: 0.5, mr: -0.5 }} />}
              sx={{
                backgroundColor: "primary.main",
                color: "primary.contrastText",
                borderRadius: "8px",
                px: { xs: 1, sm: 1.5 },
                py: 0.65,
                minHeight: 38,
                fontWeight: 800,
                fontSize: { xs: ".7rem", sm: ".8rem" },
                boxShadow: "0 4px 10px rgba(244, 121, 32, .18)",
                "&:hover": {
                  backgroundColor: "primary.dark",
                  boxShadow: "0 6px 14px rgba(244, 121, 32, .25)",
                },
              }}
            >
              {needsCustomization
                ? (isArabic ? "اختر الإضافات" : "Customize")
                : (isArabic ? "أضف للسلة" : "Add to cart")}
            </Button>
          </Box>
        </Box>

        <Box
          component="button"
          type="button"
          className="customer-menu-item-open"
          onClick={() => setIsDrawerOpen(true)}
          aria-label={isArabic ? `عرض تفاصيل ${itemDetails.name}` : `View ${itemDetails.name} details`}
          aria-haspopup="dialog"
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: { xs: 100, sm: 124 },
            minHeight: { xs: 100, sm: 124 },
            flexShrink: 0,
          }}
        >
          <Box className="customer-menu-item-image-frame">
            <MenuItemImage
              src={itemDetails.image}
              alt={itemDetails.name}
              imageLoading={itemDetails.imageLoading}
              imageError={itemDetails.imageError}
              loadImage={() => loadItemImage(itemDetails.id)}
              priority={priority}
              width={{ xs: 100, sm: 124 }}
              height={{ xs: 100, sm: 124 }}
              borderRadius="18px"
            />
          </Box>

          {hasAllergy && (
            <Tooltip title={isArabic ? "عرض تفاصيل مسببات الحساسية" : "View allergen details"} arrow>
              <Box
                sx={{
                  position: "absolute",
                  top: 6,
                  insetInlineStart: 6,
                  backgroundColor: "error.main",
                  color: "white",
                  borderRadius: "50%",
                  width: 26,
                  height: 26,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: "0px 2px 6px rgba(0,0,0,0.4)",
                  cursor: "pointer",
                }}
              >
                <WarningAmberIcon sx={{ fontSize: "1.1rem" }} />
              </Box>
            </Tooltip>
          )}
        </Box>
      </Card>

      <ItemDetailsDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        itemDetails={itemDetails}
      />
    </>
  );
}

export default MenuItemCard;
