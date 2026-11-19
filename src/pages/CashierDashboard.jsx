// لوحة التشغيل الرئيسية للكاشير: تعرض مبيعات اليوم والطلبات الحية فقط.
import DashboardHeader from "../components/cashier-dashboard/DashboardHeader";
import LiveOrders from "../components/cashier-dashboard/orders/LiveOrders";
import WaiterCallNotification from "../components/cashier-dashboard/orders/WaiterCallNotification";
import CashierSalesDrawer from "../components/cashier-dashboard/orders/CashierSalesDrawer";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { useOrders } from "../context/OrdersContext";
import { useStore } from "../context/StoreInfoContext";
import { useLanguage } from "../context/LanguageContext";
import { useBranch } from "../context/BranchContext";
import supabase from "../supabase";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useShift } from "../context/ShiftContext";
import { getWorkdaySchedule, isWithinWorkdayShifts, shiftBusinessDate } from "../utils/workdayUtils";
import { toLocalDateKey } from "../utils/salesReportUtils";
import PrinterSetupDialog from "../components/cashier-dashboard/PrinterSetupDialog";
import InvoiceModal from "../components/manager-dashboard/orders/OrderPill";
import CashierShiftGate from "../components/cashier-dashboard/CashierShiftGate";
import PrinterBridgeStatus from "../components/cashier-dashboard/PrinterBridgeStatus";
import CategoryPrintRoutingDrawer from "../components/manager-dashboard/menu-control/CategoryPrintRoutingDrawer";
import ShiftReports from "../components/manager-dashboard/ShiftReports";
import { useMenu } from "../context/MenuContext";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import NewTableOrderAlert from "../components/cashier-dashboard/orders/NewTableOrderAlert";
import IngredientInventory from "../components/manager-dashboard/IngredientInventory";
import CashierItemAvailability from "../components/cashier-dashboard/CashierItemAvailability";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { getPrinterSettings, printKitchenTicketGroups } from "../utils/qzPrinting";
import { buildOrderReceiptGroups } from "../utils/categoryReceiptUtils";
import NotificationSettingsCard from "../components/cashier-dashboard/NotificationSettingsCard";

const AUTO_PRINT_KEY = "servio.cashier.autoPrintAfterSave";

