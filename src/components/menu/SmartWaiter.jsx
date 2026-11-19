import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Collapse, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import MicNoneIcon from "@mui/icons-material/MicNone";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import ItemDetailsDrawer from "./ItemDetailsDrawer";
import { useCart } from "../../context/CartContext";
import { useMenu } from "../../context/MenuContext";
import supabase from "../../supabase";
import { getActivePromotions } from "../../utils/promotions";
import { getSmartWaiterGreeting, getSmartWaiterPromotionScope, getSmartWaiterSuggestions, hasUnsupportedDietaryConstraint } from "../../utils/smartWaiter";

const MAX_DISMISSALS = 3;
const labels = {
  ar: {
    title: "مساعد المنيو", intro: "أساعدك في اختيار صنف من القائمة.", open: "اقترح لي", close: "إخفاء المساعد",
    description: "اقتراحات بسيطة من القائمة حسب الوقت وسلتك، وبحد السعر الذي تختاره.",
    query: "ماذا تفضّل؟ (اختياري)", queryHint: "مثلاً: قهوة، حلوى، أو تحت ٣٠", budget: "الحد الأقصى لسعر الصنف", budgetHint: "لسعر صنف واحد قبل العروض، وليس لإجمالي السلة", invalidBudget: "أدخل مبلغاً غير سالب.",
    mic: "تحدث", listening: "إيقاف الاستماع", micHint: "الصوت اختياري؛ قد يعالجه مزوّد المتصفح خارج جهازك. يمكنك الكتابة بدلاً منه.",
    micUnavailable: "التعرف الصوتي غير متاح؛ يمكنك الكتابة.", micError: "تعذّر الاستماع أو لم تُمنح صلاحية الميكروفون. يمكنك الكتابة والمحاولة مجدداً.",
    speak: "استمع للاقتراحات", speechUnavailable: "لا يتوفر صوت بهذه اللغة في المتصفح؛ يمكنك قراءة الاقتراحات.",
    details: "عرض التفاصيل", dismiss: "لا أرغب بهذا الاقتراح", empty: "لا توجد أصناف مطابقة الآن. جرّب تغيير الطلب أو حد السعر.",
    pairing: "مناسب مع ما في سلتك", promotion: "ضمن عرض حالي", morning: "فكرة للصباح", afternoon: "فكرة لمنتصف اليوم", evening: "فكرة للمساء", menu: "من القائمة",
    offer: "عرض", offerNote: "يُعاد التحقق من السعر المخفّض من المطعم عند إرسال الطلب.",
    allergyWarning: "لا يمكن للمساعد ضمان خلو الأصناف من مسببات الحساسية. اسأل فريق المطعم عن المكونات قبل الطلب.", allergyRequest: "لا أستطيع التحقق من قيود الحساسية أو الاستبعاد. يرجى سؤال فريق المطعم قبل الاختيار.",
  },
  en: {
    title: "Menu assistant", intro: "I can help you choose from the menu.", open: "Suggest something", close: "Hide assistant",
    description: "Simple menu suggestions based on the time, your cart, and your chosen price limit.",
    query: "What do you prefer? (optional)", queryHint: "For example: coffee, dessert, or under 30", budget: "Maximum price per item", budgetHint: "One item's menu price before offers, not the cart total", invalidBudget: "Enter a non-negative amount.",
    mic: "Speak", listening: "Stop listening", micHint: "Voice is optional; your browser provider may process audio off-device. You can type instead.",
    micUnavailable: "Speech recognition is unavailable; you can type instead.", micError: "Couldn't listen or microphone permission was denied. You can type or try again.",
    speak: "Hear suggestions", speechUnavailable: "No voice is available for this language; please read the suggestions.",
    details: "View details", dismiss: "Not interested in this suggestion", empty: "No matching items right now. Try another request or price limit.",
    pairing: "Pairs with your cart", promotion: "In a current offer", morning: "A morning idea", afternoon: "An afternoon idea", evening: "An evening idea", menu: "From the menu",
    offer: "Offer", offerNote: "The discounted price is checked again by the restaurant when you send the order.",
    allergyWarning: "This assistant cannot guarantee allergen-free items. Ask restaurant staff about ingredients before ordering.", allergyRequest: "I cannot verify allergy or dietary exclusions. Please ask restaurant staff before choosing.",
  },
};

