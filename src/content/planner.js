/*
 * Month planner (pure): how long to sit on each remaining office day so the
 * month ends at or above the target average.
 *
 * Uses the same rules as the summary (HR method): each day counts in whole
 * minutes, and the month's average is truncated. Therefore
 *     floor(total / days) >= target   <=>   total >= target * days
 * so the exact requirement is
 *     perDay = ceil((target * (counted + remaining) - countedTotal) / remaining)
 *
 * Remaining office days default to weekdays that aren't a known holiday /
 * weekly-off; the user can flip any upcoming day (WFH, leave, extra office day).
 */
(function (root) {
  'use strict';

  const calc = typeof module === 'object' && module.exports
    ? require('./calculator.js')
    : root.KekaHours.calculator;

  const pad2 = n => String(n).padStart(2, '0');

  function settledState(day, weekend) {
    if (!day) return weekend ? 'off' : 'none';
    switch (calc.classify(day)) {
      case 'included': return 'worked';
      case 'wfh': return 'wfh';
      case 'leave': return 'leave';
      default: return day.isHoliday ? 'holiday' : (day.isWeeklyOff || weekend) ? 'off' : 'absent';
    }
  }

  /**
   * @param {object} p
   * @param {string} p.monthKey   'YYYY-MM'
   * @param {string} p.todayKey   'YYYY-MM-DD'
   * @param {Array}  p.days       normalized AttendanceDay[] (any months; filtered here)
   * @param {Map}    [p.dayTypes] date -> Keka dayType (0 working, 1 holiday, 2 weekly-off)
   * @param {object} [p.overrides] date -> 'office' | 'away'
   * @param {number} [p.targetMinutes]
   */
  function planMonth(p) {
    const target = calc.sanitizeTarget(p.targetMinutes);
    const [y, m] = p.monthKey.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday = 0
    const monthOfToday = p.todayKey.slice(0, 7);
    const isPastMonth = p.monthKey < monthOfToday;
    const overrides = p.overrides || {};
    const dayTypes = p.dayTypes || new Map();

    const inMonth = calc.dedupe(p.days).filter(d => d.date.slice(0, 7) === p.monthKey);
    const byDate = new Map(inMonth.map(d => [d.date, d]));
    const summary = calc.calculateSummary(inMonth, target);

    const cells = [];
    let remaining = 0;
    let today = null;

    for (let dd = 1; dd <= daysInMonth; dd += 1) {
      const date = `${p.monthKey}-${pad2(dd)}`;
      const dow = new Date(y, m - 1, dd).getDay();
      const weekend = dow === 0 || dow === 6;
      const day = byDate.get(date);
      const kind = day ? calc.classify(day) : null;
      const isToday = date === p.todayKey;
      // Today is settled once it's counted or excluded (WFH / leave);
      // while it's still open (or not started) it's a remaining day.
      const settled = isPastMonth || date < p.todayKey ||
        (isToday && kind && kind !== 'incomplete' && kind !== 'no-time');

      if (settled) {
        const state = settledState(day, weekend);
        cells.push({ date, day: dd, isToday, state, minutes: state === 'worked' ? calc.wholeMinutes(day.grossMinutes) : null });
        continue;
      }

      const type = dayTypes.get(date);
      const hasTime = !!(day && day.grossMinutes > 0 && !day.isWFH && !day.isLeave);
      const holiday = (day && day.isHoliday) || type === 1;
      const knownOff = holiday || (day && day.isWeeklyOff) || type === 2;
      const def = hasTime ? 'office'
        : (day && (day.isWFH || day.isLeave)) ? 'away'
        : (knownOff || (type == null && weekend)) ? 'away' : 'office';
      const plan = overrides[date] === 'office' || overrides[date] === 'away' ? overrides[date] : def;
      if (plan === 'office') remaining += 1;
      cells.push({
        date, day: dd, isToday,
        state: plan === 'office' ? 'plan-office' : 'plan-away',
        overridden: plan !== def,
        reason: holiday ? 'Holiday' : knownOff || weekend ? 'Off' : '',
      });
      if (isToday) {
        today = {
          date,
          planned: plan === 'office',
          soFarMinutes: day && day.grossMinutes > 0 ? calc.wholeMinutes(day.grossMinutes) : 0,
          openSince: (day && day.openSince) || null,
        };
      }
    }

    const counted = summary.trackedDays;
    const countedMinutes = summary.totalMinutes;
    const neededMinutes = target * (counted + remaining) - countedMinutes;
    const requiredPerDay = remaining ? Math.max(1, Math.ceil(neededMinutes / remaining)) : null;

    let status;
    if (isPastMonth) status = 'complete';
    else if (!remaining) status = 'no-days';
    else if (neededMinutes <= remaining) status = 'secured'; // 1 minute per day is enough
    else status = 'needed';

    if (today && today.planned && requiredPerDay) {
      today.moreMinutes = Math.max(0, requiredPerDay - today.soFarMinutes);
      // Exact clock-out time is only known for a single open punch (no breaks yet).
      const start = today.openSince ? Date.parse(today.openSince) : NaN;
      today.leaveAt = Number.isFinite(start) && today.soFarMinutes === 0 ? start + requiredPerDay * 60000 : null;
    }

    return {
      monthKey: p.monthKey,
      daysInMonth,
      firstWeekday,
      cells,
      targetMinutes: target,
      countedDays: counted,
      countedMinutes,
      currentAverage: summary.averageWholeMinutes,
      remainingDays: remaining,
      neededMinutes,
      requiredPerDay,
      status,
      today,
    };
  }

  const api = { planMonth };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KekaHours.planner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
