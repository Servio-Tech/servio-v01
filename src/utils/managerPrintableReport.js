function escapeHtml(value) {
  return String(value ?? "—").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export function buildManagerPrintableReport({
  title,
  subtitle = "",
  columns,
  rows,
  summary = [],
  language = "ar",
}) {
  const isArabic = language === "ar";
  const tableHead = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const tableRows = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${columns.length}">${isArabic ? "لا توجد بيانات مطابقة" : "No matching data"}</td></tr>`;
  const summaryHtml = summary.map(([label, value]) => `<div class="summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

  return `<!doctype html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:24px;font-family:Arial,sans-serif;color:#29231f;background:#fff}
    .toolbar{display:flex;justify-content:flex-end;margin-bottom:18px}
    button{border:0;border-radius:7px;background:#d8662d;color:#fff;padding:10px 16px;font:700 14px Arial,sans-serif;cursor:pointer}
    .brand{color:#b65125;font-size:11px;font-weight:800;letter-spacing:.1em;margin-bottom:7px}
    h1{font-size:25px;line-height:1.3;margin:0 0 5px}
    .subtitle{color:#6b625b;font-size:13px;line-height:1.6;margin:0 0 18px}
    .summary{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
    .summary-item{display:flex;gap:8px;align-items:center;padding:8px 11px;background:#fff4ea;border:1px solid #f1d0b9;border-radius:7px;font-size:12px}
    .summary-item strong{color:#8e421f}
    .table-wrap{overflow:visible}
    table{width:100%;border-collapse:collapse;table-layout:auto;font-size:11px}
    thead{display:table-header-group}
    th{background:#332a24;color:#fff;font-weight:700}
    th,td{border:1px solid #ded7cf;padding:8px;text-align:start;vertical-align:top;overflow-wrap:anywhere}
    tbody tr:nth-child(even){background:#fff8f1}
    .empty{text-align:center;padding:24px;color:#6b625b}
    @media print{
      @page{size:A4 landscape;margin:12mm}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{padding:0}
      .toolbar{display:none}
      tr{break-inside:avoid}
    }
    @media screen and (max-width:700px){body{padding:14px}table{font-size:10px}th,td{padding:6px}}
  </style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">${isArabic ? "طباعة / حفظ PDF" : "Print / Save PDF"}</button></div>
  <div class="brand">SERVIO · ${isArabic ? "تقرير الإدارة" : "MANAGEMENT REPORT"}</div>
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
  ${summaryHtml ? `<div class="summary">${summaryHtml}</div>` : ""}
  <div class="table-wrap"><table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table></div>
</body>
</html>`;
}

export function openManagerPrintableReport(report) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) throw new Error("Print window was blocked");
  printWindow.document.open();
  printWindow.document.write(buildManagerPrintableReport(report));
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}
