import test from "node:test";
import assert from "node:assert/strict";
import { validateAdminRegistration } from "./registrationErrors.js";

const valid = { email: "manager@example.com", password: "123456", full_name: "Manager", store_name: "Cafe", store_slug: "my-cafe" };
test("the owner console route cannot be claimed by a new business", () => {
  assert.equal(validateAdminRegistration({ ...valid, store_slug: "OWNER-CONSOLE" }), "slug");
  assert.equal(validateAdminRegistration(valid), null);
});
