import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Navigate } from "react-router-dom";
import supabase from "../../supabase";
import { ownerError, verifyOwner } from "./ownerApi";
import { OwnerLanguageToggle, useOwnerLanguage } from "./OwnerLocale";

export default function RequireOwner({ children }) {
  const { text, arabic } = useOwnerLanguage();
  const [state, setState] = useState({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const version = useRef(0);

  useEffect(() => {
    let active = true;
    const check = async (knownSession) => {
      const current = ++version.current;
      setState({ status: "loading" });
      try {
        let session = knownSession;
        if (session === undefined) {
          const result = await supabase.auth.getSession();
          if (result.error) throw result.error;
          session = result.data?.session;
        }
        if (!session) {
          if (active && current === version.current) setState({ status: "signedOut" });
          return;
        }
        await verifyOwner();
        if (active && current === version.current) setState({ status: "allowed" });
      } catch (error) {
        if (active && current === version.current) setState({ status: "error", error });
      }
    };
    void check();
    // Defer network calls outside Supabase's auth callback to avoid auth lock deadlocks.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["SIGNED_OUT", "SIGNED_IN", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) return;
      version.current += 1;
      setState({ status: event === "SIGNED_OUT" ? "signedOut" : "loading" });
      if (event !== "SIGNED_OUT") setTimeout(() => { if (active) void check(session); }, 0);
    });
    return () => { active = false; version.current += 1; listener.subscription.unsubscribe(); };
  }, [retry]);

  if (state.status === "signedOut") return <Navigate to="/owner-console/sign-in" replace />;
  if (state.status === "allowed") return children;
  return <Box className="owner-surface" sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3 }}>
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 460, alignItems: "center", textAlign: "center" }}>
      <Box sx={{ alignSelf: "end" }}><OwnerLanguageToggle /></Box>
      {state.status === "loading" ? <><CircularProgress /><Typography>{text("جارٍ التحقق من صلاحية المالك...", "Checking owner access...")}</Typography></> : <>
        <Typography variant="h5">{text("تعذر فتح لوحة المالك", "Unable to open the owner console")}</Typography>
        <Alert severity="error" sx={{ width: "100%", textAlign: "start" }}>{ownerError(state.error, arabic)}</Alert>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: "100%", justifyContent: "center" }}>
          <Button variant="contained" onClick={() => setRetry((n) => n + 1)}>{text("إعادة المحاولة", "Try again")}</Button>
          <Button variant="outlined" onClick={async () => { await supabase.auth.signOut({ scope: "local" }); setState({ status: "signedOut" }); }}>{text("استخدام حساب آخر", "Use another account")}</Button>
        </Stack>
      </>}
    </Stack>
  </Box>;
}
