import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Link as RouterLink } from "react-router-dom";
import LanguageToggle from "../components/LanguageToggle";
import TrialNotice from "../components/TrialNotice";
import { useLanguage } from "../context/LanguageContext";
import "../styles/studio.css";

function Brand() {
  return <RouterLink className="studio-wordmark" to="/" aria-label="SERVIO"><img src="/logo-icon.webp" alt="" />SERVIO</RouterLink>;
}

function ShotCaption({ name, type, likes, views, pro = true }) {
  return <Box className="studio-shot-caption">
    <Box className="studio-shot-caption-main">
      <Box className="studio-avatar">S</Box>
      <Box sx={{ minWidth: 0 }}>
        <div className="studio-caption-title">{name} {pro && <span className="studio-pro">PRO+</span>}</div>
        <div className="studio-caption-sub">{type}</div>
      </Box>
    </Box>
    <Box className="studio-shot-caption-meta"><span>♥ {likes}</span><span>{views}</span></Box>
  </Box>;
}

function DashboardShot({ dark = false, variant = "kpi" }) {
  return <Box className={`shot-window ${dark ? "dark" : ""}`}>
    <Box className="shot-window-top" />
    <Box className="shot-window-body">
      <Box className="shot-side"><b />{[1, 2, 3, 4, 5].map((item) => <i key={item} />)}</Box>
      <Box className="shot-board">
        <Typography component="h4">{variant === "orders" ? "Live operations" : variant === "growth" ? "Growth overview" : "Overview"}</Typography>
        <Box className="shot-kpis">
          <Box className="shot-kpi"><small>Revenue</small><strong>{variant === "growth" ? "98" : "28.6k"}</strong></Box>
          <Box className="shot-kpi"><small>Orders</small><strong>{variant === "orders" ? "126" : "74"}</strong></Box>
          <Box className="shot-kpi"><small>Health</small><strong>{variant === "growth" ? "87%" : "64%"}</strong></Box>
        </Box>
        {variant !== "orders" && <Box className="shot-chart">{[1, 2, 3, 4, 5].map((item) => <i key={item} />)}</Box>}
        <Box className="shot-rows">{[1, 2, 3, 4].map((item) => <Box className="shot-row" key={item}><span /><span /><span /></Box>)}</Box>
      </Box>
    </Box>
  </Box>;
}

function GuestShot() {
  return <Box className="shot-window">
    <Box className="shot-window-top" />
    <Box sx={{ p: 2.2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}><Box><Typography fontWeight={950} fontSize=".9rem">Today at the table</Typography><Typography color="text.secondary" fontSize=".65rem">A calmer guest journey</Typography></Box><Box className="studio-pill active">LIVE</Box></Stack>
      {["New order · Table 08", "Ready to serve · #1048", "Service call · Table 04"].map((row, index) => <Box key={row} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.15, px: 1.3, mb: .8, borderRadius: 2, bgcolor: index === 0 ? "#fff1eb" : "#f5f5f3" }}><Typography fontSize=".7rem" fontWeight={850}>{row}</Typography><Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: index === 1 ? "#4ab58d" : "#ff6038" }} /></Box>)}
    </Box>
  </Box>;
}

