import { test } from "node:test";
import assert from "node:assert/strict";
import { branchCreationReason, branchSlugForName, validateBranchName } from "./branchManagement.js";

const unknown = { plan: "unknown", multiBranch: false };
const context = { tenantId: "tenant-1", isPublic: false, loading: false, branchCount: 0, capabilities: unknown };

test("permits first branch but fails closed for additional unknown-plan branches", () => {
  assert.equal(branchCreationReason(context), "allowed");
  assert.equal(branchCreationReason({ ...context, branchCount: 1 }), "plan_unknown");
  assert.equal(branchCreationReason({ ...context, branchCount: 2 }), "plan_unknown");
  assert.equal(branchCreationReason({ ...context, branchCount: 1, capabilities: { plan: "unknown", multiBranch: true } }), "plan_unknown");
});

test("does not permit creation before a complete branch count or for a public visitor", () => {
  for (const branchCount of [null, undefined, -1, 1.5]) assert.equal(branchCreationReason({ ...context, branchCount }), "loading");
  assert.equal(branchCreationReason({ ...context, loading: true }), "loading");
  assert.equal(branchCreationReason({ ...context, isPublic: true }), "unauthorized");
  assert.equal(branchCreationReason({ ...context, tenantId: null }), "unauthorized");
});

test("Starter stays single-branch and Pro is limited to three total branches", () => {
  const starter = { plan: "starter", multiBranch: false, maxBranches: 1 };
  const pro = { plan: "pro", multiBranch: true, maxBranches: 3 };
  assert.equal(branchCreationReason({ ...context, branchCount: 1, capabilities: starter }), "plan_limit");
  assert.equal(branchCreationReason({ ...context, branchCount: 1, capabilities: pro }), "allowed");
  assert.equal(branchCreationReason({ ...context, branchCount: 2, capabilities: pro }), "allowed");
  assert.equal(branchCreationReason({ ...context, branchCount: 3, capabilities: pro }), "branch_limit");
  assert.equal(branchCreationReason({ ...context, branchCount: 4, capabilities: pro }), "branch_limit");
  assert.equal(branchCreationReason({ ...context, branchCount: 1, capabilities: { plan: "pro", multiBranch: true } }), "plan_unknown");
});

test("validates branch names using the table's 2–120 character bounds", () => {
  assert.equal(validateBranchName("  Cafe  "), "Cafe");
  assert.equal(validateBranchName("ا"), null);
  assert.equal(validateBranchName("🚀🚀"), "🚀🚀");
  assert.equal(validateBranchName("a".repeat(120)), "a".repeat(120));
  assert.equal(validateBranchName("a".repeat(121)), null);
  assert.equal(validateBranchName(null), null);
});

test("uses a canonical first branch slug and never reuses inactive slugs", () => {
  assert.equal(branchSlugForName("Cafe", []), "main");
  assert.equal(branchSlugForName("فرع", [{ slug: "main" }, { slug: "branch", is_active: false }]), "branch-2");
  assert.equal(branchSlugForName("Cafe", [{ slug: "cafe" }, { slug: "cafe-2" }]), "cafe-3");
  const slug = branchSlugForName(`${"a".repeat(47)} b`, [{ slug: "main" }]);
  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});
