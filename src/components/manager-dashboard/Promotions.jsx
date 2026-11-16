// مكون قسم ادارة العروض Promotions
// CONTEXT
import { useLanguage } from "../../context/LanguageContext";

// MUI COMPONENTS
import { Avatar, Box, Button, Card, Stack, Typography } from "@mui/material";

// MUI ICONS
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";

function Promotions() {
  const { language } = useLanguage();
  const isArabic = language !== "en";

  return (
    <Box sx={{ p: { xs: 0, md: 0.5 }, minWidth: 0 }}>
      <Stack spacing={2.25}>
        {/* HEADER */}
        <Card
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.75 },
            borderRadius: { xs: 3, md: 4 },
            border: "1px solid rgba(255,255,255,.78)",
            background:
              "linear-gradient(125deg, rgba(255,255,255,.92) 0%, rgba(255,249,242,.92) 100%)",
            boxShadow: "0 16px 42px rgba(23,26,47,.055)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ minWidth: 0, alignItems: "center" }}
            >
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: "rgba(244,121,32,.12)",
                  color: "primary.main",
                }}
              >
                <LocalOfferOutlinedIcon />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 950, letterSpacing: "-.02em" }}
                >
                  {isArabic ? "إدارة العروض" : "Promotions & Offers"}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.4, maxWidth: 760 }}
                >
                  {isArabic
                    ? "أنشئ عروضاً وباقات وخصومات مخصصة لزيادة المبيعات، وحدد مواعيدها والأصناف المشمولة بها."
                    : "Create custom discounts, combo deals, and limited-time offers to boost sales across your menu."}
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              sx={{
                borderRadius: 2.5,
                fontWeight: 900,
                whiteSpace: "nowrap",
                minHeight: 44,
              }}
            >
              {isArabic ? "إنشاء عرض جديد" : "Create new offer"}
            </Button>
          </Stack>
        </Card>

        {/* KPIs CARDS */}
      </Stack>
    </Box>
  );
}

export default Promotions;