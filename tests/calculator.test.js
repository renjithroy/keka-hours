'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSummary, isIncluded, sanitizeTarget } = require('../src/content/calculator.js');

let seq = 0;
function day(grossMinutes, flags = {}) {
  seq += 1;
  return {
    date: flags.date || `2026-09-${String(seq % 28 + 1).padStart(2, '0')}`,
    grossMinutes,
    isWFH: false, isLeave: false, isHoliday: false, isWeeklyOff: false, isIncomplete: false,
    sourcePrecision: 'display-rounded',
    ...flags,
  };
}
const d = (n, h, m = 0, flags = {}) => day(h * 60 + m, { date: `2026-09-${String(n).padStart(2, '0')}`, ...flags });

test('1. normal office days: 9h, 8h, 10h -> 9h', () => {
  const s = calculateSummary([d(1, 9), d(2, 8), d(3, 10)], 540);
  assert.equal(s.averageMinutes, 540);
  assert.equal(s.totalMinutes, 27 * 60);
  assert.equal(s.trackedDays, 3);
  assert.equal(s.deltaMinutesPerDay, 0);
  assert.equal(s.daysAtOrAboveTarget, 2);
  assert.equal(s.daysBelowTarget, 1);
  assert.deepEqual(s.longestDay, { date: '2026-09-03', grossMinutes: 600 });
  assert.deepEqual(s.shortestDay, { date: '2026-09-02', grossMinutes: 480 });
});

test('2. WFH excluded from the denominator', () => {
  const s = calculateSummary([d(1, 9), d(2, 9, 0, { isWFH: true }), d(3, 8)], 540);
  assert.equal(s.averageMinutes, 510);
  assert.equal(s.trackedDays, 2);
  assert.equal(s.wfhDays, 1);
});

test('3. leave excluded', () => {
  const s = calculateSummary([d(1, 9), d(2, 0, 0, { isLeave: true }), d(3, 8)], 540);
  assert.equal(s.averageMinutes, 510);
  assert.equal(s.leaveDays, 1);
});

test('4. worked holiday is included', () => {
  const s = calculateSummary([d(4, 11, 18, { isHoliday: true, isPresent: true }), d(5, 9)], 540);
  assert.equal(s.trackedDays, 2);
  assert.equal(s.workedHolidays, 1);
  assert.equal(s.longestDay.date, '2026-09-04');
});

test('5. worked Saturday / weekly-off is included', () => {
  const s = calculateSummary([d(26, 8, 20, { isWeeklyOff: true })], 540);
  assert.equal(s.trackedDays, 1);
  assert.equal(s.averageMinutes, 500);
  assert.equal(s.workedWeeklyOffs, 1);
});

test('6. WFH on a weekly-off is excluded', () => {
  const s = calculateSummary([d(26, 8, 20, { isWeeklyOff: true, isWFH: true })], 540);
  assert.equal(s.trackedDays, 0);
  assert.equal(s.averageMinutes, null);
  assert.equal(s.wfhDays, 1);
});

test('7. leave with an unexpected duration is still excluded', () => {
  const s = calculateSummary([d(1, 7, 0, { isLeave: true }), d(2, 9)], 540);
  assert.equal(s.trackedDays, 1);
  assert.equal(s.averageMinutes, 540);
});

test('8. zero-time weekly-off / holiday does not count', () => {
  const s = calculateSummary([d(5, 0, 0, { isWeeklyOff: true }), d(6, 0, 0, { isHoliday: true }), d(7, 9)], 540);
  assert.equal(s.trackedDays, 1);
  assert.equal(s.noTimeDays, 2);
});

test('9. duplicate rows for the same date are not double-counted', () => {
  const s = calculateSummary([d(1, 9), d(1, 9), d(2, 8)], 540);
  assert.equal(s.trackedDays, 2);
  assert.equal(s.totalMinutes, 17 * 60);
});

test('10. empty dataset', () => {
  for (const input of [[], null, undefined]) {
    const s = calculateSummary(input, 540);
    assert.equal(s.trackedDays, 0);
    assert.equal(s.averageMinutes, null);
    assert.equal(s.deltaMinutesPerDay, null);
    assert.equal(s.longestDay, null);
    assert.equal(s.sourcePrecision, null);
  }
});

test('11. today still clocked in is not counted, but reported', () => {
  const s = calculateSummary([d(1, 9), d(2, 3, 10, { isIncomplete: true })], 540);
  assert.equal(s.trackedDays, 1);
  assert.deepEqual(s.pendingToday, { date: '2026-09-02', grossMinutes: 190 });
});

