// Browser-local rules only. These suggestions never change prices or submit an order.
const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeSmartWaiterText(value) {
  return String(value || "").toLowerCase()
    .replace(/[٠-٩۰-۹]/g, (digit) => String(DIGITS.includes(digit) ? DIGITS.indexOf(digit) : PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[\u064b-\u065f\u0670ـ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}.]+/gu, " ").trim();
}

const INTENTS = {
  drink: ["drink", "drinks", "beverage", "beverages", "مشروب", "مشروبات", "عصير", "juice"],
  coffee: ["coffee", "latte", "cappuccino", "espresso", "قهوه", "كافيه", "لاتيه", "اسبريسو", "كابتشينو"],
  tea: ["tea", "شاي"],
  dessert: ["dessert", "desserts", "sweet", "sweets", "cake", "حلي", "حلويات", "كيك", "تحليه"],
  meal: ["meal", "food", "lunch", "dinner", "وجبه", "اكل", "غداء", "عشاء"],
  breakfast: ["breakfast", "فطور", "افطار"],
};
const STOP_WORDS = new Set(["recommend", "recommendation", "recommendations", "suggest", "suggestion", "please", "show", "find", "what", "would", "you", "like", "i", "me", "a", "an", "the", "for", "with", "under", "below", "within", "up", "to", "budget", "max", "maximum", "less", "than", "sar", "aed", "usd", "اقترح", "اقترحي", "اقتراح", "اقتراحات", "ابي", "ابغى", "اريد", "اريدك", "ماذا", "ممكن", "اعطني", "لي", "من", "مع", "في", "بحد", "تحت", "اقل", "الميزانيه", "ميزانيه", "ميزانيتي", "ريال", "ريالات", "ر", "س"]);
const includesWord = (text, word) => text.split(" ").some((token) => token === word || (word.length >= 4 && token.includes(word)));

// This simple matcher cannot establish dietary safety. Never turn an exclusion
// or allergy request into a positive recommendation for the excluded item.
export function hasUnsupportedDietaryConstraint(query) {
  const text = normalizeSmartWaiterText(query);
  const tokens = text.split(" ");
  const blocked = new Set(["no", "not", "without", "avoid", "excluding", "exclude", "free", "non", "cannot", "cant", "vegan", "vegetarian", "بدون", "بلا", "لا", "ما", "مو", "ممنوع", "عدم", "استبعد", "تجنب", "خالي", "خال", "خاليه"]);
  return tokens.some((word) => blocked.has(word) || word.startsWith("allerg") || word.startsWith("intoleran") || word.startsWith("حساس"))
    || /\bcan t\b/.test(text);
}

export function parseSmartWaiterQuery(rawQuery) {
  const text = normalizeSmartWaiterText(rawQuery);
  const budgetMatch = text.match(/(?:under|below|within|budget|maximum|max|less than|تحت|اقل من|ميزانيتي|الميزانيه|ميزانيه|بحد)\s*(?:of|is|الى|حتى)?\s*(\d+(?:\.\d+)?)/);
  const budget = budgetMatch ? Number(budgetMatch[1]) : null;
  const intents = Object.values(INTENTS).filter((words) => words.some((word) => includesWord(text, word)));
  const terms = text.split(" ").filter((word) => word && !STOP_WORDS.has(word) && !/^\d+(?:\.\d+)?$/.test(word));
  return { budget: Number.isFinite(budget) && budget >= 0 ? budget : null, intents, terms };
}

