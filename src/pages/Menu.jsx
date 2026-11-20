// صفحة التطبيق `Menu` التي تجمع واجهة المسار وسلوكه.
import MenuHeader from "../components/menu/MenuHeader";
import MenuSearchBar from "../components/menu/MenuSearchBar";
import MenuFilterTabs from "../components/menu/MenuFilterTabs";
import MenuItemsList from "../components/menu/MenuItemsList";
import FloatingCartBar from "../components/cart/FloatingCartBar";
import CartDrawer from "../components/cart/CartDrawer";
import NotFound from "../components/NotFound";
import FloatingActions from "../components/menu/FloatingActions";
import ReviewSection from "../components/menu/ReviewSection";
import CallWaiterConfirm from "../components/menu/CallWaiterConfirm";
import SuggestionBanner from "../components/menu/SuggestionBanner";
import CustomerTrackingBanner from "../components/menu/CustomerTrackingBanner";
import SmartWaiter from "../components/menu/SmartWaiter";
import TrialNotice from "../components/TrialNotice";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useCart } from "../context/CartContext";
import { useTables } from "../context/TablesContext";
import { useTenant } from "../context/TenantContext";
import { useBranch } from "../context/BranchContext";
import { useLanguage } from "../context/LanguageContext";
import { getPlanCapabilities } from "../utils/planCapabilities";
import { useState, useEffect } from "react";

function Menu() {
  const [isCartOpen, setCartOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [callingWaiterConfirmation, setCallingWaiterConfirmation] =
    useState(false);
  const { tables, loaded: tablesLoaded } = useTables();
  const { setTable } = useCart();
  const {
    tableNumber,
    tenant,
    storeInfo,
    slug,
    loading: tenantLoading,
  } = useTenant();
  const { branchSlug, selectedBranch, publicBranchSlug, loading: branchLoading } = useBranch();
  const { language } = useLanguage();
  const isCashierQr =
    new URLSearchParams(window.location.search).get("cashier") === "1";
  const orderLocation = isCashierQr ? "كاشير" : tableNumber;
  const isValidTable =
    isCashierQr ||
    (tableNumber
      ? tables.some(
          (table) => String(table.table_number) === String(tableNumber),
        )
      : true);
  useEffect(() => {
    setTable(isValidTable && tableNumber ? tableNumber : null);
  }, [tableNumber, isValidTable, setTable]);
  if (tenantLoading || (tenant && tableNumber && !isCashierQr && !tablesLoaded))
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  if (!tenant)
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <NotFound
          title={language === "en" ? "Cafe not found" : "الكافيه غير موجود"}
          message={language === "en" ? "We couldn't find the cafe at this link." : "تعذّر العثور على الكافيه من خلال هذا الرابط."}
        />
      </Container>
    );
  if (!isValidTable)
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <NotFound
          title={language === "en" ? "Invalid table number" : "رقم الطاولة غير صالح"}
          message={language === "en" ? "Check the menu link or ask a staff member for help." : "تحقّق من رابط المنيو أو اطلب المساعدة من الموظف."}
        />
      </Container>
    );
  return (
    <Box
      className="studio-page"
      sx={{ minHeight: "100vh", pb: 3 }}
    >
      <Box sx={{ px: { xs: 1.2, sm: 2 }, pt: { xs: 1, sm: 1.5 } }}>
        <Box
          sx={{
            maxWidth: 760,
            mx: "auto",
            background: "#fff",
            border: "1px solid var(--fn-line)",
            borderRadius: { xs: 2.5, sm: 3 },
            boxShadow: "0 14px 40px rgba(22,22,26,.06)",
            px: { xs: 1.2, sm: 2 },
            pt: 1.3,
            pb: 0.3,
          }}
        >
          <MenuHeader table={orderLocation} showSearch={false} />
        </Box>
      </Box>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          maxWidth: 760,
          mx: "auto",
          mt: -0.3,
          px: { xs: 1.2, sm: 2 },
          pt: 0.8,
          background: "rgba(246,247,249,.92)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(23,26,47,.08)",
        }}
      >
          <MenuSearchBar />
          <MenuFilterTabs />
      </Box>
      <Container maxWidth="md" sx={{ pt: 1.5 }}>
        <CustomerTrackingBanner
          slug={slug}
          branchSlug={branchSlug}
          tableNumber={tableNumber}
        />
        {slug === "mzaj-ryfy" && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            {language === "ar"
              ? "تنويه: معلومات مسببات الحساسية للأصناف المستندة إلى صورة المنيو تقديرية وغير معتمدة من المطبخ. اسأل فريق الخدمة عن المكونات واحتمال التلامس العرضي قبل الطلب."
              : "Allergen details for items added from the photographed menu are estimates based on suggested recipes, not verified by the kitchen. Ask staff about ingredients and possible cross-contact before ordering."}
          </Alert>
        )}
        {getPlanCapabilities(tenant).aiWaiter === true && (
          <SmartWaiter
            key={`${tenant.id}:${selectedBranch?.id || "none"}`}
            tenant={tenant}
            branch={selectedBranch}
            branchLoading={branchLoading}
            publicBranchSlug={publicBranchSlug}
            language={language}
            currency={storeInfo?.currency || "SAR"}
          />
        )}
        <MenuItemsList />
      </Container>
      <FloatingActions
        handleReview={() => {
          if (storeInfo?.google_maps_review_url)
            window.open(
              storeInfo.google_maps_review_url,
              "_blank",
              "noopener,noreferrer",
            );
          else setReviewOpen(true);
        }}
        handleCallWaiter={() => setCallingWaiterConfirmation(true)}
      />
      <SuggestionBanner />
      <FloatingCartBar handleCartOpen={() => setCartOpen(true)} currency={storeInfo?.currency || "SAR"} />
      <CartDrawer
        open={isCartOpen}
        close={() => setCartOpen(false)}
        cashierMode={isCashierQr}
        currency={storeInfo?.currency || "SAR"}
      />
      <ReviewSection
        open={reviewOpen}
        close={() => setReviewOpen(false)}
        tableNumber={orderLocation}
      />
      <CallWaiterConfirm
        open={callingWaiterConfirmation}
        close={() => setCallingWaiterConfirmation(false)}
        tableNumber={orderLocation}
      />
      <TrialNotice />
    </Box>
  );
}
export default Menu;
