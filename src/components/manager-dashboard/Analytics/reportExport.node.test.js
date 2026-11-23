import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs/lib/exceljs.browser.js";
import { buildReportExportModel, createSafeCsv, createWorkbook, safeSpreadsheetCell } from "./reportExport.js";

const text = {
  csvTitle: "تقرير", csvFrom: "من", csvTo: "إلى", gross: "الإجمالي", net: "الصافي", vat: "الضريبة", orders: "الطلبات", average: "متوسط الطلب", itemQuantity: "الكمية", table: "الطاولة", tableOrders: "طلبات الطاولة", tableRevenue: "إيرادات الطاولات", unspecifiedTable: "غير محددة", turnsPerTable: "الدوران", averageDuration: "المدة", minutes: "دقيقة", tableOrderDetails: "تفاصيل الطاولات", orderNumber: "رقم الطلب", orderTime: "الوقت", previousOrderGap: "الفاصل", orderDuration: "المدة", topItems: "الأصناف", rank: "الترتيب", item: "الصنف", quantity: "الكمية", itemSales: "المبيعات", unknownItem: "غير معروف",
};
const input = {
  report: { gross: 115, net: 100, vat: 15, orderCount: 1, averageOrder: 115, itemQuantity: 2, tableRevenue: [{ tableNumber: "=HYPERLINK(1)", orderCount: 1, revenue: 115 }], topItems: [{ name: "لاتيه, كبير", quantity: 2, revenue: 115 }] },
  tableTurnover: { tableCount: 1, averageTurnsPerTable: 1, averageMinutes: 20 },
  tableTurnoverDetails: [{ table: "5", orders: [{ orderNumber: 1, createdAt: new Date("2026-10-05T10:00:00Z"), gapMinutes: null, durationMinutes: 20, totalPrice: 115 }] }],
  series: [{ label: "10:00", total: 115 }], range: { from: "2026-10-05", to: "2026-10-05" }, text, currency: "ر.س", analyticsCurrency: "SAR",
  analytics: { analyticsReady: true, totalSalesToday: 115, aovToday: "115.00", todaysOrders: [{}], salesGrowth: 10, aovGrowth: -2, ordersGrowth: 0, isDaily: false, currentLabels: ["Monday"], currentSales: [115], topProducts: [{ name: "لاتيه", quantity: 2, totalRevenue: 115 }], recentOrders: [{ table_number: "5", status: "served", items: [{}, {}], created_at: "2026-10-05T10:00:00Z", total_price: 115 }] }, language: "ar",
};

test("model contains the displayed report and overview values with no customer fields", () => {
  const model = buildReportExportModel(input);
  assert.equal(model.rtl, true);
  assert.deepEqual(model.sections[0].rows.slice(2, 8).map((row) => row[1]), [115, 100, 15, 1, 115, 2]);
  assert.deepEqual(model.sections[1].rows[0], ["10:00", 115, "ر.س"]);
  assert.equal(model.sections[3].rows[0][4], 20);
  assert.deepEqual(model.sections[5].rows[0], ["المبيعات", 115, "SAR", 10]);
  assert.match(model.sections[6].title, /٧ أيام/);
  assert.equal(JSON.stringify(model).includes("customer"), false);
});

test("failed analytics is explicitly unavailable instead of inventing zeroes", () => {
  const model = buildReportExportModel({ ...input, analytics: { analyticsReady: false } });
  assert.equal(model.sections.length, 6);
  assert.match(model.sections[5].rows[0][0], /غير متاحة/);
});

test("spreadsheet formula attacks and CSV escaping are neutralized without converting numbers", () => {
  for (const value of ["=1+1", "+cmd", "-1+3", "@cmd", " \t=cmd", "\rtest", "\t@bad"]) assert.equal(safeSpreadsheetCell(value), `'${value}`);
  assert.equal(safeSpreadsheetCell(-12), -12);
  assert.equal(safeSpreadsheetCell("لاتيه"), "لاتيه");
  const csv = createSafeCsv([{ title: "عنوان", columns: ["الاسم", "القيمة"], rows: [["=1+1", -12], ['لاتيه, "كبير"', 1]] }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"'=1\+1","-12"/);
  assert.match(csv, /"لاتيه, ""كبير"""/);
});

test("real XLSX round-trips numeric values, RTL sheets, and harmless string cells", async () => {
  const model = buildReportExportModel(input);
  const workbook = createWorkbook(model, ExcelJS);
  const bytes = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(bytes);
  assert.equal(loaded.worksheets.length, 9);
  assert.equal(loaded.getWorksheet("الملخص").views[0].rightToLeft, true);
  assert.equal(loaded.getWorksheet("الملخص").getCell("B4").value, 115);
  assert.equal(loaded.getWorksheet("إيرادات الطاولات").getCell("A2").value, "'=HYPERLINK(1)");
  assert.equal(loaded.getWorksheet("الأصناف").getCell("B2").value, "لاتيه, كبير");
  assert.equal(typeof loaded.getWorksheet("الأصناف").getCell("D2").value, "number");
});
