import test from "node:test";
import assert from "node:assert/strict";
import { fetchOwnerPage, searchOwnerDirectory } from "./ownerDirectory.js";

test("search examines later pages and reports progress without assuming a search parameter", async () => {
  const calls = [];
  const progress = [];
  const callOwner = async (action, body) => {
    calls.push([action, body]);
    return body.page === 1
      ? { page: 1, has_more: true, users: [{ id: "one", email: "first@example.com" }] }
      : { page: 2, has_more: false, users: [{ id: "two", email: "target@example.com" }] };
  };
  const result = await searchOwnerDirectory(callOwner, "target", { onProgress: (page) => progress.push(page) });
  assert.deepEqual(result, { users: [{ id: "two", email: "target@example.com" }], pagesChecked: 2 });
  assert.deepEqual(calls, [["list", { page: 1 }], ["list", { page: 2 }]]);
  assert.deepEqual(progress, [1, 2]);
});

test("invalid or repeated pages are rejected rather than showing incomplete results", async () => {
  await assert.rejects(() => fetchOwnerPage(async () => ({ page: 1, has_more: true, users: [] }), 1), /Invalid pagination/);
  await assert.rejects(() => searchOwnerDirectory(async (_action, { page }) => ({ page, has_more: page < 2, users: [{ id: "same" }] }), "same"), /Invalid pagination/);
});

test("search stops when cancelled and fails explicitly at the safety limit", async () => {
  const callOwner = async (_action, { page }) => ({ page, has_more: true, users: [{ id: String(page) }] });
  assert.equal(await searchOwnerDirectory(callOwner, "x", { isActive: () => false }), null);
  await assert.rejects(() => searchOwnerDirectory(callOwner, "x", { maxPages: 2 }), /safe pagination limit/);
});
