/*
 * Pure clock-out reminder logic (no chrome.* calls; unit-tested).
 *
 * Keka hides the clock-out button 12h after the first clock-in and marks a
 * missed clock-out. On WFH days people clock in via the web and forget to
 * clock out, so from 9h after clock-in we remind with increasing frequency
 * until the 12h deadline (or until Keka shows the day clocked out).
 *
 * Session shape (persisted by the service worker):
 *   { date: 'YYYY-MM-DD', clockIn: epochMs, entryCount, sentIndex, dismissedAt: entryCount | null }
 */
(function (root) {
  'use strict';

  const HOUR = 3600000;
  const MIN = 60000;
  const DEADLINE_MS = 12 * HOUR;
  // Offsets from clock-in: every 30 min from 9h, every 15 min from 11h, then the last 10 minutes.
  const OFFSETS_MS = [9 * HOUR, 9.5 * HOUR, 10 * HOUR, 10.5 * HOUR, 11 * HOUR,
    11 * HOUR + 15 * MIN, 11.5 * HOUR, 11 * HOUR + 45 * MIN, 11 * HOUR + 50 * MIN, 11 * HOUR + 55 * MIN];
  // From here on the notification stays on screen until acted on.
  const URGENT_FROM_MS = 11.5 * HOUR;

  /**
   * Trimmed Keka summary record (see network-hook.js) -> open WFH session, or
   * null when it isn't a WFH day or the day isn't currently clocked in.
   */
  function openWfhSession(rec) {
    if (!rec || typeof rec.date !== 'string') return null;
    // attendanceDayStatus 2 = remote / WFH (same inference as parser.js).
    const wfh = rec.status === 2 || rec.remoteDay === true;
    if (!wfh || !isOpen(rec)) return null;
    const pairs = Array.isArray(rec.pairs) ? rec.pairs : [];
    const first = rec.firstLog || (pairs[0] && pairs[0][0]);
    const clockIn = first ? Date.parse(first) : NaN;
    if (!Number.isFinite(clockIn)) return null;
    return { date: rec.date, clockIn, entryCount: Number.isFinite(rec.entryCount) ? rec.entryCount : 0 };
  }

  /** Clocked in right now: last punch is an IN, or there's an open in/out pair. */
  function isOpen(rec) {
    const pairs = Array.isArray(rec.pairs) ? rec.pairs : [];
    return rec.lastPunch === 0 || pairs.some(p => p && p[0] && !p[1]);
  }

  /**
   * Fold a newly seen record into the current session. Returns the next
   * session (or null to stop reminding).
   */
  function applyRecord(session, rec, now) {
    const next = openWfhSession(rec);
    if (next && now < next.clockIn + DEADLINE_MS) {
      if (session && session.date === next.date && session.clockIn === next.clockIn) {
        // Same day: keep progress. A new punch (back from a break) re-arms a dismissal.
        const dismissedAt = session.dismissedAt != null && next.entryCount > session.dismissedAt ? null : session.dismissedAt;
        return { ...session, entryCount: next.entryCount, dismissedAt };
      }
      return { ...next, sentIndex: -1, dismissedAt: null };
    }
    // Keka shows the session's day as clocked out.
    if (session && rec && rec.date === session.date && !isOpen(rec)) return null;
    return session;
  }

  const active = (session, now) =>
    !!session && session.dismissedAt == null && now < session.clockIn + DEADLINE_MS;

  /** Index of the latest reminder already due at `now` (-1 if none). */
  function dueIndex(session, now) {
    let idx = -1;
    OFFSETS_MS.forEach((off, i) => { if (session.clockIn + off <= now) idx = i; });
    return idx;
  }

  /** Epoch ms of the next reminder after the ones already sent, or null. */
  function nextAlarmAt(session, now) {
    if (!active(session, now)) return null;
    const due = dueIndex(session, now);
    if (due > session.sentIndex) return now; // missed while asleep: send the latest one now
    const off = OFFSETS_MS[due + 1];
    return off == null ? null : session.clockIn + off;
  }

  function timeOfDay(ms) {
    const d = new Date(ms);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  }

  function duration(ms) {
    const total = Math.max(0, Math.floor(ms / MIN));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  }

  /**
   * Which reminder to show at `now`, or null. Only the latest due one is shown,
   * so waking a laptop after hours never fires a burst of stale notifications.
   */
  function reminderFor(session, now) {
    if (!active(session, now)) return null;
    const index = dueIndex(session, now);
    if (index < 0 || index <= session.sentIndex) return null;
    const elapsed = now - session.clockIn;
    const deadline = session.clockIn + DEADLINE_MS;
    const left = deadline - now;
    const urgent = elapsed >= URGENT_FROM_MS;
    return {
      index,
      urgent,
      title: urgent ? `Clock out now: ${duration(left)} left` : 'Don\'t forget to clock out',
      message: `WFH: clocked in at ${timeOfDay(session.clockIn)} (${duration(elapsed)} ago). ` +
        `Keka marks a missed clock-out after ${timeOfDay(deadline)}.`,
    };
  }

  const api = { DEADLINE_MS, OFFSETS_MS, openWfhSession, applyRecord, nextAlarmAt, reminderFor };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KekaReminder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
