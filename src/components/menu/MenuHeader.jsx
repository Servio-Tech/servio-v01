// COMPONENTS
import MenuSearchBar from "./MenuSearchBar";

// MUI COMPONENTS
import { Box, Stack, Chip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

// ICONS
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import LanguageToggle from "../LanguageToggle";

// CONTEXTS
import { useStore } from "../../context/StoreInfoContext";
import { useLanguage } from "../../context/LanguageContext";

function MenuHeader({ table }) {
  // Context: استخراج بيانات المحل (الاسم والوصف) لعرضها في الهيدر الرئيسي للمنيو
  const { storeInfo } = useStore();
  const { language } = useLanguage();
  const theme = useTheme();
  const isArabic = language !== "en";

  return (
    <Box className="customer-menu-header" sx={{ pb: 0.7 }}>
      {/* TITLE & TABLE NUMBER */}
      <Stack
        direction="row"
        className="customer-menu-brand-row"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          gap: 1.5,
        }}
      >
        {/* STORE NAME AND TAGLINE */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            component="h1"
            className="customer-menu-title"
            sx={{ fontWeight: 900, letterSpacing: "-0.7px", mb: 0.5, fontSize: { xs: "1.65rem", sm: "2rem" }, overflowWrap: "anywhere" }}
          >
            {storeInfo?.store_name || (isArabic ? "قائمة الطعام" : "Menu")}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
          {table && <Chip
            className="customer-menu-table-chip"
            icon={<PlaceOutlinedIcon sx={{ fontSize: "1.1rem !important" }} />}
            label={table === "كاشير" || table === "Cashier"
              ? (isArabic ? "طلب الكاشير" : "Cashier order")
              : (isArabic ? `طاولة ${table}` : `Table ${table}`)}
            sx={{ px: 1, py: 2, borderRadius: "8px", fontWeight: 700, fontSize: ".8rem" }}
          />}
          <LanguageToggle compact dark={theme.palette.mode === "dark"} />
        </Stack>
      </Stack>

      {/* MENU SEARCH BAR COMPONENT */}
      <Box className="customer-menu-search"><MenuSearchBar /></Box>
    </Box>
  );
}

export default MenuHeader;
