/* Builds a minimal but genuine .xlsx (ZIP + OOXML) in memory so the XLSX reader is tested against real file structure. */
'use strict';
const zlib = require('zlib');

function zip(files) {
  const parts = [], central = []; let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameB = Buffer.from(name), raw = Buffer.from(content, 'utf8'), data = zlib.deflateRawSync(raw), crc = zlib.crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameB.length, 26);
    parts.push(lh, nameB, data);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

/** sheets: [{name, rows:[[cell,...]]}]; cell = string | number | {date:serial} | {inline:'text'} | null */
function buildXlsx(sheets) {
  const shared = []; const si = s => { let i = shared.indexOf(s); if (i < 0) { shared.push(s); i = shared.length - 1; } return i; };
  const sheetXml = sh => '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    sh.rows.map((row, r) => `<row r="${r + 1}">` + row.map((c, ci) => {
      const ref = colName(ci) + (r + 1);
      if (c == null || c === '') return `<c r="${ref}"/>`;
      if (typeof c === 'number') return `<c r="${ref}"><v>${c}</v></c>`;
      if (c.date != null) return `<c r="${ref}" s="1"><v>${c.date}</v></c>`;
      if (c.inline != null) return `<c r="${ref}" t="inlineStr"><is><t>${x(c.inline)}</t></is></c>`;
      return `<c r="${ref}" t="s"><v>${si(String(c))}</v></c>`;
    }).join('') + '</row>').join('') + '</sheetData></worksheet>';
  const files = {};
  sheets.forEach((sh, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(sh); });
  files['[Content_Types].xml'] = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>';
  files['xl/workbook.xml'] = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((sh, i) => `<sheet name="${x(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>';
  files['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((sh, i) => `<Relationship Id="rId${i + 1}" Type="x" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>';
  files['xl/styles.xml'] = '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>';
  files['xl/sharedStrings.xml'] = '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + shared.map(s => `<si><t>${x(s)}</t></si>`).join('') + '</sst>';
  return zip(files);
}
module.exports = { buildXlsx };
