import { useEffect, useMemo, useState } from "react";
import supabase from "../../../supabase";
import { useTenant } from "../../../context/TenantContext";
import { useBranch } from "../../../context/BranchContext";
import { useStore } from "../../../context/StoreInfoContext";
import { aggregateSalesReport, getOperationalSaleDate, getPresetDateRange, getUtcDateBounds } from "../../../utils/salesReportUtils";
import { getWorkdaySchedule } from "../../../utils/workdayUtils";
import { aggregateTableTurnover, buildTableTurnoverDetails } from "../../../utils/tableOrderUtils";
import { hasCompleteItemData } from "./itemCompleteness";

const PAGE_SIZE = 500;

// The report is always scoped to both the active tenant and the selected branch.
export default function useSalesReport(enabled = true) {
  const { tenantId, loading: tenantLoading } = useTenant();
  const { selectedBranchId, selectedBranch, loading: branchLoading } = useBranch();
  const { storeInfo = {} } = useStore();
  const [period, setPeriod] = useState("daily");
  const [clock, setClock] = useState(() => new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [snapshot, setSnapshot] = useState({ key: null, orders: [], loading: true, error: "" });
  const schedule = useMemo(() => getWorkdaySchedule(storeInfo), [storeInfo]);
  const range = useMemo(() => getPresetDateRange(period, clock, schedule.startMinutes), [period, clock, schedule.startMinutes]);
  const key = JSON.stringify([tenantId, selectedBranchId, tenantLoading, branchLoading, range.from, range.to, schedule.startMinutes, refreshKey, enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setSnapshot({ key, orders: [], loading: false, error: "" });
      return () => { active = false; };
    }
    if (tenantLoading || branchLoading) {
      setSnapshot({ key, orders: [], loading: true, error: "" });
      return () => { active = false; };
    }
    if (!tenantId || !selectedBranchId) {
      setSnapshot({ key, orders: [], loading: false, error: "scope" });
      return () => { active = false; };
    }
    const load = async () => {
      setSnapshot({ key, orders: [], loading: true, error: "" });
      try {
        const { start, endExclusive } = getUtcDateBounds(range.from, range.to, schedule.startMinutes);
        // Candidate timestamps can differ. Fetch any matching candidate, then apply the same
        // paid-at/completed-at/created-at precedence as the existing sales calculations.
        const candidates = ["paid_at", "completed_at", "created_at"]
          .map((column) => `and(${column}.gte.${start},${column}.lt.${endExclusive})`).join(",");
        const orders = [];
        for (let offset = 0; active; offset += PAGE_SIZE) {
          const { data, error } = await supabase.from("orders")
            .select("id,created_at,completed_at,paid_at,payment_status,payment_method,status,total_price,items,table_number")
            .eq("tenant_id", tenantId).eq("branch_id", selectedBranchId)
            .in("status", ["ready", "served", "unclaimed"])
            .or("status.neq.ready,payment_status.eq.paid")
            .or(candidates)
            .order("created_at", { ascending: true }).order("id", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
          if (error) throw error;
          const page = data || [];
          orders.push(...page.filter((order) => {
            const date = getOperationalSaleDate(order);
            return date && date >= new Date(start) && date < new Date(endExclusive);
          }));
          if (page.length < PAGE_SIZE) break;
        }
        if (active) setSnapshot({ key, orders, loading: false, error: "" });
      } catch (error) {
        console.error("Could not load sales report", { code: error?.code, status: error?.status, message: error?.message });
        if (active) setSnapshot({ key, orders: [], loading: false, error: "load" });
      }
    };
    void load();
    return () => { active = false; };
  }, [key, enabled, tenantLoading, branchLoading, tenantId, selectedBranchId, range.from, range.to, schedule.startMinutes]);

  // Never show or export the previous branch/range while the next request is pending.
  const current = snapshot.key === key ? snapshot : { orders: [], loading: true, error: "" };
  const report = useMemo(() => {
    const result = aggregateSalesReport(current.orders, schedule);
    const itemDataComplete = hasCompleteItemData(result.salesOrders);
    return itemDataComplete ? { ...result, itemDataComplete } : { ...result, itemDataComplete, itemQuantity: null, topItems: [] };
  }, [current.orders, schedule]);
  const turnover = useMemo(() => aggregateTableTurnover(report.salesOrders, schedule), [report.salesOrders, schedule]);
  const turnoverDetails = useMemo(() => buildTableTurnoverDetails(report.salesOrders, schedule), [report.salesOrders, schedule]);
  const refresh = () => { setClock(new Date()); setRefreshKey((value) => value + 1); };
  return { ...current, report, turnover, turnoverDetails, schedule, period, setPeriod, range, refresh, storeInfo, selectedBranch };
}
