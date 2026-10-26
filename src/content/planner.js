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
 * Today counts as a finished office day only with Include today on (the same
 * switch as the Overview): a last punch that's an OUT may just be a break.
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
   * @param {boolean} [p.includeToday] count today's office time as a finished day (else it's still in progress)
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

    const includeToday = p.includeToday === true;
    const inMonth = calc.dedupe(p.days).filter(d => d.date.slice(0, 7) === p.monthKey);
    const byDate = new Map(inMonth.map(d => [d.date, d]));
    // Without Include today, today's hours are "so far", not a counted day.
    const summary = calc.calculateSummary(includeToday ? inMonth : inMonth.filter(d => d.date !== p.todayKey), target);

    const cells = [];
    let remaining = 0;
    let todayOffice = null; // today as a remaining office day: { firstIn }
    let todayCounted = null; // today counted (Include today on): { minutes, firstIn }

    for (let dd = 1; dd <= daysInMonth; dd += 1) {
      const date = `${p.monthKey}-${pad2(dd)}`;
      const dow = new Date(y, m - 1, dd).getDay();
      const weekend = dow === 0 || dow === 6;
      const day = byDate.get(date);
      const kind = day ? calc.classify(day) : null;
      const isToday = date === p.todayKey;
      // Today is settled once it's excluded (WFH / leave), or counted with Include
      // today on; while it's still open, on a break, or not started it's a remaining day.
      const settled = isPastMonth || date < p.todayKey ||
        (isToday && kind && kind !== 'incomplete' && kind !== 'no-time' && (kind !== 'included' || includeToday));

      if (settled) {
        const state = settledState(day, weekend);
        const minutes = state === 'worked' ? calc.wholeMinutes(day.grossMinutes) : null;
        cells.push({ date, day: dd, isToday, state, minutes });
        if (isToday && state === 'worked' && !isPastMonth) todayCounted = { minutes, firstIn: day.firstIn || null };
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
      if (isToday && plan === 'office') todayOffice = { firstIn: (day && day.firstIn) || null };
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

    // Today's own plan, Include today on or off: the time to sit today as one of the
    // remaining office days (not "so far / more"), and, from the first clock-in, when
    // that's reached. Gross hours run from the first clock-in, so breaks don't move it.
    let today = null;
    const t = todayOffice || todayCounted;
    if (t) {
      const days = counted - (todayCounted ? 1 : 0);
      const minutes = countedMinutes - (todayCounted ? todayCounted.minutes : 0);
      const left = remaining + (todayCounted ? 1 : 0);
      const need = target * (days + left) - minutes;
      if (need > left) { // more than a minute a day: there's something to sit
        const requiredMinutes = Math.ceil(need / left);
        const start = t.firstIn ? Date.parse(t.firstIn) : NaN;
        today = {
          date: p.todayKey,
          requiredMinutes,
          firstIn: Number.isFinite(start) ? start : null,
          leaveAt: Number.isFinite(start) ? start + requiredMinutes * 60000 : null,
        };
      }
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
