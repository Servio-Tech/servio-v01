import test from "node:test";
import assert from "node:assert/strict";
import { buildManagerPrintableReport } from "./managerPrintableReport.js";

test("print report escapes cell content and preserves a localized, printable table", () => {
  const html = buildManagerPrintableReport({
    title: "سجل <الطلبات>",
    subtitle: "بيانات الفرع",
    columns: ["الصنف", "الملاحظات"],
    rows: [["قهوة", "<script>alert(1)</script>"]],
    summary: [["عدد الطلبات", 1]],
    language: "ar",
  });

  assert.match(html, /lang="ar" dir="rtl"/);
  assert.match(html, /سجل &lt;الطلبات&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /@page\{size:A4 landscape/);
  assert.match(html, /طباعة \/ حفظ PDF/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("print report gives empty filtered datasets a clear localized state", () => {
  const html = buildManagerPrintableReport({
    title: "Availability",
    columns: ["Item"],
    rows: [],
    language: "en",
  });

  assert.match(html, /No matching data/);
  assert.match(html, /colspan="1"/);
});
