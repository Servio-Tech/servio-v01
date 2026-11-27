import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import signQzRequest from "./signature.js";
import { SERVIO_CERTIFICATE_PUBLIC_KEY_SHA256, matchesServioCertificate } from "./certificateFingerprint.js";

const directory = dirname(fileURLToPath(import.meta.url));

describe("SERVIO QZ certificate and signer", () => {
  test("matches the bundled public certificate and installed override.crt", () => {
    const certificateBytes = readFileSync(resolve(directory, "../../public/servio-qz-certificate.txt"));
    const overrideBytes = readFileSync(resolve(directory, "../../printer-setup/override.crt"));
    const certificate = new X509Certificate(certificateBytes);
    const actualFingerprint = createHash("sha256")
      .update(certificate.publicKey.export({ type: "spki", format: "der" }))
      .digest("hex");

    assert.equal(actualFingerprint, SERVIO_CERTIFICATE_PUBLIC_KEY_SHA256);
    assert.equal(overrideBytes.equals(certificateBytes), true);
  });

  test("rejects a signing key that does not match the SERVIO certificate", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    assert.equal(matchesServioCertificate(privateKey.export({ type: "pkcs8", format: "pem" })), false);
    assert.equal(matchesServioCertificate("not a private key"), false);
  });

  test("loads the signing endpoint as an ESM function and rejects unsupported methods", async () => {
    const response = {
      statusCode: 200,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      send(body) { this.body = body; return this; },
    };
    await signQzRequest({ method: "GET", headers: {} }, response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.body, "Method not allowed");
  });
});
