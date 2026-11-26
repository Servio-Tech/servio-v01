import { Box, Stack, Typography } from "@mui/material";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import "./ownerStyles.css";

/** Presentation only: authentication and language remain owned by each page. */
export default function OwnerAuthLayout({ arabic, owner = false, authLabel, toggle, children, footer }) {
  return <Box className="owner-surface owner-auth" dir={arabic ? "rtl" : "ltr"}>
    <Box component="aside" className="owner-auth-intro">
      <Stack direction="row" className="owner-brand" sx={{ alignItems: "center", gap: 1.5 }}>
        <Box component="img" src="/logo-icon.webp" alt="" sx={{ width: 44, height: 44, objectFit: "contain" }} />
        <Box><Typography className="owner-brand-name">SERVIO<span>.</span></Typography><Typography className="owner-brand-caption">{owner ? "OWNER CONSOLE" : "OPERATIONS PLATFORM"}</Typography></Box>
      </Stack>
      <Box className="owner-auth-story">
        <Typography className="owner-eyebrow">{owner ? (arabic ? "مساحة المالك" : "OWNER WORKSPACE") : (arabic ? "مساحة فريقك" : "YOUR WORKSPACE")}</Typography>
        <Typography component="h1" className="owner-auth-headline">{owner ? (arabic ? "كل الحسابات، برؤية أوضح." : "Every account, in clear view.") : (arabic ? "شغّل المكان بوضوح." : "Run the place with clarity.")}</Typography>
        <Typography className="owner-auth-description">{owner ? (arabic ? "مساحة خاصة لإدارة المستخدمين والاشتراكات في SERVIO بأمان." : "A private space for securely managing SERVIO users and subscriptions.") : (arabic ? "من الطلبات إلى الكاشير والتقارير، كل ما يحتاجه فريقك في مكان واحد." : "From orders to cashier operations and reports, everything your team needs in one place.")}</Typography>
        <Box className="owner-auth-art" aria-hidden="true"><Box className="owner-auth-art-icon"><ShieldRoundedIcon /></Box><Box><span>SERVIO</span><strong>{owner ? "OWNER CONSOLE" : "OPERATIONS"}</strong></Box><Box className="owner-auth-art-line" /><Box className="owner-auth-art-dot" /></Box>
      </Box>
      <Typography className="owner-auth-footnote">SERVIO · {arabic ? "كل شيء في مكانه" : "Everything in its place"}</Typography>
    </Box>
    <Box className="owner-auth-main">
      <Box className="owner-auth-topbar"><Stack direction="row" className="owner-auth-mobile-brand" sx={{ alignItems: "center", gap: 1 }}><Box component="img" src="/logo-icon.webp" alt="" sx={{ width: 36, height: 36 }} /><Typography className="owner-brand-name">SERVIO<span>.</span></Typography></Stack><Box className="owner-auth-language">{toggle}</Box></Box>
      <Box className="owner-auth-content">{children}{footer}</Box>
      <Typography className="owner-auth-bottom">SERVIO / {owner ? "OWNER CONSOLE" : (authLabel || "SIGN IN")}</Typography>
    </Box>
  </Box>;
}
