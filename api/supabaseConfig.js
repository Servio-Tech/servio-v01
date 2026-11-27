// Shared server-side resolver: prefer explicit API vars, then Vite client vars used by this deployment.
export function getSupabaseConfig(env = process.env) {
  const firstDefined = (...values) => values.map((value) => String(value || "").trim()).find(Boolean) || "";
  return {
    url: firstDefined(env.SUPABASE_URL, env.VITE_SUPABASE_URL, env.REACT_APP_SUPABASE_URL),
    key: firstDefined(env.SUPABASE_ANON_KEY, env.VITE_SUPABASE_KEY, env.REACT_APP_SUPABASE_KEY),
  };
}
