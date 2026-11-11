/* ERP core · boot.js — creates the store, the file store and the app from a project config, and starts it.
   A project page only needs:   <script>ERP.boot(window.PROJECT_CONFIG, '#app')</script>
   If saved data cannot be read it is NOT overwritten: the user is told and offered to download the raw data or start fresh. */
(function (g) {
  'use strict';
  const ERP = g.ERP = g.ERP || {};
  const esc = ERP.util.esc;

  ERP.boot = function boot(config, selector, options) {
    options = options || {};
    const mount = typeof selector === 'string' ? document.querySelector(selector) : selector;
    let adapter;
    try { adapter = options.adapter || ERP.storage.LocalAdapter(config.storageKey); } catch (e) { adapter = ERP.storage.MemoryAdapter(); }
    // localStorage can be blocked (private mode, file:// policy) — probe it and fall back to memory with a visible warning
    let memoryFallback = false;
    if (!options.adapter) { try { g.localStorage.setItem('__erp_probe', '1'); g.localStorage.removeItem('__erp_probe'); } catch (e) { adapter = ERP.storage.MemoryAdapter(); memoryFallback = true; } }
    const files = options.files || ERP.storage.IndexedFiles(config.filesKey || (config.storageKey + '_files'));
    let store;
    try { store = ERP.Store(config, adapter); }
    catch (e) {
      mount.innerHTML = '<div style="max-width:640px;margin:60px auto;font-family:system-ui;padding:0 16px"><h1>Saved data could not be opened</h1><p>' + esc(e.message) + '</p><p>Your data has <b>not</b> been changed. You can download the raw stored text and send it to support, or start with an empty database.</p><p><button id="dl">Download raw data</button> <button id="rs">Start empty (deletes the unreadable data)</button></p></div>';
      mount.querySelector('#dl').onclick = () => { let t = ''; try { t = g.localStorage.getItem(config.storageKey) || ''; } catch (x) { /* none */ } ERP.util.download(t, config.storageKey + '_raw.txt', 'text/plain'); };
      mount.querySelector('#rs').onclick = () => { if (g.confirm('Delete the unreadable data and start empty?')) { adapter.clear(); g.location.reload(); } };
      return null;
    }
    const app = ERP.App(config, { store, files, mount });
    app.start();
    if (memoryFallback) ERP.ui.toast('Browser storage is blocked here, so nothing you enter will be kept after closing this page.', 'warn', 12000);
    g.ERP_APP = app; return app;
  };
})(typeof window !== 'undefined' ? window : globalThis);
