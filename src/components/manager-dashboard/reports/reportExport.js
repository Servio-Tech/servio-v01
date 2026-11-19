import { csvText, reportColumns } from "./reportData.js";

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportReport(format, { records, text, range, branch, language }) {
  const filename = `servio-sales-${range.from}-${range.to}`;
  const columns = reportColumns(text);
  if (format === "csv") {
    download(new Blob([csvText(records, text)], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    return;
  }
  if (format === "xlsx") {
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const rows = [
      columns.map(([, label]) => ({ value: label, type: String, fontWeight: "bold", backgroundColor: "#14213d", textColor: "#ffffff" })),
      ...records.map((record) => columns.map(([key]) => {
        const value = record[key];
        if (value === undefined || value === null || value === "") return null;
        // Strings remain literal text, never spreadsheet formulas.
        return { value, type: typeof value === "number" ? Number : String };
      })),
    ];
    const blob = await writeExcelFile(rows, {
      sheet: "Report", rightToLeft: language === "ar", stickyRowsCount: 1,
      columns: columns.map(([key]) => ({ width: key === "label" || key === "section" ? 30 : 18 })),
    }).toBlob();
    download(blob, `${filename}.xlsx`);
    return;
  }
  if (format === "docx") {
    const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = await import("docx");
    const align = language === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT;
    const para = (value, options = {}) => new Paragraph({ alignment: align, bidirectional: language === "ar", ...options, children: [new TextRun(value)] });
    const children = [
      para(text.title, { heading: HeadingLevel.TITLE }),
      para(`${text.branch}: ${branch || text.noBranch}   |   ${text.from}: ${range.from}   |   ${text.to}: ${range.to}`),
    ];
    let previousSection = "";
    records.forEach((record) => {
      if (record.section !== previousSection) {
        children.push(para(record.section, { heading: HeadingLevel.HEADING_2 }));
        previousSection = record.section;
      }
      const fields = columns.slice(5).filter(([key]) => record[key] !== undefined && record[key] !== "")
        .map(([key, label]) => `${label}: ${record[key]}`).join("   |   ");
      children.push(para(`${record.label}${fields ? ` — ${fields}` : ""}`));
    });
    const document = new Document({ sections: [{ children }] });
    download(await Packer.toBlob(document), `${filename}.docx`);
  }
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

export function printReport({ records, text, range, branch, language }) {
  const popup = window.open("", "_blank", "width=1000,height=800");
  if (!popup) return false;
  const columns = reportColumns(text).slice(4);
  const sections = [...new Set(records.map((record) => record.section))];
  const tables = sections.map((section) => {
    const sectionRecords = records.filter((record) => record.section === section);
    const visible = columns.filter(([key]) => key === "label" || sectionRecords.some((record) => record[key] !== undefined && record[key] !== ""));
    const head = visible.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("");
    const body = sectionRecords.map((record) => `<tr>${visible.map(([key, label]) => `<td data-label="${escapeHtml(label)}">${escapeHtml(record[key] ?? "—")}</td>`).join("")}</tr>`).join("");
    return `<h2>${escapeHtml(section)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }).join("");
  popup.document.write(`<!doctype html><html lang="${language === "ar" ? "ar" : "en"}" dir="${language === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${escapeHtml(text.title)}</title><style>
    @page thermal58 { size:58mm auto; margin:2mm } @page thermal80 { size:80mm auto; margin:2mm }
    body[data-paper="58"]{page:thermal58}body[data-paper="80"]{page:thermal80}
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#162138;padding:16px}h1{font-size:24px}h2{font-size:17px;margin-top:25px}p{font-size:12px;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:11px;overflow-wrap:anywhere}th,td{padding:7px;border:1px solid #cbd5e1;text-align:start}th{background:#14213d;color:white}.tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tools button,.tools select{font:inherit;padding:8px;border:1px solid #d9541e;border-radius:5px}.tools button{background:#d9541e;color:#fff;cursor:pointer}
    @media print{.tools{display:none}body{padding:0}h2{break-after:avoid}tr{break-inside:avoid}body[data-paper="58"] table,body[data-paper="80"] table,body[data-paper="58"] tbody,body[data-paper="80"] tbody,body[data-paper="58"] tr,body[data-paper="80"] tr,body[data-paper="58"] td,body[data-paper="80"] td{display:block;width:100%}body[data-paper="58"] thead,body[data-paper="80"] thead{display:none}body[data-paper="58"] td,body[data-paper="80"] td{border:0;padding:2px}body[data-paper="58"] td:before,body[data-paper="80"] td:before{content:attr(data-label) ': ';font-weight:bold}body[data-paper="58"] tr,body[data-paper="80"] tr{border:1px solid #aaa;margin:4px 0}}
  </style></head><body data-paper="system"><div class="tools"><label for="paper">${escapeHtml(text.paper)}</label><select id="paper"><option value="system">${escapeHtml(text.system)}</option><option value="58">${escapeHtml(text.thermal58)}</option><option value="80">${escapeHtml(text.thermal80)}</option></select><button type="button" onclick="window.print()">${escapeHtml(text.print)}</button></div><h1>${escapeHtml(text.title)}</h1><p>${escapeHtml(text.branch)}: ${escapeHtml(branch || text.noBranch)} &nbsp; | &nbsp; ${escapeHtml(text.from)}: ${escapeHtml(range.from)} &nbsp; | &nbsp; ${escapeHtml(text.to)}: ${escapeHtml(range.to)}</p>${tables}<script>document.getElementById('paper').addEventListener('change',function(e){document.body.dataset.paper=e.target.value})</script></body></html>`);
  popup.document.close();
  return true;
}
