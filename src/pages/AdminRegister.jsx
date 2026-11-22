import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import LanguageToggle from "../components/LanguageToggle";
import { useLanguage } from "../context/LanguageContext";
import supabase from "../supabase";
import { slugifyName } from "../utils/slug";
import { registrationErrorMessage, validateAdminRegistration } from "../utils/registrationErrors";

const CURRENCIES = [
  { value: "SAR", labelKey: "currencySar" },
  { value: "AED", labelKey: "currencyAed" },
  { value: "USD", labelKey: "currencyUsd" },
];
const fieldSx = {
  mb: 1.35,
  "& .MuiOutlinedInput-root": {
    borderRadius: "14px",
    bgcolor: "#fffdf8",
    color: "#171512",
    transition: "background-color .18s ease",
    "& fieldset": { borderColor: "#ded8cb" },
    "&:hover fieldset": { borderColor: "#b8ab99" },
    "&.Mui-focused fieldset": { borderColor: "#c85b2a", borderWidth: "1.5px" },
  },
  "& .MuiInputLabel-root": { color: "#706d66" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#a74621" },
  "& .MuiInputAdornment-root, & .MuiSvgIcon-root": { color: "#706d66" },
};

function BrandIntro({ t, arabic }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: { xs: "none", md: "flex" },
        minHeight: "100vh",
        p: { md: 5, lg: 6 },
        color: "#171512",
        position: "relative",
        overflow: "hidden",
        borderInlineEnd: "1px solid #e8e2d7",
        background:
          "radial-gradient(circle at 10% 86%, rgba(200,91,42,.12), transparent 40%), #f1e8dc",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          top: -230,
          insetInlineEnd: -180,
          border: "1px solid rgba(33,30,26,.09)",
          boxShadow:
            "0 0 0 80px rgba(33,30,26,.025), 0 0 0 160px rgba(33,30,26,.018)",
        }}
      />
      <Stack

        sx={{ position: "relative", zIndex: 1, width: "100%" , justifyContent: "space-between"}}
      >
        <Box>
          <Stack direction="row"  spacing={1.2} sx={{ alignItems: "center" }}>
            <Box
              component="img"
              src="/logo192.png"
              alt="SERVIO"
              sx={{ width: 54, height: 54, objectFit: "contain" }}
            />
            <Typography
              sx={{
                fontWeight: 1000,
                fontSize: "1.55rem",
                letterSpacing: "-.06em",
                color: "#171512",
              }}
            >
              SERVIO
            </Typography>
          </Stack>
          <Typography
            sx={{
              mt: 6,
              color: "#a74621",
              fontWeight: 900,
              letterSpacing: ".08em",
              fontSize: ".78rem",
            }}
          >
            {arabic ? "ابدأ من هنا" : "START HERE"}
          </Typography>
          <Typography
            sx={{
              mt: 1.5,
              fontSize: { md: "3.4rem", lg: "4.2rem" },
              lineHeight: 1.02,
              fontWeight: 1000,
              letterSpacing: "-.07em",
              maxWidth: 560,
              color: "#171512",
            }}
          >
            {arabic
              ? "مكانك يستحق تشغيلًا أوضح."
              : "Your venue deserves clearer operations."}
          </Typography>
          <Typography
            sx={{
              mt: 2.5,
              color: "#706d66",
              lineHeight: 1.9,
              maxWidth: 500,
              fontSize: "1.08rem",
            }}
          >
            {t("registerIntro")}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "#83796e" }}>
          {t("homeFooterText")}
        </Typography>
      </Stack>
    </Box>
  );
}

function AuthCard({ children }) {
  return (
    <Card
      elevation={0}
      sx={{
        width: "100%",
        maxWidth: 620,
        borderRadius: 4,
        border: "1px solid #e8e2d7",
        bgcolor: "#fffdf8",
        boxShadow: "0 24px 70px rgba(35,29,22,.09)",
        color: "#171512",
      }}
    >
      {children}
    </Card>
  );
}