test('12. precision is reported honestly', () => {
  const precise = { sourcePrecision: 'precise' };
  assert.equal(calculateSummary([d(1, 9, 0, precise), d(2, 9, 0, precise)], 540).sourcePrecision, 'precise');
  assert.equal(calculateSummary([d(1, 9, 0, precise), d(2, 9)], 540).sourcePrecision, 'mixed');
  assert.equal(calculateSummary([d(1, 9), d(2, 9)], 540).sourcePrecision, 'display-rounded');
  // Excluded days don't affect the precision label.
  assert.equal(calculateSummary([d(1, 9, 0, precise), d(2, 9, 0, { isWFH: true })], 540).sourcePrecision, 'precise');
});

test('target comparison uses exact seconds and delta is per day', () => {
  const s = calculateSummary([d(1, 8, 59.9), d(2, 9, 0)], 540);
  assert.equal(s.daysAtOrAboveTarget, 1);
  assert.equal(s.daysBelowTarget, 1);
  const t = calculateSummary([d(1, 8, 42)], 540);
  assert.equal(t.deltaMinutesPerDay, -18);
});

test('isIncluded matches the core rule: !WFH && !Leave && gross > 0', () => {
  assert.equal(isIncluded(day(1)), true);
  assert.equal(isIncluded(day(0)), false);
  assert.equal(isIncluded(day(NaN)), false);
  assert.equal(isIncluded(day(60, { isWFH: true })), false);
  assert.equal(isIncluded(day(60, { isLeave: true })), false);
  assert.equal(isIncluded(day(60, { isHoliday: true })), true);
});

test('target is sanitized', () => {
  assert.equal(sanitizeTarget(510), 510);
  assert.equal(sanitizeTarget('abc'), 540);
  assert.equal(sanitizeTarget(0), 540);
  assert.equal(sanitizeTarget(5000), 540);
});

test('HR rounding: seconds dropped per day, average truncated (never rounded up)', () => {
  const fmt = require('../src/content/format.js');
  // 9h 00m 59s and 9h 03m 00s -> 540 + 543 whole minutes -> 541.5 -> 9h 01m
  const s = calculateSummary([d(1, 9, 59 / 60, { sourcePrecision: 'precise' }), d(2, 9, 3, { sourcePrecision: 'precise' })], 540);
  assert.equal(s.totalMinutes, 1083);
  assert.equal(s.averageWholeMinutes, 541);
  assert.equal(fmt.duration(s.averageMinutes), '9h 01m');
  assert.equal(s.deltaMinutesPerDay, 1);
  // 8h 59m 59s is below a 9h target.
  const below = calculateSummary([d(3, 8, 59 + 59 / 60, { sourcePrecision: 'precise' })], 540);
  assert.equal(below.daysBelowTarget, 1);
  assert.equal(below.deltaMinutesPerDay, -1);
});

test('month-to-date header range', () => {
  const fmt = require('../src/content/format.js');
  assert.equal(fmt.monthToDateRange('2026-10-05'), '1 Oct – 5 Oct 2026');
  assert.equal(fmt.monthToDateRange('2026-10-28'), '1 Oct – 28 Oct 2026');
  assert.equal(fmt.monthToDateRange('2026-10-01'), '1 Oct 2026');
  // Include today off: up to yesterday.
  assert.equal(fmt.monthToDateRange('2026-10-26', true), '1 Oct – 25 Oct 2026');
  assert.equal(fmt.monthToDateRange('2026-10-02', true), '1 Oct 2026');
  assert.equal(fmt.monthToDateRange('2026-10-01', true), 'Oct 2026', 'nothing counted yet on the 1st');
  assert.equal(fmt.monthToDateRange('bad'), '');
});

test('allDays lists every day with its kind, for the daily chart', () => {
  const s = calculateSummary([
    d(1, 9, 30),
    d(2, 8, 0, { isWFH: true }),
    d(3, 0, 0, { isLeave: true }),
    d(5, 0, 0, { isWeeklyOff: true }),
    d(4, 0, 0, { isHoliday: true }),
    d(6, 3, 10, { isIncomplete: true }),
  ], 540);
  assert.deepEqual(s.allDays.map(x => [x.date.slice(8), x.kind, x.grossMinutes]), [
    ['01', 'included', 570], ['02', 'wfh', 480], ['03', 'leave', 0],
    ['04', 'no-time', 0], ['05', 'no-time', 0], ['06', 'incomplete', 190],
  ]);
  assert.equal(s.allDays[3].isHoliday, true);
  assert.equal(s.allDays[4].isWeeklyOff, true);
});