export function getSmartWaiterPeriod(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export function getSmartWaiterGreeting(language, hour = new Date().getHours()) {
  const period = getSmartWaiterPeriod(hour);
  const greetings = {
    ar: { morning: "صباح الخير!", afternoon: "أهلاً بك!", evening: "مساء الخير!" },
    en: { morning: "Good morning!", afternoon: "Welcome!", evening: "Good evening!" },
  };
  return greetings[language === "en" ? "en" : "ar"][period];
}

const PERIOD_WORDS = {
  morning: ["breakfast", "coffee", "tea", "فطور", "افطار", "قهوه", "شاي"],
  afternoon: ["lunch", "meal", "sandwich", "غداء", "وجبه", "ساندويتش"],
  evening: ["dinner", "dessert", "tea", "عشاء", "حلويات", "حلي", "شاي"],
};

export function getSmartWaiterPromotionScope(tenant, branch, publicBranchSlug) {
  // A public branch must belong to the resolved tenant, and an explicit QR branch must match.
  if (!tenant?.id || !branch?.id || !branch?.tenant_id || String(branch.tenant_id) !== String(tenant.id)) return null;
  if (publicBranchSlug && branch.slug !== publicBranchSlug) return null;
  return { tenantId: tenant.id, branchId: branch.id };
}

export function getSmartWaiterSuggestions({ items = [], categories = [], cartItems = [], promotions = [], budget = null, query = "", hour = new Date().getHours(), dismissedIds = [], limit = 3 } = {}) {
  if (hasUnsupportedDietaryConstraint(query)) return [];
  const queryData = parseSmartWaiterQuery(query);
  const rawBudget = budget == null ? "" : String(budget).trim();
  const normalizedBudget = rawBudget.replace(/[٠-٩۰-۹]/g, (digit) => String(DIGITS.includes(digit) ? DIGITS.indexOf(digit) : PERSIAN_DIGITS.indexOf(digit)));
  const typedBudget = rawBudget === "" ? null : Number(normalizedBudget);
  const maxPrice = Number.isFinite(typedBudget) && typedBudget >= 0 ? typedBudget : queryData.budget;
  const excluded = new Set([...cartItems.map((item) => String(item?.id ?? item?.menu_item_id ?? "")), ...dismissedIds.map(String)]);
  const catalog = new Map(items.filter((item) => item?.id != null).map((item) => [String(item.id), item]));
  const paired = new Set();
  cartItems.forEach((entry) => {
    const source = catalog.get(String(entry?.id ?? entry?.menu_item_id ?? ""));
    const ids = Array.isArray(source?.recommendation_item_ids) ? source.recommendation_item_ids : entry?.recommendation_item_ids;
    if (Array.isArray(ids)) ids.forEach((id) => paired.add(String(id)));
  });
  const categoryById = new Map(categories.map((category) => [String(category.id), category]));
  const offersByItem = new Map();
  promotions.forEach((offer) => {
    if (!Array.isArray(offer?.target_item_ids) || !(offer.title_ar || offer.title_en)) return;
    offer.target_item_ids.forEach((id) => { if (!offersByItem.has(String(id))) offersByItem.set(String(id), offer); });
  });
  const period = getSmartWaiterPeriod(hour);
  const seen = new Set();
  return items.flatMap((item, index) => {
    const id = String(item?.id ?? "");
    const price = item?.price == null || item.price === "" ? NaN : Number(item.price);
    if (!id || seen.has(id) || excluded.has(id) || (item?.isAvailableForSale ?? item?.available) !== true || !Number.isFinite(price) || price < 0 || (maxPrice !== null && price > maxPrice)) return [];
    seen.add(id);
    const category = categoryById.get(String(item.category_id)) || {};
    const searchText = normalizeSmartWaiterText([item.name, item.name_en, item.description, item.description_en, category.name, category.name_en, ...(Array.isArray(item.tags) ? item.tags : [])].filter(Boolean).join(" "));
    if (queryData.intents.length && !queryData.intents.some((words) => words.some((word) => includesWord(searchText, word)))) return [];
    if (!queryData.intents.length && queryData.terms.length && !queryData.terms.some((word) => includesWord(searchText, word))) return [];
    const pairing = paired.has(id);
    const offer = offersByItem.get(id) || null;
    const timeMatch = PERIOD_WORDS[period].some((word) => includesWord(searchText, word));
    return [{ item, promotion: offer, reason: pairing ? "pairing" : offer ? "promotion" : timeMatch ? period : "menu", score: (pairing ? 10 : 0) + (offer ? 5 : 0) + (timeMatch ? 3 : 0), index }];
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, Math.max(0, limit));
}
