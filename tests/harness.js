/* Test harness: loads the app's NON-UI scripts, in the exact order index.html loads them, into an isolated vm context
   with an in-memory localStorage. No browser needed. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(p => !p.startsWith('js/ui/'));
}

function load(opts = {}) {
  const store = opts.storage || {};
  const ctx = {
    console, setTimeout, clearTimeout, TextDecoder, TextEncoder, Blob, Response, DecompressionStream, URL,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { if (opts.quotaFull) throw new Error('QuotaExceeded'); store[k] = String(v); }, removeItem: k => delete store[k] },
  };
  vm.createContext(ctx);
  ctx.window = ctx; // modules attach to window when present
  for (const rel of scriptList()) vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  return { LGM: ctx.LGM, storage: store, ctx };
}

module.exports = { load, scriptList, ROOT };