function readDismissals(key) {
  try {
    const data = JSON.parse(window.sessionStorage.getItem(key) || "{}");
    return { count: Math.min(MAX_DISMISSALS, Math.max(0, Number(data.count) || 0)), ids: Array.isArray(data.ids) ? data.ids.map(String).slice(0, MAX_DISMISSALS) : [] };
  } catch { return { count: 0, ids: [] }; }
}

export default function SmartWaiter({ tenant, branch, branchLoading, publicBranchSlug, language, currency = "SAR" }) {
  const isEnglish = language === "en";
  const text = labels[isEnglish ? "en" : "ar"];
  const { cartItems } = useCart();
  const { items, categoriesList, menuLoading } = useMenu();
  const scope = getSmartWaiterPromotionScope(tenant, branch, publicBranchSlug);
  const scopeKey = `${tenant?.id || "unknown"}:${branch?.id || "none"}`;
  const storageKey = `servio.smartWaiter.dismissals:${encodeURIComponent(scopeKey)}`;
  const [dismissals, setDismissals] = useState(() => readDismissals(storageKey));
  const [hidden, setHidden] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState("");
  const [offersState, setOffersState] = useState({ scope: "", offers: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [robotOpen, setRobotOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiState, setAiState] = useState("idle");
  const [hour, setHour] = useState(() => new Date().getHours());
  const recognitionRef = useRef(null);
  const previousLanguageRef = useRef(language);
  const Recognition = typeof window === "undefined" ? null : (window.SpeechRecognition || window.webkitSpeechRecognition);
  const canSpeak = typeof window !== "undefined" && Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  const offerScope = scope ? `${scope.tenantId}:${scope.branchId}` : "";
  const offers = offersState.scope === offerScope ? offersState.offers : [];
  const invalidBudget = budget !== "" && (!Number.isFinite(Number(budget)) || Number(budget) < 0);
  // Menu context can temporarily contain the previous branch while a new one loads.
  const scopedItems = useMemo(() => {
    if (branchLoading || (branch && !offerScope)) return [];
    return items.filter((item) => (!item.tenant_id || String(item.tenant_id) === String(tenant?.id))
      && (!branch?.id || !item.branch_id || String(item.branch_id) === String(branch.id)));
  }, [items, tenant?.id, branch?.id, branchLoading, offerScope]);
  const suggestions = useMemo(() => getSmartWaiterSuggestions({
    items: scopedItems, categories: categoriesList, cartItems, promotions: offers,
    budget: invalidBudget ? null : budget, query, hour, dismissedIds: dismissals.ids,
  }), [scopedItems, categoriesList, cartItems, offers, budget, invalidBudget, query, hour, dismissals.ids]);
  const displaySuggestions = useMemo(() => {
    const ai = aiSuggestions.map((entry) => {
      const item = scopedItems.find((candidate) => String(candidate.id) === String(entry.id));
      return item ? { item, promotion: offers.find((offer) => offer.target_item_ids.includes(String(item.id))), reason: "aiReason", aiReason: entry.reason } : null;
    }).filter(Boolean);
    return [...ai, ...suggestions.filter(({ item }) => !ai.some((entry) => String(entry.item.id) === String(item.id)))].slice(0, 5);
  }, [aiSuggestions, scopedItems, offers, suggestions]);
  const selectedItem = scopedItems.find((item) => String(item.id) === String(selectedId) && (item.isAvailableForSale ?? item.available) === true);

  useEffect(() => {
    setDismissals(readDismissals(storageKey));
    setHidden(false);
    setManualOpen(false);
    setExpanded(false);
    setSelectedId(null);
  }, [storageKey]);

  useEffect(() => {
    if (!expanded) return undefined;
    setHour(new Date().getHours());
    const interval = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(interval);
  }, [expanded]);

  useEffect(() => {
    let stream;
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((nextStream) => {
        stream = nextStream;
        stream.getTracks().forEach((track) => track.stop());
      }).catch(() => setVoiceError(text.micError));
    }
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [scopeKey]);

  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    previousLanguageRef.current = language;
    const recognition = recognitionRef.current;
    if (recognition) {
      recognitionRef.current = null;
      recognition.onresult = null; recognition.onerror = null; recognition.onend = null;
      try { recognition.abort(); } catch {}
    }
    setListening(false);
    setVoiceError("");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, [language]);

  useEffect(() => {
    if (selectedId && !selectedItem) setSelectedId(null);
  }, [selectedId, selectedItem]);

  useEffect(() => {
    if (!expanded || !scope || branchLoading || hidden || (dismissals.count >= MAX_DISMISSALS && !manualOpen)) return undefined;
    let active = true;
    let sequence = 0;
    const refreshOffers = async () => {
      const request = ++sequence;
      try {
        const result = await getActivePromotions(supabase, scope.tenantId, scope.branchId);
        if (active && request === sequence) setOffersState({ scope: offerScope, offers: Array.isArray(result) ? result : [] });
      } catch {
        if (active && request === sequence) setOffersState({ scope: offerScope, offers: [] });
      }
    };
    void refreshOffers();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refreshOffers(); }, 60_000);
    window.addEventListener("focus", refreshOffers);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", refreshOffers); };
  }, [expanded, scope?.tenantId, scope?.branchId, offerScope, branchLoading, hidden, dismissals.count, manualOpen]);

  useEffect(() => {
    if (!expanded || !tenant?.id || scopedItems.length === 0) return undefined;
    const timer = window.setTimeout(async () => {
      setAiState("loading");
      try {
        const response = await fetch("/api/ai/smart-waiter", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: tenant.id, query, items: scopedItems }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.fallback) throw new Error("fallback");
        setAiSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
        setAiState("ready");
      } catch {
        setAiSuggestions([]);
        setAiState("fallback");
      }
    }, query ? 450 : 100);
    return () => window.clearTimeout(timer);
  }, [expanded, tenant?.id, query, scopedItems]);

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; try { recognition.abort(); } catch {} }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const stopVoice = () => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition.onresult = null; recognition.onerror = null; recognition.onend = null;
      try { recognition.abort(); } catch {}
    }
    setListening(false);
    if (canSpeak) window.speechSynthesis.cancel();
  };
  const dismiss = (itemId) => {
    stopVoice();
    const next = { count: Math.min(MAX_DISMISSALS, dismissals.count + 1), ids: itemId ? [...new Set([...dismissals.ids, String(itemId)])] : dismissals.ids };
    setDismissals(next);
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Optional storage. */ }
    if (!itemId || next.count >= MAX_DISMISSALS) { setHidden(true); setManualOpen(false); }
  };
  const toggleListening = () => {
    if (listening) { stopVoice(); return; }
    if (!Recognition) { setVoiceError(text.micUnavailable); return; }
    setVoiceError("");
    try {
      const recognition = new Recognition();
      recognition.lang = isEnglish ? "en-US" : "ar-SA";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) setQuery(String(transcript).slice(0, 160));
      };
      recognition.onerror = () => setVoiceError(text.micError);
      recognition.onend = () => { recognitionRef.current = null; setListening(false); };
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch { recognitionRef.current = null; setListening(false); setVoiceError(text.micError); }
  };
  const speakSuggestions = () => {
    setVoiceError("");
    if (!canSpeak) { setVoiceError(text.speechUnavailable); return; }
    try {
      const prefix = isEnglish ? "en" : "ar";
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((candidate) => String(candidate.lang || "").toLowerCase().split(/[-_]/)[0] === prefix);
      if (!voice) { setVoiceError(text.speechUnavailable); return; }
      stopVoice();
      const names = suggestions.map(({ item }) => isEnglish ? (item.name_en || item.name) : item.name).join(isEnglish ? ", " : "، ");
      const utterance = new window.SpeechSynthesisUtterance(`${getSmartWaiterGreeting(language, hour)} ${names || text.empty}`);
      utterance.lang = isEnglish ? "en-US" : "ar-SA";
      utterance.voice = voice;
      utterance.onerror = (event) => { if (event.error !== "canceled" && event.error !== "interrupted") setVoiceError(text.speechUnavailable); };
      window.speechSynthesis.speak(utterance);
    } catch { setVoiceError(text.speechUnavailable); }
  };

  if (!robotOpen && !expanded) {
    return (
      <Box sx={{ position: "fixed", bottom: 92, insetInlineEnd: 14, zIndex: 1050, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ bgcolor: "#fff", color: "#14213d", px: 1.2, py: .8, borderRadius: 3, boxShadow: "0 8px 24px rgba(20,33,61,.16)", fontWeight: 800, fontSize: ".78rem" }}>{getSmartWaiterGreeting(language, hour)} {isEnglish ? "Need a suggestion?" : "وش تشتهي اليوم؟"}</Box>
        <Button aria-label={text.open} onClick={() => { setRobotOpen(true); setExpanded(true); }} sx={{ minWidth: 72, width: 72, height: 72, borderRadius: "50%", p: 0, bgcolor: "#14213d", boxShadow: "0 12px 28px rgba(20,33,61,.28)", "&:hover": { bgcolor: "#243655" } }}>
          <Box sx={{ position: "relative", width: 48, height: 48, borderRadius: "50%", bgcolor: "#ff9b72", border: "3px solid #fff" }}>
            <Box sx={{ position: "absolute", top: 14, left: 10, width: 7, height: 7, borderRadius: "50%", bgcolor: "#14213d" }} /><Box sx={{ position: "absolute", top: 14, right: 10, width: 7, height: 7, borderRadius: "50%", bgcolor: "#14213d" }} />
            <Box sx={{ position: "absolute", bottom: 9, left: 15, width: 16, height: 6, borderBottom: "3px solid #14213d", borderRadius: "50%" }} />
            <Box sx={{ position: "absolute", top: -10, left: 20, width: 6, height: 10, bgcolor: "#fff", borderRadius: 2 }} /><Box sx={{ position: "absolute", top: -15, left: 18, width: 10, height: 10, borderRadius: "50%", bgcolor: "#ff8351" }} />
          </Box>
        </Button>
      </Box>
    );
  }
  if (hidden || (dismissals.count >= MAX_DISMISSALS && !manualOpen)) {
    return <Button aria-label={text.open} onClick={() => { setHidden(false); setManualOpen(true); setExpanded(true); }}
      startIcon={<AutoAwesomeOutlinedIcon />} variant="contained" size="small"
      sx={{ position: "fixed", bottom: 92, insetInlineEnd: 16, zIndex: 1050, borderRadius: 1,
        bgcolor: "#14213d", color: "#fff", border: "1px solid rgba(255,255,255,.16)", boxShadow: "0 4px 16px rgba(0,0,0,.2)",
        "&:hover": { bgcolor: "#243655" } }}>
      {text.title}
    </Button>;
  }
  return (
    <Paper component="section" aria-label={text.title} elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, border: "1px solid rgba(244,121,32,.24)", borderRadius: 3, background: "rgba(255,251,247,.94)" }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, minWidth: 0 }}>
        <AutoAwesomeOutlinedIcon color="primary" aria-hidden="true" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: ".95rem" }}>{getSmartWaiterGreeting(language, hour)} {text.title}</Typography>
          {!expanded && <Typography variant="body2" color="text.secondary">{text.intro}</Typography>}
        </Box>
        {!expanded && <Button size="small" variant="outlined" onClick={() => setExpanded(true)} sx={{ flexShrink: 0, borderRadius: 2 }}>{text.open}</Button>}
        <IconButton aria-label={text.close} onClick={() => dismiss()} size="small"><CloseIcon fontSize="small" /></IconButton>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{text.allergyWarning}</Typography>
      {!expanded && !menuLoading && !branchLoading && suggestions.length > 0 && (
        <Box sx={{ mt: 1.25, px: 1.25, py: 1, border: "1px solid rgba(217,84,30,.18)", borderRadius: 1, bgcolor: "#fff" }}>
          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800 }}>{isEnglish ? "A suggestion for you" : "اقتراح لك"}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: 800, minWidth: 0, overflowWrap: "anywhere" }}>{isEnglish ? (suggestions[0].item.name_en || suggestions[0].item.name) : suggestions[0].item.name}</Typography>
            <Button size="small" onClick={() => setSelectedId(suggestions[0].item.id)}>{text.details}</Button>
          </Stack>
        </Box>
      )}
      <Collapse in={expanded} unmountOnExit>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2 }}>{text.description}</Typography>
        {aiState === "loading" && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .5 }}>{isEnglish ? "Preparing a Saudi-style suggestion…" : "أجهز لك اقتراحًا بلهجة سعودية…"}</Typography>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1.5 }}>
          <TextField fullWidth size="small" label={text.query} value={query} onChange={(event) => setQuery(event.target.value.slice(0, 160))} helperText={text.queryHint} />
          <TextField size="small" type="number" label={text.budget} value={budget} onChange={(event) => setBudget(event.target.value)} error={invalidBudget} helperText={invalidBudget ? text.invalidBudget : text.budgetHint} slotProps={{ htmlInput: { min: 0, step: "any", inputMode: "decimal" } }} sx={{ minWidth: { sm: 210 } }} />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, mt: 1 }}>
          {Recognition && <Button variant="outlined" size="small" startIcon={<MicNoneIcon />} onClick={toggleListening}>{listening ? text.listening : text.mic}</Button>}
          {canSpeak && <Button variant="text" size="small" startIcon={<VolumeUpOutlinedIcon />} onClick={speakSuggestions} disabled={menuLoading || branchLoading || invalidBudget}>{text.speak}</Button>}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .5 }}>{Recognition ? text.micHint : text.micUnavailable}</Typography>
        {voiceError && <Alert severity="info" sx={{ mt: 1 }}>{voiceError}</Alert>}
        {!invalidBudget && !menuLoading && !branchLoading && (suggestions.length ? (
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {displaySuggestions.map(({ item, promotion, reason, aiReason }) => (
              <Box key={item.id} sx={{ p: 1.2, bgcolor: "rgba(255,255,255,.78)", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800 }}>{aiReason || text[reason]}</Typography>
                    <Typography sx={{ fontWeight: 800 }}>{isEnglish ? (item.name_en || item.name) : item.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{String(item.price)} {currency}</Typography>
                    {promotion && <Typography variant="body2" color="text.secondary">{text.offer}: {isEnglish ? (promotion.title_en || promotion.title_ar) : (promotion.title_ar || promotion.title_en)}</Typography>}
                  </Box>
                  <IconButton size="small" aria-label={`${text.dismiss}: ${item.name}`} onClick={() => dismiss(item.id)}><CloseIcon fontSize="small" /></IconButton>
                </Stack>
                <Button size="small" onClick={() => { stopVoice(); setSelectedId(item.id); }}>{text.details}</Button>
              </Box>
            ))}
            {suggestions.some(({ promotion }) => promotion) && <Typography variant="caption" color="text.secondary">{text.offerNote}</Typography>}
          </Stack>
        ) : <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{hasUnsupportedDietaryConstraint(query) ? text.allergyRequest : text.empty}</Typography>)}
      </Collapse>
      {selectedItem && <ItemDetailsDrawer open onClose={() => setSelectedId(null)} itemDetails={selectedItem} />}
    </Paper>
  );
}
