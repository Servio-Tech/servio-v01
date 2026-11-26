import { lazy, Suspense } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import NotFound from "./components/NotFound";
import { useLanguage } from "./context/LanguageContext";
import "./App.css";

const Home = lazy(() => import("./pages/Home"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminRegister = lazy(() => import("./pages/AdminRegister"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const OwnerRoute = lazy(() => import("./routes/OwnerRoute"));
const MenuRoute = lazy(() => import("./routes/MenuRoute"));
const TrackingRoute = lazy(() => import("./routes/TrackingRoute"));
const CustomerExperienceRoute = lazy(() => import("./routes/CustomerExperienceRoute"));
const CartRoute = lazy(() => import("./routes/CartRoute"));
const ServiceRoute = lazy(() => import("./routes/ServiceRoute"));
const ReviewRoute = lazy(() => import("./routes/ReviewRoute"));
const StaffRoute = lazy(() => import("./routes/StaffRoute"));

function CashierLoginRoute() {
  const { slug } = useParams();
  return <AdminLogin cashierSlug={slug} />;
}

function RouteLoading() {
  const { t } = useLanguage();
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ minHeight: "100vh", display: "grid", placeContent: "center", justifyItems: "center", gap: 1.5 }}
    >
      <CircularProgress size={28} />
      <Typography color="text.secondary">{t("loading")}</Typography>
    </Box>
  );
}

function App() {
  const { language, t } = useLanguage();

  return (
    <div className="App" dir={language === "ar" ? "rtl" : "ltr"}>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/register" element={<AdminRegister />} />
          <Route path="/owner-console/sign-in" element={<OwnerRoute />} />
          <Route path="/owner-console" element={<OwnerRoute dashboard />} />
          <Route path="/cashier/:slug" element={<CashierLoginRoute />} />
          <Route element={<CustomerExperienceRoute />}>
            <Route path="/track/:slug/:orderId?" element={<TrackingRoute />} />
            <Route path="/cart/:slug/:tableNumber?" element={<CartRoute />} />
            <Route path="/service/:slug/:tableNumber?" element={<ServiceRoute />} />
            <Route path="/review/:slug/:tableNumber?" element={<ReviewRoute />} />
            <Route path="/menu/:slug/:tableNumber?" element={<MenuRoute />} />
            <Route path="/:slug/:tableNumber?" element={<MenuRoute />} />
          </Route>
          <Route path="/dashboard/pos" element={<StaffRoute role="cashier" redirectTo="/dashboard" />} />
          <Route path="/dashboard" element={<StaffRoute role="cashier" />} />
          <Route path="/manager" element={<StaffRoute role="admin" />} />
          <Route path="*" element={<NotFound title={t("notFoundTitle")} message={t("notFoundMessage")} />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
