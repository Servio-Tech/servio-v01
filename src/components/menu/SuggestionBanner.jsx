import { useEffect, useState } from "react";
import { useSuggestions } from "../../context/SuggestionsContext";
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../context/LanguageContext";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Badge from "@mui/material/Badge";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";

function SuggestionBanner() {
  const { suggestedItems } = useSuggestions();
  const { addToCart } = useCart();
  const { language } = useLanguage();
  const isArabic = language !== "en";
  const currentSuggestion = suggestedItems?.[0];
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (currentSuggestion) setExpanded(true);
  }, [currentSuggestion?.id]);

  if (!currentSuggestion) return null;

  if (!expanded) {
    return (
      <IconButton
        aria-label={isArabic ? `عرض الاقتراحات (${suggestedItems.length})` : `Show suggestions (${suggestedItems.length})`}
        onClick={() => setExpanded(true)}
        sx={{
          position: "fixed",
          zIndex: 1200,
          insetInlineEnd: 12,
          bottom: "calc(90px + env(safe-area-inset-bottom, 0px))",
          width: 48,
          height: 48,
          bgcolor: "#fffaf1",
          color: "#c85c2c",
          border: "1px solid rgba(200, 92, 44, .28)",
          boxShadow: "0 6px 20px rgba(33, 29, 26, .2)",
          "&:hover": { bgcolor: "#f8e5d8" },
        }}
      >
        <Badge
          badgeContent={suggestedItems.length}
          color="error"
          max={9}
          overlap="circular"
          sx={{ "& .MuiBadge-badge": { fontWeight: 900, minWidth: 17, height: 17, fontSize: ".62rem" } }}
        >
          <AutoAwesomeIcon />
        </Badge>
      </IconButton>
    );
  }

  return (
    <Paper
      elevation={3}
      sx={{
        position: "fixed",
        zIndex: 1200,
        left: "50%",
        bottom: "calc(82px + env(safe-area-inset-bottom, 0px))",
        transform: "translateX(-50%)",
        width: "calc(100% - 16px)",
        maxWidth: "720px",
        minHeight: "72px",
        bgcolor: "background.paper",
        borderRadius: "16px",
        px: 1.2,
        py: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        border: "1.5px solid",
        borderColor: "primary.main",
        boxShadow: "0 8px 26px rgba(33, 29, 26, .2)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflow: "hidden", minWidth: 0 }}>
        <Box
          component="img"
          src={currentSuggestion.image || "/logo-icon.webp"}
          alt={currentSuggestion.name}
          sx={{ width: 42, height: 42, borderRadius: "12px", objectFit: "cover", flexShrink: 0 }}
        />
        <Box sx={{ overflow: "hidden", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.55, mb: 0.2, minWidth: 0 }}>
            <AutoAwesomeIcon sx={{ fontSize: ".78rem", color: "primary.main", flexShrink: 0 }} />
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800, fontSize: ".67rem", lineHeight: 1, whiteSpace: "nowrap" }}>
              {isArabic ? "قد يناسب طلبك" : "You may like this"}
            </Typography>
            <Chip
              size="small"
              label={isArabic ? "اختيار سريع" : "Quick pick"}
              color="primary"
              sx={{ display: { xs: "none", sm: "inline-flex" }, height: 18, borderRadius: "7px", fontSize: ".58rem", fontWeight: 900, "& .MuiChip-label": { px: 0.65 } }}
            />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 750, fontSize: ".82rem", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentSuggestion.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: ".7rem", lineHeight: 1 }}>
            +{Number(currentSuggestion.price).toFixed(2)} {isArabic ? "ر.س" : "SAR"}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={() => addToCart(currentSuggestion)}
          sx={{ borderRadius: "12px", fontWeight: 800, px: 1.25, py: 0.45, minWidth: "auto", fontSize: ".72rem", whiteSpace: "nowrap" }}
        >
          {isArabic ? "اطلب" : "Order"}
        </Button>
        <IconButton
          size="small"
          aria-label={isArabic ? "طي الاقتراح" : "Collapse suggestion"}
          onClick={() => setExpanded(false)}
          sx={{ color: "text.secondary", p: 0.55 }}
        >
          <CloseIcon sx={{ fontSize: "1rem" }} />
        </IconButton>
      </Box>
    </Paper>
  );
}

export default SuggestionBanner;
