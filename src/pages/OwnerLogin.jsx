import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import supabase from "../supabase";
import { ownerError, verifyOwner } from "../components/owner/ownerApi";
import { OwnerLanguageToggle, useOwnerLanguage } from "../components/owner/OwnerLocale";
import OwnerAuthLayout from "../components/owner/OwnerAuthLayout";

export default function OwnerLogin() {
  const { text, arabic } = useOwnerLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState("checking");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function checkExistingSession() {
      try {
        const result = await supabase.auth.getSession();
        if (result.error) throw result.error;
        if (result.data?.session) {
          await verifyOwner();
          if (active) { navigate("/owner-console", { replace: true }); return; }
        }
      } catch (failure) {
        if (active) setError(failure);
      } finally {
        if (active) setBusy("");
      }
    }
    void checkExistingSession();
    return () => { active = false; };
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy("signing");
    try {
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) {
        const failure = new Error(text("البريد الإلكتروني أو كلمة المرور غير صحيحة، أو لا يمكن تسجيل الدخول الآن.", "The email or password is incorrect, or sign-in is unavailable."));
        throw failure;
      }
      if (!result.data?.session) throw new Error(text("لم يتم إنشاء جلسة صالحة. حاول مجددًا.", "No valid session was created. Please try again."));
      await verifyOwner();
      navigate("/owner-console", { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy("");
    }
  }

  return <OwnerAuthLayout arabic={arabic} owner toggle={<OwnerLanguageToggle />} footer={<Typography component={RouterLink} to="/" className="owner-auth-link" sx={{ display: "inline-block", mt: 3, fontSize: ".9rem", fontWeight: 700 }}>{arabic ? "→ العودة إلى SERVIO" : "← Back to SERVIO"}</Typography>}>
    <Box className="owner-auth-card MuiPaper-root" sx={{ p: { xs: 2.5, sm: 4 } }}>
      <Box className="owner-auth-icon"><ShieldRoundedIcon /></Box>
      <Typography className="owner-eyebrow" sx={{ mb: 1 }}>{text("دخول آمن", "SECURE ACCESS")}</Typography>
      <Typography variant="h5" component="h2" sx={{ mb: 1, fontWeight: 900 }}>{text("دخول مالك المنصة", "Owner sign in")}</Typography>
      <Typography sx={{ color: "#aaa69d", mb: 3 }}>{text("استخدم حساب المالك المصرّح به للوصول إلى هذه المساحة.", "Use an authorized owner account to access this space.")}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{ownerError(error, arabic)}</Alert>}
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField required fullWidth label={text("البريد الإلكتروني", "Email address")} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} slotProps={{ htmlInput: { dir: "ltr" } }} />
          <TextField required fullWidth label={text("كلمة المرور", "Password")} type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? text("إخفاء كلمة المرور", "Hide password") : text("إظهار كلمة المرور", "Show password")} onClick={() => setShowPassword((value) => !value)} edge="end">{showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton></InputAdornment> } }} />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={Boolean(busy)} endIcon={!busy && <ArrowForwardRoundedIcon />} sx={{ py: 1.5, borderRadius: 2.5, fontWeight: 900 }}>{busy ? <><CircularProgress size={18} color="inherit" /> {busy === "checking" ? text("جارٍ التحقق...", "Checking...") : text("جارٍ تسجيل الدخول...", "Signing in...")}</> : text("دخول لوحة المالك", "Sign in to owner console")}</Button>
        </Stack>
      </Box>
    </Box>
  </OwnerAuthLayout>;
}
