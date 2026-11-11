// Generates ../ERP_Analysis_And_Documentation/DATA_DICTIONARY.md directly from project/config.js, so the document can never disagree with the code.
//   node tools/gen-data-dictionary.js
const path = require('path'), fs = require('fs');
const root = path.join(__dirname, '..');
['util', 'storage', 'store', 'importer'].forEach(f => require(path.join(root, 'core', 'js', f + '.js')));
['logic', 'config'].forEach(f => require(path.join(root, 'project', f + '.js')));
const C = LGM.config, store = ERP.Store(C, ERP.storage.MemoryAdapter());
const out = [];
out.push('# Leads Global ERP — Data Dictionary', '', '*Generated from `project/config.js` by `tools/gen-data-dictionary.js`. Do not edit by hand.*', '');
out.push('Every record has a system `id` (prefix + 4-digit number per table, e.g. `CAN-0007`), `createdAt` and `updatedAt`. Records link to each other **by id**. Scoped tables also carry `division` (fixed at creation, cannot be changed).', '');
Object.keys(C.entities).forEach(k => {
  const e = C.entities[k];
  out.push('## ' + (e.plural || k) + '  (`' + k + '`)', '');
  out.push('* ID prefix: `' + e.idPrefix + '-`   · Scoped by division: **' + (e.scoped ? 'yes' : 'no (global)') + '**');
  if (e.unique) out.push('* Duplicate rule: ' + e.unique.map(c => '`' + c.join(' + ') + '`' + (e.scoped ? ' (within a division)' : '')).join('; '));
  if (e.track) out.push('* History kept for: ' + e.track.map(t => '`' + t + '`').join(', '));
  if (e.upload) out.push('* File upload: ' + e.upload.accept + ', up to ' + (e.upload.maxBytes / 1048576) + ' MB, stored separately (IndexedDB), record keeps name/type/size/file id.');
  out.push('* Delete: blocked while other records still point to the record.', '');
  const scopes = e.scoped ? C.scope.values : [null];
  scopes.forEach(sc => {
    const fs_ = store.fieldsFor(k, sc); if (!fs_.length) { out.push('**' + (sc || 'all') + '** — not used in this division.', ''); return; }
    out.push('**' + (sc ? sc + ' — ' + store.label(k, sc).label : 'Fields') + '**', '', '| Field key | Label | Type | Required | Allowed values / link |', '|---|---|---|---|---|');
    fs_.forEach(f => {
      const req = typeof f.required === 'function' ? 'conditional' : f.required ? 'yes' : '';
      let a = '';
      if (f.type === 'select') { const o = store.optionsFor(f, sc, {}); a = o.length > 8 ? o.slice(0, 4).join(', ') + ' … (' + o.length + ' values)' : o.join(', '); }
      if (f.type === 'ref') a = '→ `' + f.ref + '`' + (f.fills ? ' (fills ' + Object.keys(f.fills).join(', ') + ')' : '');
      if (f.type === 'number') a = [f.min != null ? 'min ' + f.min : '', f.max != null ? 'max ' + f.max : '', f.integer ? 'whole number' : ''].filter(Boolean).join(', ');
      if (f.compute) a = 'calculated automatically';
      if (f.hidden) a = 'system (file metadata)';
      out.push('| `' + f.key + '` | ' + f.label + ' | ' + f.type + ' | ' + req + ' | ' + a.replace(/\|/g, '/') + ' |');
    });
    out.push('');
  });
});
out.push('## Stage lists per division', '');
Object.keys(LGM.STAGES).forEach(d => out.push('* **' + d + '**: ' + LGM.STAGES[d].join(' → ')));
out.push('', '## Candidate milestone dates filled by a daily update', '', '| Stage reached | Date field |', '|---|---|');
Object.keys(LGM.MILESTONE).forEach(s => out.push('| ' + s + ' | `' + LGM.MILESTONE[s] + '` |'));
out.push('');
const dest = path.join(root, '..', 'ERP_Analysis_And_Documentation', 'DATA_DICTIONARY.md');
fs.writeFileSync(dest, out.join('\n'));
console.log('written', dest, out.length, 'lines');
