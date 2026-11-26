// لوحة التشغيل الرئيسية للكاشير: تعرض مبيعات اليوم والطلبات الحية فقط.
import DashboardHeader from "../components/cashier-dashboard/DashboardHeader";
import LiveOrders from "../components/cashier-dashboard/orders/LiveOrders";
import WaiterCallNotification from "../components/cashier-dashboard/orders/WaiterCallNotification";
import CashierSalesDrawer from "../components/cashier-dashboard/orders/CashierSalesDrawer";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { useOrders } from "../context/OrdersContext";
import { useStore } from "../context/StoreInfoContext";
import { useLanguage } from "../context/LanguageContext";
import { useBranch } from "../context/BranchContext";
import supabase from "../supabase";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useEffect, useMemo, useRef, useState } from "react";
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
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import Badge from "@mui/material/Badge";
import IngredientInventory from "../components/manager-dashboard/IngredientInventory";
import { getPrinterSettings, printKitchenTicketGroups } from "../utils/qzPrinting";
import { unlockRealtimeNotifications } from "../utils/realtimeNotifications";
import { buildOrderReceiptGroups } from "../utils/categoryReceiptUtils";
import NotificationSettingsCard from "../components/cashier-dashboard/NotificationSettingsCard";
import { DashboardThemeProvider } from "../theme/DashboardTheme";
import { useTenant } from "../context/TenantContext";
import useNewOrderBell from "../components/cashier-dashboard/orders/useNewOrderBell";
import { getCashierOrderStatusCounts } from "../components/cashier-dashboard/orders/orderFilterLogic";

const AUTO_PRINT_KEY = "servio.cashier.autoPrintAfterSave";

