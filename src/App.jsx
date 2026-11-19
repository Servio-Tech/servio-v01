import { lazy, Suspense } from "react";
import NotFound from "./components/NotFound";
import RequireSession from "./components/RequireSession";
import { useParams } from "react-router-dom";
import "./App.css";
import { Routes, Route, Navigate } from "react-router-dom";
import { useLanguage } from "./context/LanguageContext";

const Menu = lazy(() => import("./pages/Menu"));
const CashierDashboard = lazy(() => import("./pages/CashierDashboard"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminRegister = lazy(() => import("./pages/AdminRegister"));
const Home = lazy(() => import("./pages/Home"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));
const OwnerLogin = lazy(() => import("./pages/OwnerLogin"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));

function App() {
  const { language } = useLanguage();
  const CashierLoginRoute = () => {
    const { slug } = useParams();
    return <AdminLogin cashierSlug={slug} />;
  };

  return (
    <div className="App" dir={language === "ar" ? "rtl" : "ltr"}>
      <Suspense fallback={<div role="status" style={{ padding: "2rem", textAlign: "center" }}>{language === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>}>
      <Routes>
        {/* الصفحات العامة لا تتطلب جلسة؛ مسار menu يمرر slug ورقم الطاولة للمنيو. */}
        <Route path="/home" element={<Home />} />
        <Route path="/" element={<AdminLogin />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/register" element={<AdminRegister />} />
        <Route path="/owner-console/sign-in" element={<OwnerLogin />} />
        <Route path="/owner-console" element={<OwnerDashboard />} />
        <Route path="/cashier/:slug" element={<CashierLoginRoute />} />
        <Route path="/track/:slug/:orderId?" element={<OrderTrackingPage />} />
        <Route path="/menu/:slug/:tableNumber?" element={<Menu />} />
        <Route path="/:slug/:tableNumber?" element={<Menu />} />
        {/* لوحتا التشغيل محميتان حسب الدور؛ لا يكفي إخفاء الروابط في الواجهة. */}
        {/* المسار القديم معطّل مع الاحتفاظ بكود POS؛ البيع المباشر متاح من تبويب الطلبات. */}
        <Route path="/dashboard/pos" element={<RequireSession role="cashier"><Navigate to="/dashboard" replace /></RequireSession>} />
        <Route path="/dashboard" element={<RequireSession role="cashier"><CashierDashboard /></RequireSession>} />
        <Route path="/manager" element={<RequireSession role="admin"><ManagerDashboard /></RequireSession>} />
        <Route path="*" element={<NotFound title="صفحة غير موجودة" message="الرابط الذي تحاول الوصول إليه غير صحيح." />} />
      </Routes>
      </Suspense>
    </div>
  );
}

export default App;