function Dashboard() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [shiftExpanded, setShiftExpanded] = useState(false);
  const [testInvoice, setTestInvoice] = useState(null);
  const location = useLocation();
  const shiftState = useShift();
  const { finishedOrders = [], ordersLoading, ordersLoadError } = useOrders();
  const { newTableOrderAlert } = useOrders();
  const { storeInfo = {} } = useStore();
  const { items = [], categoriesList = [], menuLoading, updateCategoryPrintRoutes } = useMenu();
  const { t, language } = useLanguage();
  const { selectedBranchId } = useBranch();
  const categoryPrinterNames = useMemo(
    () =>
      categoriesList
        .map((category) => category.printer_name)
        .filter((name) => typeof name === "string" && name.trim()),
    [categoriesList],
  );
  const schedule = useMemo(() => getWorkdaySchedule(storeInfo), [storeInfo]);
  const operationalToday =
    shiftBusinessDate(new Date(), schedule.startMinutes) || new Date();
  const operationalTodayKey = toLocalDateKey(operationalToday);
  const todayOrders = useMemo(
    () =>
      finishedOrders.filter(
        (order) =>
          order.status !== "cancelled" &&
          Number.isFinite(
            new Date(order.paid_at || order.completed_at || order.created_at).getTime(),
          ) &&
          isWithinWorkdayShifts(
            new Date(order.paid_at || order.completed_at || order.created_at),
            schedule,
          ) &&
          toLocalDateKey(
            shiftBusinessDate(
              new Date(order.paid_at || order.completed_at || order.created_at),
              schedule.startMinutes,
            ),
          ) === operationalTodayKey,
      ),
    [finishedOrders, schedule, operationalTodayKey],
  );
  const totalSales = todayOrders.reduce(
    (sum, order) => sum + Number(order.total_price || 0),
    0,
  );
  const currency = storeInfo.currency || "ر.س";

  // The existing table-order alert navigates to this route with this flag.
  useEffect(() => {
    if (location.state?.openLiveOrders) setActiveTab("orders");
  }, [location.key, location.state]);

  // Do not leave shift failures hidden inside the compact shift panel.
  useEffect(() => {
    if (shiftState.error) setShiftExpanded(true);
  }, [shiftState.error]);

  const [autoPrintAfterSave, setAutoPrintAfterSave] = useState(() => {
    try {
      return window.localStorage.getItem(AUTO_PRINT_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const autoPrintedPublicOrders = useRef(new Set());

  useEffect(() => {
    let active = true;
    const syncPushLanguage = async () => {
      try {
        if (!window.isSecureContext || !navigator.serviceWorker || !selectedBranchId) return;
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager?.getSubscription();
        if (!active || !subscription) return;
        await supabase.rpc("save_cashier_notification_subscription", {
          p_subscription: subscription.toJSON(),
          p_branch_id: selectedBranchId,
          p_language: language === "en" ? "en" : "ar",
          p_device_label: "Cashier device",
        });
      } catch {
        // A language sync is best-effort and must never interrupt cashier work.
      }
    };
    void syncPushLanguage();
    return () => { active = false; };
  }, [language, selectedBranchId]);

  useEffect(() => {
    const incoming = newTableOrderAlert;
    if (!incoming?.id || autoPrintedPublicOrders.current.has(incoming.id)) return;
    const settings = getPrinterSettings();
    if (!settings.autoPrintPublicOrders) return;
    // لا نؤكد الطباعة قبل اكتمال تحميل المنيو؛ وإلا قد تطبع التذكرة الموحدة
    // أولًا ثم تمنع إعادة المحاولة بعد وصول إعدادات split_print.
    if (menuLoading) return;
    autoPrintedPublicOrders.current.add(incoming.id);
    // طلب العميل المؤكد يطبع تذاكر المطبخ حسب التصنيفات نفسها المستخدمة
    // في التوجيه اليدوي؛ لذلك يعمل split_print حتى لو كانت كل التصنيفات
    // على طابعة واحدة، مع بقاء إيصال العميل الموحد في مسار الفاتورة.
    const ticketGroups = buildOrderReceiptGroups(incoming, categoriesList, items, language);
    printKitchenTicketGroups(ticketGroups, storeInfo, { settings, language })
      .catch((error) => console.error("تعذر طباعة تذكرة طلب العميل تلقائيًا", error));
  }, [newTableOrderAlert, storeInfo, language, categoriesList, items, menuLoading]);

  const handleAutoPrintChange = (event) => {
    const checked = Boolean(event?.target?.checked);
    setAutoPrintAfterSave(checked);
    try {
      window.localStorage.setItem(AUTO_PRINT_KEY, String(checked));
    } catch {
      /* تفضيل محلي اختياري */
    }
  };

  const openPrinterTest = () => {
    setTestInvoice({
      id: `test-${Date.now()}`,
      created_at: new Date().toISOString(),
      table_number: language === "ar" ? "اختبار طابعة" : "Printer test",
      notes:
        language === "ar"
          ? "هذه فاتورة اختبار وليست عملية بيع."
          : "Test receipt only; not a sale.",
      total_price: 0,
      payment_status: "unpaid",
      items: [
        {
          id: "servio-printer-test",
          name:
            language === "ar"
              ? "اختبار اتصال الطابعة"
              : "Printer connection test",
          quantity: 1,
          price: 0,
        },
      ],
    });
  };

  const ar = language === "ar";
  const shiftReady = shiftState.statusReady ?? !shiftState.loading;
  const shiftLabel = shiftState.error
    ? (ar ? "تعذر تحميل حالة الوردية" : "Shift status unavailable")
    : !shiftReady
      ? (ar ? "جارٍ التحقق من الوردية" : "Checking shift")
      : shiftState.currentShift
        ? (ar ? "الوردية نشطة" : "Shift active")
        : (ar ? "الوردية غير نشطة" : "Shift not started");

  return (
    <Box sx={{ width: "100%", minHeight: "100vh", bgcolor: "#111111", pb: 5 }}>
      <NewTableOrderAlert />
      <Box component="header" sx={{ bgcolor: "#111", borderBottom: "3px solid #d9541e", px: { xs: 2, sm: 3, md: 4 }, py: 1.5 }}>
        <Container maxWidth="xl" disableGutters><DashboardHeader handleNotificationOpen={() => setIsNotificationOpen(true)} /></Container>
      </Box>

      <Container maxWidth="xl" disableGutters sx={{ px: { xs: 2, sm: 3, md: 4 }, pt: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
            <Box>
              <Typography sx={{ color: "#d9541e", fontSize: ".72rem", fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>{ar ? "مساحة التشغيل" : "OPERATIONS WORKSPACE"}</Typography>
              <Typography sx={{ color: "#f4f6fa", fontSize: { xs: "1.2rem", sm: "1.4rem" }, fontWeight: 950, lineHeight: 1.3, mt: .25 }}>{ar ? "لوحة الكاشير" : "Cashier dashboard"}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: .8, bgcolor: "#14213d", border: "1px solid rgba(255,255,255,.1)", borderRadius: 1 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#fff1e9", color: "#d9541e" }}><StorefrontRoundedIcon sx={{ fontSize: 19 }} /></Box>
                <Box>
                  <Typography sx={{ fontSize: ".68rem", color: "#b1bdd0", fontWeight: 800, lineHeight: 1.2 }}>{t("totalSales")} · {ar ? "اليوم التشغيلي" : "Workday"}</Typography>
                  <Typography sx={{ color: "#f4f6fa", fontWeight: 950, fontSize: ".94rem", lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}>{ordersLoading || ordersLoadError ? "—" : totalSales.toFixed(2)} <Box component="span" sx={{ fontSize: ".7rem", color: "#b1bdd0", fontWeight: 700 }}>{currency}</Box></Typography>
                </Box>
              </Box>
              <Button variant="outlined" startIcon={<ReceiptLongRoundedIcon />} onClick={() => setIsSalesHistoryOpen(true)} sx={{ minHeight: 48, borderColor: "rgba(255,255,255,.14)", color: "#e2e8f1", bgcolor: "#1e2530", borderRadius: 1, fontWeight: 800, "&:hover": { borderColor: "#d9541e", bgcolor: "#283345" } }}>{t("orderHistory")}</Button>
            </Box>
          </Box>

          <Box sx={{ border: "1px solid #dfe5ec", borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, px: { xs: 1.5, sm: 2 }, py: 1 }}>
              <Button onClick={() => setShiftExpanded((expanded) => !expanded)} aria-expanded={shiftExpanded} aria-controls="cashier-shift-panel" sx={{ justifyContent: "flex-start", minHeight: 38, color: "#25364c", fontWeight: 850, px: .5, "&:hover": { bgcolor: "#f4f6f8" } }}>
                <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: shiftState.error ? "#c3443b" : shiftState.currentShift ? "#29966d" : "#d9541e", marginInlineEnd: 1 }} />
                {shiftLabel}
                <ExpandMoreRoundedIcon sx={{ marginInlineStart: .5, fontSize: 20, transform: shiftExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </Button>
              <PrinterBridgeStatus language={language} categoryPrinterNames={categoryPrinterNames} />
            </Box>
            {/* Keep the gate mounted even when collapsed: its mandatory-start dialog and shift checks remain active. */}
            <Collapse in={shiftExpanded}>
              <Box id="cashier-shift-panel" sx={{ px: { xs: 1.5, sm: 2 }, pt: .5 }}><CashierShiftGate /></Box>
            </Collapse>
          </Box>

          <Box sx={{ bgcolor: "#1e2530", border: "1px solid rgba(255,255,255,.08)", borderRadius: 1, overflow: "hidden" }}>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto" aria-label={ar ? "تبويبات الكاشير" : "Cashier tabs"} sx={{ px: { xs: .5, sm: 1.5 }, borderBottom: "1px solid rgba(255,255,255,.08)", "& .MuiTabs-flexContainer, & .MuiTabs-list": { flexWrap: "nowrap", gap: 0 }, "& .MuiTabs-indicator": { bgcolor: "#d9541e", height: 3 }, "& .MuiTab-root": { minHeight: 56, px: { xs: 1.5, sm: 2 }, color: "#aeb8c8", fontSize: ".82rem", fontWeight: 850, whiteSpace: "nowrap" }, "& .Mui-selected": { color: "#fff !important" } }}>
              <Tab id="cashier-tab-orders" aria-controls="cashier-panel-orders" value="orders" label={ar ? "الطلبات الواردة" : "Incoming orders"} />
              <Tab id="cashier-tab-inventory" aria-controls="cashier-panel-inventory" value="inventory" icon={<Inventory2OutlinedIcon />} iconPosition="start" label={ar ? "إدارة المخزون" : "Inventory"} />
              <Tab id="cashier-tab-availability" aria-controls="cashier-panel-availability" value="availability" icon={<Inventory2OutlinedIcon />} iconPosition="start" label={ar ? "توفر الأصناف" : "Item availability"} />
              <Tab id="cashier-tab-printing" aria-controls="cashier-panel-printing" value="printing" icon={<PrintRoundedIcon />} iconPosition="start" label={ar ? "إعدادات الطباعة" : "Printer settings"} />
              <Tab id="cashier-tab-notifications" aria-controls="cashier-panel-notifications" value="notifications" icon={<NotificationsActiveRoundedIcon />} iconPosition="start" label={ar ? "الإشعارات والدليل" : "Notifications & guide"} />
              <Tab id="cashier-tab-shifts" aria-controls="cashier-panel-shifts" value="shifts" icon={<AccessTimeRoundedIcon />} iconPosition="start" label={ar ? "الورديات" : "Shifts"} />
            </Tabs>
            <Box role="tabpanel" id={`cashier-panel-${activeTab}`} aria-labelledby={`cashier-tab-${activeTab}`} sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, minHeight: 360, minWidth: 0, bgcolor: activeTab === "orders" ? "#1e2530" : "#fff" }}>
              {activeTab === "orders" ? (
                <LiveOrders resetToken={location.state?.openLiveOrders ? location.key : undefined} />
              ) : activeTab === "shifts" ? (
                <ShiftReports />
              ) : activeTab === "inventory" ? (
                <IngredientInventory />
              ) : activeTab === "availability" ? (
                <CashierItemAvailability />
              ) : activeTab === "notifications" ? (
                <Box sx={{ maxWidth: 1100, mx: "auto", py: { xs: 1, md: 2 } }}><NotificationSettingsCard /></Box>
              ) : (
                <Stack spacing={2.5} sx={{ maxWidth: 1100, mx: "auto", py: { xs: 1, md: 2 } }}>
                  <PrinterSetupDialog open={activeTab === "printing"} onClose={() => {}} language={language} autoPrint={autoPrintAfterSave} onAutoPrintChange={handleAutoPrintChange} onTest={openPrinterTest} inline />
                  <CategoryPrintRoutingDrawer open={activeTab === "printing"} onClose={() => {}} categories={categoriesList} onUpdateCategories={updateCategoryPrintRoutes} inline />
                </Stack>
              )}
            </Box>
          </Box>
        </Stack>
      </Container>

      <CashierSalesDrawer open={isSalesHistoryOpen} onClose={() => setIsSalesHistoryOpen(false)} />
      <WaiterCallNotification open={isNotificationOpen} close={() => setIsNotificationOpen(false)} />
      <InvoiceModal open={Boolean(testInvoice)} onClose={() => setTestInvoice(null)} order={testInvoice} isTest autoPrint />
    </Box>
  );
}

export default Dashboard;
