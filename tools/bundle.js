/* Packs the app into ONE self-contained HTML file (CSS + all scripts inline, same order as index.html).
   Usage:  node tools/bundle.js [--fragment <outfile>]
   Default output: dist/LGM_ERP_V6_Developed_single_file.html  (open by double-click, or host anywhere)
   --fragment writes a body-only variant (no doctype/html/head/body) for hosts that wrap the page themselves. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const css = read('css/styles.css') + '\nbody{background:#f2f6fa;color:#172b43}\n';
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<!-- configuration -->')).trim();
const js = scripts.map(f => { const t = read(f); if (/<\/script/i.test(t)) throw new Error(f + ' contains </script>'); return `<script>/* ${f} */\n${t}\n</script>`; }).join('\n');
const title = 'LGM ERP V6 Developed';
const fragment = `<title>${title}</title>\n<style>\n${css}</style>\n${body}\n${js}\n`;
const full = `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n${fragment}</head></html>`;
// full document: put markup in <body>
const fullDoc = `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${title}</title>\n<style>\n${css}</style>\n</head><body>\n${body}\n${js}\n</body></html>\n`;
const i = process.argv.indexOf('--fragment');
if (i > 0) { fs.writeFileSync(process.argv[i + 1], fragment); console.log('fragment →', process.argv[i + 1], fragment.length, 'bytes'); }
else { fs.mkdirSync(path.join(root, 'dist'), { recursive: true }); const out = path.join(root, 'dist', 'LGM_ERP_V6_Developed_single_file.html'); fs.writeFileSync(out, fullDoc); console.log('bundle →', out, fullDoc.length, 'bytes'); }
