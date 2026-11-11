// Copies the framework core into a project folder:  node tools/sync-core.js ../Leads_Global_ERP_Final
// The core is never edited inside a project — change it here, then sync.
const fs = require('fs'), path = require('path');
const dest = process.argv[2]; if (!dest) { console.error('usage: node tools/sync-core.js <project-folder>'); process.exit(1); }
const src = path.join(__dirname, '..', 'core'), out = path.resolve(dest, 'core');
(function copy(a, b) { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); fs.statSync(s).isDirectory() ? copy(s, d) : fs.copyFileSync(s, d); } })(src, out);
console.log('core copied to', out);
