import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTables } from "../../../context/TablesContext";
import { useTenant } from "../../../context/TenantContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useBranch } from "../../../context/BranchContext";
import { useStore } from "../../../context/StoreInfoContext";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import InputAdornment from "@mui/material/InputAdornment";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import PrintIcon from "@mui/icons-material/Print";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import {
  BORDER_MIN_CONTRAST, DEFAULT_QR_SETTINGS, MAX_LOGO_DATA_LENGTH, QR_COLOR_MIN_CONTRAST,
  contrastRatio, qrSettingsKey, readQRSettings, readableTextColor, writeQRSettings,
} from "./qrCardSettings";
import "./qrCardSettings.css";

const copy = {
  ar: {
    eyebrow: "بطاقات المنيو", studio: "صمّم بطاقة QR", studioHint: "اضبط التفاصيل وشاهد النتيجة مباشرة قبل الطباعة.",
    live: "معاينة مباشرة", sample: "نموذج لطاولة", appearance: "الخط والنص", colors: "الألوان والحواف", logo: "الشعار",
    tableSize: "حجم رقم الطاولة", caption: "النص أسفل الرمز", captionSize: "حجم النص", qrSize: "حجم رمز QR",
    qrColor: "لون رمز QR", cardColor: "خلفية البطاقة", borderColor: "لون الحواف", frame: "نمط الحواف",
    solid: "كلاسيكي", double: "مزدوج", dashed: "متقطع", dotted: "منقّط", square: "زوايا حادة",
    showLogo: "إظهار الشعار", upload: "رفع شعار", changeLogo: "استبدال الشعار", removeLogo: "إزالة الشعار المرفوع",
    storeLogo: "يُستخدم شعار النشاط إن وُجد، أو ارفع شعارًا خاصًا بالبطاقة.",
    logoHint: "PNG أو JPG أو WebP، حتى 2 م.ب. يظهر الشعار خارج الرمز حتى لا يحجب البيانات.",
    noLogo: "لا يوجد شعار محدد", logoError: "تعذرت قراءة الصورة. اختر PNG أو JPG أو WebP بحجم لا يتجاوز 2 م.ب.",
    contrastError: "اختر لونًا أغمق للرمز، أو زد التباين بين الخلفية والحواف؛ لم يُطبّق اللون غير الواضح.",
    scanHint: "يُحفظ هامش أبيض حول الرمز لضمان وضوحه. جرّب المسح بعد الطباعة.",
    localSaved: "تُحفظ هذه الإعدادات تلقائيًا في هذا المتصفح لهذا النشاط والفرع فقط، ولا تتزامن بين الأجهزة.",
    localFailed: "التخزين المحلي غير متاح أو ممتلئ، أو لم يُحدد النشاط والفرع بعد؛ ستبقى التغييرات لهذه الجلسة فقط.",
    privacy: "يُحفظ النص والشعار المرفوع محليًا دون تشفير؛ لا تستخدم بيانات أو صورًا خاصة على جهاز مشترك.",
    reset: "استعادة الافتراضي", printTip: "يمكنك اختيار «حفظ كملف PDF» من نافذة الطباعة. فعّل طباعة ألوان الخلفية عند الحاجة.",
    cashier: "كاشير", cashierQr: "QR الكاشير", printCashier: "طباعة QR الكاشير", working: "جاري الإرسال...",
    noPreview: "تظهر المعاينة عند تحديد رابط النشاط.", px: "بكسل",
  },
  en: {
    eyebrow: "MENU CARDS", studio: "Design your QR card", studioHint: "Adjust the details and preview the result before printing.",
    live: "LIVE PREVIEW", sample: "Sample table", appearance: "Type & message", colors: "Colors & borders", logo: "Logo",
    tableSize: "Table number size", caption: "Text below the code", captionSize: "Text size", qrSize: "QR code size",
    qrColor: "QR code color", cardColor: "Card background", borderColor: "Border color", frame: "Border style",
    solid: "Classic", double: "Double", dashed: "Dashed", dotted: "Dotted", square: "Square corners",
    showLogo: "Show logo", upload: "Upload logo", changeLogo: "Replace logo", removeLogo: "Remove uploaded logo",
    storeLogo: "The business logo is used when available, or upload a logo for this card.",
    logoHint: "PNG, JPG or WebP, up to 2 MB. The logo sits outside the code so it never covers data.",
    noLogo: "No logo selected", logoError: "Could not read the image. Choose a PNG, JPG or WebP up to 2 MB.",
    contrastError: "Choose a darker QR color or increase contrast between the card and border. The low-contrast color was not applied.",
    scanHint: "A white quiet zone is kept around the code. Test a scan after printing.",
    localSaved: "These settings are saved automatically in this browser for this business and branch only; they do not sync across devices.",
    localFailed: "Local storage is unavailable or full, or the business and branch are not yet selected; changes last only for this session.",
    privacy: "Text and uploaded logos are stored locally without encryption; avoid private content on shared devices.",
    reset: "Reset to defaults", printTip: "Choose Save as PDF in the print dialog. Enable background graphics if needed.",
    cashier: "Cashier", cashierQr: "Cashier QR", printCashier: "Print cashier QR", working: "Working...",
    noPreview: "The preview appears when the business link is available.", px: "px",
  },
};

