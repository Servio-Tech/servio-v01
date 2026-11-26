import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
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
import { DashboardThemeProvider } from "../theme/DashboardTheme";
import OwnerAuthLayout from "../components/owner/OwnerAuthLayout";

const CURRENCIES = [
  { value: "SAR", labelKey: "currencySar" },
  { value: "AED", labelKey: "currencyAed" },
  { value: "USD", labelKey: "currencyUsd" },
];
const fieldSx = { mb: 1.35 };

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
  const [resendSucceeded, setResendSucceeded] = useState(false);
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
    if (loading) return;
    setLoading(true);
    setResendMessage("");
    setResendSucceeded(false);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: formData.email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setResendMessage(registrationErrorMessage(error, arabic));
      } else {
        setResendMessage(t("resendDone"));
        setResendSucceeded(true);
      }
    } catch (error) {
      setResendMessage(registrationErrorMessage(error, arabic));
    } finally {
      setLoading(false);
    }
  };

  if (emailSent)
    return (
      <DashboardThemeProvider direction={arabic ? "rtl" : "ltr"}>
        <OwnerAuthLayout arabic={arabic} authLabel={arabic ? "إنشاء حساب" : "CREATE ACCOUNT"} toggle={<LanguageToggle dark />}>
          <Box className="owner-auth-card MuiPaper-root" sx={{ p: { xs: 2.5, sm: 4 }, textAlign: "center" }}>
            <Box className="owner-auth-icon" sx={{ mx: "auto" }}>
              <EmailRoundedIcon />
            </Box>
            <Typography className="owner-eyebrow" sx={{ mb: 1 }}>
              {arabic ? "خطوة أخيرة" : "ONE LAST STEP"}
            </Typography>
            <Typography variant="h5" component="h2" fontWeight={900} sx={{ mb: 1 }}>
              {t("verifyEmail")}
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {t("sentActivation")}
            </Typography>
            <Typography fontWeight={900} sx={{ direction: "ltr", my: 1.5, overflowWrap: "anywhere" }}>
              {formData.email}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, mb: 2.5 }}>
              {t("activationHelp")}
            </Typography>
            {resendMessage && (
              <Alert severity={resendSucceeded ? "success" : "error"} role={resendSucceeded ? "status" : "alert"} sx={{ mb: 2, textAlign: "start" }}>
                {resendMessage}
              </Alert>
            )}
            <Button
              fullWidth
              variant="contained"
              onClick={resendConfirmation}
              disabled={loading}
              sx={{ minHeight: 48, fontWeight: 900 }}
              startIcon={loading ? <CircularProgress size={17} color="inherit" /> : undefined}
            >
              {loading ? t("loading") : t("resend")}
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => navigate("/login")}
              sx={{ mt: 1, minHeight: 44, fontWeight: 800 }}
            >
              {t("backToLogin")}
            </Button>
          </Box>
        </OwnerAuthLayout>
      </DashboardThemeProvider>
    );

  return (
    <DashboardThemeProvider direction={arabic ? "rtl" : "ltr"}>
      <OwnerAuthLayout arabic={arabic} authLabel={arabic ? "إنشاء حساب" : "CREATE ACCOUNT"} toggle={<LanguageToggle dark />}>
        <Box className="owner-auth-card MuiPaper-root" sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography className="owner-eyebrow" sx={{ mb: 1 }}>
              {arabic ? "ابدأ مساحة عملك" : "SET UP YOUR WORKSPACE"}
            </Typography>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 950, mb: 0.7 }}>
              {t("createBusiness")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.8 }}>
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
                  color: "primary.light",
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
                    disabled={loading}
                    autoComplete="organization"
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
                    disabled={isSlugLocked || loading}
                    required
                    helperText={isSlugLocked
                      ? (arabic ? "يُنشأ تلقائيًا من الاسم. حرّره إذا لم يظهر رابط مناسب." : "Generated from the business name. Unlock it if you need to adjust the link.")
                      : (arabic ? "أحرف إنجليزية صغيرة وأرقام، مع شرطات عند الحاجة." : "Use lowercase English letters, numbers, and hyphens.")}
                    sx={fieldSx}
                    slotProps={{ input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            disabled={loading}
                            onClick={() => setIsSlugLocked((value) => !value)}
                            aria-label={isSlugLocked
                              ? (arabic ? "تمكين تعديل رابط النشاط" : "Enable business link editing")
                              : (arabic ? "قفل رابط النشاط" : "Lock business link")}
                          >
                            {isSlugLocked ? (
                              <LockRoundedIcon fontSize="small" />
                            ) : (
                              <LockOpenRoundedIcon
                                fontSize="small"
                                color="primary"
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
                    disabled={loading}
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
              <Divider sx={{ my: 1.8 }} />
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
                    disabled={loading}
                    autoComplete="name"
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
                    disabled={loading}
                    type="tel"
                    autoComplete="tel"
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
                    disabled={loading}
                    autoComplete="email"
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
                    disabled={loading}
                    autoComplete="new-password"
                    helperText={arabic ? "6 أحرف على الأقل" : "At least 6 characters"}
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
                            aria-label={showPassword
                              ? (arabic ? "إخفاء كلمة المرور" : "Hide password")
                              : (arabic ? "إظهار كلمة المرور" : "Show password")}
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
                startIcon={loading ? <CircularProgress size={17} color="inherit" /> : <StorefrontRoundedIcon />}
                sx={{ minHeight: 50, mt: 1, fontWeight: 900 }}
              >
                {loading ? t("loading") : t("registerSubmit")}
              </Button>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 3, textAlign: "center" }}
            >
              {t("haveAccount")}{" "}
              <Box
                component={RouterLink}
                to="/login"
                className="owner-auth-link"
                sx={{ fontWeight: 900 }}
              >
                {t("homeLogin")}
              </Box>
            </Typography>
        </Box>
      </OwnerAuthLayout>
    </DashboardThemeProvider>
  );
}
