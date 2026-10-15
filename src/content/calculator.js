/*
 * Pure calculation engine. Operates only on normalized AttendanceDay objects:
 *
 *   { date: 'YYYY-MM-DD', grossMinutes, isWFH, isLeave (full day), isHalfLeave, isHoliday,
 *     isWeeklyOff, isIncomplete, sourcePrecision: 'precise'|'display-rounded' }
 *
 * A day counts toward the average only when:  !WFH && !Leave && gross > 0
 * (and it is not today's still-open day). A half-day leave with office time
 * counts (its hours are real office hours); a full-day leave never does. Holidays / weekly-offs with real
 * tracked time DO count — the attendance record is the source of truth.
 *
 * Rounding matches HR: each day's seconds are dropped (whole minutes), and
 * the average is truncated, never rounded up.
 */
(function (root) {
  'use strict';

  const DEFAULT_TARGET = 9 * 60;

  function sanitizeTarget(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 24 * 60 ? Math.round(n) : DEFAULT_TARGET;
  }

  /** Exact minutes (may include seconds) -> whole minutes, seconds dropped. */
  function wholeMinutes(minutes) {
    return Math.floor(Math.round(minutes * 60) / 60);
  }

  function hasTrackedTime(day) {
    return Number.isFinite(day.grossMinutes) && day.grossMinutes > 0;
  }

  /** 'wfh' | 'leave' | 'no-time' | 'incomplete' | 'included' */
  function classify(day) {
    if (day.isWFH) return 'wfh';
    if (day.isLeave) return 'leave';
    if (!hasTrackedTime(day)) return day.isHalfLeave ? 'leave' : 'no-time';
    if (day.isIncomplete) return 'incomplete';
    return 'included';
  }

  function isIncluded(day) {
    return classify(day) === 'included';
  }

  /** Same date twice -> the later entry wins (never double-count). */
  function dedupe(days) {
    const byDate = new Map();
    for (const day of Array.isArray(days) ? days : []) {
      if (day && typeof day.date === 'string') byDate.set(day.date, day);
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  function calculateSummary(days, targetMinutes) {
    const target = sanitizeTarget(targetMinutes);
    const unique = dedupe(days);
    let included = [];
    const counts = { wfh: 0, leave: 0, 'no-time': 0 };
    let pendingToday = null;

    for (const day of unique) {
      const kind = classify(day);
      if (kind === 'included') included.push(day);
      else if (kind === 'incomplete') pendingToday = { date: day.date, grossMinutes: day.grossMinutes };
      else counts[kind] += 1;
    }

    included = included.map(d => ({ ...d, grossMinutes: wholeMinutes(d.grossMinutes) }));
    const totalMinutes = included.reduce((sum, d) => sum + d.grossMinutes, 0);
    const trackedDays = included.length;
    const averageMinutes = trackedDays ? totalMinutes / trackedDays : null;
    // Truncated whole minutes: what is displayed and compared with the target.
    const averageWholeMinutes = averageMinutes == null ? null : Math.floor(averageMinutes + 1e-9);

    let longest = null;
    let shortest = null;
    let atOrAbove = 0;
    for (const d of included) {
      if (!longest || d.grossMinutes > longest.grossMinutes) longest = d;
      if (!shortest || d.grossMinutes < shortest.grossMinutes) shortest = d;
      if (d.grossMinutes >= target) atOrAbove += 1;
    }

    const preciseCount = included.filter(d => d.sourcePrecision === 'precise').length;
    let sourcePrecision = null;
    if (trackedDays) {
      sourcePrecision = preciseCount === trackedDays ? 'precise' : preciseCount === 0 ? 'display-rounded' : 'mixed';
    }

    const pick = d => (d ? { date: d.date, grossMinutes: d.grossMinutes } : null);

    return {
      averageMinutes,
      averageWholeMinutes,
      totalMinutes,
      trackedDays,
      targetMinutes: target,
      deltaMinutesPerDay: averageWholeMinutes == null ? null : averageWholeMinutes - target,
      longestDay: pick(longest),
      shortestDay: pick(shortest),
      daysAtOrAboveTarget: atOrAbove,
      daysBelowTarget: trackedDays - atOrAbove,
      wfhDays: counts.wfh,
      leaveDays: counts.leave,
      noTimeDays: counts['no-time'],
      workedHolidays: included.filter(d => d.isHoliday).length,
      workedWeeklyOffs: included.filter(d => d.isWeeklyOff && !d.isHoliday).length,
      halfLeaveDays: included.filter(d => d.isHalfLeave).length,
      // Counted days in date order (whole minutes).
      includedDays: included.map(d => ({ date: d.date, grossMinutes: d.grossMinutes })),
      // Every day in the view, for the daily chart: kind = classify() result.
      allDays: unique.map(d => ({
        date: d.date,
        kind: classify(d),
        grossMinutes: hasTrackedTime(d) ? wholeMinutes(d.grossMinutes) : 0,
        isHoliday: !!d.isHoliday,
        isWeeklyOff: !!d.isWeeklyOff,
        isHalfLeave: !!d.isHalfLeave,
      })),
      pendingToday,
      sourcePrecision,
    };
  }

  const api = { calculateSummary, wholeMinutes, classify, isIncluded, dedupe, sanitizeTarget, DEFAULT_TARGET };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.KekaHours = root.KekaHours || {}).calculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
