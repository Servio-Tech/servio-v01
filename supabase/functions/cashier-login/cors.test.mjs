import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function loadCashierLoginHandler() {
  const source = (await readFile(new URL("./index.js", import.meta.url), "utf8"))
    .replace(/^import .*;\s*$/gm, "");
  let handler;
  globalThis.Deno = {
    env: { get: () => "local-test" },
    serve: (registeredHandler) => { handler = registeredHandler; },
  };
  await import(`data:text/javascript;base64,${Buffer.from(`${source}\n// cors-test`).toString("base64")}`);
  return handler;
}

test("cashier login allows only SERVIO Vercel preview origins in CORS", async () => {
  const handler = await loadCashierLoginHandler();
  const previewOrigin = "https://servio-mvp-git-review-servio-production-read-fc86b1-servio-tech.vercel.app";
  const previewResponse = await handler(new Request("https://edge.test/", {
    method: "OPTIONS",
    headers: { origin: previewOrigin },
  }));
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get("access-control-allow-origin"), previewOrigin);

  const untrustedOrigin = "https://servio-mvp-git-review-evil.vercel.app.attacker.test";
  const untrustedResponse = await handler(new Request("https://edge.test/", {
    method: "OPTIONS",
    headers: { origin: untrustedOrigin },
  }));
  assert.equal(untrustedResponse.status, 200);
  assert.notEqual(untrustedResponse.headers.get("access-control-allow-origin"), untrustedOrigin);
  assert.equal(untrustedResponse.headers.get("access-control-allow-origin"), "https://servio-mvp.vercel.app");
});
