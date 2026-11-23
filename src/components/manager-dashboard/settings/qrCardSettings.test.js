import test from "node:test";
import assert from "node:assert/strict";
import {
  BORDER_MIN_CONTRAST, DEFAULT_QR_SETTINGS, QR_COLOR_MIN_CONTRAST,
  contrastRatio, normalizeQRSettings, qrSettingsKey, readQRSettings,
  readableTextColor, writeQRSettings,
} from "./qrCardSettings.js";

test("foreground remains dark on a white quiet zone and borders remain distinguishable", () => {
  const value = normalizeQRSettings({ qrColor: "#ffff00", cardColor: "#ffffff", borderColor: "#fefefe" });
  assert.equal(value.qrColor, DEFAULT_QR_SETTINGS.qrColor);
  assert.ok(contrastRatio(value.qrColor, "#ffffff") >= QR_COLOR_MIN_CONTRAST);
  assert.ok(contrastRatio(value.cardColor, value.borderColor) >= BORDER_MIN_CONTRAST);
  assert.ok(contrastRatio(readableTextColor("#ffffff"), "#ffffff") >= 4.5);
  assert.ok(contrastRatio(readableTextColor("#111111"), "#111111") >= 4.5);
});

test("valid choices survive normalization; sizes and image data are constrained", () => {
  const value = normalizeQRSettings({ tableSize: 99, captionSize: 1, qrSize: 240, qrColor: "#003c42", cardColor: "#f8f0e0", borderColor: "#872d15", borderStyle: "double", caption: "Scan here", showLogo: false, logoDataUrl: "data:image/svg+xml;base64,AAA" });
  assert.equal(value.tableSize, 40);
  assert.equal(value.captionSize, 12);
  assert.equal(value.qrSize, 240);
  assert.equal(value.qrColor, "#003c42");
  assert.equal(value.borderStyle, "double");
  assert.equal(value.caption, "Scan here");
  assert.equal(value.showLogo, false);
  assert.equal(value.logoDataUrl, "");
});

test("settings are separated by both tenant and branch and storage errors are reported", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const a = qrSettingsKey("tenant.a", "branch/one");
  const b = qrSettingsKey("tenant.a", "branch/two");
  const c = qrSettingsKey("tenant.b", "branch/one");
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(qrSettingsKey("tenant.a", null), null);
  assert.equal(writeQRSettings(storage, a, { ...DEFAULT_QR_SETTINGS, caption: "First branch" }), true);
  assert.equal(readQRSettings(storage, a).settings.caption, "First branch");
  assert.equal(readQRSettings(storage, b).settings.caption, null);
  assert.equal(writeQRSettings({ setItem: () => { throw Error("quota"); } }, a, DEFAULT_QR_SETTINGS), false);
  assert.equal(readQRSettings({ getItem: () => { throw Error("blocked"); } }, a).available, false);
});
