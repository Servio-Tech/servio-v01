// Branch counts include inactive records: an inactive branch is still a branch.
// This is a UI/workflow check, not a substitute for a server-side plan limit.
export function branchCreationReason({ tenantId, isPublic, loading, branchCount, capabilities }) {
  if (isPublic || !tenantId) return "unauthorized";
  if (loading || !Number.isInteger(branchCount) || branchCount < 0) return "loading";
  // A newly provisioned tenant may have no branch. Creating its first branch
  // is not a multi-branch capability and keeps onboarding usable.
  if (branchCount === 0) return "allowed";
  if (branchCount >= 3) return "branch_limit";
  if (capabilities?.plan === "pro" && capabilities?.multiBranch === true && capabilities?.maxBranches === 3) return "allowed";
  return capabilities?.plan === "starter" ? "plan_limit" : "plan_unknown";
}

export function validateBranchName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  const length = [...name].length;
  return length >= 2 && length <= 120 ? name : null;
}

export function branchSlugForName(name, branches) {
  // A first branch needs the canonical slug used by existing server fallbacks.
  if (branches.length === 0) return "main";
  const base = (name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "")) || "branch";
  const used = new Set(branches.map((branch) => branch.slug));
  let slug = base;
  let suffix = 2;
  while (used.has(slug)) slug = `${base}-${suffix++}`;
  return slug;
}
