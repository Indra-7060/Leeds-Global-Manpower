/* STORAGE ADAPTER — the only module that touches localStorage. In production this is replaced by an API client
   (see docs/06_Production_Requirements.md); nothing else in the app knows where data lives. */
(function (g) {
  'use strict';
  const LGM = (g.LGM = g.LGM || {});
  const mem = {};
  let persistent = true;

  const ls = () => { try { return g.localStorage || null; } catch (e) { return null; } };

  LGM.Storage = {
    get(key) {
      try { const s = ls(); const raw = s ? s.getItem(key) : null; return raw == null ? (key in mem ? mem[key] : null) : JSON.parse(raw); }
      catch (e) { return key in mem ? mem[key] : null; }
    },
    /** Returns true when written to durable storage; false when only held in memory (quota/private mode). */
    set(key, val) {
      try { const s = ls(); if (!s) throw new Error('no storage'); s.setItem(key, JSON.stringify(val)); delete mem[key]; persistent = true; return true; }
      catch (e) { mem[key] = val; persistent = false; return false; }
    },
    remove(key) { delete mem[key]; try { const s = ls(); if (s) s.removeItem(key); } catch (e) { /* ignore */ } },
    isPersistent: () => persistent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
