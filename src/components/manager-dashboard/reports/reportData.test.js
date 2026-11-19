import test from "node:test";
import assert from "node:assert/strict";
import { buildReportRecords, csvText, REPORT_COPY, reportColumns } from "./reportData.js";
import { hasCompleteItemData } from "./itemCompleteness.js";

const report = {
  gross: 115, net: 100, vat: 15, orderCount: 1, averageOrder: 115, itemQuantity: 2,
  tableRevenue: [{ tableNumber: "A, 1", orderCount: 1, revenue: 115 }],
  topItems: [{ name: '=HYPERLINK("bad")', quantity: 2, revenue: 100 }],
};
const turnover = { tableCount: 1, averageTurnsPerTable: 1, averageMinutes: 10 };
const turnoverDetails = [{ table: "A, 1", orders: [{ orderNumber: 1, createdAt: new Date("2026-01-01T10:00:00Z"), gapMinutes: null, durationMinutes: 10, totalPrice: 115 }] }];
const range = { from: "2026-01-01", to: "2026-01-01" };

test("exports fixed columns with UTF-8 BOM, escaped values, and formula protection", () => {
  const text = REPORT_COPY.en;
  const rows = buildReportRecords({ report, turnover, turnoverDetails, range, branch: "East", currency: "SAR", text });
  const csv = csvText(rows, text);
  assert.ok(csv.startsWith('\uFEFF"Branch","From","To","Section"'));
  assert.ok(csv.includes('"A, 1"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"2026-01-01T10:00:00.000Z"'));
  assert.ok(rows.some((row) => row.section === text.method && row.label === text.note));
  assert.equal(reportColumns(text).length, 12);
});

test("Arabic headers are preserved and undefined averages are blank rather than invented", () => {
  const text = REPORT_COPY.ar;
  const rows = buildReportRecords({ report: { ...report, orderCount: 0, averageOrder: 0, tableRevenue: [], topItems: [] }, turnover: { tableCount: 0, averageTurnsPerTable: 0, averageMinutes: null }, turnoverDetails: [], range, branch: "الرياض", currency: "ر.س", text });
  assert.equal(rows.find((row) => row.label === text.average).amount, "");
  assert.equal(rows.find((row) => row.label === text.turns).count, "");
  assert.ok(csvText(rows, text).includes("الرياض"));
  assert.ok(csvText(rows, text).includes("الفرع"));
});

test("item metrics require recorded quantities and prices for every order line", () => {
  assert.equal(hasCompleteItemData([{ items: [{ name: "Tea", quantity: 2, price: 0 }] }]), true);
  assert.equal(hasCompleteItemData([{ items: '[{"name":"Tea","quantity":2,"price":12}]' }]), true);
  assert.equal(hasCompleteItemData([{ items: [{ name: "Tea", price: 12 }] }]), false);
  assert.equal(hasCompleteItemData([{ items: [{ name: "Tea", quantity: 2 }] }]), false);
  assert.equal(hasCompleteItemData([{ items: [] }]), false);
  assert.equal(hasCompleteItemData([{ items: "not json" }]), false);
});
