const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const DAY_MS = 86_400_000;
const MAX_PER_DAY = 500;
const MAX_QUERY = 160;
const MAX_ITEMS = 80;

function send(res, status, payload) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function clientKey(req, tenantId) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `${String(tenantId || "public").slice(0, 80)}:${forwarded || "unknown"}`;
}

function allowed(bucket, now) {
  if (!bucket || now - bucket.dayStarted >= DAY_MS) bucket = { windowStarted: now, windowCount: 0, dayStarted: now, dayCount: 0 };
  if (now - bucket.windowStarted >= WINDOW_MS) { bucket.windowStarted = now; bucket.windowCount = 0; }
  if (bucket.windowCount >= MAX_PER_WINDOW || bucket.dayCount >= MAX_PER_DAY) return { ok: false, bucket };
  bucket.windowCount += 1;
  bucket.dayCount += 1;
  return { ok: true, bucket };
}

function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_ITEMS).map((item) => ({
    id: String(item?.id || "").slice(0, 80),
    name: String(item?.name || "").slice(0, 120),
    description: String(item?.description || "").slice(0, 240),
    price: Number(item?.price) || 0,
  })).filter((item) => item.id && item.name);
}

function parseModelJson(text, ids) {
  try {
    const parsed = JSON.parse(String(text || "").replace(/^```json\s*|```$/g, "").trim());
    const list = Array.isArray(parsed) ? parsed : parsed?.suggestions;
    if (!Array.isArray(list)) return [];
    const allowedIds = new Set(ids);
    return list.slice(0, 5).map((entry) => ({
      id: String(entry?.id || ""),
      reason: String(entry?.reason || "اقتراح مناسب لك").slice(0, 160),
    })).filter((entry) => allowedIds.has(entry.id));
  } catch { return []; }
}

export default async function smartWaiter(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Method not allowed" }); }
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  const tenantId = String(body?.tenantId || "").slice(0, 80);
  const query = String(body?.query || "").trim().slice(0, MAX_QUERY);
  const items = cleanItems(body?.items);
  if (!tenantId || !items.length) return send(res, 400, { error: "Invalid waiter request" });
  const now = Date.now();
  const key = clientKey(req, tenantId);
  const result = allowed(buckets.get(key), now);
  buckets.set(key, result.bucket);
  if (!result.ok) return send(res, 429, { error: "Waiter usage limit reached", retry_after_seconds: 60, fallback: true });
  const apiKey = String(process.env.GEMINI_API_KEY || "");
  if (!apiKey) return send(res, 503, { error: "Gemini is not configured", fallback: true });
  const model = String(process.env.GEMINI_MODEL || "gemini-3.6-flash");
  const catalog = items.map(({ id, name, description, price }) => ({ id, name, description, price })).slice(0, MAX_ITEMS);
  const prompt = [
    "أنت ويتر سعودي لطيف لمطعم. اقترح أصنافاً من الكتالوج فقط وبلهجة سعودية خفيفة ومهذبة.",
    "لا تغيّر الأسعار ولا تخترع أصنافاً ولا تتحدث عن الحساسية كضمان.",
    "أرجع JSON فقط بهذا الشكل: [{\"id\":\"معرف من الكتالوج\",\"reason\":\"سبب قصير باللهجة السعودية\"}]، بحد أقصى 3 اقتراحات.",
    `طلب العميل: ${query || "اقترح شيئاً مناسباً"}`,
    `الكتالوج: ${JSON.stringify(catalog)}`,
  ].join("\n");
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 350, responseMimeType: "application/json" } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error("Smart waiter Gemini provider status", response.status);
      return send(res, response.status === 429 ? 429 : 502, { error: "Gemini request failed", fallback: true, provider_status: response.status });
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    return send(res, 200, { suggestions: parseModelJson(text, items.map((item) => item.id)), model });
  } catch (error) {
    console.error("Smart waiter Gemini request failed", error?.name || "unknown");
    return send(res, 502, { error: "Gemini unavailable", fallback: true });
  }
};
