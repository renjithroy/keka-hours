/*
 * Local-only planner preferences (chrome.storage.local): which upcoming days
 * the user marked as away (WFH / leave) or as an extra office day.
 * Shape: { planOverrides: { 'YYYY-MM': { 'YYYY-MM-DD': 'office' | 'away' } } }
 * Also stores the widget's colour theme: { theme: 'light' | 'dark' }
 * and the Overview's "include today" switch: { includeToday: boolean }
 */
(function (root) {
  'use strict';

  const KEY = 'planOverrides';
  const THEME_KEY = 'theme';
  const INCLUDE_TODAY_KEY = 'includeToday';
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

  const validTheme = t => (t === 'light' || t === 'dark' ? t : null);

  /** Saved theme ('light' | 'dark'), or null if the user never chose one. */
  async function loadTheme() {
    const s = storage();
    if (!s) return null;
    try {
      const got = await s.get({ [THEME_KEY]: null });
      return validTheme(got[THEME_KEY]);
    } catch (_) {
      return null;
    }
  }

  async function saveTheme(theme) {
    const value = validTheme(theme);
    const s = storage();
    if (!s || !value) return;
    try { await s.set({ [THEME_KEY]: value }); } catch (_) { /* extension reloaded; keep in memory */ }
  }

  /** Calls back when the theme changes (e.g. toggled in another Keka tab). */
  function onThemeChange(callback) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[THEME_KEY]) callback(validTheme(changes[THEME_KEY].newValue));
      });
    } catch (_) { /* storage unavailable */ }
  }

  async function loadIncludeToday() {
    const s = storage();
    if (!s) return false;
    try {
      const got = await s.get({ [INCLUDE_TODAY_KEY]: false });
      return got[INCLUDE_TODAY_KEY] === true;
    } catch (_) {
      return false;
    }
  }

  async function saveIncludeToday(value) {
    const s = storage();
    if (!s) return;
    try { await s.set({ [INCLUDE_TODAY_KEY]: value === true }); } catch (_) { /* extension reloaded; keep in memory */ }
  }

  /** Calls back when "include today" changes (e.g. toggled in another Keka tab). */
  function onIncludeTodayChange(callback) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[INCLUDE_TODAY_KEY]) callback(changes[INCLUDE_TODAY_KEY].newValue === true);
      });
    } catch (_) { /* storage unavailable */ }
  }

  root.KekaHours.settings = {
    loadOverrides, saveOverrides, onChange, loadTheme, saveTheme, onThemeChange,
    loadIncludeToday, saveIncludeToday, onIncludeTodayChange,
  };
})(globalThis);