function Dashboard() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [orderType, setOrderType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [testInvoice, setTestInvoice] = useState(null);
  const { orders = [], finishedOrders = [], ordersLoading, ordersLoadError, newTableOrderAlert } = useOrders();
  const { storeInfo = {} } = useStore();
  const { items = [], categoriesList = [], menuLoading, updateCategoryPrintRoutes } = useMenu();
  const { language } = useLanguage();
  const { selectedBranchId } = useBranch();
  const { tenantId } = useTenant();
  const { bell, announcement } = useNewOrderBell({ tenantId, branchId: selectedBranchId, orders, ordersLoading, ordersLoadError });
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
  const currency = storeInfo.currency || (language === "ar" ? "ر.س" : "SAR");
  const orderStatusCounts = useMemo(() => getCashierOrderStatusCounts(orders), [orders]);
  const orderSummaryLoading = ordersLoading || Boolean(ordersLoadError);

  const [autoPrintAfterSave, setAutoPrintAfterSave] = useState(() => {
    try {
      return window.localStorage.getItem(AUTO_PRINT_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const autoPrintedPublicOrders = useRef(new Set());

  useEffect(() => {
    const unlockAudio = () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      void unlockRealtimeNotifications();
    };
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

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

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100dvh",
        background: "radial-gradient(circle at 88% 0%, rgba(244,121,32,.10), transparent 24%), radial-gradient(circle at 0% 60%, rgba(145,182,206,.035), transparent 28%), #111110",
        py: { xs: 1.5, sm: 2.5, md: 3 },
        px: { xs: 1.25, sm: 2.5, md: 3.5 },
      }}
    >
      <Container maxWidth="xl" disableGutters>
        <Stack spacing={{ xs: 1.25, md: 1.8 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 2.25, md: 2.75 },
              borderRadius: { xs: 3, md: 4 },
              border: "1px solid rgba(233,222,207,.12)",
              background: "linear-gradient(135deg, rgba(32,30,27,.98), rgba(25,25,23,.98))",
              boxShadow: "none",
            }}
          >
            <DashboardHeader
              handleNotificationOpen={() => setIsNotificationOpen(true)}
              totalSales={totalSales}
              currency={currency}
              salesLoading={ordersLoading || ordersLoadError}
              onOpenSalesHistory={() => setIsSalesHistoryOpen(true)}
            />
          </Paper>

          <Stack direction={{ xs: "column", md: "row" }} sx={{ alignItems: { xs: "stretch", md: "center" }, gap: 1.1 }}>
            {activeTab !== "shifts" && (
              <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
                <CashierShiftGate compact requireStart={false} />
              </Box>
            )}
            <Paper elevation={0} sx={{ flex: activeTab === "shifts" ? "1 1 auto" : "0 1 auto", minWidth: 0, px: 1.2, py: .35, borderRadius: 2.5, border: "1px solid", borderColor: "divider", bgcolor: "rgba(255,255,255,.025)" }}>
              <PrinterBridgeStatus language={language} categoryPrinterNames={categoryPrinterNames} />
            </Paper>
          </Stack>

          <Box component="main" sx={{ minWidth: 0 }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.35, sm: 1.9, md: 2.4 },
                borderRadius: { xs: 3, md: 4 },
                border: "1px solid rgba(233,222,207,.12)",
                background: "#1b1a18",
                boxShadow: "none",
                minHeight: { xs: 360, md: 480 },
                minWidth: 0,
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, value) => setActiveTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                aria-label={language === "ar" ? "تبويبات الكاشير" : "Cashier navigation"}
                sx={{
                  px: { xs: .25, sm: .5 },
                  mb: 0,
                  borderBottom: 1,
                  borderColor: "divider",
                  "& .MuiTab-root": { fontWeight: 850, minHeight: 54, minWidth: { xs: 112, sm: 132 }, px: { xs: 1, sm: 1.5 } },
                  "& .MuiTab-iconWrapper": { fontSize: 19 },
                }}
              >
                <Tab
                  value="orders"
                  icon={<Badge badgeContent={orderSummaryLoading ? 0 : orderStatusCounts.all} color="warning" max={99} sx={{ "& .MuiBadge-badge": { fontWeight: 900 } }}><PointOfSaleRoundedIcon /></Badge>}
                  iconPosition="start"
                  aria-label={language === "ar" ? `الطلبات الواردة: ${orderStatusCounts.all}` : `Incoming orders: ${orderStatusCounts.all}`}
                  label={language === "ar" ? "الطلبات" : "Orders"}
                />
                <Tab
                  value="inventory"
                  icon={<Inventory2OutlinedIcon />}
                  iconPosition="start"
                  label={language === "ar" ? "المخزون والتوفر" : "Inventory"}
                />
                <Tab
                  value="printing"
                  icon={<PrintRoundedIcon />}
                  iconPosition="start"
                  label={language === "ar" ? "الطباعة" : "Printing"}
                />
                <Tab
                  value="notifications"
                  icon={<NotificationsActiveRoundedIcon />}
                  iconPosition="start"
                  label={language === "ar" ? "الإشعارات والدليل" : "Notifications"}
                />
                <Tab
                  value="shifts"
                  icon={<AccessTimeRoundedIcon />}
                  iconPosition="start"
                  label={language === "ar" ? "الورديات" : "Shifts"}
                />
              </Tabs>
              <Box sx={{ minWidth: 0, pt: { xs: 1.5, sm: 2 } }}>
            {activeTab === "orders" ? (
              <Stack spacing={{ xs: 1.5, md: 2 }}>
                <LiveOrders
                  orderTypeFilter={orderType}
                  onOrderTypeChange={setOrderType}
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  bell={bell}
                  announcement={announcement}
                />
              </Stack>
            ) : activeTab === "shifts" ? (
              <Stack spacing={2.25}>
                <CashierShiftGate requireStart={false} />
                <ShiftReports />
              </Stack>
            ) : activeTab === "inventory" ? (
              <IngredientInventory />
            ) : activeTab === "notifications" ? (
              <Box sx={{ maxWidth: 1100, mx: "auto", py: { xs: 1, md: 2 } }}>
                <NotificationSettingsCard />
              </Box>
            ) : (
              <Stack spacing={2.5} sx={{ maxWidth: 1100, mx: "auto", py: { xs: 1, md: 2 } }}>
                <PrinterSetupDialog
                  open={activeTab === "printing"}
                  onClose={() => {}}
                  language={language}
                  autoPrint={autoPrintAfterSave}
                  onAutoPrintChange={handleAutoPrintChange}
                  onTest={openPrinterTest}
                  inline
                />
                <CategoryPrintRoutingDrawer
                  open={activeTab === "printing"}
                  onClose={() => {}}
                  categories={categoriesList}
                  onUpdateCategories={updateCategoryPrintRoutes}
                  inline
                />
              </Stack>
            )}
              </Box>
            </Paper>
          </Box>

          <CashierSalesDrawer
            open={isSalesHistoryOpen}
            onClose={() => setIsSalesHistoryOpen(false)}
          />
          <WaiterCallNotification
            open={isNotificationOpen}
            close={() => setIsNotificationOpen(false)}
          />
          <InvoiceModal
            open={Boolean(testInvoice)}
            onClose={() => setTestInvoice(null)}
            order={testInvoice}
            isTest
            autoPrint
          />
        </Stack>
      </Container>
    </Box>
  );
}

export default function CashierDashboard() {
  const { language } = useLanguage();
  return (
    <DashboardThemeProvider direction={language === "en" ? "ltr" : "rtl"}>
      <Dashboard />
    </DashboardThemeProvider>
  );
}
