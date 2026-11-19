// مكوّن واجهة `MenuSearchBar` ضمن مجموعة `menu`.
// MUI COMPONENTS
import { TextField } from "@mui/material";

// CONTEXTS
import { useMenu } from "../../context/MenuContext";
import { useLanguage } from "../../context/LanguageContext";

function MenuSearchBar() {
  const { searchQuery, setSearchQuery } = useMenu();
  const { language } = useLanguage();

  return (
    <TextField
      fullWidth
      size="small"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder={language === "en" ? "Search for your favorite item..." : "ابحث عن صنفك المفضل..."}
      aria-label={language === "en" ? "Search menu" : "البحث في المنيو"}
      variant="outlined"
      sx={{
        background: "rgba(248,249,250,.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        "& .MuiOutlinedInput-root": {
          "& fieldset": {
            borderColor: "divider",
          },
          "&.Mui-focused fieldset": {
            borderColor: "secondary.light",
          },
        },
      }}
    />
  );
}

export default MenuSearchBar;
