/* Display formatting helpers (pure). */
(function (root) {
  'use strict';

  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /** 542.9 -> "9h 02m" (truncated like HR — never rounded up) */
  function duration(minutes) {
    if (!Number.isFinite(minutes)) return '—';
    const total = Math.max(0, Math.floor(minutes + 1e-9));
    return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
  }

  /** 2 -> "+2m", -65 -> "−1h 05m", 0 -> "±0m" */
  function delta(minutes) {
    if (!Number.isFinite(minutes)) return '—';
    const r = Math.round(minutes);
    if (r === 0) return '±0m';
    const sign = r > 0 ? '+' : '−';
    const abs = Math.abs(r);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return h ? `${sign}${h}h ${String(m).padStart(2, '0')}m` : `${sign}${m}m`;
  }

  /** 639.6 -> "10:39" (compact, for calendar cells) */
  function compact(minutes) {
    if (!Number.isFinite(minutes)) return '';
    const total = Math.max(0, Math.floor(minutes + 1e-9));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  /** epoch ms -> "7:42 PM" */
  function timeOfDay(ts) {
    const d = new Date(ts);
    const h = d.getHours();
    return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  /** "2026-10" -> "October" */
  function monthName(monthKey) {
    const m = Number(String(monthKey || '').slice(5, 7));
    return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
      'October', 'November', 'December'][m - 1] || '';
  }

  /** "2026-09-01" -> "Tue, 1 Sep" */
  function dayDate(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  }

  /** "September 2026" -> "Sep 2026"; other labels unchanged. */
  function shortLabel(label) {
    const m = /^([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(String(label || '').trim());
    return m ? `${m[1]} ${m[2]}` : String(label || '');
  }

  function relative(ts, now = Date.now()) {
    if (!ts) return '';
    const s = Math.max(0, Math.round((now - ts) / 1000));
    if (s < 45) return 'just now';
    if (s < 90) return '1 min ago';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    const d = new Date(ts);
    return `at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const api = { duration, delta, compact, timeOfDay, monthName, dayDate, shortLabel, relative };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.KekaHours = root.KekaHours || {}).format = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
