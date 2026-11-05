import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { analyse, guessMapping, mapRows, problemRows, type Target } from '@/lib/domain/importer';
import { parseCsv } from '@/lib/io/csv';
import { readTable } from '@/lib/io/readTable';
import { extractCv } from '@/lib/io/cv';
import { buildDemoState } from '@/lib/seed-data';

const seed = () => buildDemoState();
function run(target: Target, csv: string, role = 'md') {
  const t = parseCsv(csv), cols = t[0], map = guessMapping(target, cols);
  return { map, an: analyse(target, mapRows(target, t.slice(1), map), seed(), role) };
}

const CAND = [
  'Name,Passport,Client,Country,Trade,Status,QVC Date,Order ID',
  'Test Alpha,TST-001,Demo Construction Ltd,Bangladesh,Steel Fixer,QVC,15/10/2026,ORD-1002',
  'Test Beta,TST-002,Demo Construction Ltd,Bangladesh,Mason,Visa Applied,,',
  'Test Gamma,DEMO-P0001,Demo Construction Ltd,Bangladesh,Mason,CV Submitted,,',
  'Test Delta,TST-001,Demo Construction Ltd,Bangladesh,Mason,CV Submitted,,',
  'Test Epsilon,TST-005,Demo Construction Ltd,Bangladesh,Mason,Banana,,',
  ',TST-006,Demo Construction Ltd,Bangladesh,Mason,CV Submitted,,',
  'Test Zeta,TST-007,Demo Construction Ltd,Bangladesh,Mason,CV Submitted,99/99/2026,',
  'Test Eta,TST-008,Demo Unlisted Co,Sri Lanka,Welder,,,',
].join('\n');

describe('import analysis (dry run)', () => {
  it('maps columns using the V6 aliases', () => {
    const { map } = run('candidates', CAND);
    expect([map.candidate_name, map.passport, map.client, map.status, map.qvc_date, map.order_id]).toEqual(['0', '1', '2', '5', '6', '7']);
  });
  it('candidates: 3 valid, 2 duplicates (existing passport + same file), 3 rejected with reasons', () => {
    const { an } = run('candidates', CAND);
    expect([an.valid.length, an.duplicates.length, an.invalid.length]).toEqual([3, 2, 3]);
    const why = (r: number) => an.invalid.find(x => x.row === r)!.errors.join(' ');
    expect(why(5)).toMatch(/Unknown status "Banana"/); expect(why(6)).toMatch(/Missing required: candidate name/); expect(why(7)).toMatch(/QVC date is not a valid date/);
    expect(an.duplicates.map(d => d.row)).toEqual([3, 4]);
  });
  it('unregistered clients are reported so they can be created as Prospects; unknown countries are accepted', () => {
    const { an } = run('candidates', CAND);
    expect(an.newClients).toEqual(['Demo Unlisted Co']);
    const eta = an.valid.find(v => v.input.name === 'Test Eta')!; expect(eta.input.country).toBe('Sri Lanka'); expect(eta.input.status).toBeUndefined();
    expect(an.valid.find(v => v.input.name === 'Test Alpha')!.input.qvc_date).toBe('15/10/2026'); // normalised to ISO by validateInput when saved
  });
  it('orders: bad quantity, id clash and missing required rejected; true duplicate skipped; custom id kept', () => {
    const csv = 'Client,Country,Trade,Quantity,Order ID,Status\nDemo Facilities Co.,Nepal,Welder,40,ORD-2001,Interview\nDemo Facilities Co.,Nepal,Welder,abc,,\nDemo Facilities Co.,Nepal,Fitter,10,ORD-1001,\nDemo Facilities Co.,Bangladesh,Cleaners / Helpers,400,ORD-1001,\n,Nepal,Welder,5,,';
    const { an } = run('orders', csv);
    expect([an.valid.length, an.duplicates.length, an.invalid.length]).toEqual([1, 1, 3]);
    expect(an.valid[0].code).toBe('ORD-2001');
  });
  it('finance: role gate, direction/category/date/amount validation, duplicate vs existing, default account by division', () => {
    const csv = 'Date,Division,Direction,Account,Party,Client,Country,Category,Amount,Reference\n' +
      '2026-11-05,Domestic,Payment,,Demo Agency X,,Philippines,Agency expense,"1,200.50",R-1\n' + '2026-11-05,Blue,Receipt,Cash,Demo Agency Y,,Nepal,Mystery,300,R-2\n' +
      '2026-11-05,Blue,Sideways,Cash,Demo Agency Z,,Nepal,Other,300,R-3\n' + '2026-11-05,Blue,Receipt,Cash,Demo Agency Z,,Nepal,Other,-5,R-4\n' + '2026-11-01,labour,Outgoing,Cash,Demo Dhaka Agency,Demo Facilities Co.,Bangladesh,Agency advance,15000,DEMO-001';
    expect(() => run('finance', csv, 'staff')).toThrow(/restricted/);
    const { an } = run('finance', csv);
    expect([an.valid.length, an.duplicates.length, an.invalid.length]).toEqual([2, 1, 2]);
    const r1 = an.valid.find(v => v.input.ref === 'R-1')!.input, r2 = an.valid.find(v => v.input.ref === 'R-2')!.input;
    expect([r1.division, r1.direction, r1.account, r1.amount]).toEqual(['domestic', 'Outgoing', 'QIIB', 1200.5]);
    expect(r2.category).toBe('Other'); expect(r2.note).toMatch(/Original category: Mystery/);
  });
  it('rejected/duplicate rows come back as a fix-and-retry sheet', () => {
    const { an } = run('candidates', CAND); const rows = problemRows(an);
    expect(rows.length).toBe(1 + 5); expect(rows[0].slice(0, 2)).toEqual(['data_row', 'problem']); expect(rows[1][1]).toMatch(/REJECTED|DUPLICATE/);
  });
});

