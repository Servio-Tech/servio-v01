import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import GppBadRoundedIcon from "@mui/icons-material/GppBadRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import supabase from "../supabase";
import { callOwner, ownerError } from "../components/owner/ownerApi";
import { isBlocked } from "../components/owner/ownerUtils";
import { fetchOwnerPage, searchOwnerDirectory } from "../components/owner/ownerDirectory";
import { OwnerLanguageToggle, useOwnerLanguage } from "../components/owner/OwnerLocale";
import UserList from "../components/owner/UserList";
import SubscriptionDialog from "../components/owner/SubscriptionDialog";
import AccountActionDialog from "../components/owner/AccountActionDialog";
import { clearSubscriptionAttempt, createSubscriptionAttempt, loadSubscriptionAttempt, sameSubscriptionPayload, saveSubscriptionAttempt } from "../components/owner/subscriptionAttempts";

const SEARCH_PAGE_SIZE = 20;
const MAX_SEARCH_PAGES = 1000;

function Stat({ icon, label, value }) {
  return <Box className="owner-stat"><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography sx={{ color: "#aaa69d", fontSize: ".84rem", fontWeight: 700 }}>{label}</Typography><Box className="owner-stat-icon">{icon}</Box></Stack><Typography sx={{ fontSize: "1.8rem", lineHeight: 1.2, fontWeight: 900, mt: 1 }}>{value}</Typography></Box>;
}

