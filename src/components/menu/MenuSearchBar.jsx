// مكوّن واجهة `MenuSearchBar` ضمن مجموعة `menu`.
// MUI COMPONENTS
import { TextField } from "@mui/material";

// CONTEXTS
import { useMenu } from "../../context/MenuContext";
import { useLanguage } from "../../context/LanguageContext";

function MenuSearchBar() {
  const { searchQuery, setSearchQuery } = useMenu();
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <TextField
      fullWidth
      size="small"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      slotProps={{ htmlInput: { "aria-label": isEnglish ? "Search menu items" : "ابحث في أصناف المنيو" } }}
      placeholder={isEnglish ? "Search the menu..." : "ابحث عن صنفك المفضل..."}
      variant="outlined"
      sx={{
        background: "#f7f5f0",
        "& .MuiOutlinedInput-root": {
          borderRadius: "8px",
          "& fieldset": {
            borderColor: "divider",
          },
          "&.Mui-focused fieldset": {
            borderColor: "primary.main",
          },
        },
      }}
    />
  );
}

export default MenuSearchBar;
