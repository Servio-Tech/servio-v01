import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Stack,
  Typography,
  IconButton,
  Menu,
  MenuItem,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import { Link as RouterLink } from "react-router-dom";
import LanguageToggle from "../components/LanguageToggle";
import { useLanguage } from "../context/LanguageContext";

const HERO_IMAGE = "/servio-home-hero.jpg";
const icons = {
  menu: MenuBookRoundedIcon,
  orders: PointOfSaleRoundedIcon,
  insight: InsightsRoundedIcon,
  qr: QrCode2RoundedIcon,
  team: GroupsRoundedIcon,
  service: SupportAgentRoundedIcon,
  store: StorefrontRoundedIcon,
};
const content = {
  ar: {
    nav: ["المميزات", "كيف يعمل", "لمن صُمم", "الباقات", "الأسئلة"],
    login: "تسجيل الدخول",
    start: "ابدأ التجربة المجانية",
    tag: "منصة تشغيل للمقاهي والمطاعم",
    title: "تجربة ضيافة أفضل،",
    accent: "وتشغيل أوضح.",
    desc: "يجمع SERVIO المنيو الرقمي والطلبات والكاشير ونداءات الخدمة والتحليلات في مساحة واحدة، ليبقى فريقك على اتصال من أول طلب حتى نهاية اليوم.",
    create: "ابدأ تجربتك المجانية",
    heroNote: "للضيافة اليومية، من الطاولة إلى لوحة الإدارة",
    imageAlt: "مشهد بصري يعرّف بتجربة SERVIO الرقمية للضيافة",
    imageBadge: "كل تفاصيل التشغيل، في مكان واحد",
    intro: "كل خطوة تعرف طريقها.",
    introText:
      "من لحظة فتح العميل للمنيو إلى متابعة صاحب النشاط لأداء المكان، يربط SERVIO تجربة الضيف بعمل الفريق في تدفق واحد.",
    featureTitle: "أدوات عملية ليوم أكثر سلاسة",
    featureText:
      "حلول واضحة لأهم تفاصيل التشغيل اليومي، ضمن مساحة واحدة للفريق والإدارة.",
    features: [
      [
        "menu",
        "منيو رقمي ورموز QR",
        "امنح الطاولات روابطها ورموزها، ليطّلع العميل على المنيو ويطلب من متصفح جواله دون الحاجة إلى تطبيق.",
      ],
      [
        "orders",
        "طلبات بتدفق واضح",
        "استقبل الطلبات وتابع حالاتها عبر واجهة الكاشير والفريق، مع مسار مفهوم من الاستقبال إلى التجهيز.",
      ],
      [
        "service",
        "نداءات الخدمة",
        "ابقَ على اطلاع بنداءات الطاولات وتابعها ضمن مساحة عمل الفريق.",
      ],
      [
        "insight",
        "متابعة وتقارير",
        "راجع المبيعات والطلبات وأداء الأصناف والتقييمات من لوحة الإدارة.",
      ],
      [
        "team",
        "مساحات مناسبة للأدوار",
        "تجربة مخصصة لصاحب النشاط والكاشير والفريق، مع عرض يركز على ما يحتاجه كل دور.",
      ],
      [
        "store",
        "إدارة الفروع",
        "نظّم بيانات الفروع واربط القوائم والطلبات وفرق العمل بها ضمن نظرة إدارية أوضح.",
      ],
    ],
    howTitle: "أربع خطوات، وتدفق واحد.",
    howText:
      "ابدأ بإعداد نشاطك، ثم اربط نقاط الخدمة، ودع الطلبات تنتقل إلى فريقك بوضوح.",
    steps: [
      ["أنشئ نشاطك", "أدخل بيانات المكان وأكمل إعداد هويته ورابطه."],
      ["جهّز المنيو والطاولات", "نظّم الأصناف وأنشئ روابط ورموز QR للطاولات."],
      ["استقبل الطلبات", "تظهر الطلبات للكاشير والفريق مع حالة يمكن متابعتها."],
      ["تابع يومك", "استخدم لوحة الإدارة والتقارير لمراجعة النشاط والأداء."],
    ],
    audienceTitle: "مساحة عمل تجمع فريق الضيافة.",
    audienceText:
      "كل شخص يرى تجربة تناسب دوره، بينما تظل رحلة الضيف متصلة من الطاولة إلى فريق الخدمة.",
    audience: [
      [
        "store",
        "أصحاب المقاهي والمطاعم",
        "إدارة النشاط والمنيو والفروع والاطلاع على مؤشرات التشغيل من لوحة واحدة.",
      ],
      [
        "team",
        "الكاشير وفريق الخدمة",
        "متابعة الطلبات والورديات ونداءات الخدمة من مساحة عمل واضحة.",
      ],
      [
        "menu",
        "الضيوف والعملاء",
        "الوصول إلى المنيو والطلب من الطاولة باستخدام رابط أو QR، من دون تحميل تطبيق.",
      ],
    ],
    valuesTitle: "تقنية بهدوء. وضوح في كل تفصيلة.",
    values: [
      [
        "الوضوح أولًا",
        "معلومات تشغيل مفهومة تساعد الفريق على معرفة الخطوة التالية.",
      ],
      ["كل شيء متصل", "رحلة العميل وعمل الفريق والإدارة أجزاء من تجربة واحدة."],
      [
        "البساطة في الخدمة",
        "أدوات عملية تساند اليوم المزدحم دون تعقيد غير ضروري.",
      ],
    ],
    planTitle: "اختر المساحة المناسبة لفروعك.",
    planText: "مقارنة تعريفية بالخطط، دون أسعار أو التزام شراء من هذه الصفحة.",
    starter: "كل أدوات SERVIO، لنشاط بفرع واحد.",
    pro: "كل أدوات SERVIO، لنشاط يمتد إلى ثلاثة فروع إجمالًا.",
    all: "تشمل كل الميزات",
    one: "فرع واحد فقط",
    three: "3 فروع إجمالًا",
    planNote:
      "الباقات معروضة هنا للتعريف فقط. يمكنك إنشاء حساب لمعرفة الخطوات المتاحة لنشاطك.",
    faqTitle: "إجابات سريعة قبل البداية.",
    faqs: [
      [
        "هل يحتاج العميل إلى تنزيل تطبيق؟",
        "لا. يفتح العميل رابط المنيو أو يمسح رمز QR من متصفح الهاتف مباشرة.",
      ],
      [
        "ما الذي يتضمنه كل من Starter وPro؟",
        "تتضمن الباقتان كل ميزات SERVIO. تتيح Starter فرعًا واحدًا فقط، وتتيح Pro ثلاثة فروع إجمالًا.",
      ],
      [
        "هل يمكن استخدام SERVIO للطلبات عند الكاشير؟",
        "نعم. يتضمن التدفق رمز QR خاصًا بالكاشير لتسجيل الطلبات المحلية ضمن مساحة عمل الكاشير.",
      ],
      [
        "هل يمكنني متابعة نداءات الخدمة والطلبات؟",
        "نعم. يمكن للفريق متابعة الطلبات وحالاتها ونداءات الخدمة من مساحة العمل المناسبة لدوره.",
      ],
    ],
    ctaTitle: "دع تفاصيل التشغيل تمضي معًا.",
    ctaText:
      "ابدأ بإعداد نشاطك، واجمع المنيو والطلبات والفريق في تجربة واحدة أوضح.",
    ctaButton: "ابدأ تجربتك المجانية",
    footer: "تشغيل ضيافة أكثر ترابطًا، من تجربة الضيف حتى لوحة الإدارة.",
    rights: "جميع الحقوق محفوظة.",
    explore: "استكشف",
    account: "الحساب",
    brandTag: "تشغيل أذكى للضيافة",
  },
  en: {
    nav: ["Features", "How it works", "Who it's for", "Plans", "FAQs"],
    login: "Sign in",
    start: "Start free trial",
    tag: "Operations for cafes & restaurants",
    title: "A better guest experience,",
    accent: "a clearer way to run.",
    desc: "SERVIO brings digital menus, orders, cashier workflows, service calls, and analytics together—keeping your team connected from the first order to the end of the day.",
    create: "Start your free trial",
    heroNote: "For everyday hospitality, from table to manager view",
    imageAlt:
      "A visual introduction to SERVIO's digital hospitality experience",
    imageBadge: "Your operations, in one place",
    intro: "Every step knows where to go.",
    introText:
      "From a guest opening the menu to an owner reviewing the day, SERVIO connects the guest experience and team workflows in one flow.",
    featureTitle: "Practical tools for a smoother day",
    featureText:
      "Clear ways to manage everyday operations, brought together for your team and managers.",
    features: [
      [
        "menu",
        "Digital menus & QR codes",
        "Give tables their own links and codes, so guests can browse the menu and order from a phone browser—no app required.",
      ],
      [
        "orders",
        "A clear order flow",
        "Receive orders and follow their status through cashier and team views, from intake to preparation.",
      ],
      [
        "service",
        "Service calls",
        "Keep track of table service calls in the team's workspace, without losing them in the rush.",
      ],
      [
        "insight",
        "Reports & performance",
        "Review sales, orders, item performance, and feedback from the manager dashboard.",
      ],
      [
        "team",
        "Workspaces by role",
        "Purposeful views for owners, cashiers, and teams, focused on what each role needs.",
      ],
      [
        "store",
        "Branch management",
        "Organize branch details and connect their menus, orders, and teams for a clearer management view.",
      ],
    ],
    howTitle: "Four steps. One connected flow.",
    howText:
      "Set up your business, connect your service points, and let orders reach your team with clarity.",
    steps: [
      [
        "Create your business",
        "Enter your venue details and set up its identity and link.",
      ],
      [
        "Set up menus & tables",
        "Organize items and create links and QR codes for tables.",
      ],
      [
        "Receive orders",
        "Orders appear for cashiers and teams with a status to follow.",
      ],
      [
        "Review your day",
        "Use the manager dashboard and reports to review operations.",
      ],
    ],
    audienceTitle: "One workspace for hospitality teams.",
    audienceText:
      "Everyone gets an experience suited to their role, while the guest journey stays connected to the service team.",
    audience: [
      [
        "store",
        "Cafe & restaurant owners",
        "Manage the business, menus, and branches, and review operations from one dashboard.",
      ],
      [
        "team",
        "Cashiers & service teams",
        "Follow orders, shifts, and service calls in a clear workspace.",
      ],
      [
        "menu",
        "Guests & customers",
        "Open the menu and order at the table using a link or QR code, with no app download.",
      ],
    ],
    valuesTitle: "Thoughtful technology. Clarity in every detail.",
    values: [
      [
        "Clarity first",
        "Understandable operations views help the team see what comes next.",
      ],
      [
        "Connected by design",
        "The guest journey, team workflow, and management view belong to one experience.",
      ],
      [
        "Simplicity in service",
        "Practical tools for busy days, without unnecessary complexity.",
      ],
    ],
    planTitle: "Choose the right space for your branches.",
    planText:
      "An informational plan overview, with no prices or purchase commitment on this page.",
    starter: "Every SERVIO feature for a business with one branch.",
    pro: "Every SERVIO feature for a business with up to three branches in total.",
    all: "All features included",
    one: "One branch only",
    three: "3 branches in total",
    planNote:
      "Plans are shown for information only. Create an account to see the next steps for your business.",
    faqTitle: "Quick answers before you begin.",
    faqs: [
      [
        "Do guests need to download an app?",
        "No. Guests open the menu link or scan a QR code directly in their phone's browser.",
      ],
      [
        "What is included in Starter and Pro?",
        "Both plans include all SERVIO features. Starter is limited to one branch; Pro includes three branches in total.",
      ],
      [
        "Can SERVIO handle orders at the cashier?",
        "Yes. A dedicated cashier QR code records local orders within the cashier workspace.",
      ],
      [
        "Can I follow service calls and orders?",
        "Yes. Teams can follow orders, their statuses, and service calls in the workspace for their role.",
      ],
    ],
    ctaTitle: "Let every part of operations move together.",
    ctaText:
      "Set up your business and bring menus, orders, and your team into one clearer experience.",
    ctaButton: "Start your free trial",
    footer:
      "More connected hospitality operations, from the guest experience to the manager view.",
    rights: "All rights reserved.",
    explore: "Explore",
    account: "Account",
    brandTag: "Smarter hospitality operations",
  },
};

