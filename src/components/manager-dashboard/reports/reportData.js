export const REPORT_COPY = {
  en: {
    title: "Sales report", subtitle: "Your business, in focus. A clear view of sales for the selected branch.",
    reports: "Reports", analytics: "Analytics", branch: "Branch", from: "From", to: "To", period: "Period", daily: "Operational day", weekly: "Full week", monthly: "Full month",
    gross: "Total sales incl. VAT", net: "Sales before VAT", vat: "VAT extracted (15/115)", orders: "Sales orders", average: "Average order value", quantitySold: "Units sold",
    overview: "Sales overview", overviewSub: "Recorded sales for this period", tableRevenue: "Revenue by table / service", topItems: "Top-selling items", topItemsSub: "Ranked by quantity · up to 10 items", tableDetails: "Physical table order details", tableDetailsSub: "Time between recorded orders and time to completion", tableTurnover: "Physical table activity", tables: "Tables with orders", turns: "Orders per table", duration: "Average completion time", minutes: "min",
    label: "Metric / item / table", count: "Count / quantity", amount: "Amount", currency: "Currency", sequence: "Period table/day sequence", time: "Order created (UTC)", gap: "Gap (minutes)", completion: "Completion (minutes)", section: "Section", unspecified: "Unspecified", noItems: "No item data for this period.", noTables: "No physical table orders for this period.", noData: "No sales orders in this period.", loading: "Loading report…", error: "Could not load report data. Check your connection and permissions and retry.", scopeError: "Select an available branch to view its report.", retry: "Retry", refresh: "Refresh", export: "Export", pdf: "PDF / Print", xlsx: "Excel (.xlsx)", docx: "Word (.docx)", csv: "Access-compatible CSV", exportError: "Export could not be completed. Check the browser and try again.", popupError: "The print window was blocked. Allow pop-ups and try again.", print: "Print / Save as PDF", paper: "Paper size", system: "System default", thermal58: "Thermal 58 mm", thermal80: "Thermal 80 mm",
    note: "Sales use paid time when available for paid orders, otherwise completion time, then creation time for legacy orders; the device's local time zone and configured work shifts apply. Includes served and unclaimed orders and paid ready orders. VAT is extracted at 15/115 per order. Item amounts are based on stored item prices and may differ from order totals. Table order sequences are calculated within this report, not official order numbers.",
    record: "Report record", empty: "No records", method: "Method", noBranch: "Selected branch", incompleteItemData: "Item metrics are unavailable because some order lines have incomplete item data.",
  },
  ar: {
    title: "تقارير المبيعات", subtitle: "أعمالك بوضوح. نظرة شاملة على مبيعات الفرع المحدد.",
    reports: "التقارير", analytics: "التحليلات", branch: "الفرع", from: "من", to: "إلى", period: "الفترة", daily: "اليوم التشغيلي", weekly: "الأسبوع الكامل", monthly: "الشهر الكامل",
    gross: "إجمالي المبيعات شامل الضريبة", net: "المبيعات قبل الضريبة", vat: "الضريبة المستخرجة (15/115)", orders: "طلبات المبيعات", average: "متوسط قيمة الطلب", quantitySold: "الوحدات المباعة",
    overview: "نظرة على المبيعات", overviewSub: "المبيعات المسجلة خلال الفترة", tableRevenue: "الإيرادات حسب الطاولة / الخدمة", topItems: "الأصناف الأعلى مبيعاً", topItemsSub: "حسب الكمية · حتى 10 أصناف", tableDetails: "تفاصيل طلبات الطاولات الفعلية", tableDetailsSub: "الفاصل بين الطلبات المسجلة ومدة إكمال الطلب", tableTurnover: "نشاط الطاولات الفعلية", tables: "الطاولات التي لديها طلبات", turns: "متوسط الطلبات للطاولة", duration: "متوسط مدة الإكمال", minutes: "دقيقة",
    label: "المؤشر / الصنف / الطاولة", count: "العدد / الكمية", amount: "المبلغ", currency: "العملة", sequence: "تسلسل الطاولة/اليوم في الفترة", time: "إنشاء الطلب (UTC)", gap: "الفاصل (دقيقة)", completion: "مدة الإكمال (دقيقة)", section: "القسم", unspecified: "غير محدد", noItems: "لا توجد بيانات أصناف خلال هذه الفترة.", noTables: "لا توجد طلبات طاولات فعلية خلال هذه الفترة.", noData: "لا توجد طلبات مبيعات خلال هذه الفترة.", loading: "جارٍ تحميل التقرير…", error: "تعذر تحميل بيانات التقرير. تحقق من الاتصال والصلاحيات وأعد المحاولة.", scopeError: "اختر فرعاً متاحاً لعرض تقريره.", retry: "إعادة المحاولة", refresh: "تحديث", export: "تصدير", pdf: "PDF / طباعة", xlsx: "Excel (.xlsx)", docx: "Word (.docx)", csv: "CSV متوافق مع Access", exportError: "تعذر تصدير التقرير. تحقق من المتصفح وحاول مجدداً.", popupError: "حُظرت نافذة الطباعة. اسمح بالنوافذ المنبثقة وحاول مجدداً.", print: "طباعة / حفظ PDF", paper: "مقاس الورق", system: "إعداد النظام", thermal58: "حراري 58 مم", thermal80: "حراري 80 مم",
    note: "يستخدم تاريخ البيع وقت الدفع للطلبات المدفوعة عند توفره، ثم وقت الإكمال، ثم الإنشاء للطلبات القديمة، حسب المنطقة الزمنية للجهاز والورديات المهيأة. يشمل الطلبات المسلّمة وغير المستلمة والجاهزة المدفوعة. تُستخرج الضريبة بنسبة 15/115 لكل طلب. قيم الأصناف مبنية على الأسعار المسجلة وقد تختلف عن إجمالي الطلب. تسلسل الطاولة محسوب داخل التقرير وليس رقم طلب رسمياً.",
    record: "سجل التقرير", empty: "لا توجد سجلات", method: "الطريقة", noBranch: "الفرع المحدد", incompleteItemData: "مؤشرات الأصناف غير متاحة لعدم اكتمال بيانات بعض أصناف الطلبات.",
  },
};

