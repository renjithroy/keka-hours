/*
 * Attendance parser: Keka DOM + captured API records -> normalized AttendanceDay[].
 *
 * Two layers:
 *  1. snapshot(document)  – the only code that touches the DOM. Reads the month
 *     header and, per row, plain strings (date text, badges, tooltips, text).
 *  2. Pure functions      – classifyRow, normalizeApiRecord, mergeDay, buildView.
 *
 * The rendered table is the source of truth for *which* days are shown and
 * their status. API records only upgrade a day's duration to exact seconds,
 * and only when they agree with what the table currently shows (so a stale
 * API copy can never override a newer table).
 */
(function (root) {
  'use strict';

  const MONTH_TOKENS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const ROW_DATE_RE = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:,?\s+(\d{4}))?/i;
  const DURATION_RE = /(\d{1,3})\s*h\s*(\d{1,2})\s*m\b/gi;
  // Display rounding (floor vs round) can differ by a minute.
  const AGREE_TOLERANCE_MIN = 1;
  // totalGrossHours has 2 decimals => +-18s; allow a little slack.
  const PRECISE_TOLERANCE_SEC = 20;

  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const pad2 = n => String(n).padStart(2, '0');
  const dateKey = (y, m0, d) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

  function monthIndex(token) {
    return MONTH_TOKENS.indexOf(String(token || '').slice(0, 3).toLowerCase());
  }

  function localDateKey(date) {
    return dateKey(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /** "September, 2026" -> { isMonth, label: 'September 2026', year, month, monthKey } */
  function parseHeader(text) {
    const t = clean(text);
    const m = /^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(t);
    if (m && monthIndex(m[1]) >= 0) {
      const month = monthIndex(m[1]);
      const year = Number(m[2]);
      return { isMonth: true, label: `${MONTH_NAMES[month]} ${year}`, year, month, monthKey: `${year}-${pad2(month + 1)}` };
    }
    return { isMonth: false, label: t || null, year: null, month: null, monthKey: null };
  }

  function isValidDate(y, m0, d) {
    const dt = new Date(y, m0, d);
    return dt.getFullYear() === y && dt.getMonth() === m0 && dt.getDate() === d;
  }

  /** Row date text ("Fri, 04 Sept") -> 'YYYY-MM-DD'. Year comes from the header or is inferred. */
  function resolveRowDate(text, header, today) {
    const m = ROW_DATE_RE.exec(String(text || ''));
    if (!m) return null;
    const day = Number(m[2]);
    const month = monthIndex(m[3]);
    if (month < 0) return null;
    let year;
    if (m[4]) year = Number(m[4]);
    else if (header && header.isMonth && header.month === month) year = header.year;
    else {
      // Rolling views (e.g. "30 DAYS"): the most recent such date not far in the future.
      year = today.getFullYear();
      if (new Date(year, month, day) - today > 31 * 864e5) year -= 1;
    }
    return isValidDate(year, month, day) ? dateKey(year, month, day) : null;
  }

  function parseMinutes(text) {
    const all = [...String(text || '').matchAll(DURATION_RE)];
    if (!all.length) return null;
    const last = all[all.length - 1]; // Gross Hours comes after Break Taken.
    return Number(last[1]) * 60 + Number(last[2]);
  }

  /** Pure: row snapshot -> AttendanceDay (display-rounded). */
  function classifyRow(snap, ctx) {
    const date = resolveRowDate(snap.dateText, ctx.header, ctx.today);
    if (!date) return null;
    const marks = [...(snap.badges || []), ...(snap.tooltips || [])].map(clean).join(' | ');
    const all = `${marks} | ${clean(snap.text)}`;
    const gross = parseMinutes(snap.durationText != null ? snap.durationText : snap.text) || 0;
    const [y, mo, d] = date.split('-').map(Number);
    const leaveMark = /\bleave\b/i.test(marks);
    const halfMark = /\bhalf\b|\b(1st|2nd|first|second)\s*half\b/i.test(all);
    return {
      date,
      dayName: WEEKDAYS[new Date(y, mo - 1, d).getDay()],
      grossMinutes: gross,
      displayedMinutes: gross,
      isWFH: /\bwfh\b|work\s*from\s*home/i.test(marks),
      isLeave: leaveMark && !halfMark,
      isHalfLeave: leaveMark && halfMark,
      isPresent: /\bpresent\b/i.test(marks),
      isHoliday: /\bhldy\b|\bholiday\b/i.test(all),
      isWeeklyOff: /\bw-?off\b|weekly[\s-]?off/i.test(all),
      hasTrackedTime: gross > 0,
      isToday: date === ctx.todayKey,
      isIncomplete: false,
      sourcePrecision: 'display-rounded',
    };
  }

  function secondsBetween(a, b) {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    return Number.isFinite(ta) && Number.isFinite(tb) && tb >= ta ? (tb - ta) / 1000 : null;
  }

  /**
   * Exact gross seconds from punch timestamps, accepted only when it matches
   * Keka's own totalGrossHours. Never fabricates precision.
   */
  function preciseSeconds(rec) {
    if (!Number.isFinite(rec.grossHours)) return null;
    const reference = rec.grossHours * 3600;
    if (reference === 0) return 0;
    const candidates = [];
    const pairs = Array.isArray(rec.pairs) ? rec.pairs : [];
    if (pairs.length && pairs.every(p => p && p[0] && p[1])) {
      const parts = pairs.map(p => secondsBetween(p[0], p[1]));
      if (parts.every(v => v != null)) candidates.push(parts.reduce((s, v) => s + v, 0));
    }
    if (rec.firstLog && rec.lastLog) {
      const span = secondsBetween(rec.firstLog, rec.lastLog);
      if (span != null) candidates.push(span);
    }
    const hit = candidates.find(c => Math.abs(c - reference) <= PRECISE_TOLERANCE_SEC);
    return hit == null ? null : hit;
  }

  /** Pure: trimmed API record (see network-hook.js) -> AttendanceDay. */
  function normalizeApiRecord(rec, ctx) {
    if (!rec || typeof rec.date !== 'string') return null;
    const precise = preciseSeconds(rec);
    const shown = parseMinutes(rec.grossText);
    const displayed = shown != null ? shown : Number.isFinite(rec.grossHours) ? Math.round(rec.grossHours * 60) : 0;
    const grossMinutes = precise != null ? precise / 60 : displayed;
    const isToday = rec.date === ctx.todayKey;
    const pairs = rec.pairs || [];
    const openPair = pairs.some(p => p && p[0] && !p[1]);
    // Today's first clock-in (Keka's first log of the day), breaks or not: gross hours run from
    // it, so it plus the time to sit is when you can clock out.
    const firstIn = isToday ? (rec.firstLog || (pairs[0] && pairs[0][0]) || null) : null;
    const [y, mo, d] = rec.date.split('-').map(Number);
    return {
      date: rec.date,
      dayName: WEEKDAYS[new Date(y, mo - 1, d).getDay()],
      grossMinutes,
      displayedMinutes: displayed,
      // Inferred from Keka data: dayType 1 = holiday, 2 = weekly off;
      // attendanceDayStatus 1 = present (office), 2 = remote / WFH.
      isWFH: rec.status === 2 || rec.remoteDay === true,
      isLeave: rec.leave === true && rec.partialLeave !== true,
      isHalfLeave: rec.leave === true && rec.partialLeave === true,
      isPresent: rec.status === 1,
      isHoliday: rec.dayType === 1,
      isWeeklyOff: rec.dayType === 2,
      hasTrackedTime: grossMinutes > 0,
      isToday,
      // Still clocked in today (last punch is an IN, or an open pair).
      isIncomplete: isToday && grossMinutes > 0 && (rec.lastPunch === 0 || openPair),
      firstIn,
      sourcePrecision: precise != null ? 'precise' : 'display-rounded',
    };
  }

  /** Pure: combine a table row with the API record for the same date. */
  function mergeDay(domDay, apiDay) {
    const agrees = apiDay &&
      Math.abs(Math.round(apiDay.grossMinutes) - domDay.displayedMinutes) <= AGREE_TOLERANCE_MIN;
    if (!agrees) {
      // No (current) API data: today can't be confirmed as finished, so it
      // is shown as "in progress" rather than distorting the average.
      return { ...domDay, isIncomplete: domDay.isToday && domDay.grossMinutes > 0 };
    }
    return {
      ...domDay,
      grossMinutes: apiDay.sourcePrecision === 'precise' ? apiDay.grossMinutes : domDay.grossMinutes,
      sourcePrecision: apiDay.sourcePrecision,
      isWFH: domDay.isWFH || apiDay.isWFH,
      // The API knows full vs half-day leave; the table badge alone doesn't.
      isHalfLeave: domDay.isHalfLeave || apiDay.isHalfLeave,
      isLeave: (domDay.isLeave || apiDay.isLeave) && !(domDay.isHalfLeave || apiDay.isHalfLeave),
      isHoliday: domDay.isHoliday || apiDay.isHoliday,
      isWeeklyOff: domDay.isWeeklyOff || apiDay.isWeeklyOff,
      isPresent: domDay.isPresent || apiDay.isPresent,
      isIncomplete: apiDay.isIncomplete,
      firstIn: apiDay.firstIn || null,
    };
  }

  function labelFromDays(days) {
    const months = new Set(days.map(d => d.date.slice(0, 7)));
    if (months.size !== 1) return 'Attendance';
    const [y, m] = [...months][0].split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }

  /**
   * Pure: snapshot + API store -> view.
   *   { status: 'ok', label, days, source: 'table'|'api' }
   *   { status: 'loading', label, reason }
   */
  function buildView(snap, apiRecords, ctx) {
    const header = parseHeader(snap.headerText);
    const c = { ...ctx, header };
    const apiFor = date => {
      const rec = apiRecords && apiRecords.get(date);
      return rec ? normalizeApiRecord(rec, c) : null;
    };

    if (snap.rows && snap.rows.length) {
      let domDays = snap.rows.map(r => classifyRow(r, c)).filter(Boolean);
      if (!domDays.length) return { status: 'loading', label: header.label, reason: 'unparsed-rows' };

      // Rolling view ("Last 30 Days"): show the current month to date only.
      if (!header.isMonth) {
        const monthKey = ctx.todayKey.slice(0, 7);
        const [y, m] = monthKey.split('-').map(Number);
        domDays = domDays.filter(d => d.date.slice(0, 7) === monthKey && d.date <= ctx.todayKey);
        const shown = new Set(domDays.map(d => d.date));
        // Fill any early-month days the rolling window doesn't reach (e.g. 1st on the 31st).
        const extra = apiRecords
          ? [...apiRecords.values()]
            .filter(r => r && typeof r.date === 'string' && r.date.slice(0, 7) === monthKey && r.date <= ctx.todayKey && !shown.has(r.date))
            .map(r => normalizeApiRecord(r, c)).filter(Boolean)
          : [];
        const days = [...domDays.map(d => mergeDay(d, apiFor(d.date))), ...extra];
        return { status: 'ok', label: `${MONTH_NAMES[m - 1]} ${y}`, monthKey, monthToDate: true, days, source: 'table' };
      }

      // Header already switched month but Angular still shows the old rows.
      if (header.isMonth && domDays.some(d => d.date.slice(0, 7) !== header.monthKey)) {
        return { status: 'loading', label: header.label, reason: 'month-mismatch' };
      }
      const days = domDays.map(d => mergeDay(d, apiFor(d.date)));
      const monthKey = header.monthKey || (labelFromDays(days) !== 'Attendance' ? days[0].date.slice(0, 7) : null);
      return { status: 'ok', label: header.label || labelFromDays(days), monthKey, days, source: 'table' };
    }

    // No table rows (e.g. calendar view): fall back to captured API data for the header month.
    if (header.isMonth && apiRecords) {
      const days = [...apiRecords.values()]
        .filter(r => r && typeof r.date === 'string' && r.date.slice(0, 7) === header.monthKey)
        .map(r => normalizeApiRecord(r, c))
        .filter(Boolean);
      if (days.length) return { status: 'ok', label: header.label, monthKey: header.monthKey, days, source: 'api' };
    }
    return { status: 'loading', label: header.label, reason: snap.listPresent ? 'no-rows' : 'no-list' };
  }

  /** Stable fingerprint of what the summary depends on. */
  function signature(view) {
    if (view.status !== 'ok') return `${view.status}|${view.label || ''}|${view.reason || ''}`;
    return `${view.label}|${view.monthToDate ? 'mtd' : ''}|${view.source}|` + view.days.map(d => [
      d.date,
      d.isWFH ? 'w' : '', d.isLeave ? 'l' : '', d.isHalfLeave ? 'hl' : '', d.isHoliday ? 'h' : '', d.isWeeklyOff ? 'o' : '',
      d.isIncomplete ? 'a' : '', d.firstIn || '',
      Math.round(d.grossMinutes * 60),
      d.sourcePrecision === 'precise' ? 'p' : 'r',
    ].join(',')).join(';');
  }

  /* ------------------------------ DOM layer ------------------------------ */

  function findHeaderText(scope) {
    if (!scope) return '';
    const headings = [...scope.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    const month = headings.find(h => parseHeader(h.textContent).isMonth);
    if (month) return clean(month.textContent);
    const any = headings.find(h => clean(h.textContent));
    return any ? clean(any.textContent) : '';
  }

  function rowElements(listView) {
    // Layer 1: each child of the list body is one day (worked rows and
    // W-OFF/leave/holiday rows have different inner markup).
    const body = listView.querySelector('.card-body');
    if (body && body.children.length) return [...body.children];
    // Layer 2: known row class.
    return [...listView.querySelectorAll('.attendance-logs-row')];
  }

  function snapshotRow(el) {
    const text = clean(el.textContent);
    const m = ROW_DATE_RE.exec(text);
    if (!m) return null;
    // Prefer the "Gross Hours" column cell; fall back to the row's last duration.
    const cells = [...el.querySelectorAll('span')].map(s => clean(s.textContent)).filter(t => /^\d{1,3}h \d{1,2}m$/.test(t));
    return {
      dateText: m[0],
      text,
      durationText: cells.length ? cells[cells.length - 1] : null,
      badges: [...el.querySelectorAll('.badge')].map(b => clean(b.textContent)),
      tooltips: [...el.querySelectorAll('[xhrtooltip]')].map(n => clean(n.getAttribute('xhrtooltip'))),
    };
  }

  function snapshot(doc) {
    const logs = doc.querySelector('employee-attendance-logs');
    const listView = doc.querySelector('employee-attendance-list-view');
    const rows = listView ? rowElements(listView).map(snapshotRow).filter(Boolean) : [];
    return {
      headerText: findHeaderText(logs || listView && listView.parentElement),
      listPresent: !!listView,
      rows,
    };
  }

  /**
   * Pure: the Actions card's button / link labels -> 'in' (shows "WFH
   * Clock-out"), 'out' (only "WFH Clock-In"), or null (card not there).
   */
  function clockStateFromLabels(labels) {
    const texts = (labels || []).map(clean);
    if (texts.some(t => /\bclock[\s-]*out\b/i.test(t))) return 'in';
    if (texts.some(t => /\bclock[\s-]*in\b/i.test(t))) return 'out';
    return null;
  }

  /** DOM: WFH clock state from Keka's Actions card (fallback when no API data). */
  function readClockState(doc) {
    const card = doc.querySelector('employee-attendance-request-actions');
    if (!card) return null;
    return clockStateFromLabels([...card.querySelectorAll('button, a')].map(el => el.textContent));
  }

  const api = {
    parseHeader, resolveRowDate, parseMinutes, classifyRow, preciseSeconds,
    normalizeApiRecord, mergeDay, buildView, signature, snapshot, localDateKey,
    clockStateFromLabels, readClockState,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.KekaHours = root.KekaHours || {}).parser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
