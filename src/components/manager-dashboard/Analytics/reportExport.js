// A single export model is built from the same already-loaded values used on screen.
// It deliberately contains no customer data or database access.
export function safeSpreadsheetCell(value) {
  if (typeof value !== "string") return value == null ? "" : value;
  // Spreadsheet applications can interpret formulas after whitespace or control characters.
  return /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}

export function createSafeCsv(sections) {
  const rows = sections.flatMap(({ title, columns, rows: data }) => [
    [title], columns, ...data, [],
  ]);
  return `\uFEFF${rows.map((row) => row.map((value) => `"${String(safeSpreadsheetCell(value)).replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
}

const validDateString = (date, locale) => {
  if (!date) return "";
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? "" : new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(value);
};

export function buildReportExportModel({ report, tableTurnover, tableTurnoverDetails, series, range, text, currency, analyticsCurrency = currency, analytics, language }) {
  const ar = language === "ar";
  const locale = ar ? "ar-SA" : "en-SA";
  const label = (arabic, english) => ar ? arabic : english;
  const sections = [
    {
      name: label("الملخص", "Summary"), title: text.csvTitle,
      columns: [label("المؤشر", "Metric"), label("القيمة", "Value"), label("الوحدة", "Unit")],
      rows: [
        [text.csvFrom, range.from, ""], [text.csvTo, range.to, ""],
        [text.gross, report.gross, currency], [text.net, report.net, currency], [text.vat, report.vat, currency],
        [text.orders, report.orderCount, ""], [text.average, report.averageOrder, currency], [text.itemQuantity, report.itemQuantity, ""],
        [text.table, tableTurnover.tableCount, ""], [text.turnsPerTable, tableTurnover.averageTurnsPerTable, ""],
        [text.averageDuration, tableTurnover.averageMinutes ?? "", text.minutes],
      ],
    },
    { name: label("اتجاه المبيعات", "Sales trend"), title: label("المبيعات حسب الفترة المختارة", "Sales in selected period"), columns: [label("الفترة", "Period"), text.gross, currency], rows: series.map((point) => [point.label, point.total, currency]) },
    { name: label("إيرادات الطاولات", "Table revenue"), title: text.tableRevenue, columns: [text.table, text.tableOrders, text.gross, currency], rows: report.tableRevenue.map((table) => [table.tableNumber || text.unspecifiedTable, table.orderCount, table.revenue, currency]) },
    { name: label("تفاصيل الطاولات", "Table details"), title: text.tableOrderDetails, columns: [text.table, text.orderNumber, text.orderTime, `${text.previousOrderGap} (${text.minutes})`, `${text.orderDuration} (${text.minutes})`, text.gross, currency], rows: tableTurnoverDetails.flatMap((table) => table.orders.map((order) => [table.table, order.orderNumber, validDateString(order.createdAt, locale), order.gapMinutes ?? "", order.durationMinutes ?? "", order.totalPrice, currency])) },
    { name: label("الأصناف", "Items"), title: text.topItems, columns: [text.rank, text.item, text.quantity, text.itemSales, currency], rows: report.topItems.map((item, index) => [index + 1, item.name || text.unknownItem, item.quantity, item.revenue, currency]) },
  ];
  const overviewTitle = label("لمحة اليوم التشغيلي", "Operational day overview");
  const overviewRows = analytics?.analyticsReady ? [
    [label("المبيعات", "Sales"), analytics.totalSalesToday, analyticsCurrency, analytics.salesGrowth],
    [label("متوسط الطلب", "Average order"), Number(analytics.aovToday), analyticsCurrency, analytics.aovGrowth],
    [label("الطلبات", "Orders"), analytics.todaysOrders.length, "", analytics.ordersGrowth],
  ] : [[label("بيانات اللمحة غير متاحة", "Overview data unavailable"), "", "", ""]];
  sections.push({ name: label("اللمحة", "Overview"), title: overviewTitle, columns: [label("المؤشر", "Metric"), label("القيمة", "Value"), label("الوحدة", "Unit"), label("التغير عن اليوم السابق %", "Change vs previous day %")], rows: overviewRows });
  if (analytics?.analyticsReady) {
    sections.push(
      { name: label("اتجاه اللمحة", "Overview trend"), title: analytics.isDaily ? label("لمحة المبيعات اليومية", "Daily overview trend") : label("لمحة آخر ٧ أيام", "Last 7 days overview trend"), columns: [label("الفترة", "Period"), label("المبيعات", "Sales"), analyticsCurrency], rows: analytics.currentLabels.map((point, index) => [point, analytics.currentSales[index] ?? 0, analyticsCurrency]) },
      { name: label("أصناف اللمحة", "Overview items"), title: label("أعلى أصناف اليوم التشغيلي", "Operational day top items"), columns: [text.rank, text.item, text.quantity, text.itemSales, analyticsCurrency], rows: analytics.topProducts.map((product, index) => [index + 1, product.name, product.quantity, product.totalRevenue, analyticsCurrency]) },
      { name: label("الطلبات الأخيرة", "Recent orders"), title: label("آخر طلبات اليوم التشغيلي", "Operational day recent orders"), columns: [text.table, label("الحالة", "Status"), label("عدد الأصناف", "Item count"), text.orderTime, text.gross, analyticsCurrency], rows: analytics.recentOrders.map((order) => [order.table_number || order.table || "—", order.status || "", order.items?.length || 0, validDateString(order.created_at, locale), Number(order.total_price) || 0, analyticsCurrency]) },
    );
  }
  return { sections, rtl: ar, filename: `servio-report-${range.from}-${range.to}` };
}

