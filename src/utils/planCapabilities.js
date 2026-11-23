// جميع الميزات متاحة في الباقتين؛ يختلف فقط العدد الإجمالي للفروع.
export function getBranchLimit(plan) {
  if (plan === "starter") return 1;
  if (plan === "pro") return 3;
  return null;
}

export function canAddBranch(plan, branchCount) {
  const limit = getBranchLimit(plan);
  return limit !== null && Number.isInteger(branchCount) && branchCount >= 0 && branchCount < limit;
}