const copy = {
  ar: {
    nav: ["استكشف", "المنيو", "الطلبات", "التحليلات"],
    kicker: "نظام تشغيل الضيافة",
    title: "يومك التشغيلي، بصورة أوضح.",
    body: "SERVIO يحوّل تفاصيل المنيو والطلبات والكاشير إلى موجز عمل واحد — واضح للفريق، مفيد للمدير، وسهل للضيف.",
    cta: "أنشئ نشاطك",
    login: "لدي حساب بالفعل",
    filters: ["الأكثر شيوعًا", "الطلبات", "التحليلات", "المنيو", "الفروع"],
    feedTitle: "مشاهد من التشغيل",
    feedBody: "كل بطاقة تحكي جزءًا من اليوم: ما يحدث الآن، وما يستحق قرارًا بعد الإغلاق.",
    first: ["SERVIO Studio", "لوحة تشغيل يومية", "428", "92.4k"],
    second: ["SERVIO Ops", "تدفق الطلبات", "356", "91.3k"],
    third: ["SERVIO Menu", "تجربة الضيف من الطاولة", "313", "74.8k"],
    sectionTitle: "من أول QR إلى آخر قرار",
    sectionBody: "واجهات مركزة تجعل النظام جزءًا طبيعيًا من يوم الفريق، لا شاشة إضافية تحتاج إلى شرح.",
    ctaTitle: "اجعل كل يوم قابلًا للقراءة.",
    ctaBody: "ابدأ بنظام تشغيل هادئ، يترك لفريقك مساحة أكبر للضيافة نفسها.",
    faqTitle: "قبل أن تبدأ",
    faq: [["هل يحتاج الضيف إلى تطبيق؟", "لا. يفتح رابط المنيو أو يمسح QR الطاولة من متصفح جواله مباشرة."], ["هل يدعم أكثر من فرع؟", "نعم. اربط الفروع والكاشير والطلبات والمنيو ضمن مساحة واحدة."], ["هل يعمل أمام الكاشير؟", "نعم. يوجد تدفق خاص للطلبات المحلية مع الحفاظ على نفس سجل التشغيل."]],
    footer: "منصة تشغيل رقمية تربط الضيف والفريق والإدارة في تجربة واحدة.",
    roles: [["صاحب النشاط", "قرار أوضح", "شاهد المبيعات والفروع وأداء الأصناف في موجز واحد."], ["فريق الكاشير", "تدفق أسرع", "استقبل الطلبات والورديات ونداءات الخدمة بدون ضوضاء."], ["الضيف", "تجربة أسهل", "افتح المنيو من الطاولة واطلب بدون تطبيق أو انتظار طويل."]],
  },
  en: {
    nav: ["Discover", "Menu", "Orders", "Analytics"],
    kicker: "Hospitality operating system",
    title: "The operating day, made clear.",
    body: "SERVIO turns menus, orders, cashier work and analytics into one useful feed — clear for teams, useful for managers, easy for guests.",
    cta: "Create your business",
    login: "I already have an account",
    filters: ["Popular", "Orders", "Analytics", "Menu", "Branches"],
    feedTitle: "Scenes from service",
    feedBody: "Each shot carries one part of the day: what is happening now and what deserves a decision later.",
    first: ["SERVIO Studio", "Daily operations board", "428", "92.4k"],
    second: ["SERVIO Ops", "Order flow", "356", "91.3k"],
    third: ["SERVIO Menu", "The guest view", "313", "74.8k"],
    sectionTitle: "From the first QR to the last decision",
    sectionBody: "Focused interfaces that become part of the team’s day, not another screen to explain.",
    ctaTitle: "Make every day readable.",
    ctaBody: "Start with a calmer operating system that gives your team more room for hospitality itself.",
    faqTitle: "Before you start",
    faq: [["Does the guest need an app?", "No. Guests open the menu link or scan the table QR directly from their phone browser."], ["Can it support multiple branches?", "Yes. Connect branches, cashiers, orders and menus in one workspace."], ["Can it handle cashier orders?", "Yes. Local orders follow a focused cashier flow while keeping the same operating history."]],
    footer: "A digital operations platform connecting guests, teams and managers.",
    roles: [["Business owner", "Clearer decisions", "See sales, branches and item performance in one useful feed."], ["Cashier team", "Faster flow", "Handle orders, shifts and service calls without noise."], ["Guest", "An easier visit", "Open the menu from the table and order without an app or a long wait."]],
  },
};