const sections = ["features", "how", "audience", "plans", "faqs"];
const labelEyebrow = (ar) =>
  ar
    ? [
        "المميزات",
        "كيف يعمل",
        "لمن صُمم",
        "الباقات",
        "الأسئلة الشائعة",
        "قيم SERVIO",
      ]
    : [
        "Features",
        "How it works",
        "Who it's for",
        "Plans",
        "FAQs",
        "SERVIO values",
      ];

function Brand({ dark = false, tagline, language }) {
  return (
    <Stack
      component={RouterLink}
      to="/"
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        textDecoration: "none",
        color: "inherit",
        flexShrink: 0,
      }}
    >
      <Box
        component="img"
        src="/logo192.png"
        alt=""
        sx={{
          width: { xs: 28, sm: 32 },
          height: { xs: 28, sm: 32 },
          objectFit: "cover",
          borderRadius: "8px",
          flexShrink: 0,
        }}
      />
      <Box>
        <Typography
          sx={{
            fontWeight: 950,
            letterSpacing: "-.04em",
            lineHeight: 1,
            fontSize: { xs: ".92rem", sm: "1.02rem" },
          }}
        >
          SERVIO
        </Typography>
        <Typography
          sx={{
            display: { xs: "none", sm: "block" },
            fontSize: ".55rem",
            color: dark ? "rgba(255,255,255,.58)" : "#606778",
            mt: 0.25,
            letterSpacing: language === "ar" ? 0 : ".05em",
          }}
        >
          {tagline}
        </Typography>
      </Box>
    </Stack>
  );
}

