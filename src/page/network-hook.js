/*
 * Runs in the page's MAIN world at document_start.
 *
 * Keka renders the attendance log from
 *   GET /k/attendance/api/mytime/attendance/summary/<YYYY-MM-01>
 * whose records carry exact punch timestamps (to the second). The table only
 * shows minute-rounded "Gross Hours", so this hook passively reads copies of
 * that response and forwards a *minimal* per-day record to the extension's
 * content script on the same page.
 *
 * For WFH clock-out reminders it also reads the responses of
 *   POST .../attendance/workingremotelyclockin   (WFH Clock-In / Clock-out click)
 *   GET  .../attendance/attendancedayrequests    (Actions card, on page load)
 * keeping only the request date and each punch's time and in/out direction.
 *
 * - It never makes requests of its own and never reads headers/tokens/cookies
 *   or request bodies.
 * - It ignores every other endpoint.
 * - It drops everything except the fields needed (no locations, IP
 *   addresses, notes, premises, ids).
 * - Data only travels via window.postMessage to this same page.
 */
(function () {
  'use strict';

  const SUMMARY_URL = /\/attendance\/api\/mytime\/attendance\/summary\b/i;
  const CLOCKIN_URL = /\/attendance\/api\/mytime\/attendance\/workingremotelyclockin\b/i;
  const DAY_REQUESTS_URL = /\/attendance\/api\/mytime\/attendance\/attendancedayrequests\b/i;
  const CHANNEL = 'keka-hours-extension';
  const MAX_DAYS = 400;

  function toNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function toTimestamp(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value : null;
  }

  /** Reduce one Keka day-summary record to the fields the extension needs. */
  function trimSummaryRecord(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const date = typeof rec.attendanceDate === 'string' ? rec.attendanceDate.slice(0, 10) : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

    const entries = Array.isArray(rec.timeEntries) ? rec.timeEntries.filter(e => e && !e.isDeleted) : [];
    const last = entries[entries.length - 1];
    const pairs = (Array.isArray(rec.validInOutPairs) ? rec.validInOutPairs : [])
      .map(p => [toTimestamp(p && p.inTime), toTimestamp(p && p.outTime)]);
    const leaveStatuses = Array.isArray(rec.leaveDayStatuses) ? rec.leaveDayStatuses : [];
    const leaveDetails = Array.isArray(rec.leaveDetails) ? rec.leaveDetails.filter(Boolean) : [];
    // leaveDayStatus: 1 = full day, 2 / 3 = first / second half (inferred from Keka data).
    const leaveCodes = [...leaveStatuses, ...leaveDetails.map(l => l.leaveDayStatus)].filter(v => typeof v === 'number');
    const hasLeave = leaveStatuses.length > 0 || leaveDetails.length > 0;
    const partialLeave = hasLeave && (
      (leaveCodes.length > 0 && leaveCodes.every(c => c === 2 || c === 3)) ||
      (leaveDetails.length > 0 && leaveDetails.every(l => l.isHourlyLeave === true))
    );

    return {
      date,
      dayType: toNumber(rec.dayType),
      status: toNumber(rec.attendanceDayStatus),
      remoteDay: rec.isFullyWorkedOnWorkingRemotelyDay === true,
      leave: hasLeave,
      partialLeave,
      grossHours: toNumber(rec.totalGrossHours),
      grossText: typeof rec.grossHoursInHHMM === 'string' ? rec.grossHoursInHHMM : null,
      pairs,
      firstLog: toTimestamp(rec.firstLogOfTheDay),
      lastLog: toTimestamp(rec.lastLogOfTheDay),
      lastPunch: last ? toNumber(last.punchStatus) : null,
      entryCount: entries.length,
    };
  }

  function trimSummaryPayload(payload) {
    const list = payload && Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
    return list.slice(0, MAX_DAYS).map(trimSummaryRecord).filter(Boolean);
  }

  /** One Keka WFH day request -> { date, punches: [{ at, in }] } (punchStatus 0 = in, 1 = out). */
  function trimWfhRequest(req) {
    if (!req || typeof req !== 'object') return null;
    const date = typeof req.requestDate === 'string' ? req.requestDate.slice(0, 10) : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const punches = (Array.isArray(req.timeEntries) ? req.timeEntries : [])
      .filter(e => e && !e.isDeleted && toTimestamp(e.timestamp) && (e.punchStatus === 0 || e.punchStatus === 1))
      .map(e => ({ at: e.timestamp.slice(0, 19), in: e.punchStatus === 0 }))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    return { date, punches };
  }

  /** WFH Clock-In / Clock-out click response: today's request with every punch. */
  function trimClockinResponse(payload) {
    const rec = trimWfhRequest(payload && payload.data && payload.data.request);
    return rec ? { records: [rec], complete: false } : null;
  }

  /** Page-load day requests: every WFH request, so a missing day means no web punches. */
  function trimDayRequests(payload) {
    const data = payload && payload.data;
    if (!data || typeof data !== 'object' || !('workfromhome' in data)) return null;
    const list = Array.isArray(data.workfromhome) ? data.workfromhome : [];
    return { records: list.slice(0, 31).map(trimWfhRequest).filter(Boolean), complete: true };
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { trimSummaryRecord, trimSummaryPayload, trimWfhRequest, trimClockinResponse, trimDayRequests };
    return;
  }

  // Latest record per date; replayed when the content script asks (it may load
  // after Keka's first request completed).
  const cache = new Map();

  function publish(records) {
    window.postMessage({ source: CHANNEL, type: 'attendance-records', records }, window.location.origin);
  }

  function ingest(payload) {
    try {
      const records = trimSummaryPayload(typeof payload === 'string' ? JSON.parse(payload) : payload);
      if (!records.length) return;
      for (const r of records) cache.set(r.date, r);
      if (cache.size > MAX_DAYS) {
        const oldest = [...cache.keys()].sort().slice(0, cache.size - MAX_DAYS);
        for (const k of oldest) cache.delete(k);
      }
      publish(records);
    } catch (_) { /* not our data; ignore */ }
  }

  // Latest WFH punches seen (the page-load request usually completes before
  // the content script is listening).
  let lastWfh = null;

  function ingestWfh(trim, payload) {
    try {
      const wfh = trim(typeof payload === 'string' ? JSON.parse(payload) : payload);
      if (!wfh) return;
      lastWfh = wfh;
      window.postMessage({ source: CHANNEL, type: 'wfh-punches', ...wfh }, window.location.origin);
    } catch (_) { /* not our data; ignore */ }
  }

  /** Which handler (if any) reads this response. */
  function handlerFor(url) {
    if (SUMMARY_URL.test(url)) return ingest;
    if (CLOCKIN_URL.test(url)) return payload => ingestWfh(trimClockinResponse, payload);
    if (DAY_REQUESTS_URL.test(url)) return payload => ingestWfh(trimDayRequests, payload);
    return null;
  }

  window.addEventListener('message', event => {
    if (event.source !== window || !event.data || event.data.source !== CHANNEL) return;
    if (event.data.type !== 'replay-request') return;
    if (cache.size) publish([...cache.values()]);
    if (lastWfh) window.postMessage({ source: CHANNEL, type: 'wfh-punches', ...lastWfh }, window.location.origin);
  });

  // Keka's Angular router navigates with history.pushState/replaceState, which
  // fires neither hashchange nor popstate. Announce those URL changes so the
  // widget can hide/show immediately. (Only a signal; no data is sent.)
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    if (typeof original !== 'function') continue;
    history[method] = function (...args) {
      const result = original.apply(this, args);
      try { window.postMessage({ source: CHANNEL, type: 'route-change' }, window.location.origin); } catch (_) {}
      return result;
    };
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function (...args) {
      const result = originalFetch.apply(this, args);
      try {
        const input = args[0];
        const url = typeof input === 'string' ? input : input && input.url;
        const handle = url ? handlerFor(String(url)) : null;
        if (handle) {
          result.then(res => {
            if (res && res.ok) res.clone().json().then(handle).catch(() => {});
          }).catch(() => {});
        }
      } catch (_) { /* never interfere with Keka */ }
      return result;
    };
  }

  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const originalOpen = XHR.prototype.open;
    const originalSend = XHR.prototype.send;

    XHR.prototype.open = function (method, url, ...rest) {
      try { this.__kekaHoursHandle = handlerFor(String(url)); } catch (_) {}
      return originalOpen.call(this, method, url, ...rest);
    };

    XHR.prototype.send = function (...args) {
      const handle = this.__kekaHoursHandle;
      if (handle) {
        this.addEventListener('load', function () {
          try {
            if (this.status < 200 || this.status >= 300) return;
            const type = this.responseType;
            if (type === '' || type === 'text') handle(this.responseText);
            else if (type === 'json') handle(this.response);
          } catch (_) { /* ignore */ }
        });
      }
      return originalSend.apply(this, args);
    };
  }
})();