async function xlsx(build: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook(); build(wb); return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('reading real .xlsx files (generated with exceljs)', () => {
  it('reads strings, numbers, Excel dates (as ISO), formula results and picks a worksheet', async () => {
    const buf = await xlsx(wb => {
      const s = wb.addWorksheet('Candidates'); s.addRow(['Name', 'Passport', 'Client', 'Country', 'Trade', 'Status', 'QVC Date', 'Qty']);
      s.addRow(['Xl One', 'XL-001', 'Demo Construction Ltd', 'Nepal', 'Mason', 'QVC', new Date(Date.UTC(2026, 9, 15)), 7]);
      s.addRow(['Xl Two & Co', 'XL-002', 'Demo Construction Ltd', 'Nepal', 'Mason', 'RTP', null, { formula: '3+4', result: 7 }]);
      wb.addWorksheet('Second').addRows([['Name'], ['Other sheet']]);
    });
    const t = await readTable('c.xlsx', buf); expect(t.sheetNames).toEqual(['Candidates', 'Second']);
    expect(t.columns[6]).toBe('QVC Date'); expect(t.rows[0][6]).toBe('2026-10-15'); expect(t.rows[0][7]).toBe('7'); expect(t.rows[1][7]).toBe('7'); expect(t.rows[1][0]).toBe('Xl Two & Co');
    expect((await readTable('c.xlsx', buf, 1)).rows[0][0]).toBe('Other sheet');
    const map = guessMapping('candidates', t.columns), an = analyse('candidates', mapRows('candidates', t.rows, map), seed(), 'md'); expect(an.valid.length).toBe(2);
  });
  it('gives clear errors for unsupported, corrupt or empty files', async () => {
    await expect(readTable('x.xls', Buffer.from('a'))).rejects.toThrow(/Upload \.xlsx/);
    await expect(readTable('x.csv', Buffer.from('only header'))).rejects.toThrow(/No data rows/);
    await expect(readTable('bad.xlsx', Buffer.from('not a zip at all'))).rejects.toThrow(/could not be read/);
    await expect(readTable('big.csv', Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow(/10 MB/);
  });
  it('reads CSV with BOM and semicolons', async () => { const t = await readTable('a.csv', Buffer.from('﻿Name;Client\nA;B')); expect(t.columns).toEqual(['Name', 'Client']); expect(t.rows).toEqual([['A', 'B']]); });
});

describe('CV extraction', () => {
  it('extracts e-mail and phone from TXT and DOCX; lists PDF/archives; refuses other types', async () => {
    const txt = await extractCv('cv.txt', Buffer.from('Name: Demo Person\nEmail: demo.person@example.test\nPhone: +000 1234 5678'));
    expect([txt.extractedEmail, txt.extractedPhone, txt.note]).toEqual(['demo.person@example.test', '+000 1234 5678', 'Text extracted — review required']);
    const zip = new JSZip(); zip.file('word/document.xml', '<w:document><w:p><w:r><w:t>Contact: docx.person@example.test &amp; more</w:t></w:r></w:p></w:document>');
    const docx = await extractCv('cv.docx', Buffer.from(await zip.generateAsync({ type: 'uint8array' }))); expect(docx.extractedEmail).toBe('docx.person@example.test'); expect(docx.preview).toMatch(/& more/);
    expect((await extractCv('cv.pdf', Buffer.from('%PDF'))).note).toMatch(/PDF received/); expect((await extractCv('pack.zip', Buffer.from('x'))).note).toMatch(/Archive received/);
    await expect(extractCv('virus.exe', Buffer.from('x'))).rejects.toThrow(/Unsupported file type/);
    expect((await extractCv('broken.docx', Buffer.from('not a zip'))).note).toMatch(/Read failed/);
  });
});