export function reportColumns(text) {
  return [
    ["branch", text.branch], ["from", text.from], ["to", text.to], ["section", text.section],
    ["label", text.label], ["count", text.count], ["amount", text.amount], ["currency", text.currency],
    ["sequence", text.sequence], ["time", text.time], ["gap", text.gap], ["completion", text.completion],
  ];
}

export function buildReportRecords({ report, turnover, turnoverDetails, range, branch, currency, text }) {
  const base = { branch: branch || text.noBranch, from: range.from, to: range.to };
  const row = (section, label, fields = {}) => ({ ...base, section, label, ...fields });
  return [
    row(text.overview, text.gross, { amount: report.gross, currency }),
    row(text.overview, text.net, { amount: report.net, currency }),
    row(text.overview, text.vat, { amount: report.vat, currency }),
    row(text.overview, text.orders, { count: report.orderCount }),
    row(text.overview, text.average, { amount: report.orderCount ? report.averageOrder : "", currency: report.orderCount ? currency : "" }),
    row(text.overview, text.quantitySold, { count: report.itemQuantity ?? "" }),
    row(text.tableTurnover, text.tables, { count: turnover.tableCount }),
    row(text.tableTurnover, text.turns, { count: turnover.tableCount ? turnover.averageTurnsPerTable : "" }),
    row(text.tableTurnover, text.duration, { completion: turnover.averageMinutes ?? "" }),
    ...report.tableRevenue.map((table) => row(text.tableRevenue, table.tableNumber || text.unspecified, { count: table.orderCount, amount: table.revenue, currency })),
    ...report.topItems.map((item) => row(text.topItems, item.name || text.unspecified, { count: item.quantity, amount: item.revenue, currency })),
    ...turnoverDetails.flatMap((table) => table.orders.map((order) => row(text.tableDetails, table.table, {
      sequence: order.orderNumber, time: order.createdAt.toISOString(), gap: order.gapMinutes ?? "", completion: order.durationMinutes ?? "", amount: order.totalPrice, currency,
    }))),
    row(text.method, report.itemDataComplete === false ? `${text.note} ${text.incompleteItemData}` : text.note),
  ];
}

// One header and a fixed set of columns make this UTF-8 BOM CSV importable into Access.
// Prefix dangerous text cells so spreadsheet applications cannot execute them as formulas.
export function csvText(records, text) {
  const columns = reportColumns(text);
  const cell = (value) => {
    let safe = value ?? "";
    if (typeof safe === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(safe)) safe = `'${safe}`;
    return `"${String(safe).replace(/"/g, '""')}"`;
  };
  return `\uFEFF${[columns.map(([, title]) => title), ...records.map((record) => columns.map(([key]) => record[key] ?? ""))].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