function Heading({ eyebrow, title, text, center = false, dark = false }) {
  return (
    <Box
      sx={{
        maxWidth: center ? 740 : 680,
        mx: center ? "auto" : 0,
        mb: { xs: 4, md: 6 },
        textAlign: center ? "center" : "start",
      }}
    >
      <Typography
        sx={{
          color: dark ? "#FDBA74" : "#A54700",
          fontSize: ".76rem",
          textTransform: "uppercase",
          letterSpacing: ".14em",
          fontWeight: 850,
          mb: 1.4,
        }}
      >
        {eyebrow}
      </Typography>
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: "2rem", md: "3rem" },
          fontWeight: 850,
          letterSpacing: "-.055em",
          lineHeight: 1.15,
        }}
      >
        {title}
      </Typography>
      {text && (
        <Typography
          sx={{
            mt: 2,
            color: dark ? "rgba(255,253,248,.72)" : "#606778",
            lineHeight: 1.85,
          }}
        >
          {text}
        </Typography>
      )}
    </Box>
  );
}

function Icon({ name, invert = false }) {
  const I = icons[name] || StorefrontRoundedIcon;
  return (
    <Box
      sx={{
        width: 42,
        height: 42,
        borderRadius: "12px",
        display: "grid",
        placeItems: "center",
        bgcolor: invert ? "rgba(255,255,255,.1)" : "rgba(244,121,32,.09)",
        color: invert ? "#FDBA74" : "#A54700",
        flexShrink: 0,
      }}
    >
      <I />
    </Box>
  );
}

