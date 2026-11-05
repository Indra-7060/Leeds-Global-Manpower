/* XLSX READER — pure JS (ZIP central directory + DecompressionStream), no DOM, no network.
   Improvements over V6: date cells are converted to ISO dates (V6 returned Excel serial numbers), sheet selection,
   booleans/inline strings/formula strings, entity decoding, and it is testable outside a browser. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const u8str = b => new TextDecoder('utf-8').decode(b);

  async function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress XLSX files; save the sheet as CSV and import that instead.');
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function openZip(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { pos = i; break; }
    if (pos < 0) throw new Error('Not a valid XLSX file (ZIP directory not found).');
    const count = dv.getUint16(pos + 10, true); let off = dv.getUint32(pos + 16, true);
    const entries = {};
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('Invalid ZIP directory.');
      const method = dv.getUint16(off + 10, true), packed = dv.getUint32(off + 20, true);
      const nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), local = dv.getUint32(off + 42, true);
      entries[u8str(bytes.subarray(off + 46, off + 46 + nl))] = { method, packed, local };
      off += 46 + nl + el + cl;
    }
    async function read(name) {
      const e = entries[name]; if (!e) return '';
      if (dv.getUint32(e.local, true) !== 0x04034b50) throw new Error('Invalid ZIP member.');
      const start = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
      const part = bytes.subarray(start, start + e.packed);
      if (e.method === 0) return u8str(part);
      if (e.method === 8) return u8str(await inflateRaw(part));
      throw new Error('Unsupported ZIP compression method.');
    }
    return { entries, read };
  }

  const unesc = s => s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()];
  });
  const attrs = tag => { const o = {}; tag.replace(/([\w:.-]+)\s*=\s*"([^"]*)"/g, (m, k, v) => (o[k] = unesc(v))); return o; };
  const textOf = xml => { let out = ''; xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (m, t) => (out += unesc(t))); return out; };
  const colIndex = ref => { let n = 0; for (const c of (ref.match(/^[A-Z]+/) || ['A'])[0]) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };

  function isDateFormat(id, code) {
    if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58)) return true;
    if (!code) return false;
    const c = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    return /[dmyhs]/i.test(c) && !/^(general|0|#)/i.test(c.trim());
  }

  /** Read one worksheet. Returns { sheetNames, sheetIndex, rows } (rows = arrays of strings, blank rows dropped). */
  async function read(input, sheetIndex = 0) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const zip = openZip(bytes);

    const shared = [];
    const sst = await zip.read('xl/sharedStrings.xml');
    if (sst) sst.replace(/<si\b[^>]*>([\s\S]*?)<\/si>/g, (m, si) => { shared.push(textOf(si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''))); return m; });

    const dateXf = [];
    const styles = await zip.read('xl/styles.xml');
    if (styles) {
      const custom = {};
      styles.replace(/<numFmt\b([^>]*?)\/?>/g, (m, a) => { const o = attrs(a); if (o.numFmtId) custom[o.numFmtId] = o.formatCode; return m; });
      const block = (styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '';
      block.replace(/<xf\b([^>]*?)\/?>/g, (m, a) => { const id = Number(attrs(a).numFmtId || 0); dateXf.push(isDateFormat(id, custom[id])); return m; });
    }

    const wb = await zip.read('xl/workbook.xml');
    const sheets = []; wb.replace(/<sheet\b([^>]*?)\/?>/g, (m, a) => { const o = attrs(a); sheets.push({ name: o.name, rid: o['r:id'] || o.id }); return m; });
    if (!sheets.length) throw new Error('No worksheets found in this workbook.');
    const idx = Math.min(Math.max(0, sheetIndex), sheets.length - 1);
    let path = 'xl/worksheets/sheet' + (idx + 1) + '.xml';
    const rels = await zip.read('xl/_rels/workbook.xml.rels');
    if (rels && sheets[idx].rid) rels.replace(/<Relationship\b([^>]*?)\/?>/g, (m, a) => { const o = attrs(a); if (o.Id === sheets[idx].rid) path = o.Target.startsWith('/') ? o.Target.slice(1) : o.Target.startsWith('xl/') ? o.Target : 'xl/' + o.Target; return m; });

    const xml = await zip.read(path);
    if (!xml) throw new Error('Worksheet data not found.');
    const rows = [];
    xml.replace(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, (m, inner) => {
      if (!inner) return m;
      const vals = [];
      inner.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (mm, a, body) => {
        const o = attrs(a); const col = colIndex(o.r || 'A1'); let v = '';
        if (body) {
          const vm = body.match(/<v>([\s\S]*?)<\/v>/); const raw = vm ? unesc(vm[1]) : '';
          if (o.t === 's') v = shared[Number(raw)] || '';
          else if (o.t === 'inlineStr') v = textOf(body);
          else if (o.t === 'b') v = raw === '1' ? 'TRUE' : 'FALSE';
          else if (o.t === 'str' || o.t === 'e') v = raw;
          else if (o.t === 'd') v = raw.slice(0, 10);
          else if (raw !== '' && dateXf[Number(o.s)] && !isNaN(Number(raw))) v = LGM.Util.serialToISO(Number(raw));
          else v = raw.trim();
        }
        vals[col] = v; return mm;
      });
      const out = Array.from({ length: vals.length }, (_, i) => vals[i] || '');
      if (out.some(x => String(x).trim())) rows.push(out);
      return m;
    });
    return { sheetNames: sheets.map(s => s.name), sheetIndex: idx, rows };
  }

  /** Raw text of one member of any ZIP-based Office file (used for .docx CV text extraction). */
  async function readEntry(input, name) { return openZip(input instanceof Uint8Array ? input : new Uint8Array(input)).read(name); }

  LGM.Xlsx = { read, readEntry };
})(typeof window !== 'undefined' ? window : globalThis);