function getStorage() {
  try { return window.localStorage; } catch { return null; }
}

// Re-encode local raster images to limit storage and strip file metadata. No logo overlays QR modules.
function prepareLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      reject(new Error("invalid image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/png");
        if (data.length > MAX_LOGO_DATA_LENGTH) throw new Error("image too large");
        resolve(data);
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(url); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("invalid image")); };
    image.src = url;
  });
}

function RangeControl({ label, value, min, max, onChange, unit }) {
  return <label className="qr-range"><span className="qr-control-heading"><span>{label}</span><strong dir="ltr">{value} {unit}</strong></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ColorControl({ label, value, onChange }) {
  return <label className="qr-color-control"><span>{label}</span><span className="qr-color-well"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><b dir="ltr">{value.toUpperCase()}</b></span></label>;
}

function CardDesign({ settings, logo, title, value, caption }) {
  const borderStyles = {
    solid: { border: `2px solid ${settings.borderColor}`, borderRadius: 16 },
    double: { border: `6px double ${settings.borderColor}`, borderRadius: 16 },
    dashed: { border: `3px dashed ${settings.borderColor}`, borderRadius: 16 },
    dotted: { border: `3px dotted ${settings.borderColor}`, borderRadius: 16 },
    square: { border: `3px solid ${settings.borderColor}`, borderRadius: 0 },
  };
  return <div className="qr-card-design" style={{ ...borderStyles[settings.borderStyle], backgroundColor: settings.cardColor, color: readableTextColor(settings.cardColor) }}>
    {settings.showLogo && logo && <img className="qr-card-logo" src={logo} alt="" />}
    <div className="qr-card-title" style={{ fontSize: `${settings.tableSize}px` }}>{title}</div>
    <div className="qr-code-paper"><QRCodeSVG value={value} size={settings.qrSize} fgColor={settings.qrColor} bgColor="#ffffff" level="H" marginSize={4} style={{ maxWidth: "100%", height: "auto", display: "block" }} /></div>
    {caption && <div className="qr-card-caption" style={{ fontSize: `${settings.captionSize}px` }}>{caption}</div>}
    <div className="qr-card-url" dir="ltr" title={value}>{value}</div>
  </div>;
}

function QRCodeStudio({ scopeKey, resolvedSlug, branchSlug, language, t, tables, tablesError, generateTables, deleteTable, clearTables, storeLogo }) {
  const text = copy[language === "en" ? "en" : "ar"];
  const [initial] = useState(() => readQRSettings(getStorage(), scopeKey));
  const [settings, setSettings] = useState(initial.settings);
  const [saved, setSaved] = useState(initial.available);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [tablesCount, setTablesCount] = useState(tables.length || 5);
  const caption = settings.caption === null ? t("managerScanMenu") : settings.caption;
  const logo = settings.logoDataUrl || storeLogo || "";
  const cashierQrValue = resolvedSlug ? `${window.location.origin}/menu/${resolvedSlug}?branch=${encodeURIComponent(branchSlug || "main")}&cashier=1` : "";
  const tableValue = (number) => resolvedSlug ? `${window.location.origin}/menu/${resolvedSlug}/${number}?branch=${encodeURIComponent(branchSlug || "main")}` : "";
  const sampleNumber = tables[0]?.table_number ?? 1;

  useEffect(() => { setSaved(writeQRSettings(getStorage(), scopeKey, settings)); }, [scopeKey, settings]);
  const update = (key, value) => { setNotice(""); setSettings((current) => ({ ...current, [key]: value })); };
  const updateColor = (key, value) => {
    const next = { ...settings, [key]: value };
    if (contrastRatio(next.qrColor, "#ffffff") < QR_COLOR_MIN_CONTRAST || contrastRatio(next.cardColor, next.borderColor) < BORDER_MIN_CONTRAST) {
      setNotice(text.contrastError);
      return;
    }
    update(key, value);
  };
  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const logoDataUrl = await prepareLogo(file);
      setNotice("");
      setSettings((current) => ({ ...current, logoDataUrl, showLogo: true }));
    } catch { setNotice(text.logoError); }
  };
  const handleGenerate = async (event) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    try { const result = await generateTables(tablesCount); if (!result?.error) setTablesCount(""); }
    finally { setSending(false); }
  };
  const handlePrint = (tableId = null) => {
    if (tableId !== null) {
      const isCashier = tableId === "cashier";
      const card = document.getElementById(isCashier ? "cashier-qr-card" : `table-card-${tableId}`);
      if (card) {
        const gridItem = card.closest(".qr-grid-item");
        card.classList.add(isCashier ? "print-cashier-target" : "print-single-target");
        gridItem?.classList.add("print-single-grid-target");
        document.body.classList.add(isCashier ? "printing-cashier" : "printing-single");
        const cleanup = () => {
          document.body.classList.remove("printing-single", "printing-cashier");
          card.classList.remove("print-single-target", "print-cashier-target");
          gridItem?.classList.remove("print-single-grid-target");
          window.removeEventListener("afterprint", cleanup);
        };
        window.addEventListener("afterprint", cleanup);
        requestAnimationFrame(() => window.print());
        return;
      }
    }
    requestAnimationFrame(() => window.print());
  };
  const card = (title, value) => <CardDesign settings={settings} logo={logo} title={title} value={value} caption={caption} />;

  return <Box className="qr-studio" sx={{ pt: 1, maxWidth: 1100, mx: "auto" }} dir={language === "en" ? "ltr" : "rtl"}>
    <Paper className="no-print qr-generate-panel" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "start", gap: 1.5, mb: 2 }}>
        <QrCode2Icon sx={{ fontSize: 32, color: "#b65125" }} />
        <Box><Typography component="h1" variant="h6" sx={{ fontWeight: 800 }}>{t("managerQrTitle")}</Typography><Typography sx={{ color: "text.secondary" }}>{t("managerQrHint")}</Typography></Box>
      </Box>
      <Box component="form" onSubmit={handleGenerate}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label={t("managerTableCount")} value={tablesCount} onChange={(event) => setTablesCount(event.target.value)} size="small" slotProps={{ htmlInput: { min: 1, max: 100 }, input: { startAdornment: <InputAdornment position="start"><TableRestaurantIcon fontSize="small" /></InputAdornment> } }} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><Button fullWidth type="submit" variant="contained" disabled={sending} startIcon={<AddBoxOutlinedIcon />} sx={{ fontWeight: 700 }}>{sending ? text.working : t("managerGenerate")}</Button></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><Button fullWidth variant="outlined" color="error" startIcon={<DeleteOutlinedIcon />} disabled={sending} onClick={async () => { if (sending) return; setSending(true); try { await clearTables(); } finally { setSending(false); } }} sx={{ fontWeight: 700 }}>{t("managerClearAll")}</Button></Grid>
        </Grid>
      </Box>
    </Paper>
    {tablesError && <Typography className="no-print" color="error" sx={{ mb: 2 }}>{tablesError}</Typography>}

    <section className="qr-editor no-print" aria-label={text.studio}>
      <div className="qr-editor-head"><div><div className="qr-eyebrow">{text.eyebrow}</div><h2>{text.studio}</h2><p>{text.studioHint}</p></div><button type="button" className="qr-reset" onClick={() => { setSettings({ ...DEFAULT_QR_SETTINGS }); setNotice(""); }}>{text.reset}</button></div>
      <div className="qr-editor-layout">
        <div className="qr-controls">
          <div className="qr-control-section"><h3><span>01</span>{text.appearance}</h3>
            <RangeControl label={text.tableSize} value={settings.tableSize} min={14} max={40} unit={text.px} onChange={(value) => update("tableSize", value)} />
            <label className="qr-text-control"><span>{text.caption}</span><input type="text" maxLength={120} value={caption} onChange={(event) => update("caption", event.target.value)} /></label>
            <RangeControl label={text.captionSize} value={settings.captionSize} min={12} max={24} unit={text.px} onChange={(value) => update("captionSize", value)} />
            <RangeControl label={text.qrSize} value={settings.qrSize} min={150} max={240} unit={text.px} onChange={(value) => update("qrSize", value)} />
          </div>
          <div className="qr-control-section"><h3><span>02</span>{text.colors}</h3>
            <div className="qr-colors"><ColorControl label={text.qrColor} value={settings.qrColor} onChange={(value) => updateColor("qrColor", value)} /><ColorControl label={text.cardColor} value={settings.cardColor} onChange={(value) => updateColor("cardColor", value)} /><ColorControl label={text.borderColor} value={settings.borderColor} onChange={(value) => updateColor("borderColor", value)} /></div>
            <div className="qr-frame-label">{text.frame}</div><div className="qr-frames" role="group" aria-label={text.frame}>{["solid", "double", "dashed", "dotted", "square"].map((style) => <button key={style} type="button" className={`qr-frame-choice ${settings.borderStyle === style ? "is-selected" : ""}`} aria-pressed={settings.borderStyle === style} onClick={() => update("borderStyle", style)}><span className={`qr-frame-swatch qr-frame-${style}`} aria-hidden="true" />{text[style]}</button>)}</div>
          </div>
          <div className="qr-control-section"><h3><span>03</span>{text.logo}</h3>
            <label className="qr-logo-toggle"><input type="checkbox" checked={settings.showLogo} onChange={(event) => update("showLogo", event.target.checked)} />{text.showLogo}</label>
            <p className="qr-help">{text.storeLogo}</p><div className="qr-logo-tools">{logo ? <img className="qr-logo-thumb" src={logo} alt="" /> : <span className="qr-logo-empty">{text.noLogo}</span>}<label className="qr-upload">{settings.logoDataUrl ? text.changeLogo : text.upload}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} /></label>{settings.logoDataUrl && <button type="button" className="qr-remove-logo" onClick={() => update("logoDataUrl", "")}>{text.removeLogo}</button>}</div>
            <p className="qr-help">{text.logoHint}</p>
          </div>
          {notice && <p className="qr-notice" role="alert">{notice}</p>}
        </div>
        <aside className="qr-preview"><div className="qr-preview-header"><span>{text.live}</span><span className="qr-preview-dot" /></div><p>{text.sample} · {sampleNumber}</p>{resolvedSlug ? card(`${t("managerTable")} ${sampleNumber}`, tableValue(sampleNumber)) : <div className="qr-preview-empty">{text.noPreview}</div>}<div className="qr-preview-hint">{text.scanHint}</div></aside>
      </div>
      <div className="qr-storage-note" role="status"><strong>{saved ? text.localSaved : text.localFailed}</strong><span>{text.privacy}</span></div>
    </section>
    <p className="qr-print-tip no-print">{text.printTip}</p>

    {cashierQrValue && <Card id="cashier-qr-card" className="qr-card qr-output-card" variant="outlined" sx={{ mb: 3 }}>{card(text.cashier, cashierQrValue)}<CardActions className="no-print" sx={{ justifyContent: "center", py: 1.5 }}><Button variant="contained" startIcon={<PrintIcon />} onClick={() => handlePrint("cashier")} sx={{ fontWeight: 800 }}>{text.printCashier}</Button></CardActions></Card>}
    {tables.length > 0 && <Box id="printable-area"><Box className="no-print" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 2 }}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t("managerCreatedTables")} ({tables.length})</Typography><Button variant="contained" color="secondary" startIcon={<PrintIcon />} size="small" onClick={() => handlePrint()} sx={{ fontWeight: 700 }}>{t("managerPrintAll")}</Button></Box>
      <Grid container spacing={2.5} className="qr-grid">{tables.map((table) => <Grid size={{ xs: 12, sm: 6, md: 4 }} className="qr-grid-item" key={table.id}><Card id={`table-card-${table.id}`} className="qr-card qr-output-card" variant="outlined">{card(`${t("managerTable")} ${table.table_number}`, tableValue(table.table_number))}<CardActions className="no-print" sx={{ justifyContent: "center", py: 1 }}><Button size="small" startIcon={<PrintIcon />} onClick={() => handlePrint(table.id)}>{t("managerPrint")}</Button><Button size="small" color="error" startIcon={<DeleteOutlinedIcon />} disabled={deletingId === table.id || sending} onClick={async () => { setDeletingId(table.id); try { await deleteTable(table.id); } finally { setDeletingId(null); } }}>{deletingId === table.id ? text.working : t("menuDelete")}</Button></CardActions></Card></Grid>)}</Grid>
    </Box>}
  </Box>;
}

function QRCodeGenerate() {
  const { t, language } = useLanguage();
  const { tables, error: tablesError, generateTables, deleteTable, clearTables } = useTables();
  const { slug: routeSlug, tenant, tenantId } = useTenant();
  const { branchSlug, selectedBranchId } = useBranch();
  const { storeInfo } = useStore();
  const scopeKey = qrSettingsKey(tenantId || tenant?.id, selectedBranchId);
  // Remount on scope changes so settings cannot be written to the wrong branch during loading.
  return <QRCodeStudio key={scopeKey || "unresolved"} scopeKey={scopeKey} resolvedSlug={tenant?.slug || routeSlug} branchSlug={branchSlug} language={language} t={t} tables={tables} tablesError={tablesError} generateTables={generateTables} deleteTable={deleteTable} clearTables={clearTables} storeLogo={storeInfo?.logo_url} />;
}

export default QRCodeGenerate;
