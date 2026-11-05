import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { toXlsx } from '@/lib/io/xlsx';

describe('V8 native .xlsx export', () => {
  const columns = [{ key: 'name', label: 'Candidate' }, { key: 'qty', label: 'Qty' }, { key: 'note', label: 'Note' }];
  it('writes a real workbook with a Summary sheet and a Detail sheet that Excel can read back', async () => {
    const buf = await toXlsx({ title: 'Test report', meta: [['Report', 'Test'], ['Filters', 'Client: All']], columns, rows: [{ name: 'Ali', qty: 3, note: 'ok' }, { name: 'Bina', qty: 12.5, note: '' }] });
    expect(buf.subarray(0, 2).toString()).toBe('PK'); // .xlsx is a zip container
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as never);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Summary', 'Detail']);
    const det = wb.getWorksheet('Detail')!;
    expect(det.getRow(1).values).toEqual([undefined, 'Candidate', 'Qty', 'Note']);
    expect(det.rowCount).toBe(3);
    expect(det.getRow(2).getCell(2).value).toBe(3);        // numbers stay numbers
    expect(det.getRow(3).getCell(2).value).toBe(12.5);
    const sum = wb.getWorksheet('Summary')!, text = [] as string[]; sum.eachRow(r => text.push(r.values!.toString()));
    expect(text.join('|')).toContain('Rows,2');
  });
  it('neutralises spreadsheet formula injection in text cells', async () => {
    const buf = await toXlsx({ title: 'x', meta: [], columns, rows: [{ name: '=HYPERLINK("http://evil","x")', qty: 1, note: '+SUM(A1)' }, { name: '@cmd', qty: 1, note: '-5 apples' }] });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as never);
    const d = wb.getWorksheet('Detail')!;
    expect(String(d.getRow(2).getCell(1).value).startsWith("'=")).toBe(true);
    expect(String(d.getRow(2).getCell(3).value).startsWith("'+")).toBe(true);
    expect(String(d.getRow(3).getCell(1).value).startsWith("'@")).toBe(true);
    expect(String(d.getRow(3).getCell(3).value).startsWith("'-")).toBe(true);
  });
  it('handles an empty detail list without crashing', async () => {
    const buf = await toXlsx({ title: 'empty', meta: [], columns, rows: [] });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as never);
    expect(wb.getWorksheet('Detail')!.rowCount).toBe(1);
  });
});
