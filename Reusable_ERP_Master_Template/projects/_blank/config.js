/* BLANK PROJECT — copy this folder, rename it, then edit. This file is LAYER 2 (configuration).
   Read ../../CUSTOMIZATION_GUIDE.md for every option. Nothing in core/ needs to change.

   What you declare here:
     entities  — your tables and their fields (a field set can differ per scope value, e.g. per division / pipeline / branch)
     reports   — tables built from live data
     overview  — dashboard cards (each `value` is a function of the data: never type a number)
     nav       — the menu
     hooks     — optional business rules (put them in logic.js — LAYER 3 — and reference them here) */
(function (g) {
  'use strict';
  const U = g.ERP.util;

  g.PROJECT = g.PROJECT || {};
  g.PROJECT.config = {
    id: 'my-new-erp',                          // unique: backups of one project can never be restored into another
    name: 'My New ERP', subtitle: 'Blank starter', currency: 'USD',
    storageKey: 'erp_my_new_erp_v1', filesKey: 'erp_my_new_erp_files_v1',   // unique browser storage names
    scope: null,                               // or { field:'branch', label:'Branch', values:['North','South'], default:'North', colors:{...} }

    lists: { status: ['Active', 'Inactive'] },
    entities: {
      items: {
        label: 'Item', plural: 'Items', idPrefix: 'IT', unique: [['name']], track: ['status'],
        fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'status', label: 'Status', type: 'select', options: 'status', default: 'Active' },
          { key: 'since', label: 'Since', type: 'date', default: () => U.todayISO() },
          { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
        ],
        columns: ['id', 'name', 'status', 'since'], filters: ['status'],
      },
    },
    reports: {
      byStatus: { title: 'Items by status', columns: [{ key: 'status', label: 'Status' }, { key: 'n', label: 'Items', type: 'number' }],
        rows: s => ['Active', 'Inactive'].map(st => ({ status: st, n: s.count('items', { status: st }), drill: { entity: 'items', filter: { status: st } } })) },
    },
    overview: {
      cards: [{ label: 'Items', value: s => s.count('items'), drill: { entity: 'items' } }, { label: 'Active', tone: 'good', value: s => s.count('items', { status: 'Active' }), drill: { entity: 'items', filter: { status: 'Active' } } }],
      panels: ['byStatus'],
    },
    nav: {
      global: [{ view: 'overview', label: 'Dashboard', icon: 'grid' }, { view: 'entity', entity: 'items', icon: 'list' }, { view: 'report', id: 'byStatus', label: 'Items by status', icon: 'chart' }, { view: 'import', label: 'Import / Export', icon: 'upload' }],
      tools: [{ view: 'settings', label: 'Settings & Backup', icon: 'cog' }, { view: 'audit', label: 'Audit log', icon: 'list' }],
    },
    tone: v => ({ Active: 'good', Inactive: 'bad' }[v] || ''),
    demo: { seed: null },                      // set to a function(store) that creates fictional records through store.create(...)
  };
})(typeof window !== 'undefined' ? window : globalThis);
