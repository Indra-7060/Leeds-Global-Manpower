/* EXPORT — CSV that opens cleanly in Excel (UTF-8 BOM, quoted, formula-injection safe). File names carry the workspace
   (DEMO/LIVE) so exported demo data can never be mistaken for business data. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});

  /** columns: [{key,label}] or [key,...]; rows: objects. Pure — returns CSV text. */
  function toCsv(columns, rows) {
    const cols = columns.map(c => (typeof c === 'string' ? { key: c, label: c } : c));
    return LGM.Csv.stringify([cols.map(c => c.label), ...rows.map(r => cols.map(c => r[c.key]))]);
  }
  const fileName = base => `LGM_${LGM.Store.mode().toUpperCase()}_${String(base).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_${LGM.Util.todayISO()}.csv`;

  let last = null;
  function download(name, text, mime) {
    last = { name, text, mime: mime || 'text/csv;charset=utf-8' };
    if (typeof document === 'undefined' || g.__LGM_NO_DOWNLOAD) return; // __LGM_NO_DOWNLOAD: test hook
    const url = URL.createObjectURL(new Blob(['﻿', text], { type: last.mime }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  /** Export rows. Returns false when there is nothing to export. */
  function exportRows(base, columns, rows) {
    if (!rows.length) return false;
    download(fileName(base), toCsv(columns, rows)); return true;
  }

  LGM.Exporter = { toCsv, fileName, download, exportRows, last: () => last };
})(typeof window !== 'undefined' ? window : globalThis);
