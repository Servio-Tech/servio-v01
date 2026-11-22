import { useEffect, useRef, useState } from "react";
import supabase from "../../../supabase";
import { createOrderEventSelector, createOrderFlashQueue } from "./orderBellLogic";

export default function useNewOrderBell({ tenantId, branchId, orders, ordersLoading, ordersLoadError }) {
  const [bell, setBell] = useState({ active: false, lit: false, order: null });
  const [announcement, setAnnouncement] = useState(null);
  const selectorRef = useRef(null);
  const snapshotRef = useRef({ orders, ordersLoading, ordersLoadError });
  snapshotRef.current = { orders, ordersLoading, ordersLoadError };

  useEffect(() => {
    setBell({ active: false, lit: false, order: null });
    setAnnouncement(null);
    if (!tenantId || !branchId) return undefined;

    const selector = createOrderEventSelector({ tenantId, branchId });
    let active = true;
    let canPrime = false;
    let announcementNumber = 0;
    const flashes = createOrderFlashQueue((state) => {
      setBell(state);
      if (state.lit && state.cycle === 1) {
        announcementNumber += 1;
        setAnnouncement({ order: state.order, number: announcementNumber });
      }
    }, window);
    const deliver = (rows) => rows.forEach((order) => flashes.enqueue(order));
    const prime = () => {
      const snapshot = snapshotRef.current;
      if (!active || !canPrime || snapshot.ordersLoading || snapshot.ordersLoadError) return;
      deliver(selector.prime(snapshot.orders));
    };
    selectorRef.current = { prime };

    // A separate INSERT-only subscriber retains each event even when React
    // batches simultaneous updates into the context's single latest alert.
    const channel = supabase.channel(`cashier-bell:${tenantId}:${branchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        if (active) deliver(selector.receive(payload));
      })
      .subscribe();

    // Let the orders provider enter its loading state when the branch changes.
    const primeTimer = window.setTimeout(() => { canPrime = true; prime(); }, 0);
    return () => {
      active = false;
      window.clearTimeout(primeTimer);
      selectorRef.current = null;
      flashes.stop();
      supabase.removeChannel(channel);
    };
  }, [tenantId, branchId]);

  useEffect(() => {
    if (!ordersLoading && !ordersLoadError) selectorRef.current?.prime();
  }, [orders, ordersLoading, ordersLoadError]);

  return { bell, announcement };
}
