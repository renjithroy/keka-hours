/*
 * Local-only planner preferences (chrome.storage.local): which upcoming days
 * the user marked as away (WFH / leave) or as an extra office day.
 * Shape: { planOverrides: { 'YYYY-MM': { 'YYYY-MM-DD': 'office' | 'away' } } }
 */
(function (root) {
  'use strict';

  const KEY = 'planOverrides';
  const KEEP_MONTHS = 3;

  function storage() {
    try { return chrome.storage && chrome.storage.local; } catch (_) { return null; }
  }

  async function loadOverrides() {
    const s = storage();
    if (!s) return {};
    try {
      const got = await s.get({ [KEY]: {} });
      return got[KEY] && typeof got[KEY] === 'object' ? got[KEY] : {};
    } catch (_) {
      return {};
    }
  }

  async function saveOverrides(all) {
    const months = Object.keys(all).sort();
    const pruned = {};
    for (const k of months.slice(-KEEP_MONTHS)) if (Object.keys(all[k]).length) pruned[k] = all[k];
    const s = storage();
    if (s) {
      try { await s.set({ [KEY]: pruned }); } catch (_) { /* extension reloaded; keep in memory */ }
    }
    return pruned;
  }

  /** Calls back when overrides change (e.g. from another Keka tab). */
  function onChange(callback) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) callback(changes[KEY].newValue || {});
      });
    } catch (_) { /* storage unavailable */ }
  }

  root.KekaHours.settings = { loadOverrides, saveOverrides, onChange };
})(globalThis);
