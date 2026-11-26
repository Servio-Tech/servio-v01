import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useLanguage } from "../context/LanguageContext";

/** زر لغة موحّد يعمل على الخلفيات الفاتحة والداكنة. */
export default function LanguageToggle({ compact = false, dark = false }) {
  const { language, setLanguage, t } = useLanguage();
  const buttonSize = compact ? 30 : 38;
  const buttonStyles = {
    border: 0,
    borderRadius: 99,
    minWidth: buttonSize,
    minHeight: buttonSize,
    px: compact ? 0.55 : 1,
    py: compact ? 0.25 : 0.35,
    fontSize: compact ? ".67rem" : ".72rem",
    fontWeight: 900,
    color: dark ? "rgba(255,255,255,.78)" : "text.secondary",
    transition: "background-color .18s ease, color .18s ease, box-shadow .18s ease",
    "&.Mui-selected": {
      bgcolor: dark ? "primary.main" : "secondary.main",
      color: "#fff",
      boxShadow: dark ? "0 3px 10px rgba(244,121,32,.28)" : "none",
      "&:hover": { bgcolor: dark ? "primary.dark" : "secondary.dark" },
    },
    "&:focus-visible": {
      outline: "2px solid",
      outlineColor: dark ? "primary.light" : "secondary.main",
      outlineOffset: 2,
    },
  };

  return (
    <ToggleButtonGroup
      exclusive
      value={language}
      onChange={(_, value) => value && setLanguage(value)}
      size="small"
      aria-label={t("language")}
      sx={{
        direction: "ltr",
        border: `1px solid ${dark ? "rgba(255,255,255,.24)" : "rgba(23,26,47,.14)"}`,
        borderRadius: 99,
        p: "2px",
        backgroundColor: dark ? "#292b31" : "#ffffff",
      }}
    >
      <ToggleButton value="ar" aria-label={t("arabicLanguage")} sx={buttonStyles}>
        ع
      </ToggleButton>
      <ToggleButton value="en" aria-label={t("englishLanguage")} sx={buttonStyles}>
        EN
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
