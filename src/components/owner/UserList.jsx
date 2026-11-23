import { Box, Button, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { formatDate, isBlocked } from "./ownerUtils";
import { useOwnerLanguage } from "./OwnerLocale";

const secondary = { color: "text.secondary", fontSize: ".78rem", lineHeight: 1.5 };

function Account({ user }) {
  const { text, arabic } = useOwnerLanguage();
  return <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 850, overflowWrap: "anywhere" }} dir="auto">{user.email || text("بلا بريد إلكتروني", "No email")}</Typography><Typography sx={secondary}>{user.email_confirmed_at ? text("البريد مؤكّد", "Email verified") : text("البريد غير مؤكّد", "Email unverified")} · {formatDate(user.created_at, arabic)}</Typography><Typography sx={{ ...secondary, overflowWrap: "anywhere" }} dir="ltr">{user.id}</Typography></Box>;
}
function Business({ user }) {
  const { text } = useOwnerLanguage();
  return <Box><Typography sx={{ fontWeight: 800 }}>{user.tenant_name || (user.tenant_id ? text("نشاط بلا اسم", "Unnamed business") : text("بلا نشاط مرتبط", "No linked business"))}</Typography><Typography sx={secondary} dir="auto">{user.tenant_slug ? `/${user.tenant_slug}` : "—"} · {user.role || "—"}</Typography></Box>;
}
function Subscription({ user }) {
  const { text, arabic } = useOwnerLanguage();
  return <Box><Chip size="small" label={user.plan ? String(user.plan).toLowerCase() === "pro" ? "Pro" : String(user.plan).toLowerCase() === "starter" ? "Starter" : user.plan : text("بلا باقة", "No plan")} sx={{ fontWeight: 850, bgcolor: user.plan?.toLowerCase() === "pro" ? "rgba(160,145,205,.16)" : "rgba(219,120,62,.14)", color: user.plan?.toLowerCase() === "pro" ? "#c9b9eb" : "#e7a477" }} /><Typography sx={{ ...secondary, mt: .5 }}>{formatDate(user.starts_at, arabic)} — {formatDate(user.ends_at, arabic)}</Typography></Box>;
}
function Status({ user }) {
  const { text, arabic } = useOwnerLanguage();
  const blocked = isBlocked(user);
  return <Box><Chip size="small" label={blocked ? text("محظور", "Blocked") : text("غير محظور", "Not blocked")} sx={{ fontWeight: 850, color: blocked ? "#ed9b94" : "#a0c9a8", bgcolor: blocked ? "rgba(194,90,80,.16)" : "rgba(104,161,115,.14)" }} />{blocked && user.banned_until && <Typography sx={{ ...secondary, mt: .5 }}>{text("حتى", "Until")} {formatDate(user.banned_until, arabic)}</Typography>}</Box>;
}
function Actions({ user, onEdit, onAction }) {
  const { text } = useOwnerLanguage();
  const blocked = isBlocked(user);
  return <Box><Stack direction="row" flexWrap="wrap" useFlexGap gap={.5}>
    <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} disabled={!user.tenant_id} onClick={() => onEdit(user)}>{text("الاشتراك", "Subscription")}</Button>
    <Button size="small" color={blocked ? "primary" : "warning"} startIcon={blocked ? <LockOpenRoundedIcon /> : <BlockRoundedIcon />} onClick={() => onAction(blocked ? "unban_user" : "ban_user", user)}>{blocked ? text("فك الحظر", "Unban") : text("حظر", "Ban")}</Button>
    <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => onAction("delete_user", user)}>{text("حذف", "Delete")}</Button>
  </Stack>{!user.tenant_id && <Typography sx={{ ...secondary, mt: .5 }}>{text("تعديل الاشتراك غير متاح: لا يوجد نشاط مرتبط.", "Subscription editing unavailable: no linked business.")}</Typography>}</Box>;
}

export default function UserList({ users, onEdit, onAction }) {
  const { text } = useOwnerLanguage();
  return <>
    <TableContainer sx={{ display: { xs: "none", lg: "block" }, boxShadow: "none", bgcolor: "transparent" }}>
      <Table className="owner-table" sx={{ minWidth: 1050 }}>
        <TableHead><TableRow sx={{ "& th": { color: "#aaa69d", fontSize: ".76rem", fontWeight: 900, whiteSpace: "nowrap", py: 1.8, borderColor: "rgba(235,220,198,.09)" } }}><TableCell>{text("الحساب وتاريخ إنشائه", "Account & creation date")}</TableCell><TableCell>{text("النشاط / الدور", "Business / role")}</TableCell><TableCell>{text("الباقة وفترتها", "Plan & period")}</TableCell><TableCell>{text("الفروع", "Branches")}</TableCell><TableCell>{text("الحالة", "Status")}</TableCell><TableCell>{text("الإجراءات", "Actions")}</TableCell></TableRow></TableHead>
        <TableBody>{users.map((user) => <TableRow key={user.id} sx={{ "& td": { py: 2, borderColor: "rgba(235,220,198,.09)", verticalAlign: "top" } }}><TableCell><Account user={user} /></TableCell><TableCell><Business user={user} /></TableCell><TableCell><Subscription user={user} /></TableCell><TableCell>{user.branch_count ?? "—"}</TableCell><TableCell><Status user={user} /></TableCell><TableCell><Actions user={user} onEdit={onEdit} onAction={onAction} /></TableCell></TableRow>)}</TableBody>
      </Table>
    </TableContainer>
    <Stack spacing={1.5} sx={{ display: { xs: "flex", lg: "none" }, p: { xs: 1.5, sm: 2 } }}>{users.map((user) => <Box key={user.id} className="owner-account-card" sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}><Account user={user} /><Status user={user} /></Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, my: 2 }}><Box><Typography sx={{ ...secondary, mb: .5 }}>{text("النشاط / الدور", "Business / role")}</Typography><Business user={user} /><Typography sx={{ ...secondary, mt: .5 }}>{text("الفروع", "Branches")}: {user.branch_count ?? "—"}</Typography></Box><Box><Typography sx={{ ...secondary, mb: .5 }}>{text("الباقة وفترتها", "Plan & period")}</Typography><Subscription user={user} /></Box></Box>
      <Actions user={user} onEdit={onEdit} onAction={onAction} />
    </Box>)}</Stack>
  </>;
}