export default function Home() {
  const { language } = useLanguage();
  const ar = language !== "en";
  const c = copy[ar ? "ar" : "en"];
  const [faq, setFaq] = useState(null);
  const Arrow = ar ? ArrowBackRoundedIcon : ArrowForwardRoundedIcon;
  return <Box className="studio-page" dir={ar ? "rtl" : "ltr"}>
    <Box component="header" className="studio-nav">
      <Brand />
      <Box className="studio-nav-links">{c.nav.map((item, index) => <a href={index === 0 ? "#feed" : index === 1 ? "#menu" : index === 2 ? "#orders" : "#analytics"} key={item}>{item}</a>)}</Box>
      <Stack direction="row" spacing={.8} alignItems="center"><LanguageToggle compact /><Button component={RouterLink} to="/login" size="small" sx={{ color: "var(--fn-ink)", fontWeight: 900 }}>{c.login}</Button><Button component={RouterLink} to="/register" size="small" variant="contained" sx={{ bgcolor: "var(--fn-ink)", borderRadius: 999, px: 1.8, fontWeight: 900, "&:hover": { bgcolor: "#333" } }}>{c.cta}</Button></Stack>
    </Box>

    <Box className="studio-shell">
      <Box className="studio-hero">
        <Box><div className="studio-kicker">{c.kicker}</div><h1>{c.title.split(",")[0]}<br /><em>{c.title.split(",").slice(1).join(",")}</em></h1></Box>
        <Box><p className="studio-hero-copy">{c.body}</p><Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}><Button component={RouterLink} to="/register" variant="contained" endIcon={<Arrow />} sx={{ bgcolor: "var(--fn-orange)", color: "#fff", borderRadius: 999, px: 2.2, fontWeight: 900, "&:hover": { bgcolor: "#e44b28" } }}>{c.cta}</Button><Button component="a" href="#feed" sx={{ color: "var(--fn-ink)", border: "1px solid var(--fn-line)", borderRadius: 999, fontWeight: 850 }}>{ar ? "شاهد الواجهات" : "View the work"}</Button></Stack></Box>
      </Box>

      <Box className="studio-filter-row" aria-label={ar ? "فلاتر العرض" : "Feed filters"}>{c.filters.map((filter, index) => <Box className={`studio-pill ${index === 0 ? "active" : ""}`} key={filter}>{filter}</Box>)}</Box>

      <Box id="feed" className="studio-feed">
        <Box className="studio-shot"><Box className="studio-shot-canvas dark"><DashboardShot dark variant="kpi" /></Box><ShotCaption name={c.first[0]} type={c.first[1]} likes={c.first[2]} views={c.first[3]} /></Box>
        <Box className="studio-shot"><Box className="studio-shot-canvas light"><DashboardShot variant="growth" /></Box><ShotCaption name={c.second[0]} type={c.second[1]} likes={c.second[2]} views={c.second[3]} /></Box>
        <Box className="studio-shot"><Box className="studio-shot-canvas lilac"><GuestShot /></Box><ShotCaption name={c.third[0]} type={c.third[1]} likes={c.third[2]} views={c.third[3]} /></Box>
      </Box>

      <Box className="studio-section-heading" id="analytics"><Box><div className="studio-kicker">{c.feedTitle}</div><Typography component="h2">{c.sectionTitle}</Typography></Box><Typography component="p">{c.sectionBody}</Typography></Box>
      <Box className="studio-shot-grid" id="menu">
        <Box className="studio-shot"><Box className="studio-shot-canvas light"><DashboardShot variant="orders" /></Box><ShotCaption name="SERVIO Menu" type={ar ? "منيو وطاولات" : "Menus & tables"} likes="254" views="74k" /></Box>
        <Box className="studio-shot" id="orders"><Box className="studio-shot-canvas dark"><DashboardShot dark variant="growth" /></Box><ShotCaption name="SERVIO Reports" type={ar ? "قرار مبني على بيانات" : "Decisions backed by data"} likes="178" views="73.6k" /></Box>
      </Box>

      <Box className="studio-section-heading"><Box><div className="studio-kicker">{ar ? "مصمم لكل يوم" : "BUILT FOR THE DAY"}</div><Typography component="h2">{ar ? "كل شخص يرى ما يحتاجه." : "Everyone sees what they need."}</Typography></Box><Typography component="p">{ar ? "نفس النظام، بثلاث زوايا واضحة — الإدارة، الفريق، والضيف." : "One system, three clear points of view — management, team and guest."}</Typography></Box>
      <Box className="studio-role-grid">{c.roles.map(([role, title, body]) => <Box className="studio-role" key={role}><small>{role}</small><Typography component="h3">{title}</Typography><Typography component="p">{body}</Typography></Box>)}</Box>

      <Box className="studio-cta"><Box><Typography component="h2">{c.ctaTitle}</Typography><Typography component="p">{c.ctaBody}</Typography></Box><Button component={RouterLink} to="/register" className="studio-pill" sx={{ bgcolor: "#fff", color: "var(--fn-ink)", border: 0, minHeight: 42, px: 2.2, fontWeight: 950 }}>{c.cta} <Arrow sx={{ fontSize: 18, mx: .5 }} /></Button></Box>

      <Box sx={{ maxWidth: 760, mx: "auto", mt: 10 }}><Typography component="h2" sx={{ fontSize: { xs: "2rem", md: "3rem" }, fontWeight: 950, letterSpacing: "-.08em", mb: 2.5 }}>{c.faqTitle}</Typography><Stack spacing={1}>{c.faq.map(([question, answer], index) => <Box key={question} sx={{ borderBottom: "1px solid var(--fn-line)" }}><Button fullWidth onClick={() => setFaq(faq === index ? null : index)} sx={{ justifyContent: "space-between", color: "var(--fn-ink)", py: 1.7, px: 0, textAlign: "start", fontWeight: 900 }}>{question}<ExpandMoreRoundedIcon sx={{ transform: faq === index ? "rotate(180deg)" : "none", transition: ".2s" }} /></Button>{faq === index && <Typography sx={{ color: "var(--fn-muted)", pb: 1.8, lineHeight: 1.8 }}>{answer}</Typography>}</Box>)}</Stack></Box>
      <Box component="footer" sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", borderTop: "1px solid var(--fn-line)", mt: 10, pt: 2.5, color: "var(--fn-muted)" }}><Brand /><Typography fontSize=".75rem">{c.footer}</Typography></Box>
    </Box>
    <TrialNotice />
  </Box>;
}
