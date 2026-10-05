'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planMonth } = require('../src/content/planner.js');
const { calculateSummary } = require('../src/content/calculator.js');

const day = (date, minutes, flags = {}) => ({
  date, grossMinutes: minutes, isWFH: false, isLeave: false, isHoliday: false, isWeeklyOff: false,
  isIncomplete: false, sourcePrecision: 'precise', ...flags,
});

// October 2026: 1st is a Thursday. Weekdays Oct 1..27 worked at 8h 50m (530 min)
// except 2nd (holiday), 5th (WFH). Today = Wed 28 Oct, not clocked in yet.
function octoberDays() {
  const days = [];
  for (let d = 1; d <= 27; d += 1) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    const dow = new Date(2026, 9, d).getDay();
    if (dow === 0 || dow === 6) days.push(day(date, 0, { isWeeklyOff: true }));
    else if (d === 2) days.push(day(date, 0, { isHoliday: true }));
    else if (d === 5) days.push(day(date, 597, { isWFH: true }));
    else days.push(day(date, 530));
  }
  return days;
}

test('required per-day minutes are exact (HR truncation): enough, and 1 minute less is not', () => {
  const days = octoberDays();
  const p = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days });
  // Remaining weekdays: 28, 29, 30 (31 is Saturday).
  assert.equal(p.remainingDays, 3);
  assert.equal(p.status, 'needed');
  assert.equal(p.countedDays, 17);
  assert.equal(p.countedMinutes, 17 * 530);
  // 540 * 20 - 17 * 530 = 10800 - 9010 = 1790 -> ceil(1790 / 3) = 597
  assert.equal(p.requiredPerDay, 597);

  const finish = perDay => calculateSummary([
    ...days,
    day('2026-10-28', perDay), day('2026-10-29', perDay), day('2026-10-30', perDay),
  ], 540).averageWholeMinutes;
  assert.ok(finish(p.requiredPerDay) >= 540);
  assert.ok(finish(p.requiredPerDay - 1) < 540);
});

test('seconds are dropped like HR: 9h 56m 59s counts as 9h 56m', () => {
  const days = octoberDays();
  const p = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days });
  const withSeconds = calculateSummary([...days,
    day('2026-10-28', 596 + 59 / 60), day('2026-10-29', 596 + 59 / 60), day('2026-10-30', 596 + 59 / 60)], 540);
  assert.ok(withSeconds.averageWholeMinutes < 540);
  assert.equal(p.requiredPerDay, 597);
});

test('calendar defaults: weekends and Keka holidays away; overrides switch days', () => {
  const days = octoberDays();
  const dayTypes = new Map([['2026-10-29', 1]]); // Keka says 29th is a holiday
  const p = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days, dayTypes });
  const cell = d => p.cells.find(c => c.date === `2026-10-${d}`);
  assert.equal(cell(29).state, 'plan-away');
  assert.equal(cell(29).reason, 'Holiday');
  assert.equal(cell(31).state, 'plan-away');
  assert.equal(p.remainingDays, 2);

  const q = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days, dayTypes,
    overrides: { '2026-10-30': 'away', '2026-10-31': 'office' } });
  assert.equal(cell(30).state, 'plan-office');
  assert.equal(q.cells.find(c => c.date === '2026-10-30').state, 'plan-away');
  assert.equal(q.cells.find(c => c.date === '2026-10-31').state, 'plan-office');
  assert.equal(q.cells.find(c => c.date === '2026-10-31').overridden, true);
  assert.equal(q.remainingDays, 2);
});

test('past cells: worked minutes, WFH, holiday, weekly-off', () => {
  const p = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: octoberDays() });
  const cell = d => p.cells.find(c => c.date === `2026-10-${String(d).padStart(2, '0')}`);
  assert.equal(cell(1).state, 'worked');
  assert.equal(cell(1).minutes, 530);
  assert.equal(cell(2).state, 'holiday');
  assert.equal(cell(3).state, 'off');
  assert.equal(cell(5).state, 'wfh');
  assert.equal(p.firstWeekday, 3); // Thursday
  assert.equal(p.cells.length, 31);
});

test('today: open punch gives clock-out time; done today is not remaining; WFH today is settled', () => {
  const base = octoberDays();
  const open = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28',
    days: [...base, day('2026-10-28', 0, { openSince: '2026-10-28T10:00:00' })] });
  assert.equal(open.today.planned, true);
  assert.equal(open.today.leaveAt, Date.parse('2026-10-28T10:00:00') + 597 * 60000);

  const partial = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28',
    days: [...base, day('2026-10-28', 200, { isIncomplete: true })] });
  assert.equal(partial.remainingDays, 3);
  assert.equal(partial.today.moreMinutes, 597 - 200);
  assert.equal(partial.today.leaveAt, null);

  const done = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...base, day('2026-10-28', 600)] });
  assert.equal(done.remainingDays, 2);
  assert.equal(done.cells.find(c => c.date === '2026-10-28').state, 'worked');

  const wfh = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...base, day('2026-10-28', 300, { isWFH: true })] });
  assert.equal(wfh.remainingDays, 2);
  assert.equal(wfh.cells.find(c => c.date === '2026-10-28').state, 'wfh');
});

test('statuses: secured, no-days, complete', () => {
  const rich = [];
  for (let d = 1; d <= 27; d += 1) rich.push(day(`2026-10-${String(d).padStart(2, '0')}`, 700));
  assert.equal(planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: rich }).status, 'secured');

  const noDays = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: octoberDays(),
    overrides: { '2026-10-28': 'away', '2026-10-29': 'away', '2026-10-30': 'away' } });
  assert.equal(noDays.status, 'no-days');
  assert.equal(noDays.requiredPerDay, null);

  const sep = planMonth({ monthKey: '2026-09', todayKey: '2026-10-05', days: [day('2026-09-01', 541)] });
  assert.equal(sep.status, 'complete');
  assert.equal(sep.remainingDays, 0);
  assert.equal(sep.currentAverage, 541);
});
