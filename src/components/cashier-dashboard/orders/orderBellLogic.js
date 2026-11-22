// Realtime INSERTs, rather than order-list differences, distinguish new orders from
// initial loads, refreshes and status updates. Keep one selector per branch.
export function createOrderEventSelector({ tenantId, branchId, startedAt = Date.now() }) {
  const seen = new Set();
  const pending = new Map();
  const recentSnapshotIds = new Set();
  let ready = false;

  const validRow = (payload) => {
    if (payload?.eventType !== "INSERT") return null;
    const row = payload.new || payload.record;
    if (!row?.id || row.branch_id !== branchId || (row.tenant_id && row.tenant_id !== tenantId)) return null;
    return row;
  };

  return {
    receive(payload) {
      const row = validRow(payload);
      if (!row || pending.has(row.id)) return [];
      if (seen.has(row.id) && !recentSnapshotIds.has(row.id)) return [];
      if (!ready) {
        pending.set(row.id, row);
        return [];
      }
      recentSnapshotIds.delete(row.id);
      seen.add(row.id);
      return [row];
    },
    prime(snapshot = []) {
      if (ready) return [];
      const snapshotIds = new Set();
      for (const row of snapshot) {
        if (!row?.id || row.branch_id !== branchId || (row.tenant_id && row.tenant_id !== tenantId)) continue;
        snapshotIds.add(row.id);
        seen.add(row.id);
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : NaN;
        if (Number.isFinite(createdAt) && createdAt >= startedAt) recentSnapshotIds.add(row.id);
      }
      ready = true;
      const incoming = [];
      for (const row of pending.values()) {
        // An INSERT observed during loading is new unless the initial snapshot
        // proves it was already present before observation began. This protects
        // against stale/duplicate events without swallowing concurrent inserts.
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : NaN;
        const existedAtStart = snapshotIds.has(row.id) && (!Number.isFinite(createdAt) || createdAt < startedAt);
        recentSnapshotIds.delete(row.id);
        if (!existedAtStart) {
          seen.add(row.id);
          incoming.push(row);
        }
      }
      pending.clear();
      return incoming;
    },
  };
}

export const FLASHES_PER_ORDER = 5;
export const FLASH_ON_MS = 400;
export const FLASH_OFF_MS = 400;

// Every accepted order owns five full on/off cycles. Concurrent arrivals wait
// their turn rather than restarting or shortening an in-progress sequence.
export function createOrderFlashQueue(onChange, timers = globalThis) {
  const queue = [];
  let timer = null;
  let current = null;
  let cycle = 0;
  let stopped = false;

  const nextOrder = () => {
    if (stopped) return;
    current = queue.shift() || null;
    cycle = 0;
    if (!current) {
      onChange({ active: false, lit: false, order: null });
      return;
    }
    turnOn();
  };
  const turnOn = () => {
    if (stopped) return;
    cycle += 1;
    onChange({ active: true, lit: true, order: current, cycle });
    timer = timers.setTimeout(() => {
      if (stopped) return;
      onChange({ active: true, lit: false, order: current, cycle });
      timer = timers.setTimeout(() => {
        if (cycle < FLASHES_PER_ORDER) turnOn();
        else nextOrder();
      }, FLASH_OFF_MS);
    }, FLASH_ON_MS);
  };

  return {
    enqueue(order) {
      if (stopped) return;
      queue.push(order);
      if (!current) nextOrder();
    },
    stop() {
      stopped = true;
      if (timer !== null) timers.clearTimeout(timer);
      queue.length = 0;
      current = null;
    },
  };
}

export function getOrderType(order) {
  const value = String(order?.table_number || "").trim().toLowerCase();
  if (/سفري|takeaway/.test(value)) return "takeaway";
  if (/محلي|كاشير|cashier|pos|محل|dine[ -]?in/.test(value)) return "cashier";
  return "table";
}
