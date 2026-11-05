/* Optional local static server (no dependencies):  node tools/serve.js [port]
   The app also works by simply double-clicking index.html — this is only for convenience / automated browser testing. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), port = Number(process.argv[2]) || 5173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv' };
http.createServer((req, res) => {
  // Test helper: the browser E2E suite POSTs its results here. Writes ONE fixed file only (tests/e2e-results.json), localhost only.
  if (req.method === 'POST' && req.url === '/__e2e-results') {
    let body = ''; req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => { try { JSON.parse(body); fs.writeFileSync(path.join(root, 'tests', 'e2e-results.json'), body); res.writeHead(200); res.end('saved'); } catch (e) { res.writeHead(400); res.end('bad json'); } });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('LGM ERP V6 Developed → http://127.0.0.1:' + port));
