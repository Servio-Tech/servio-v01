// إعدادات الملف الشخصي للمدير مع حفظ فعلي في Supabase Auth والملف المرتبط.
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import SaveIcon from "@mui/icons-material/Save";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LockIcon from "@mui/icons-material/Lock";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import { useUser } from "../../../context/UserContext";
import { useLanguage } from "../../../context/LanguageContext";

function UserProfileSettings() {
  const { t, language } = useLanguage();
  const { user, updateUser } = useUser();
  const isCashier = user?.role === "cashier";
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    if (!user) return;
    setFormData((previous) => ({
      ...previous,
      full_name: user.full_name || user.name || "",
      email: user.email || "",
      phone: user.phone || "",
    }));
  }, [user]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || isCashier) return;
    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setToast({ open: true, message: t("managerPasswordMismatch"), severity: "error" });
      return;
    }
    if (formData.new_password && formData.new_password.length < 6) {
      setToast({ open: true, message: t("managerPasswordTooShort"), severity: "error" });
      return;
    }
    if ((formData.new_password || formData.email.trim().toLowerCase() !== user?.email?.toLowerCase()) && !formData.current_password) {
      setToast({ open: true, message: t("managerCurrentPasswordRequired"), severity: "error" });
      return;
    }

    setSaving(true);
    try {
      const result = await updateUser({ ...formData, email: formData.email.trim() });
      if (result?.error) {
        setToast({ open: true, message: result.error.message || t("genericLoginError"), severity: "error" });
        return;
      }
      setToast({
        open: true,
        message: result?.needsEmailConfirmation ? t("managerEmailConfirmation") : t("managerSaved"),
        severity: "success",
      });
      setFormData((previous) => ({ ...previous, current_password: "", new_password: "", confirm_password: "" }));
    } catch (error) {
      setToast({ open: true, message: error?.message || t("genericLoginError"), severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const passwordAdornment = (visible, toggle) => (
    <InputAdornment position="end">
      <IconButton type="button" onClick={toggle} edge="end" size="small" aria-label={visible ? t("hidePassword") : t("showPassword")}>
        {visible ? <VisibilityOff /> : <Visibility />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 920, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", mb: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
          <Avatar
            aria-hidden="true"
            sx={{ width: 56, height: 56, bgcolor: "rgba(244, 121, 32, 0.16)", color: "primary.light", fontWeight: 850, border: "1px solid", borderColor: "rgba(244, 121, 32, 0.28)" }}
          >
            {(formData.full_name.trim() || formData.email || "?").charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 850, letterSpacing: language === "ar" ? 0 : ".08em", lineHeight: 1.4 }}>
              {language === "ar" ? "الحساب" : "ACCOUNT"}
            </Typography>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 900, lineHeight: 1.25 }}>
              {language === "ar" ? "الملف الشخصي والأمان" : "Profile and security"}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: { xs: 240, sm: 420 } }}>
              {formData.full_name || formData.email || (language === "ar" ? "بيانات حسابك" : "Your account details")}
            </Typography>
          </Box>
        </Stack>
        <Chip
          icon={<PersonIcon />}
          label={isCashier ? (language === "ar" ? "حساب كاشير" : "Cashier account") : (language === "ar" ? "حساب مدير" : "Manager account")}
          variant="outlined"
          color="primary"
          sx={{ alignSelf: { xs: "flex-start", sm: "center" }, fontWeight: 750 }}
        />
      </Stack>

      {isCashier && <Alert severity="info" sx={{ mb: 2 }}>{t("managerCashierProfileHint")}</Alert>}

      <Stack spacing={2}>
        <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 850 }}>
              {language === "ar" ? "المعلومات الشخصية" : "Personal information"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {language === "ar" ? "البيانات التي تظهر في حسابك ووسائل التواصل." : "The details associated with your account."}
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label={t("managerFullName")} name="full_name" value={formData.full_name}
                onChange={handleInputChange} disabled={isCashier || saving} required size="small"
                autoComplete="name" helperText={isCashier ? t("managerManagerOnly") : ""}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label={t("email")} name="email" type="email" value={formData.email}
                onChange={handleInputChange} disabled={isCashier || saving} required size="small"
                autoComplete="email" slotProps={{ htmlInput: { dir: "ltr" }, input: { startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" /></InputAdornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label={t("managerPhone")} name="phone" type="tel" value={formData.phone}
                onChange={handleInputChange} disabled={isCashier || saving} size="small"
                autoComplete="tel" slotProps={{ htmlInput: { dir: "ltr" }, input: { startAdornment: <InputAdornment position="start"><PhoneIcon fontSize="small" /></InputAdornment> } }}
              />
            </Grid>
          </Grid>
        </Paper>

        {!isCashier && (
          <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.35 }}>
              <SecurityRoundedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 850 }}>
                {language === "ar" ? "الأمان وكلمة المرور" : "Security and password"}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {language === "ar" ? "اترك الحقول فارغة إذا لم ترغب بتغيير كلمة المرور." : "Leave these fields blank if you do not want to change your password."}
            </Typography>
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              {t("managerSensitiveChangeHint")}
            </Alert>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth type={showCurrentPassword ? "text" : "password"} label={t("managerCurrentPassword")}
                  name="current_password" value={formData.current_password} onChange={handleInputChange}
                  disabled={saving} size="small" autoComplete="current-password"
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" /></InputAdornment>, endAdornment: passwordAdornment(showCurrentPassword, () => setShowCurrentPassword((value) => !value)) } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth type={showNewPassword ? "text" : "password"} label={t("managerNewPassword")}
                  name="new_password" value={formData.new_password} onChange={handleInputChange}
                  disabled={saving} size="small"
                  slotProps={{ htmlInput: { minLength: 6, autoComplete: "new-password" }, input: { startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" /></InputAdornment>, endAdornment: passwordAdornment(showNewPassword, () => setShowNewPassword((value) => !value)) } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth type={showNewPassword ? "text" : "password"} label={t("managerConfirmPassword")}
                  name="confirm_password" value={formData.confirm_password} onChange={handleInputChange}
                  disabled={saving} size="small"
                  slotProps={{ htmlInput: { autoComplete: "new-password" }, input: { startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" /></InputAdornment> } }}
                />
              </Grid>
            </Grid>
          </Paper>
        )}

        {!isCashier && (
          <Stack direction={{ xs: "column-reverse", sm: "row" }} sx={{ justifyContent: "flex-end", alignItems: "stretch", gap: 1 }}>
            <Button type="submit" variant="contained" startIcon={saving ? <CircularProgress size={17} color="inherit" /> : <SaveIcon />} disabled={saving} sx={{ px: 3, width: { xs: "100%", sm: "auto" }, minHeight: 46, fontWeight: 800 }}>
              {saving ? t("managerSaving") : t("managerSave")}
            </Button>
          </Stack>
        )}
      </Stack>
      <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast((previous) => ({ ...previous, open: false }))}>
        <Alert severity={toast.severity} variant="filled" sx={{ width: "100%" }}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default UserProfileSettings;
