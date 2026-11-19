import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import supabase from "../supabase";
import { getPlanCapabilities } from "../utils/planCapabilities";
import { branchCreationReason, branchSlugForName, validateBranchName } from "../components/manager-dashboard/branches/branchManagement";
import { useTenant } from "./TenantContext";

const BranchContext = createContext(null);
const BRANCH_COLUMNS = "id,tenant_id,name,slug,is_active,created_at";

function branchError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function readSavedBranch(tenantId) {
  try { return window.localStorage.getItem(`servio.branch.${tenantId}`); }
  catch { return null; }
}

function saveBranch(tenantId, branchId) {
  try { window.localStorage.setItem(`servio.branch.${tenantId}`, branchId); }
  catch { /* Selection still works when storage is unavailable. */ }
}

export function BranchProvider({ children }) {
  const {
    tenantId,
    tenant,
    slug: tenantSlug,
    isPublic,
    loading: tenantLoading,
  } = useTenant();
  const capabilities = useMemo(() => getPlanCapabilities(tenant), [tenant]);
  const publicBranchSlug = useMemo(
    () => new URLSearchParams(window.location.search).get("branch") || null,
    [],
  );
  const [branches, setBranches] = useState([]);
  // The full list includes inactive branches, and null means it is not known.
  const [allBranches, setAllBranches] = useState(null);
  const allBranchesRef = useRef(null);
  const recordsScope = useRef(null);
  const [loadedScope, setLoadedScope] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadVersion = useRef(0);
  const mutationPending = useRef(false);
  const scope = `${isPublic ? "public" : "staff"}:${tenantId || ""}:${tenantSlug || ""}:${tenantLoading}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;

  const loadBranches = useCallback(async () => {
    const version = ++loadVersion.current;
    const stillCurrent = () => loadVersion.current === version && currentScope.current === scope;
    allBranchesRef.current = null;
    recordsScope.current = null;
    setAllBranches(null);
    setLoadedScope(null);
    setBranches([]);
    setSelectedBranchId(null);
    setError("");
    if (tenantLoading || !tenantId) {
      setLoading(Boolean(tenantLoading));
      return;
    }
    setLoading(true);
    try {
      const result = isPublic
        ? await supabase.rpc("get_public_branches", { p_slug: tenantSlug })
        : await supabase
            .from("branches")
            .select(BRANCH_COLUMNS)
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: true });
      if (!stillCurrent()) return;
      if (result.error) throw result.error;
      const records = result.data || [];
      const active = records.filter((branch) => branch.is_active === true);
      let preferred = null;
      if (isPublic && publicBranchSlug)
        preferred = active.find((branch) => branch.slug === publicBranchSlug)?.id;
      if (!isPublic) {
        const saved = readSavedBranch(tenantId);
        preferred = active.find((branch) => branch.id === saved)?.id;
        if (!preferred && active.length) {
          // A missing cashier mapping is not an error for managers.
          const { data: cashierBranch } = await supabase.rpc("current_user_branch_id");
          if (!stillCurrent()) return;
          preferred = active.find((branch) => branch.id === cashierBranch)?.id;
        }
      }
      allBranchesRef.current = records;
      recordsScope.current = scope;
      setAllBranches(records);
      setBranches(active);
      setSelectedBranchId(preferred || active[0]?.id || null);
      setLoadedScope(scope);
    } catch (loadError) {
      if (!stillCurrent()) return;
      setError(loadError?.message || "Unable to load branches");
      return { error: loadError };
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  }, [tenantId, tenantLoading, isPublic, publicBranchSlug, tenantSlug, scope]);

  useEffect(() => {
    void loadBranches();
    return () => { loadVersion.current += 1; };
  }, [loadBranches]);

  const visibleBranches = loadedScope === scope ? branches : [];
  const selectedBranch = useMemo(
    () => visibleBranches.find((branch) => branch.id === selectedBranchId) || visibleBranches[0] || null,
    [visibleBranches, selectedBranchId],
  );
  const selectBranch = useCallback(
    (branchId) => {
      const branch = visibleBranches.find((entry) => entry.id === branchId);
      if (!branch) return;
      setSelectedBranchId(branch.id);
      if (!isPublic && tenantId) saveBranch(tenantId, branch.id);
    },
    [visibleBranches, isPublic, tenantId],
  );
  const creationReason = branchCreationReason({
    tenantId,
    isPublic,
    loading: loading || tenantLoading || loadedScope !== scope,
    branchCount: loadedScope === scope ? allBranches?.length : undefined,
    capabilities,
  });
  const createBranch = useCallback(
    async (name) => {
      const records = recordsScope.current === scope ? allBranchesRef.current : null;
      const reason = branchCreationReason({
        tenantId, isPublic, loading: loading || tenantLoading,
        branchCount: records?.length, capabilities,
      });
      if (reason !== "allowed") return { error: branchError(reason, "Branch creation is unavailable") };
      const cleanName = validateBranchName(name);
      if (!cleanName) return { error: branchError("invalid_name", "Branch name must be 2–120 characters") };
      if (mutationPending.current) return { error: branchError("busy", "A branch change is already in progress") };
      mutationPending.current = true;
      const operationScope = scope;
      try {
        const branchSlug = branchSlugForName(cleanName, records);
        const { data, error: createError } = await supabase
          .from("branches")
          .insert({ tenant_id: tenantId, name: cleanName, slug: branchSlug })
          .select(BRANCH_COLUMNS)
          .single();
        if (createError) return { error: createError };
        if (!data?.id) return { error: branchError("not_found", "Branch was not returned by the server") };
        if (currentScope.current === operationScope) {
          const updated = [...(allBranchesRef.current || records), data];
          allBranchesRef.current = updated;
          setAllBranches(updated);
          setBranches((current) => [...current, data]);
          // selectBranch closes over the old list, so select the returned row directly.
          setSelectedBranchId(data.id);
          saveBranch(tenantId, data.id);
        }
        return { data, error: null };
      } catch (createError) {
        return { error: createError };
      } finally {
        mutationPending.current = false;
      }
    },
    [tenantId, isPublic, loading, tenantLoading, capabilities, scope],
  );
  const renameBranch = useCallback(
    async (branchId, name) => {
      if (isPublic || !tenantId || loading || tenantLoading || loadedScope !== scope || !visibleBranches.some((branch) => branch.id === branchId))
        return { error: branchError("unavailable", "Branch is unavailable") };
      const cleanName = validateBranchName(name);
      if (!cleanName) return { error: branchError("invalid_name", "Branch name must be 2–120 characters") };
      if (mutationPending.current) return { error: branchError("busy", "A branch change is already in progress") };
      mutationPending.current = true;
      const operationScope = scope;
      try {
        // Preserve slug and all branch data; RLS requires a matching tenant admin.
        const { data, error: updateError } = await supabase
          .from("branches")
          .update({ name: cleanName })
          .eq("tenant_id", tenantId)
          .eq("id", branchId)
          .eq("is_active", true)
          .select(BRANCH_COLUMNS)
          .maybeSingle();
        if (updateError) return { error: updateError };
        if (!data) return { error: branchError("not_found", "Branch was not found or cannot be updated") };
        if (currentScope.current === operationScope) {
          const updated = (allBranchesRef.current || []).map((entry) => entry.id === data.id ? data : entry);
          allBranchesRef.current = updated;
          setAllBranches(updated);
          setBranches((current) => current.map((entry) => entry.id === data.id ? data : entry));
        }
        return { data, error: null };
      } catch (updateError) {
        return { error: updateError };
      } finally {
        mutationPending.current = false;
      }
    },
    [visibleBranches, isPublic, tenantId, loading, tenantLoading, loadedScope, scope],
  );
  const deleteBranch = useCallback(
    async (branchId) => {
      if (isPublic || !tenantId || loading || tenantLoading || loadedScope !== scope || !visibleBranches.some((branch) => branch.id === branchId))
        return { error: branchError("unavailable", "Branch is unavailable") };
      if (mutationPending.current) return { error: branchError("busy", "A branch change is already in progress") };
      mutationPending.current = true;
      const operationScope = scope;
      try {
        // The RPC is the only app-facing delete path; it checks authorization,
        // emptiness and concurrency in the database rather than trusting the UI.
        const { data, error: deleteError } = await supabase.rpc("delete_empty_branch", { p_branch_id: branchId });
        if (deleteError) return { error: deleteError };
        if (data !== true) return { error: branchError("unavailable", "The server did not confirm branch deletion") };
        if (currentScope.current === operationScope) {
          // Clear stale rows immediately and reload the authoritative list. A
          // failed reload leaves the list empty with the existing retry alert.
          const result = await loadBranches();
          return { data, error: null, reloadError: result?.error || null };
        }
        return { data, error: null };
      } catch (deleteError) {
        return { error: deleteError };
      } finally {
        mutationPending.current = false;
      }
    },
    [visibleBranches, isPublic, tenantId, loading, tenantLoading, loadedScope, scope, loadBranches],
  );
  const value = useMemo(
    () => ({
      branches: visibleBranches,
      selectedBranch,
      selectedBranchId: selectedBranch?.id || null,
      branchSlug: selectedBranch?.slug || null,
      publicBranchSlug,
      loading,
      error,
      capabilities,
      creationReason,
      selectBranch,
      createBranch,
      renameBranch,
      deleteBranch,
      reloadBranches: loadBranches,
      tenantSlug,
    }),
    [visibleBranches, selectedBranch, publicBranchSlug, loading, error, capabilities, creationReason,
      selectBranch, createBranch, renameBranch, deleteBranch, loadBranches, tenantSlug],
  );
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export const useBranch = () => useContext(BranchContext) || {
  branches: [],
  selectedBranch: null,
  selectedBranchId: null,
  branchSlug: null,
  publicBranchSlug: null,
  loading: false,
  error: "",
  capabilities: getPlanCapabilities(null),
  creationReason: "unauthorized",
  selectBranch: () => {},
  createBranch: async () => ({ error: new Error("Branch provider unavailable") }),
  renameBranch: async () => ({ error: new Error("Branch provider unavailable") }),
  deleteBranch: async () => ({ error: new Error("Branch provider unavailable") }),
  reloadBranches: async () => {},
  tenantSlug: null,
};
