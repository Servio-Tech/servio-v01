// صفحة التطبيق `Menu` التي تجمع واجهة المسار وسلوكه.
import MenuHeader from "../components/menu/MenuHeader";
import MenuFilterTabs from "../components/menu/MenuFilterTabs";
import MenuItemsList from "../components/menu/MenuItemsList";
import NotFound from "../components/NotFound";
import SuggestionBanner from "../components/menu/SuggestionBanner";
import CustomerMenuBottomNav from "../components/menu/CustomerMenuBottomNav";
import MenuHero from "../components/menu/MenuHero";
import TrialNotice from "../components/TrialNotice";
import { useMenu } from "../context/MenuContext";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import { useCart } from "../context/CartContext";
import { useTables } from "../context/TablesContext";
import { useTenant } from "../context/TenantContext";
import { useBranch } from "../context/BranchContext";
import { useLanguage } from "../context/LanguageContext";
import { useSuggestions } from "../context/SuggestionsContext";
import { useEffect } from "react";
import "./CustomerMenu.css";

function Menu() {
  const { tables, loaded: tablesLoaded } = useTables();
  const { setTable } = useCart();
  const { tableNumber, tenant, slug, loading: tenantLoading } = useTenant();
  const { branchSlug } = useBranch();
  const { language } = useLanguage();
  const { suggestedItems = [] } = useSuggestions();
  const { items, menuError, refreshMenu } = useMenu();
  const isEnglish = language === "en";
  const isCashierQr = new URLSearchParams(window.location.search).get("cashier") === "1";
  const orderLocation = isCashierQr ? (isEnglish ? "Cashier" : "كاشير") : tableNumber;
  const isValidTable = isCashierQr || (tableNumber
    ? tables.some((table) => String(table.table_number) === String(tableNumber))
    : true);

  useEffect(() => {
    setTable(isValidTable && tableNumber ? tableNumber : null);
  }, [tableNumber, isValidTable, setTable]);

  if (tenantLoading || (tenant && tableNumber && !isCashierQr && !tablesLoaded)) {
    return (
      <Box className="customer-menu customer-menu-loading" sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!tenant) {
    return (
      <Box className="customer-menu" sx={{ minHeight: "100vh", py: 6 }}>
        <NotFound title="الكافيه غير موجود" message="تعذّر العثور على الكافيه من خلال هذا الرابط." />
      </Box>
    );
  }

  if (!isValidTable) {
    return (
      <Box className="customer-menu" sx={{ minHeight: "100vh", py: 6 }}>
        <NotFound title="رقم الطاولة غير صالح" message="تحقّق من رابط المنيو أو اطلب المساعدة من الموظف." />
      </Box>
    );
  }

  return (
    <Box className={`customer-menu${suggestedItems.length ? " customer-menu-has-suggestions" : ""}`}>
      <div className="customer-menu-page-shell">
        <div className="customer-menu-header-shell">
          <MenuHeader table={orderLocation} />
        </div>
        <div className="customer-menu-filter-shell">
          <MenuFilterTabs />
        </div>
        <MenuHero />
        <div className="customer-menu-content">
          <SuggestionBanner />
          {menuError && items.length > 0 && (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" size="small" onClick={refreshMenu}>
                  {isEnglish ? "Retry" : "إعادة المحاولة"}
                </Button>
              }
              sx={{ mb: 2, borderRadius: 2 }}
            >
              {isEnglish
                ? "The menu could not be refreshed. Showing any items already loaded."
                : "تعذّر تحديث المنيو. سنعرض الأصناف التي تم تحميلها إن وُجدت."}
            </Alert>
          )}
          {slug === "mzaj-ryfy" && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              {language === "ar"
                ? "تنويه: معلومات مسببات الحساسية للأصناف المستندة إلى صورة المنيو تقديرية وغير معتمدة من المطبخ. اسأل فريق الخدمة عن المكونات واحتمال التلامس العرضي قبل الطلب."
                : "Allergen details for items added from the photographed menu are estimates based on suggested recipes, not verified by the kitchen. Ask staff about ingredients and possible cross-contact before ordering."}
            </Alert>
          )}
          <div className="customer-menu-section-heading">
            <h2>{language === "en" ? "From the menu" : "من المنيو"}</h2>
            <p>{language === "en" ? "Made fresh for your table" : "محضّر بعناية لطاولتك"}</p>
          </div>
          <div id="customer-menu-items" style={{ scrollMarginTop: "92px" }}>
            <MenuItemsList />
          </div>
        </div>
      </div>
      <CustomerMenuBottomNav
        activePage="menu"
        canCallWaiter={!isCashierQr && Boolean(tableNumber)}
        tableNumber={orderLocation}
      />
      <TrialNotice />
    </Box>
  );
}

export default Menu;