export default function OwnerDashboard() {
  const { text, arabic } = useOwnerLanguage();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [list, setList] = useState({ status: "loading", users: [], hasMore: false, progress: 0 });
  const [notice, setNotice] = useState("");
  const [signOutError, setSignOutError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [mutation, setMutation] = useState({ busy: false, error: null });
  const [pendingSubscriptionAttempt, setPendingSubscriptionAttempt] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setSearch(input.trim()); }, 350);
    return () => clearTimeout(timer);
  }, [input]);

  // While searching, scan the paginated API rather than pretending the current page is the whole directory.
  const requestedPage = search ? 1 : page;
  useEffect(() => {
    let active = true;
    async function load() {
      setList({ status: "loading", users: [], hasMore: false, progress: 0 });
      try {
        if (!search) {
          const data = await fetchOwnerPage(callOwner, requestedPage);
          if (active) setList({ status: "ready", users: data.users, hasMore: data.has_more, progress: 0 });
          return;
        }
        const result = await searchOwnerDirectory(callOwner, search, {
          isActive: () => active,
          maxPages: MAX_SEARCH_PAGES,
          onProgress: (progress) => setList((previous) => ({ ...previous, progress })),
        });
        if (active && result) setList({ status: "ready", users: result.users, hasMore: false, progress: result.pagesChecked });
      } catch (error) {
        if (active) setList({ status: "error", error, users: [], hasMore: false, progress: 0 });
      }
    }
    void load();
    return () => { active = false; };
  }, [requestedPage, search, reload]);

  const visible = search ? list.users.slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE) : list.users;
  const hasNext = search ? page * SEARCH_PAGE_SIZE < list.users.length : list.hasMore;
  const blockedCount = visible.filter((user) => isBlocked(user)).length;
  const subscribedCount = visible.filter((user) => Boolean(user.plan)).length;

  const openEdit = (user) => {
    setMutation({ busy: false, error: null });
    const persisted = user.tenant_id ? loadSubscriptionAttempt(user.tenant_id) : null;
    const inMemory = pendingSubscriptionAttempt?.payload?.tenant_id === user.tenant_id ? pendingSubscriptionAttempt : null;
    setPendingSubscriptionAttempt(persisted || inMemory);
    setEditUser(user);
  };
  const openAction = (action, user) => { setMutation({ busy: false, error: null }); setConfirmation({ action, user }); };
  const closeDialogs = () => { if (mutation.busy) return; setEditUser(null); setConfirmation(null); setMutation({ busy: false, error: null }); };
  async function perform(action, payload) {
    if (mutation.busy) return;
    setMutation({ busy: true, error: null });
    setNotice("");
    let requestPayload = payload;
    let attempt = null;
    if (action === "set_subscription") {
      attempt = pendingSubscriptionAttempt;
      if (attempt && !sameSubscriptionPayload(attempt.payload, payload)) {
        setMutation({ busy: false, error: new Error("Pending subscription payload cannot be changed") });
        return;
      }
      if (!attempt) {
        try { attempt = createSubscriptionAttempt(payload); }
        catch (error) { setMutation({ busy: false, error }); return; }
        setPendingSubscriptionAttempt(attempt);
        saveSubscriptionAttempt(attempt);
      }
      requestPayload = { ...attempt.payload, idempotency_key: attempt.key };
    }
    try {
      await callOwner(action, requestPayload);
      if (attempt) {
        clearSubscriptionAttempt(attempt.payload.tenant_id);
        setPendingSubscriptionAttempt(null);
      }
      setEditUser(null);
      setConfirmation(null);
      setMutation({ busy: false, error: null });
      setNotice(action === "set_subscription" ? text("تم حفظ الاشتراك. جارٍ تحديث القائمة.", "Subscription saved. Refreshing the list.") : action === "delete_user" ? text("تم حذف الحساب. جارٍ تحديث القائمة.", "Account deleted. Refreshing the list.") : action === "ban_user" ? text("تم حظر الحساب. جارٍ تحديث القائمة.", "Account banned. Refreshing the list.") : text("تم فك الحظر. جارٍ تحديث القائمة.", "Account unbanned. Refreshing the list."));
      setReload((value) => value + 1);
    } catch (error) {
      // These database validation failures are atomic and prove this attempt
      // did not commit. Keep ambiguous outcomes (and key conflicts) untouched.
      if (attempt && error.status === 409 && error.code === "SUBSCRIPTION_REJECTED") {
        clearSubscriptionAttempt(attempt.payload.tenant_id);
        setPendingSubscriptionAttempt(null);
      }
      setMutation({ busy: false, error });
      // A failed network response may follow a partial server-side change.
      setReload((value) => value + 1);
    }
  }
  async function signOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      // RequireOwner observes SIGNED_OUT and replaces the route with the fixed sign-in path.
    } catch (error) {
      setSignOutError(error);
      setSigningOut(false);
    }
  }

  let listError = list.error;
  if (listError?.message === "Invalid pagination response from owner service") listError = new Error(text("استجابة خدمة المالك للصفحات غير صالحة. تعذر عرض البيانات بأمان.", "The owner service returned an invalid page response; data cannot be displayed safely."));
  if (listError?.message === "Search exceeded the safe pagination limit") listError = new Error(text("تجاوز البحث الحد الآمن البالغ 1000 صفحة؛ تعذر عرض نتائج كاملة.", "Search exceeded the 1,000-page safety limit; complete results cannot be displayed."));

  return <Box className="owner-surface owner-shell">
    <Box component="aside" className="owner-sidebar">
      <Stack direction="row" alignItems="center" gap={1.3} className="owner-brand">
        <Box component="img" src="/logo-icon.webp" alt="" sx={{ width: 42, height: 42 }} />
        <Box><Typography className="owner-brand-name">SERVIO<span>.</span></Typography><Typography className="owner-brand-caption">OWNER CONSOLE</Typography></Box>
      </Stack>
      <Box className="owner-sidebar-nav">
        <Typography className="owner-eyebrow" sx={{ px: 1.5, mb: 1.5 }}>{text("مساحة الإدارة", "WORKSPACE")}</Typography>
        <Box className="owner-sidebar-active"><PeopleAltRoundedIcon fontSize="small" />{text("المستخدمون والاشتراكات", "Users & subscriptions")}</Box>
      </Box>
      <Box className="owner-sidebar-bottom"><Typography sx={{ color: "#e2d5c5", fontWeight: 800, fontSize: ".85rem" }}>{text("إدارة المنصة", "Platform administration")}</Typography><Typography sx={{ color: "#8d8980", fontSize: ".74rem", mt: .5 }}>{text("مساحة خاصة بالمالك", "Owner workspace")}</Typography></Box>
    </Box>
    <Box className="owner-main">
      <Box component="header" className="owner-topbar">
        <Stack direction="row" alignItems="center" gap={1} className="owner-topbar-brand"><Box component="img" src="/logo-icon.webp" alt="" sx={{ width: 34, height: 34 }} /><Typography className="owner-brand-name">SERVIO<span>.</span></Typography></Stack>
        <Typography sx={{ display: { xs: "none", md: "block" }, color: "#b5aa9c", fontSize: ".83rem", fontWeight: 700 }}>{text("لوحة المالك", "Owner console")} <Box component="span" sx={{ color: "#6d6961", mx: 1 }}>/</Box> {text("المستخدمون", "Users")}</Typography>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><OwnerLanguageToggle /><Button color="inherit" onClick={signOut} disabled={signingOut} startIcon={<LogoutRoundedIcon />} sx={{ color: "#c4b9aa", fontWeight: 800 }}>{signingOut ? text("جارٍ الخروج...", "Signing out...") : text("تسجيل الخروج", "Sign out")}</Button></Stack>
      </Box>
      <Box component="main" className="owner-content">
        <Stack direction={{ xs: "column", sm: "row" }} gap={2} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "flex-end" }} sx={{ mb: 4 }}>
          <Box><Typography className="owner-eyebrow" sx={{ mb: 1.2 }}>{text("إدارة المنصة", "PLATFORM MANAGEMENT")}</Typography><Typography component="h1" sx={{ fontSize: { xs: "1.9rem", md: "2.55rem" }, fontWeight: 900, lineHeight: 1.2, letterSpacing: "-.035em" }}>{text("المستخدمون والاشتراكات", "Users & subscriptions")}</Typography><Typography sx={{ color: "#a9a49a", mt: 1 }}>{text("تابع الحسابات وباقات الأنشطة وأدر الوصول من مكان واحد.", "Review accounts, business plans, and access in one place.")}</Typography></Box>
          <Button variant="outlined" onClick={() => setReload((value) => value + 1)} disabled={list.status === "loading"} startIcon={<RefreshRoundedIcon />} sx={{ color: "#dfcbb8", borderColor: "rgba(235,220,198,.2)", borderRadius: 2 }}>{text("تحديث البيانات", "Refresh data")}</Button>
        </Stack>
        {signOutError && <Alert severity="error" sx={{ mb: 2 }}>{ownerError(signOutError, arabic)}</Alert>}
        {notice && <Alert severity="success" onClose={() => setNotice("")} sx={{ mb: 2 }}>{notice}</Alert>}
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 1.5 }}><Typography sx={{ fontWeight: 800, fontSize: ".95rem" }}>{text("نظرة عامة", "Overview")}</Typography><Typography sx={{ color: "#8f8c83", fontSize: ".75rem" }}>{text("الحسابات الظاهرة في الصفحة الحالية", "Accounts shown on this page")}</Typography></Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" }, gap: 1.5, mb: 4 }}>
          <Stat icon={<PeopleAltRoundedIcon />} label={text("الحسابات الظاهرة", "Visible accounts")} value={list.status === "ready" ? visible.length : "—"} />
          <Stat icon={<WorkspacePremiumRoundedIcon />} label={text("لديهم باقة", "With a plan")} value={list.status === "ready" ? subscribedCount : "—"} />
          <Stat icon={<GppBadRoundedIcon />} label={text("حسابات محظورة", "Blocked accounts")} value={list.status === "ready" ? blockedCount : "—"} />
        </Box>
        <Box className="owner-directory">
          <Stack direction={{ xs: "column", md: "row" }} gap={2} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" sx={{ p: { xs: 2, sm: 3 }, borderBottom: "1px solid rgba(235,220,198,.10)" }}>
            <Box><Typography variant="h6" sx={{ fontWeight: 850 }}>{text("دليل الحسابات", "Account directory")}</Typography><Typography sx={{ color: "#a9a49a", fontSize: ".85rem", mt: .4 }}>{text("البحث يشمل جميع صفحات الحسابات.", "Search covers all account pages.")}</Typography></Box>
            <TextField size="small" value={input} onChange={(event) => setInput(event.target.value)} placeholder={text("بحث بالبريد أو النشاط أو الباقة...", "Search email, business, or plan...")} aria-label={text("بحث في الحسابات", "Search accounts")} sx={{ width: { xs: "100%", md: 340 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon color="action" /></InputAdornment> } }} />
          </Stack>
          {list.status === "loading" && <Stack spacing={1.5} alignItems="center" sx={{ py: 7, px: 2 }}><CircularProgress size={30} /><Typography sx={{ color: "#a9a49a" }}>{search ? text(`جارٍ البحث في الحسابات... تم فحص ${list.progress} صفحة`, `Searching accounts... ${list.progress} pages checked`) : text("جارٍ تحميل الحسابات...", "Loading accounts...")}</Typography></Stack>}
          {list.status === "error" && <Box sx={{ p: 3 }}><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReload((value) => value + 1)}>{text("إعادة المحاولة", "Retry")}</Button>}>{ownerError(listError, arabic)}</Alert></Box>}
          {list.status === "ready" && visible.length === 0 && <Box sx={{ py: 7, px: 3, textAlign: "center" }}><PeopleAltRoundedIcon sx={{ color: "#6f6c63", fontSize: 38 }} /><Typography sx={{ fontWeight: 850, mt: 1 }}>{search ? text("لا توجد نتائج مطابقة", "No matching accounts") : text("لا توجد حسابات في هذه الصفحة", "No accounts on this page")}</Typography><Typography variant="body2" sx={{ color: "#a9a49a", mt: .5 }}>{search ? text("جرّب كلمة بحث أخرى.", "Try another search term.") : text("عند توفر حسابات ستظهر هنا.", "Accounts will appear here when available.")}</Typography></Box>}
          {list.status === "ready" && visible.length > 0 && <UserList users={visible} onEdit={openEdit} onAction={openAction} />}
          <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="space-between" alignItems="center" sx={{ p: { xs: 2, sm: 2.5 }, borderTop: "1px solid rgba(235,220,198,.10)" }}>
            <Typography variant="body2" sx={{ color: "#a9a49a" }}>{text("الصفحة", "Page")} {page}{search && list.status === "ready" ? ` · ${list.users.length} ${text("نتيجة", "results")}` : ""}</Typography>
            <Stack direction="row" spacing={1}><Button size="small" variant="outlined" disabled={page <= 1 || list.status === "loading"} onClick={() => setPage((value) => Math.max(1, value - 1))}>{text("السابقة", "Previous")}</Button><Button size="small" variant="outlined" disabled={list.status !== "ready" || !hasNext} onClick={() => setPage((value) => value + 1)}>{text("التالية", "Next")}</Button></Stack>
          </Stack>
        </Box>
      </Box>
    </Box>
    <SubscriptionDialog user={editUser} busy={mutation.busy} error={mutation.error} pendingAttempt={pendingSubscriptionAttempt} onClose={closeDialogs} onSave={(payload) => perform("set_subscription", payload)} />
    <AccountActionDialog action={confirmation?.action} user={confirmation?.user} busy={mutation.busy} error={mutation.error} onClose={closeDialogs} onConfirm={() => perform(confirmation.action, { user_id: confirmation.user.id })} />
  </Box>;
}
