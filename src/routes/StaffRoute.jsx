import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useLanguage } from "../context/LanguageContext";
import { TenantProvider } from "../context/TenantContext";
import { BranchProvider } from "../context/BranchContext";
import { MenuProvider } from "../context/MenuContext";
import { CartProvider } from "../context/CartContext";
import { OrdersProvider } from "../context/OrdersContext";
import { HistoryProvider } from "../context/HistoryContext";
import { StoreInfoProvider } from "../context/StoreInfoContext";
import { UserProvider } from "../context/UserContext";
import { ShiftProvider } from "../context/ShiftContext";
import { AnalyticsProvider } from "../context/AnalyticsContext";
import { TablesProvider } from "../context/TablesContext";
import { FeedbacksProvider } from "../context/FeedbackContext";
import { WaiterCallsProvider } from "../context/WaiterCallsContext";
import { SuggestionsProvider } from "../context/SuggestionsContext";
import RequireSession from "../components/RequireSession";

const CashierDashboard = lazy(() => import("../pages/CashierDashboard"));
const ManagerDashboard = lazy(() => import("../pages/ManagerDashboard"));

function StaffProviders({ children }) {
  return (
    <TenantProvider>
      <BranchProvider>
        <MenuProvider>
          <CartProvider>
            <OrdersProvider>
              <HistoryProvider>
                <StoreInfoProvider>
                  <UserProvider>
                    <ShiftProvider>
                      <AnalyticsProvider>
                        <TablesProvider>
                          <FeedbacksProvider>
                            <WaiterCallsProvider>
                              <SuggestionsProvider>{children}</SuggestionsProvider>
                            </WaiterCallsProvider>
                          </FeedbacksProvider>
                        </TablesProvider>
                      </AnalyticsProvider>
                    </ShiftProvider>
                  </UserProvider>
                </StoreInfoProvider>
              </HistoryProvider>
            </OrdersProvider>
          </CartProvider>
        </MenuProvider>
      </BranchProvider>
    </TenantProvider>
  );
}

function DashboardLoading() {
  const { t } = useLanguage();
  return (
    <Box role="status" aria-live="polite" sx={{ minHeight: "50vh", display: "grid", placeContent: "center", justifyItems: "center", gap: 1.5 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{t("loading")}</Typography>
    </Box>
  );
}

export default function StaffRoute({ role, redirectTo }) {
  const Page = role === "admin" ? ManagerDashboard : CashierDashboard;
  const content = redirectTo ? <Navigate to={redirectTo} replace /> : <Page />;

  return (
    <StaffProviders>
      <RequireSession role={role}>
        <Suspense fallback={<DashboardLoading />}>{content}</Suspense>
      </RequireSession>
    </StaffProviders>
  );
}
