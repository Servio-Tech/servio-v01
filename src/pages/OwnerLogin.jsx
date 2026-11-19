import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import supabase from "../supabase";

export default function OwnerLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password });
    if (signInError) { setError("بيانات الدخول غير صحيحة."); setLoading(false); return; }
    const { data, error: ownerError } = await supabase.functions.invoke("owner-admin", { body: { action: "me" } });
    if (ownerError || !data?.owner?.is_active) {
      await supabase.auth.signOut();
      setError(ownerError?.message || "هذا الحساب غير مخول للدخول إلى لوحة المالك.");
    } else navigate("/owner-console");
    setLoading(false);
  };
  return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "#111", background: "radial-gradient(circle at 20% 0%, rgba(217,84,30,.28), transparent 35%), #111" }}><Card component="form" onSubmit={submit} elevation={0} sx={{ width: "100%", maxWidth: 460, borderRadius: 4, bgcolor: "#171a2f", color: "#fff", border: "1px solid rgba(255,255,255,.12)" }}><CardContent sx={{ p: { xs: 3, sm: 5 } }}><Stack spacing={2.2}><Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}><LockOutlinedIcon sx={{ color: "#d9541e" }} /><Typography variant="h5" fontWeight={950}>دخول مالك المنصة</Typography></Stack><Typography color="rgba(255,255,255,.65)">مسار منفصل لإدارة المطاعم والملاك والباقات.</Typography>{error && <Alert severity="error">{error}</Alert>}<TextField fullWidth label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required sx={{ "& .MuiInputBase-root": { bgcolor: "#fff" } }} /><TextField fullWidth label="كلمة المرور" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required sx={{ "& .MuiInputBase-root": { bgcolor: "#fff" } }} /><Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.4, fontWeight: 900 }}>{loading ? "جارٍ التحقق..." : "دخول لوحة المالك"}</Button></Stack></CardContent></Card></Box>;
}
