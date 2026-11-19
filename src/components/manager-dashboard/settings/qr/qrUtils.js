// Keep these routes aligned with TablesContext and the public menu route.
export function tableQrUrl(origin, slug, tableNumber, branchSlug) {
  return slug ? `${origin}/menu/${slug}/${tableNumber}?branch=${encodeURIComponent(branchSlug || "main")}` : "";
}

export function cashierQrUrl(origin, slug, branchSlug) {
  return slug ? `${origin}/menu/${slug}?branch=${encodeURIComponent(branchSlug || "main")}&cashier=1` : "";
}

export function contrastAgainstWhite(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 1;
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return 1.05 / (luminance + 0.05);
}

export function textOnColor(hex) {
  return contrastAgainstWhite(hex) >= 4.5 ? "#ffffff" : "#111111";
}
