import ExcelJS from 'exceljs';
import { guard } from './csv';

export interface XlsxInput {
  title: string;
  meta: [string, string][];                 // shown on the Summary sheet (who, when, filters…)
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}

/**
 * Real .xlsx export (V8 §7): a Summary sheet (what was exported, by whom, with which filters, how many rows) and a Detail sheet
 * (header row, frozen, auto-filter, sensible widths). Numbers stay numbers; text that Excel could run as a formula is neutralised.
 */
export async function toXlsx(input: XlsxInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leads Global ERP'; wb.created = new Date();

  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 24 }, { width: 70 }];
  sum.addRow([input.title]).font = { bold: true, size: 14 };
  sum.addRow([]);
  for (const [k, v] of [...input.meta, ['Rows', String(input.rows.length)] as [string, string]]) { const r = sum.addRow([k, String(guard(v))]); r.getCell(1).font = { bold: true }; }

  const det = wb.addWorksheet('Detail');
  det.columns = input.columns.map(c => ({ header: c.label, key: c.key, width: Math.min(48, Math.max(12, c.label.length + 4)) }));
  for (const r of input.rows) {
    det.addRow(Object.fromEntries(input.columns.map(c => {
      const v = r[c.key];
      return [c.key, typeof v === 'number' || typeof v === 'boolean' ? v : guard(v == null ? '' : String(v))];
    })));
  }
  const head = det.getRow(1); head.font = { bold: true }; head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F1F8' } };
  det.views = [{ state: 'frozen', ySplit: 1 }];
  if (input.rows.length) det.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: input.columns.length } };
  // widen columns to the data (capped), so the sheet is readable without resizing
  input.columns.forEach((c, i) => {
    const longest = input.rows.reduce((m, r) => Math.max(m, String(r[c.key] ?? '').length), c.label.length);
    det.getColumn(i + 1).width = Math.min(48, Math.max(10, longest + 2));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