const styles = `@keyframes servio-enter{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.servio-home .enter{animation:servio-enter .7s cubic-bezier(.2,.7,.2,1) both}.servio-home .delay{animation-delay:.16s}@media(prefers-reduced-motion:reduce){.servio-home *, .servio-home *::before,.servio-home *::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`;

export default function Home() {
  const { language } = useLanguage();
  const ar = language !== "en";
  const c = content[ar ? "ar" : "en"];
  const Arrow = ar ? ArrowBackRoundedIcon : ArrowForwardRoundedIcon;
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const closeMobileMenu = () => setMobileMenuAnchor(null);

  return (
    <Box
      className="servio-home"
      dir={ar ? "rtl" : "ltr"}
      sx={{
        "--ink": "#171A2F",
        "--cream": "#f7f4ed",
        "--paper": "#fffdf8",
        bgcolor: "var(--cream)",
        color: "var(--ink)",
        minHeight: "100vh",
        overflow: "hidden",
        direction: ar ? "rtl" : "ltr",
        textAlign: ar ? "right" : "left",
        scrollBehavior: "smooth",
      }}
    >
      <style>{styles}</style>

      {/* Slim, Clean Header */}
      <Box
        component="header"
        sx={{
          bgcolor: "rgba(247,244,237,.96)",
          borderBottom: "1px solid #e8e2d7",
          backdropFilter: "blur(14px)",
          position: "sticky",
          top: 0,
          zIndex: 1100,
          height: "70px"
        }}
      >
        <Container maxWidth="lg">
          <Stack
            component="nav"
            aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}
            direction="row"
            sx={{
              minHeight: { xs: 56, md: 66 },
              gap: 1.5,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Brand tagline={c.brandTag} language={language} />

            {/* Desktop Nav Links */}
            <Stack
              direction="row"
              spacing={2.5}
              sx={{
                display: { xs: "none", lg: "flex" },
                mx: "auto",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {sections.map((id, i) => (
                <Box
                  key={id}
                  component="a"
                  href={`#${id}`}
                  sx={{
                    textDecoration: "none",
                    color: "#525A6A",
                    fontSize: ".84rem",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    transition: "color .18s ease",
                    "&:hover": { color: "#A54700" },
                  }}
                >
                  {c.nav[i]}
                </Box>
              ))}
            </Stack>

            {/* Mobile Menu Dropdown */}
            <Menu
              id="home-mobile-menu"
              anchorEl={mobileMenuAnchor}
              open={Boolean(mobileMenuAnchor)}
              onClose={closeMobileMenu}
              dir={ar ? "rtl" : "ltr"}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: ar ? "right" : "left",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: ar ? "right" : "left",
              }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1,
                    minWidth: 200,
                    borderRadius: "10px",
                    border: "1px solid #e8e2d7",
                    boxShadow: "0 12px 30px rgba(23,26,47,.08)",
                    p: 0.8,
                  },
                },
              }}
            >
              {sections.map((id, i) => (
                <MenuItem
                  key={id}
                  component="a"
                  href={`#${id}`}
                  onClick={closeMobileMenu}
                  sx={{
                    py: 1,
                    px: 1.8,
                    borderRadius: "8px",
                    color: "#525A6A",
                    fontWeight: 700,
                    fontSize: ".88rem",
                  }}
                >
                  {c.nav[i]}
                </MenuItem>
              ))}
              <MenuItem
                component={RouterLink}
                to="/login"
                onClick={closeMobileMenu}
                sx={{
                  py: 1,
                  px: 1.8,
                  borderRadius: "8px",
                  color: "#525A6A",
                  fontWeight: 700,
                  fontSize: ".88rem",
                }}
              >
                {c.login}
              </MenuItem>
              <Box sx={{ my: 0.8, height: "1px", bgcolor: "#eee9df" }} />
              <MenuItem
                component={RouterLink}
                to="/register"
                onClick={closeMobileMenu}
                sx={{
                  py: 1,
                  px: 1.8,
                  borderRadius: "8px",
                  bgcolor: "#F47920",
                  color: "#171A2F",
                  fontWeight: 800,
                  justifyContent: "center",
                  "&:hover": { bgcolor: "#D96816" },
                }}
              >
                {c.start}
              </MenuItem>
            </Menu>

            {/* Header Right Actions (Compact) */}
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexShrink: 0 }}
            >
              <LanguageToggle compact />
              <Button
                size="small"
                component={RouterLink}
                to="/login"
                sx={{
                  display: { xs: "none", md: "inline-flex" },
                  color: "var(--ink)",
                  px: 1.2,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  fontSize: ".82rem",
                  fontWeight: 750,
                }}
              >
                {c.login}
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                aria-label={c.start}
                variant="contained"
                endIcon={<Arrow />}
                sx={{
                  display: { xs: "none", lg: "inline-flex" },
                  bgcolor: "var(--ink)",
                  borderRadius: "10px",
                  px: 1.6,
                  minHeight: 34,
                  whiteSpace: "nowrap",
                  fontSize: ".8rem",
                  fontWeight: 800,
                  "&:hover": { bgcolor: "#A54700" },
                }}
              >
                {c.start}
              </Button>
              <IconButton
                aria-label={ar ? "فتح قائمة التنقل" : "Open navigation menu"}
                aria-expanded={Boolean(mobileMenuAnchor)}
                aria-controls="home-mobile-menu"
                aria-haspopup="menu"
                onClick={(event) => setMobileMenuAnchor(event.currentTarget)}
                sx={{
                  display: { xs: "inline-flex", lg: "none" },
                  p: 0.6,
                  color: "#171A2F",
                  border: "1px solid #e8e2d7",
                  borderRadius: "10px",
                  bgcolor: "#fffdf8",
                }}
              >
                <MenuRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="main">
        {/* Hero Section */}
        <Box
          component="section"
          aria-labelledby="hero-title"
          sx={{ pt: { xs: 5, md: 8 }, pb: { xs: 8, md: 12 } }}
        >
          <Container maxWidth="lg">
            <Stack
              className="enter"
              sx={{ alignItems: "center", textAlign: "center" }}
            >
              <Chip
                icon={<StorefrontRoundedIcon />}
                label={c.tag}
                sx={{
                  bgcolor: "#eee9df",
                  color: "#525A6A",
                  fontWeight: 750,
                  mb: 2.5,
                  px: 1,
                  "& .MuiChip-icon": { color: "#A54700" },
                }}
              />
              <Typography
                id="hero-title"
                component="h1"
                sx={{
                  maxWidth: 950,
                  fontSize: { xs: "clamp(2.4rem, 10vw, 4.2rem)", md: "5.2rem" },
                  fontWeight: 900,
                  letterSpacing: "-.075em",
                  lineHeight: 1.05,
                }}
              >
                {c.title}
                <Box
                  component="span"
                  sx={{ display: "block", color: "#A54700" }}
                >
                  {c.accent}
                </Box>
              </Typography>
              <Typography
                sx={{
                  maxWidth: 700,
                  color: "#606778",
                  mt: 2.5,
                  fontSize: { xs: "1rem", md: "1.14rem" },
                  lineHeight: 1.85,
                }}
              >
                {c.desc}
              </Typography>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                size="large"
                endIcon={<Arrow />}
                sx={{
                  mt: 3.5,
                  px: 3.5,
                  py: 1.5,
                  borderRadius: "12px",
                  bgcolor: "#F47920",
                  color: "#171A2F",
                  fontWeight: 850,
                  boxShadow: "0 12px 28px rgba(244,121,32,.22)",
                  "&:hover": {
                    bgcolor: "#C65B0A",
                    transform: "translateY(-2px)",
                  },
                  transition: "transform .2s,background-color .2s",
                }}
              >
                {c.create}
              </Button>
              <Typography
                sx={{ mt: 1.5, color: "#788096", fontSize: ".82rem" }}
              >
                {c.heroNote}
              </Typography>
            </Stack>

            <Box
              className="enter delay"
              sx={{
                position: "relative",
                maxWidth: 1060,
                mx: "auto",
                mt: { xs: 5, md: 7 },
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  width: "70%",
                  height: "70%",
                  insetInlineStart: "15%",
                  bottom: -12,
                  borderRadius: "50%",
                  bgcolor: "rgba(244,121,32,.12)",
                  filter: "blur(55px)",
                }}
              />
              <Box
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: { xs: "10px", md: "12px" },
                  bgcolor: "#e6ded0",
                  border: "1px solid rgba(23,26,47,.06)",
                  boxShadow: "0 24px 60px rgba(23,26,47,.1)",
                }}
              >
                <Box
                  component="img"
                  src={HERO_IMAGE}
                  alt={c.imageAlt}
                  loading="eager"
                  fetchPriority="high"
                  sx={{
                    display: "block",
                    width: "100%",
                    aspectRatio: { xs: "1.32 / 1", md: "2.15 / 1" },
                    objectFit: "cover",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    insetInlineStart: { xs: 14, md: 24 },
                    bottom: { xs: 14, md: 24 },
                    bgcolor: "rgba(255,253,248,.94)",
                    borderRadius: "10px",
                    px: { xs: 1.5, md: 2 },
                    py: 0.8,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    boxShadow: "0 8px 20px rgba(0,0,0,.08)",
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#A54700",
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: { xs: ".72rem", sm: ".82rem" },
                      fontWeight: 750,
                    }}
                  >
                    {c.imageBadge}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Container>
        </Box>

        <Box component="section" sx={{ py: { xs: 5, md: 8 } }}>
          <Container maxWidth="md">
            <Stack
              spacing={2}
              sx={{ alignItems: "center", textAlign: "center" }}
            >
              <Typography
                sx={{
                  color: "#A54700",
                  fontSize: ".76rem",
                  letterSpacing: ".15em",
                  fontWeight: 850,
                }}
              >
                {ar ? "تشغيل مترابط" : "CONNECTED OPERATIONS"}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: "2rem", md: "3.2rem" },
                  fontWeight: 850,
                  letterSpacing: "-.055em",
                }}
              >
                {c.intro}
              </Typography>
              <Typography
                sx={{ maxWidth: 760, color: "#606778", lineHeight: 1.9 }}
              >
                {c.introText}
              </Typography>
            </Stack>
          </Container>
        </Box>

        {/* Features Section - Clean Integrated Cards with Proper RTL Layout */}
        <Box
          component="section"
          id="features"
          sx={{
            scrollMarginTop: "88px",
            py: { xs: 6, md: 9 },
            bgcolor: "var(--paper)",
            borderTop: "1px solid #eee9df",
            borderBottom: "1px solid #eee9df",
          }}
        >
          <Container maxWidth="lg">
            <Heading
              eyebrow={c.nav[0]}
              title={c.featureTitle}
              text={c.featureText}
              center
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2,minmax(0,1fr))",
                  lg: "repeat(3,minmax(0,1fr))",
                },
                gap: 2,
              }}
            >
              {c.features.map(([icon, title, body]) => (
                <Card
                  key={title}
                  elevation={0}
                  sx={{
                    p: { xs: 2.2, md: 2.6 },
                    borderRadius: "10px",
                    bgcolor: "var(--paper)",
                    border: "1px solid #eee9df",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: ar ? "right" : "left",
                    transition: "border-color .2s",
                    "&:hover": {
                      borderColor: "#d8cebe",
                    },
                  }}
                >
                  <Icon name={icon} />
                  <Typography
                    component="h3"
                    sx={{ mt: 2, fontSize: "1.08rem", fontWeight: 850 }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.8,
                      fontSize: ".9rem",
                      color: "#606778",
                      lineHeight: 1.8,
                    }}
                  >
                    {body}
                  </Typography>
                </Card>
              ))}
            </Box>
          </Container>
        </Box>

        {/* How it works */}
        <Box
          component="section"
          id="how"
          sx={{ scrollMarginTop: "88px", py: { xs: 6, md: 9 } }}
        >
          <Container maxWidth="lg">
            <Heading eyebrow={c.nav[1]} title={c.howTitle} text={c.howText} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2,minmax(0,1fr))",
                  md: "repeat(4,minmax(0,1fr))",
                },
                gap: 2,
              }}
            >
              {c.steps.map(([title, body], i) => (
                <Box
                  key={title}
                  sx={{
                    p: 2.2,
                    minHeight: { md: 210 },
                    borderRadius: "10px",
                    bgcolor: "var(--cream)",
                    border: "1px solid #e8e2d7",
                    transition: "border-color .2s",
                    "&:hover": {
                      borderColor: "#d8cebe",
                    },
                  }}
                >
                  <Typography
                    sx={{
                      color: "#A54700",
                      fontSize: ".76rem",
                      fontWeight: 900,
                      letterSpacing: ".1em",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </Typography>
                  <Typography
                    component="h3"
                    sx={{ mt: 1.8, fontSize: "1.05rem", fontWeight: 850 }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.8,
                      color: "#606778",
                      lineHeight: 1.8,
                      fontSize: ".88rem",
                    }}
                  >
                    {body}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        {/* Who it's for */}
        <Box
          component="section"
          id="audience"
          sx={{
            scrollMarginTop: "88px",
            py: { xs: 6, md: 9 },
            bgcolor: "#171A2F",
            color: "#fffdf8",
          }}
        >
          <Container maxWidth="lg">
            <Heading
              eyebrow={c.nav[2]}
              title={c.audienceTitle}
              text={c.audienceText}
              center
              dark
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(3,minmax(0,1fr))",
                },
                gap: 2,
              }}
            >
              {c.audience.map(([icon, title, body]) => (
                <Box
                  key={title}
                  sx={{
                    p: 2.5,
                    borderRadius: "10px",
                    bgcolor: "rgba(255,255,255,.065)",
                    border: "1px solid rgba(255,255,255,.13)",
                    boxShadow: "0 12px 30px rgba(0,0,0,.16)",
                    transition:
                      "transform .2s, border-color .2s, box-shadow .2s",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      borderColor: "rgba(253,186,116,.42)",
                      boxShadow: "0 18px 36px rgba(0,0,0,.24)",
                    },
                  }}
                >
                  <Icon name={icon} invert />
                  <Typography
                    component="h3"
                    sx={{ mt: 2, fontSize: "1.08rem", fontWeight: 850 }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.8,
                      color: "rgba(255,253,248,.65)",
                      lineHeight: 1.85,
                      fontSize: ".9rem",
                    }}
                  >
                    {body}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        {/* Values */}
        <Box
          component="section"
          sx={{ py: { xs: 6, md: 9 }, bgcolor: "var(--paper)" }}
        >
          <Container maxWidth="lg">
            <Heading
              eyebrow={labelEyebrow(ar)[5]}
              title={c.valuesTitle}
              center
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(3,minmax(0,1fr))",
                },
                gap: 2.5,
              }}
            >
              {c.values.map(([title, body], i) => (
                <Box
                  key={title}
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    borderRadius: "10px",
                    bgcolor: "var(--paper)",
                    border: "1px solid #eee9df",
                    borderTop: `3px solid ${i === 1 ? "#A54700" : "#ded8cb"}`,
                    transition: "border-color .2s",
                    "&:hover": {
                      borderColor: "#d8cebe",
                    },
                  }}
                >
                  <Typography
                    component="h3"
                    sx={{ fontSize: "1.1rem", fontWeight: 850, mt: 1 }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      color: "#606778",
                      lineHeight: 1.85,
                      mt: 0.8,
                      fontSize: ".9rem",
                    }}
                  >
                    {body}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        {/* Plans */}
        <Box
          component="section"
          id="plans"
          sx={{ scrollMarginTop: "88px", py: { xs: 6, md: 9 } }}
        >
          <Container maxWidth="lg">
            <Heading
              eyebrow={c.nav[3]}
              title={c.planTitle}
              text={c.planText}
              center
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2,minmax(0,1fr))",
                },
                gap: { xs: 2.5, md: 3 },
                maxWidth: 860,
                mx: "auto",
                alignItems: "stretch",
              }}
            >
              {[
                {
                  name: "Starter",
                  sub: c.starter,
                  branch: c.one,
                  featured: false,
                },
                { name: "Pro", sub: c.pro, branch: c.three, featured: true },
              ].map((plan) => (
                <Card
                  key={plan.name}
                  elevation={0}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    p: { xs: 2.5, md: 3 },
                    borderRadius: "10px",
                    bgcolor: "var(--cream)",
                    color: "var(--ink)",
                    border: plan.featured
                      ? "1px solid #F47920"
                      : "1px solid #e8e2d7",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: ".76rem",
                      textTransform: "uppercase",
                      letterSpacing: ".12em",
                      color: plan.featured ? "#8A3B00" : "#A54700",
                      fontWeight: 900,
                    }}
                  >
                    {plan.name}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 1.5,
                      minHeight: { sm: 56 },
                      fontSize: "1.04rem",
                      fontWeight: 800,
                      lineHeight: 1.6,
                      color: "#171A2F",
                    }}
                  >
                    {plan.sub}
                  </Typography>
                  <Box
                    sx={{
                      height: "1px",
                      bgcolor: plan.featured ? "rgba(23,26,47,.15)" : "#e8e2d7",
                      my: 2.2,
                    }}
                  />
                  <Stack spacing={1.4} sx={{ mb: 3 }}>
                    {[c.all, plan.branch].map((item) => (
                      <Stack
                        key={item}
                        direction="row"
                        spacing={1.2}
                        sx={{ alignItems: "center" }}
                      >
                        <CheckRoundedIcon
                          sx={{
                            color: plan.featured ? "#8A3B00" : "#A54700",
                            fontSize: 18,
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: ".92rem",
                            fontWeight: plan.featured ? 700 : 600,
                            color: plan.featured ? "#25293c" : "#525A6A",
                          }}
                        >
                          {item}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button
                    component={RouterLink}
                    to="/register"
                    variant={plan.featured ? "contained" : "outlined"}
                    fullWidth
                    sx={{
                      mt: "auto",
                      py: 1.1,
                      borderRadius: "10px",
                      fontWeight: 850,
                      ...(plan.featured
                        ? {
                            bgcolor: "#F47920",
                            color: "#171A2F",
                            "&:hover": { bgcolor: "#D96816" },
                          }
                        : {
                            borderColor: "#A54700",
                            color: "#8A3B00",
                            "&:hover": {
                              bgcolor: "rgba(244,121,32,.08)",
                              borderColor: "#8A3B00",
                            },
                          }),
                    }}
                  >
                    {c.create}
                  </Button>
                </Card>
              ))}
            </Box>
            <Typography
              sx={{
                textAlign: "center",
                color: "#606778",
                fontSize: ".84rem",
                mt: 3,
              }}
            >
              {c.planNote}
            </Typography>
          </Container>
        </Box>

        {/* FAQs */}
        <Box
          component="section"
          id="faqs"
          sx={{
            scrollMarginTop: "88px",
            pt: { xs: 6, md: 9 },
            pb: { xs: 3, md: 5 },
            bgcolor: "var(--paper)",
            borderTop: "1px solid #eee9df",
          }}
        >
          <Container maxWidth="md">
            <Heading eyebrow={c.nav[4]} title={c.faqTitle} center />
            {c.faqs.map(([question, answer]) => (
              <Accordion
                key={question}
                disableGutters
                elevation={0}
                sx={{
                  mb: 1.5,
                  border: "1px solid #e8e2d7",
                  borderRadius: "10px !important",
                  bgcolor: "var(--paper)",
                  overflow: "hidden",
                  "&:before": { display: "none" },
                  "&.Mui-expanded": { my: 0, mb: 1.5 },
                  transition: "border-color .2s",
                  "&:hover": {
                    borderColor: "#d8cebe",
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={
                    <ExpandMoreRoundedIcon sx={{ color: "#A54700" }} />
                  }
                >
                  <Typography sx={{ fontWeight: 800, fontSize: ".98rem" }}>
                    {question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography
                    sx={{
                      color: "#606778",
                      lineHeight: 1.85,
                      fontSize: ".9rem",
                    }}
                  >
                    {answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Container>
        </Box>

        {/* CTA Banner */}
        <Box component="section" sx={{ py: { xs: 3, md: 5 } }}>
          <Container maxWidth="lg">
            <Box
              sx={{
                position: "relative",
                overflow: "hidden",
                px: { xs: 3, md: 8 },
                py: { xs: 4, md: 5 },
                borderRadius: { xs: "10px", md: "12px" },
                bgcolor: "#F47920",
                color: "#171A2F",
                textAlign: "center",
              }}
            >
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: "2rem", md: "3.2rem" },
                  maxWidth: 760,
                  mx: "auto",
                  fontWeight: 900,
                  letterSpacing: "-.055em",
                  lineHeight: 1.16,
                }}
              >
                {c.ctaTitle}
              </Typography>
              <Typography
                sx={{
                  mt: 2,
                  maxWidth: 620,
                  mx: "auto",
                  color: "rgba(23,26,47,.78)",
                  lineHeight: 1.85,
                  fontSize: ".95rem",
                }}
              >
                {c.ctaText}
              </Typography>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                size="large"
                endIcon={<Arrow />}
                sx={{
                  mt: 3.5,
                  borderRadius: "12px",
                  px: 3.5,
                  py: 1.4,
                  bgcolor: "#fffdf8",
                  color: "var(--ink)",
                  fontWeight: 850,
                  "&:hover": {
                    bgcolor: "#f4e9df",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                {c.ctaButton}
              </Button>
            </Box>
          </Container>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{ bgcolor: "#171A2F", color: "#fffdf8", pt: 6, pb: 4 }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1.5fr 1fr 1fr" },
              gap: 4,
              pb: 5,
            }}
          >
            <Box>
              <Brand dark tagline={c.brandTag} language={language} />
              <Typography
                sx={{
                  maxWidth: 360,
                  color: "rgba(255,253,248,.63)",
                  fontSize: ".88rem",
                  lineHeight: 1.8,
                  mt: 2,
                }}
              >
                {c.footer}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, mb: 1.5, fontSize: ".92rem" }}>
                {c.explore}
              </Typography>
              <Stack spacing={1.2}>
                {sections.slice(0, 4).map((id, i) => (
                  <Box
                    key={id}
                    component="a"
                    href={`#${id}`}
                    sx={{
                      width: "fit-content",
                      textDecoration: "none",
                      fontSize: ".86rem",
                      color: "rgba(255,253,248,.68)",
                      "&:hover": { color: "#FDBA74" },
                    }}
                  >
                    {c.nav[i]}
                  </Box>
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, mb: 1.5, fontSize: ".92rem" }}>
                {c.account}
              </Typography>
              <Stack spacing={1.2}>
                <Box
                  component={RouterLink}
                  to="/login"
                  sx={{
                    textDecoration: "none",
                    fontSize: ".86rem",
                    color: "rgba(255,253,248,.68)",
                  }}
                >
                  {c.login}
                </Box>
                <Box
                  component={RouterLink}
                  to="/register"
                  sx={{
                    textDecoration: "none",
                    fontSize: ".86rem",
                    color: "rgba(255,253,248,.68)",
                  }}
                >
                  {c.start}
                </Box>
              </Stack>
            </Box>
          </Box>
          <Box
            sx={{
              borderTop: "1px solid rgba(255,255,255,.1)",
              pt: 2.5,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Typography
              sx={{ color: "rgba(255,253,248,.52)", fontSize: ".76rem" }}
            >
              © {new Date().getFullYear()} SERVIO — {c.rights}
            </Typography>
            <Typography
              sx={{
                color: "rgba(255,253,248,.4)",
                fontSize: ".72rem",
                letterSpacing: ".1em",
              }}
            >
              SERVIO
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
