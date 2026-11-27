const SERVICE_WORKER_PATH = "/sw.js";

export function supportsWebPush() {
  return Boolean(
    typeof window !== "undefined" &&
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
  );
}

export async function getPushRegistration() {
  if (!supportsWebPush()) return null;
  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) {
    registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: "/" });
  }
  if (!registration?.pushManager) return null;
  if (!registration.active && navigator.serviceWorker.ready) {
    registration = await navigator.serviceWorker.ready || registration;
  }
  return registration?.pushManager ? registration : null;
}

export function base64UrlToUint8Array(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("A non-empty base64url value is required");
  }
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const decode = globalThis.atob || globalThis.window?.atob?.bind(globalThis.window);
  if (typeof decode !== "function") throw new Error("Base64 decoding is unavailable");
  const raw = decode(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function toByteView(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

export function subscriptionUsesApplicationServerKey(subscription, publicKey) {
  const existingKey = toByteView(subscription?.options?.applicationServerKey);
  if (!existingKey) return false;
  let expectedKey;
  try {
    expectedKey = base64UrlToUint8Array(publicKey);
  } catch {
    return false;
  }
  if (existingKey.length !== expectedKey.length) return false;
  return existingKey.every((byte, index) => byte === expectedKey[index]);
}

export function getPushDeviceLabel() {
  if (typeof navigator === "undefined") return "Cashier device";
  const platform = String(navigator.userAgentData?.platform || navigator.platform || "Browser")
    .replace(/[^a-zA-Z0-9 ._-]/g, "")
    .trim()
    .slice(0, 32);
  return platform ? `Cashier · ${platform}` : "Cashier device";
}
