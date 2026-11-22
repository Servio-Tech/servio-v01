// Pure helpers for the manager's local-only QR card preferences.
export const DEFAULT_QR_SETTINGS = Object.freeze({
  tableSize: 22,
  captionSize: 14,
  caption: null, // null follows the current UI language; an empty string is intentional.
  qrSize: 180,
  qrColor: "#181512",
  cardColor: "#fffaf0",
  borderColor: "#b65125",
  borderStyle: "solid",
  showLogo: true,
  logoDataUrl: "",
});

export const QR_BORDER_STYLES = ["solid", "double", "dashed", "dotted", "square"];
export const QR_COLOR_MIN_CONTRAST = 7;
export const BORDER_MIN_CONTRAST = 2;
export const MAX_LOGO_DATA_LENGTH = 400000;

const isHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const bounded = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};

export function contrastRatio(a, b) {
  if (!isHex(a) || !isHex(b)) return 0;
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export function readableTextColor(background) {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff")
    ? "#000000" : "#ffffff";
}

export function qrSettingsKey(tenantId, branchId) {
  if (!tenantId || !branchId) return null;
  return `servio.qr-card.v1.${encodeURIComponent(JSON.stringify([String(tenantId), String(branchId)]))}`;
}

export function normalizeQRSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  const defaults = DEFAULT_QR_SETTINGS;
  const qrColor = isHex(source.qrColor) && contrastRatio(source.qrColor, "#ffffff") >= QR_COLOR_MIN_CONTRAST
    ? source.qrColor : defaults.qrColor;
  let cardColor = isHex(source.cardColor) ? source.cardColor : defaults.cardColor;
  let borderColor = isHex(source.borderColor) ? source.borderColor : defaults.borderColor;
  if (contrastRatio(cardColor, borderColor) < BORDER_MIN_CONTRAST) {
    cardColor = defaults.cardColor;
    borderColor = defaults.borderColor;
  }
  const logoDataUrl = typeof source.logoDataUrl === "string" && source.logoDataUrl.length <= MAX_LOGO_DATA_LENGTH
    && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source.logoDataUrl)
    ? source.logoDataUrl : "";
  return {
    tableSize: bounded(source.tableSize ?? defaults.tableSize, 14, 40, defaults.tableSize),
    captionSize: bounded(source.captionSize ?? defaults.captionSize, 12, 24, defaults.captionSize),
    caption: source.caption === null || typeof source.caption === "string" ? source.caption?.slice(0, 120) ?? null : null,
    qrSize: bounded(source.qrSize ?? defaults.qrSize, 150, 240, defaults.qrSize),
    qrColor, cardColor, borderColor,
    borderStyle: QR_BORDER_STYLES.includes(source.borderStyle) ? source.borderStyle : defaults.borderStyle,
    showLogo: typeof source.showLogo === "boolean" ? source.showLogo : defaults.showLogo,
    logoDataUrl,
  };
}

export function readQRSettings(storage, key) {
  if (!storage || !key) return { settings: { ...DEFAULT_QR_SETTINGS }, available: false };
  try {
    const value = storage.getItem(key);
    return { settings: normalizeQRSettings(value ? JSON.parse(value) : {}), available: true };
  } catch {
    return { settings: { ...DEFAULT_QR_SETTINGS }, available: false };
  }
}

export function writeQRSettings(storage, key, settings) {
  if (!storage || !key) return false;
  try {
    storage.setItem(key, JSON.stringify(normalizeQRSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