export default function AdminRegister() {
  const { t, language } = useLanguage();
  const arabic = language !== "en";
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    store_name: "",
    store_slug: "",
    currency: "SAR",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSlugLocked, setIsSlugLocked] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => {
      const next = { ...previous, [name]: value };
      if (name === "store_name" && isSlugLocked)
        next.store_slug = slugifyName(value);
      return next;
    });
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setErrorMsg("");
    const validationError = validateAdminRegistration(formData);
    if (validationError) {
      const messages = {
        required: t("required"),
        email: arabic ? "يرجى إدخال بريد إلكتروني صحيح." : "Enter a valid email address.",
        password: arabic ? "يجب ألا تقل كلمة المرور عن 6 أحرف." : "Password must be at least 6 characters.",
        storeName: arabic ? "يجب ألا يقل اسم النشاط عن حرفين." : "Business name must be at least 2 characters.",
        slug: arabic ? "رابط النشاط غير صالح. استخدم أحرفًا إنجليزية صغيرة وأرقامًا وافصل بينها بشرطة عند الحاجة." : "Business link is invalid. Use lowercase English letters and numbers, with hyphens if needed.",
      };
      setErrorMsg(messages[validationError]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: formData.full_name.trim(),
            store_name: formData.store_name.trim(),
            store_slug: formData.store_slug.trim().toLowerCase(),
            phone: formData.phone.trim(),
            currency: formData.currency || "SAR",
            role: "admin",
          },
        },
      });
      if (error) {
        setErrorMsg(registrationErrorMessage(error, arabic));
      } else if (data?.session) {
        const { error: provisioningError } = await supabase.rpc("ensure_profile_for_current_user");
        if (provisioningError) setErrorMsg(registrationErrorMessage(provisioningError, arabic));
        else navigate("/manager");
      } else if (data?.user) {
        setEmailSent(true);
      } else {
        setErrorMsg(registrationErrorMessage(null, arabic));
      }
    } catch (error) {
      setErrorMsg(registrationErrorMessage(error, arabic));
    } finally {
      setLoading(false);
    }
  };
  const resendConfirmation = async () => {
    setLoading(true);
    setResendMessage("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: formData.email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResendMessage(error ? error.message : t("resendDone"));
    setLoading(false);
  };

  if (emailSent)
    return (
      <Box
        dir={arabic ? "rtl" : "ltr"}
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          p: { xs: 2, md: 4 },
          bgcolor: "#f7f4ed",
          background:
            "radial-gradient(circle at 90% 0%, rgba(200,91,42,.10), transparent 30%)",
        }}
      >
        <Box sx={{ position: "absolute", top: { xs: 14, sm: 20 }, insetInlineEnd: { xs: 14, sm: 20 } }}><LanguageToggle compact /></Box>
        <AuthCard>
          <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: "center" }}>
            <Box
              component="img"
              src="/logo192.png"
              alt="SERVIO"
              sx={{ width: 64, height: 64, objectFit: "cover", borderRadius: "14px", mb: 1 }}
            />
            <Typography
              sx={{
                fontWeight: 1000,
              fontSize: "1.5rem",
              letterSpacing: "-.06em",
              color: "#171512",
              mb: 3,
            }}
          >
            SERVIO
          </Typography>
            <Typography variant="h5" fontWeight={950} mb={1} sx={{ color: "#171512" }}>
              {t("verifyEmail")}
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.9, color: "#706d66" }}>
              {t("sentActivation")}
            </Typography>
            <Typography fontWeight={900} sx={{ direction: "ltr", my: 1 }}>
              {formData.email}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.8, mb: 3, color: "#706d66" }}
            >
              {t("activationHelp")}
            </Typography>
            {resendMessage && (
              <Alert
                severity={resendMessage.startsWith("تم") ? "success" : "error"}
                sx={{ mb: 2, textAlign: "right" }}
              >
                {resendMessage}
              </Alert>
            )}
            <Button
              fullWidth
              variant="contained"
              onClick={resendConfirmation}
              disabled={loading}
              sx={{ py: 1.35, borderRadius: 99, bgcolor: "#c85b2a", color: "#fff", "&:hover": { bgcolor: "#ad4820" } }}
            >
              {loading ? t("loading") : t("resend")}
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => navigate("/login")}
              sx={{ mt: 1, color: "#a74621", fontWeight: 800 }}
            >
              {t("backToLogin")}
            </Button>
          </CardContent>
        </AuthCard>
      </Box>
    );

  return (
    <Box
      dir={arabic ? "rtl" : "ltr"}
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "#f7f4ed",
        background:
          "radial-gradient(circle at 90% 0%, rgba(200,91,42,.10), transparent 30%)",
      }}
    >
      <BrandIntro t={t} arabic={arabic} />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 1.5, sm: 3, md: 5 },
          position: "relative",
          bgcolor: "transparent",
        }}
      >
        <Box sx={{ position: "absolute", top: { xs: 14, sm: 20 }, insetInlineEnd: { xs: 14, sm: 20 }, zIndex: 2 }}>
          <LanguageToggle compact />
        </Box>
        <Stack

          direction="row"
          spacing={1}
          sx={{ mb: 2.5, mt: { xs: 2, sm: 0 }, display: { xs: "flex", md: "none" }, alignItems: "center", justifyContent: "center" }}
        >
          <Box
            component="img"
            src="/logo192.png"
            alt="SERVIO"
            sx={{ width: 38, height: 38, objectFit: "cover", borderRadius: "10px" }}
          />
          <Typography
            sx={{
              fontWeight: 1000,
              fontSize: "1.5rem",
              letterSpacing: "-.06em",
              color: "#171512",
            }}
          >
            SERVIO
          </Typography>
        </Stack>
        <AuthCard>
          <CardContent sx={{ p: { xs: 2.2, sm: 4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 950, mb: 0.7, color: "#171512" }}>
              {t("createBusiness")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8, color: "#706d66" }}>
              {arabic
                ? "أنشئ مساحة نشاطك خلال دقائق، ثم أضف المنيو والطاولات والكاشير."
                : "Create your workspace in minutes, then add your menu, tables, and cashiers."}
            </Typography>
            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {errorMsg}
              </Alert>
            )}
            <Box component="form" onSubmit={handleSubmit}>
              <Typography
                variant="subtitle2"
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "center",
                  color: "#a74621",
                  fontWeight: 950,
                  mb: 1.5,
                }}
              >
                <StorefrontRoundedIcon fontSize="small" />
                {t("storeData")}
              </Typography>
              <Grid container spacing={1.3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t("cafeName")}
                    name="store_name"
                    value={formData.store_name}
                    onChange={handleChange}
                    required
                    sx={fieldSx}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t("slugName")}
                    name="store_slug"
                    value={formData.store_slug}
                    onChange={handleChange}
                    disabled={isSlugLocked}
                    required
                    sx={fieldSx}

                   slotProps={{ input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setIsSlugLocked((value) => !value)}
                          >
                            {isSlugLocked ? (
                              <LockRoundedIcon fontSize="small" />
                            ) : (
                              <LockOpenRoundedIcon
                                fontSize="small"
                                sx={{ color: "#c85b2a" }}
                              />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    } }}/>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label={t("currency")}
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    sx={fieldSx}
                  >
                    {CURRENCIES.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <Divider sx={{ my: 1.8, borderColor: "#e8e2d7" }} />
              <Typography
                variant="subtitle2"
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "center",
                  color: "primary.main",
                  fontWeight: 950,
                  mb: 1.5,
                }}
              >
                <PersonRoundedIcon fontSize="small" />
                {t("ownerData")}
              </Typography>
              <Grid container spacing={1.3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t("fullName")}
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    sx={fieldSx}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t("phone")}
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    sx={fieldSx}

                   slotProps={{ input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    } }}/>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="email"
                    label={t("email")}
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    sx={fieldSx}

                   slotProps={{ input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    } }}/>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type={showPassword ? "text" : "password"}
                    label={t("password")}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    sx={fieldSx}

                   slotProps={{ input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((value) => !value)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    } }}/>
                </Grid>
              </Grid>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ py: 1.45, borderRadius: 99, fontWeight: 900, bgcolor: "#c85b2a", color: "#fff", boxShadow: "0 10px 24px rgba(200,91,42,.18)", "&:hover": { bgcolor: "#ad4820", boxShadow: "0 12px 26px rgba(200,91,42,.24)" } }}
              >
                {loading ? t("loading") : t("registerSubmit")}
              </Button>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
              sx={{ mt: 3 }}
            >
              {t("haveAccount")}{" "}
              <Box
                component={RouterLink}
                to="/login"
                sx={{
                  color: "#a74621",
                  fontWeight: 900,
                  textDecoration: "none",
                }}
              >
                {t("homeLogin")}
              </Box>
            </Typography>
          </CardContent>
        </AuthCard>
      </Box>
    </Box>
  );
}
