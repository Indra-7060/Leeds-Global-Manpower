/** Reads an uploaded CSV / TSV / XLSX into a header + data rows. Excel dates become ISO dates; formula cells use their result. */
import ExcelJS from 'exceljs';
import { C } from '../config';
import { parseDate } from '../util';
import { parseCsv } from './csv';

export interface Table { columns: string[]; rows: string[][]; sheetNames: string[]; sheetIndex: number; truncated: boolean }
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function cellText(v: ExcelJS.CellValue | undefined): string {
  if (v == null) return '';
  if (v instanceof Date) return parseDate(v) ?? '';
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
    if ('result' in o) return cellText(o.result as ExcelJS.CellValue);
    if ('richText' in o) return (o.richText as { text: string }[]).map(t => t.text).join('').trim();
    if ('text' in o) return String(o.text).trim();
    return '';
  }
  return String(v).trim();
}

export async function readTable(fileName: string, data: Buffer, sheetIndex = 0): Promise<Table> {
  const name = fileName.toLowerCase();
  if (data.length > MAX_UPLOAD_BYTES) throw new Error('File is larger than 10 MB. Split it into smaller files.');
  let table: string[][] = []; let sheetNames: string[] = []; let idx = 0;
  if (/\.(csv|tsv|txt)$/.test(name)) table = parseCsv(data.toString('utf8'));
  else if (name.endsWith('.xlsx')) {
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(data as unknown as ArrayBuffer); } catch { throw new Error('This file could not be read as an Excel workbook (is it corrupt or password-protected?).'); }
    sheetNames = wb.worksheets.map(w => w.name);
    if (!sheetNames.length) throw new Error('No worksheets found in this workbook.');
    idx = Math.min(Math.max(0, sheetIndex), sheetNames.length - 1);
    wb.worksheets[idx].eachRow({ includeEmpty: false }, row => {
      if (table.length > C.importMaxRows + 1) return;
      const arr: string[] = []; row.eachCell({ includeEmpty: true }, (cell, col) => { arr[col - 1] = cellText(cell.value); });
      const full = Array.from(arr, x => x ?? ''); if (full.some(x => x.trim())) table.push(full);
    });
  } else throw new Error('Upload .xlsx, .csv or .tsv. Old .xls files must be saved as .xlsx first.');
  if (table.length < 2) throw new Error('No data rows found (a header row and at least one data row are required).');
  const columns = table[0].map((x, i) => String(x).trim() || 'Column ' + (i + 1));
  let rows = table.slice(1).filter(r => r.some(x => String(x).trim()));
  const truncated = rows.length > C.importMaxRows; if (truncated) rows = rows.slice(0, C.importMaxRows);
  return { columns, rows, sheetNames, sheetIndex: idx, truncated };
}
