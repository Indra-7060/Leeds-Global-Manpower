/* ERP core · storage.js — storage adapters.
   The Store only talks to the adapter interface below, so the browser demo (localStorage) can be replaced by a server API
   (database + authentication + audit) without touching UI or business logic.

   Adapter interface (all synchronous for the main data, asynchronous for files):
     kind                       string label shown in Settings
     load()  -> object|null     whole database snapshot
     save(obj)                  persist the whole snapshot (throws on quota / failure)
     clear()                    remove everything for this project
   File store interface (documents):
     put(id, {name,type,size,dataUrl}) -> Promise ; get(id) -> Promise<obj|null> ; remove(id) -> Promise ; ids() -> Promise<string[]>

   IMPORTANT: localStorage / IndexedDB live in ONE browser on ONE device. They are not secure, shared or multi-user storage. */
(function (g) {
  'use strict';
  const ERP = g.ERP = g.ERP || {};

  function LocalAdapter(key) {
    return {
      kind: 'Browser localStorage (demo only — not secure, not shared)',
      key,
      load() { try { const t = g.localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch (e) { throw new Error('Stored data could not be read: ' + e.message); } },
      save(obj) { g.localStorage.setItem(key, JSON.stringify(obj)); },
      clear() { g.localStorage.removeItem(key); },
    };
  }
  function MemoryAdapter(initial) {
    let mem = initial ? JSON.parse(JSON.stringify(initial)) : null;
    return { kind: 'In-memory (tests)', load() { return mem ? JSON.parse(JSON.stringify(mem)) : null; }, save(o) { mem = JSON.parse(JSON.stringify(o)); }, clear() { mem = null; } };
  }

  /** In-memory file store (tests, or browsers without IndexedDB). */
  function MemoryFiles() {
    const m = new Map();
    return {
      kind: 'In-memory files',
      async put(id, f) { m.set(id, f); }, async get(id) { return m.get(id) || null; }, async remove(id) { m.delete(id); }, async ids() { return [...m.keys()]; }, async clear() { m.clear(); },
    };
  }
  /** IndexedDB file store: keeps document files out of the small localStorage quota. */
  function IndexedFiles(dbName) {
    if (!g.indexedDB) return MemoryFiles();
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = g.indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('files', mode), s = t.objectStore('files'), q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
    return {
      kind: 'Browser IndexedDB (demo only)',
      put: (id, f) => tx('readwrite', s => s.put(f, id)), get: async id => (await tx('readonly', s => s.get(id))) || null,
      remove: id => tx('readwrite', s => s.delete(id)), ids: async () => (await tx('readonly', s => s.getAllKeys())) || [], clear: () => tx('readwrite', s => s.clear()),
    };
  }

  ERP.storage = { LocalAdapter, MemoryAdapter, MemoryFiles, IndexedFiles };
})(typeof window !== 'undefined' ? window : globalThis);