export function createWorkbook(model, ExcelJS) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SERVIO";
  for (const section of model.sections) {
    const sheet = workbook.addWorksheet(section.name, { views: [{ rightToLeft: model.rtl, state: "frozen", ySplit: 1 }] });
    sheet.columns = section.columns.map((column) => ({ header: safeSpreadsheetCell(column), width: Math.min(40, Math.max(16, String(column).length + 6)) }));
    for (const values of section.rows) sheet.addRow(values.map(safeSpreadsheetCell));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFF4E7" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF24201D" } };
    sheet.getRow(1).alignment = { horizontal: model.rtl ? "right" : "left", vertical: "middle", wrapText: true };
    sheet.getRow(1).height = 28;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.eachCell((cell) => { cell.alignment = { horizontal: model.rtl ? "right" : "left", vertical: "middle", wrapText: true }; });
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: section.rows.length + 1, column: section.columns.length } };
  }
  return workbook;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);
}

export function downloadCsv(model) {
  saveBlob(new Blob([createSafeCsv(model.sections)], { type: "text/csv;charset=utf-8" }), `${model.filename}.csv`);
}

export async function downloadXlsx(model) {
  // Load the browser-compatible source entry on demand so dependency overrides apply.
  const imported = await import("exceljs/lib/exceljs.browser.js");
  const ExcelJS = imported.default || imported;
  const buffer = await createWorkbook(model, ExcelJS).xlsx.writeBuffer();
  saveBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${model.filename}.xlsx`);
}

// Render the real report DOM, including charts and Arabic shaping, into a multi-page PDF.
// Sections are captured in bounded-height tiles rather than one oversized browser canvas.
export async function downloadPdf(root, filename) {
  if (!root) throw new Error("Report view is unavailable");
  const [{ default: html2canvas }, jspdf] = await Promise.all([import("html2canvas"), import("jspdf")]);
  if (document.fonts?.ready) await document.fonts.ready;
  const clone = root.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, { position: "absolute", left: "0", top: "0", zIndex: "-1", width: "1100px", maxWidth: "1100px", minWidth: "1100px", pointerEvents: "none" });
  clone.querySelectorAll(".reports-no-print").forEach((node) => node.remove());
  clone.querySelectorAll(".reports-pdf-paired").forEach((node) => { node.style.gridTemplateColumns = "1fr"; });
  clone.querySelectorAll(".MuiTableContainer-root").forEach((node) => { node.style.overflow = "visible"; node.style.width = "100%"; });
  document.body.appendChild(clone);
  try {
    const sections = [...clone.querySelectorAll("[data-pdf-section]")];
    if (!sections.length) throw new Error("Report has no printable sections");
    const pdf = new jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const width = 190, bottom = 287, pageHeight = 277, gap = 3;
    let y = 10;
    for (const section of sections) {
      const height = Math.ceil(section.getBoundingClientRect().height);
      if (!height) continue;
      const wholeHeight = height / 1100 * width;
      if (wholeHeight <= pageHeight && wholeHeight > bottom - y && y > 10) { pdf.addPage(); y = 10; }
      let offset = 0;
      while (offset < height) {
        let availablePixels = Math.floor((bottom - y) * 1100 / width);
        if (availablePixels < 100) { pdf.addPage(); y = 10; availablePixels = Math.floor(pageHeight * 1100 / width); }
        let sliceHeight = Math.min(height - offset, availablePixels);
        // Prefer table-row boundaries when a long section spans pages.
        if (offset + sliceHeight < height) {
          const sectionTop = section.getBoundingClientRect().top;
          const boundaries = [...section.querySelectorAll("tr")].map((row) => row.getBoundingClientRect().bottom - sectionTop).filter((edge) => edge > offset + 100 && edge <= offset + sliceHeight);
          if (boundaries.length) sliceHeight = Math.floor(Math.max(...boundaries) - offset);
        }
        const canvas = await html2canvas(section, { backgroundColor: "#191714", scale: 1.5, width: 1100, height: sliceHeight, y: offset, windowWidth: window.innerWidth, scrollX: 0, scrollY: 0, logging: false, useCORS: true });
        const drawnHeight = sliceHeight / 1100 * width;
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, y, width, drawnHeight, undefined, "FAST");
        canvas.width = 0; canvas.height = 0;
        offset += sliceHeight;
        y += drawnHeight;
        if (offset < height) { pdf.addPage(); y = 10; }
      }
      y += gap;
    }
    pdf.save(`${filename}.pdf`);
  } finally {
    clone.remove();
  }
}
