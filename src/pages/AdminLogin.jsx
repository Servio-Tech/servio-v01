import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, IconButton, InputAdornment, MenuItem, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import BackspaceRoundedIcon from "@mui/icons-material/BackspaceRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import supabase from "../supabase";
import LanguageToggle from "../components/LanguageToggle";
import { useLanguage } from "../context/LanguageContext";
import { DashboardThemeProvider } from "../theme/DashboardTheme";
import OwnerAuthLayout from "../components/owner/OwnerAuthLayout";
import { resolveSubscriptionProfile, subscriptionStatusMessage } from "../utils/subscriptionStatus";

const authErrorMessage = (message, t) => { const normalized = String(message || "").toLowerCase(); if (normalized.includes("email not confirmed") || normalized.includes("email_not_confirmed")) return t("confirmEmail"); if (normalized.includes("invalid login credentials")) return t("invalidCredentials"); return message || t("genericLoginError"); };
function AuthCard({ children }) { return <Card className="owner-auth-card" elevation={0} sx={{ width: "100%", maxWidth: 520 }}>{children}</Card>; }
export default function AdminLogin(props) {
  const { language } = useLanguage();
  return <DashboardThemeProvider direction={language === "ar" ? "rtl" : "ltr"}><AdminLoginContent {...props} /></DashboardThemeProvider>;
}
function AdminLoginContent({ cashierSlug: routeSlug }) {
  const { t, language } = useLanguage(); const arabic = language !== "en"; const { slug: paramSlug } = useParams(); const cashierSlug = routeSlug || paramSlug || ""; const navigate = useNavigate();
  const savedCashier = (() => { try { return JSON.parse(localStorage.getItem("servio_cashier") || "null"); } catch { return null; } })();
  const [role, setRole] = useState(cashierSlug ? "cashier" : "admin");
  const [adminData, setAdminData] = useState({ email: "", password: "" });
  const [cashierData, setCashierData] = useState({
    slug: cashierSlug || savedCashier?.slug || "",
    branch_slug: savedCashier?.branch_slug || new URLSearchParams(window.location.search).get("branch") || "",
    username: savedCashier?.username || "",
  });
  const [cashierBranches, setCashierBranches] = useState([]);
  const [cashierBranchesLoading, setCashierBranchesLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);

  const addPin = useCallback((value) => {
    setPin((current) => current.length < 6 ? `${current}${value}` : current);
  }, []);
  const removePin = useCallback(() => setPin((current) => current.slice(0, -1)), []);

  useEffect(() => {
    if (role !== "cashier" || !cashierData.slug.trim()) {
      setCashierBranches([]);
      setCashierBranchesLoading(false);
      return undefined;
    }

    let active = true;
    setErrorMsg("");
    setCashierBranchesLoading(true);
    const loadBranches = async () => {
      try {
        const { data, error } = await supabase.rpc("get_public_branches", {
          p_slug: cashierData.slug.trim().toLowerCase(),
        });
        if (!active) return;
        if (error) {
          setCashierBranches([]);
          setErrorMsg(arabic
            ? "تعذر تحميل فروع هذا النشاط. تأكد من رابط النشاط."
            : "Unable to load this business branches. Check the business slug.");
          return;
        }

        const next = data || [];
        setCashierBranches(next);
        if (cashierData.branch_slug && !next.some((branch) => branch.slug === cashierData.branch_slug)) {
          setCashierData((current) => ({ ...current, branch_slug: "" }));
        } else if (!cashierData.branch_slug && next.length === 1) {
          setCashierData((current) => ({ ...current, branch_slug: next[0].slug }));
        }
      } catch {
        if (active) {
          setCashierBranches([]);
          setErrorMsg(arabic
            ? "تعذر تحميل فروع هذا النشاط. تحقق من الاتصال وحاول مجددًا."
            : "Unable to load branches. Check your connection and try again.");
        }
      } finally {
        if (active) setCashierBranchesLoading(false);
      }
    };

    void loadBranches();
    return () => { active = false; };
  }, [role, cashierData.slug, cashierData.branch_slug, arabic]);

  useEffect(() => {
    if (role !== "cashier") return undefined;
    const onKeyDown = (event) => {
      if (loading) return;
      const target = event.target;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        addPin(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        removePin();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setPin("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [role, loading, addPin, removePin]);
  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setErrorMsg(""); setSuccessMsg(""); setCanResend(false);
    if (!adminData.email || !adminData.password) { setErrorMsg(t("required")); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: adminData.email.trim().toLowerCase(), password: adminData.password });
      if (error) {
        setErrorMsg(authErrorMessage(error.message, t));
        setCanResend(String(error.message).toLowerCase().includes("confirm"));
      } else if (!data?.session) {
        setErrorMsg(subscriptionStatusMessage("unavailable", arabic));
      } else {
        const result = await resolveSubscriptionProfile(supabase);
        if (result.status !== "active") setErrorMsg(subscriptionStatusMessage(result.status, arabic));
        else if (result.profile.role !== "admin") setErrorMsg(arabic ? "هذا الحساب غير مخصص للوحة الإدارة." : "This account cannot access the manager dashboard.");
        else navigate("/manager");
      }
    } catch {
      setErrorMsg(subscriptionStatusMessage("unavailable", arabic));
    } finally { setLoading(false); }
  };
  const resendConfirmation = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: adminData.email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setErrorMsg(authErrorMessage(error.message, t));
      else setSuccessMsg(t("resendDoneLogin"));
    } catch {
      setErrorMsg(t("genericLoginError"));
    } finally {
      setLoading(false);
    }
  };
  const handleCashierSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setErrorMsg("");
    if (!cashierData.slug || !cashierData.branch_slug || !cashierData.username || pin.length < 4) {
      setErrorMsg(t("pinInvalid"));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cashier-login", {
        body: {
          slug: cashierData.slug.trim().toLowerCase(),
          branch_slug: cashierData.branch_slug.trim().toLowerCase(),
          username: cashierData.username.trim().toLowerCase(),
          pin,
        },
      });
      if (error || !data?.email || !data?.password) {
        let serverMessage = data?.error;
        if (!serverMessage && error?.context && typeof error.context.json === "function") {
          serverMessage = (await error.context.json().catch(() => null))?.error;
        }
        setErrorMsg(serverMessage || t("cashierInvalid"));
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (authError) {
        setErrorMsg(authErrorMessage(authError.message, t));
        return;
      }
      if (!authData?.session) {
        setErrorMsg(subscriptionStatusMessage("unavailable", arabic));
        return;
      }

      const result = await resolveSubscriptionProfile(supabase);
      if (result.status !== "active") {
        setErrorMsg(subscriptionStatusMessage(result.status, arabic));
      } else if (result.profile.role !== "cashier") {
        setErrorMsg(arabic ? "هذا الحساب غير مخصص للوحة الكاشير." : "This account cannot access the cashier dashboard.");
      } else {
        localStorage.setItem("servio_cashier", JSON.stringify({
          slug: cashierData.slug,
          branch_slug: cashierData.branch_slug,
          username: cashierData.username,
        }));
        navigate("/dashboard");
      }
    } catch {
      setErrorMsg(subscriptionStatusMessage("unavailable", arabic));
    } finally {
      setLoading(false);
    }
  };
  const fieldSx = { mb: 1.8 };
  return (
    <OwnerAuthLayout arabic={arabic} toggle={<LanguageToggle dark />}>
      <AuthCard>
        <Tabs
          value={role}
          onChange={(_, value) => {
            setRole(value);
            setErrorMsg("");
            setSuccessMsg("");
          }}
          variant="fullWidth"
          aria-label={arabic ? "نوع الحساب" : "Account type"}
          sx={{ borderBottom: "1px solid rgba(235,220,198,.10)", "& .MuiTab-root": { minHeight: 58, fontWeight: 900 } }}
        >
          <Tab value="admin" label={t("authAdmin")} icon={<AdminPanelSettingsRoundedIcon />} iconPosition="start" />
          <Tab value="cashier" label={t("authCashier")} icon={<PointOfSaleRoundedIcon />} iconPosition="start" />
        </Tabs>
        <CardContent sx={{ p: { xs: 2.2, sm: 3.5 } }}>
          {errorMsg && <Alert severity="error" role="alert" sx={{ mb: 2, borderRadius: 2 }}>{errorMsg}</Alert>}
          {successMsg && <Alert severity="success" role="status" sx={{ mb: 2, borderRadius: 2 }}>{successMsg}</Alert>}
          {role === "admin" ? (
            <Box component="form" onSubmit={handleAdminSubmit}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 950, mb: .7 }}>{t("authAdminLogin")}</Typography>
              <Typography color="text.secondary" sx={{ mb: 2.5 }}>
                {arabic ? "ادخل إلى لوحة الإدارة وتابع التشغيل من مكان واحد." : "Open your manager dashboard and keep operations in one place."}
              </Typography>
              <TextField
                fullWidth
                required
                autoComplete="username"
                label={t("email")}
                type="email"
                value={adminData.email}
                onChange={(event) => setAdminData({ ...adminData, email: event.target.value })}
                sx={fieldSx}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailRoundedIcon fontSize="small" /></InputAdornment> } }}
              />
              <TextField
                fullWidth
                required
                autoComplete="current-password"
                label={t("password")}
                type={showPassword ? "text" : "password"}
                value={adminData.password}
                onChange={(event) => setAdminData({ ...adminData, password: event.target.value })}
                sx={fieldSx}
                slotProps={{ input: {
                  startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" /></InputAdornment>,
                  endAdornment: <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? (arabic ? "إخفاء كلمة المرور" : "Hide password") : (arabic ? "إظهار كلمة المرور" : "Show password")}
                      onClick={() => setShowPassword((value) => !value)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>,
                } }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={17} color="inherit" /> : undefined}
                sx={{ minHeight: 50, mt: .5, borderRadius: 2.5, fontWeight: 950 }}
              >
                {loading ? t("loading") : t("signIn")}
              </Button>
              {canResend && (
                <Button fullWidth variant="text" onClick={resendConfirmation} disabled={loading} sx={{ mt: 1, minHeight: 42 }}>
                  {t("resend")}
                </Button>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5, textAlign: "center" }}>
                {t("noAccount")}{" "}
                <Box component={RouterLink} to="/register" className="owner-auth-link" sx={{ fontWeight: 900 }}>
                  {t("createAccount")}
                </Box>
              </Typography>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleCashierSubmit}>
              <Stack direction="row" sx={{ mb: .7, justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 950 }}>{t("authCashierLogin")}</Typography>
                <Chip size="small" label="PIN" color="primary" sx={{ fontWeight: 900 }} />
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {arabic ? "استخدم لوحة الأرقام أو اكتب الرمز مباشرة من لوحة المفاتيح." : "Use the keypad or type the PIN directly from your keyboard."}
              </Typography>
              <TextField
                fullWidth
                required
                autoComplete="off"
                label={t("cashierSlug")}
                value={cashierData.slug}
                disabled={Boolean(cashierSlug) || loading}
                onChange={(event) => setCashierData({ ...cashierData, slug: event.target.value.toLowerCase() })}
                helperText={cashierSlug ? t("cashierSlugHint") : t("cashierSlugExample")}
                sx={fieldSx}
              />
              <TextField
                select
                fullWidth
                required
                label={arabic ? "الفرع" : "Branch"}
                value={cashierData.branch_slug}
                disabled={loading || cashierBranchesLoading || cashierBranches.length === 0}
                onChange={(event) => setCashierData({ ...cashierData, branch_slug: event.target.value })}
                helperText={cashierBranchesLoading
                  ? (arabic ? "جارٍ تحميل الفروع…" : "Loading branches…")
                  : cashierBranches.length
                    ? (arabic ? "اختر الفرع المرتبط بحسابك" : "Choose the branch assigned to your account")
                    : !cashierData.slug
                      ? (arabic ? "أدخل رابط النشاط أولًا لتحميل الفروع" : "Enter the business slug to load branches")
                      : (arabic ? "لم نعثر على فروع لهذا النشاط." : "No branches were found for this business.")}
                sx={fieldSx}
              >
                {cashierBranches.map((branch) => <MenuItem key={branch.id} value={branch.slug}>{branch.name}</MenuItem>)}
              </TextField>
              <TextField
                fullWidth
                required
                autoComplete="username"
                label={t("username")}
                value={cashierData.username}
                disabled={loading}
                onChange={(event) => setCashierData({ ...cashierData, username: event.target.value.toLowerCase() })}
                sx={fieldSx}
              />
              <TextField
                fullWidth
                required
                type={showPin ? "tel" : "password"}
                inputMode="numeric"
                label={t("pin")}
                value={pin}
                disabled={loading}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                sx={{ ...fieldSx, mb: 2 }}
                helperText={arabic ? "4 إلى 6 أرقام — يدعم الكيبورد وNumpad" : "4 to 6 digits — keyboard and Numpad supported"}
                slotProps={{
                  htmlInput: { maxLength: 6, autoComplete: "off", dir: "ltr" },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPin ? (arabic ? "إخفاء رمز PIN" : "Hide PIN") : (arabic ? "إظهار رمز PIN" : "Show PIN")}
                          onClick={() => setShowPin((value) => !value)}
                          edge="end"
                        >
                          {showPin ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: { xs: .8, sm: 1 }, maxWidth: 360, mx: "auto" }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((number) => (
                  <Button
                    key={number}
                    type="button"
                    variant="outlined"
                    disabled={loading || pin.length >= 6}
                    onClick={() => addPin(number)}
                    sx={{ minHeight: { xs: 52, sm: 58 }, borderRadius: 2.2, fontSize: "1.25rem", fontWeight: 950 }}
                  >
                    {number}
                  </Button>
                ))}
                <Button type="button" variant="outlined" color="error" disabled={loading || pin.length === 0} onClick={() => setPin("")} aria-label={arabic ? "مسح الرمز" : "Clear PIN"} sx={{ minHeight: { xs: 52, sm: 58 }, borderRadius: 2.2, fontWeight: 950 }}>C</Button>
                <Button type="button" variant="outlined" disabled={loading || pin.length >= 6} onClick={() => addPin("0")} sx={{ minHeight: { xs: 52, sm: 58 }, borderRadius: 2.2, fontSize: "1.25rem", fontWeight: 950 }}>0</Button>
                <Button type="button" variant="outlined" color="warning" disabled={loading || pin.length === 0} onClick={removePin} aria-label={arabic ? "حذف آخر رقم" : "Delete last digit"} sx={{ minHeight: { xs: 52, sm: 58 }, borderRadius: 2.2 }}>
                  <BackspaceRoundedIcon />
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || pin.length < 4}
                  startIcon={loading ? <CircularProgress size={17} color="inherit" /> : undefined}
                  sx={{ gridColumn: "1 / -1", minHeight: 52, mt: .5, borderRadius: 2.4, fontWeight: 950 }}
                >
                  {loading ? t("loading") : t("verifyLogin")}
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </AuthCard>
    </OwnerAuthLayout>
  );
}
