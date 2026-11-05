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

test('today: the time to sit today, and first clock-in + that = when you can clock out, breaks or not', () => {
  const base = octoberDays();
  const tenAm = Date.parse('2026-10-28T10:00:00');
  // Not clocked in yet: the time to sit, no clock-out time.
  const morning = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: base });
  assert.deepEqual([morning.today.requiredMinutes, morning.today.leaveAt], [597, null]);

  const open = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28',
    days: [...base, day('2026-10-28', 0, { firstIn: '2026-10-28T10:00:00' })] });
  assert.deepEqual([open.today.requiredMinutes, open.today.firstIn, open.today.leaveAt], [597, tenAm, tenAm + 597 * 60000]);

  // Back from a break: still first clock-in + the time to sit (not "so far / more").
  const partial = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28',
    days: [...base, day('2026-10-28', 200, { isIncomplete: true, firstIn: '2026-10-28T10:00:00' })] });
  assert.equal(partial.remainingDays, 3);
  assert.deepEqual([partial.today.requiredMinutes, partial.today.leaveAt], [597, tenAm + 597 * 60000]);

  // Counted (Include today on): the rest of the month moves on, today's own figure stays.
  const done = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28',
    days: [...base, day('2026-10-28', 600, { firstIn: '2026-10-28T10:00:00' })], includeToday: true });
  assert.equal(done.remainingDays, 2);
  assert.equal(done.cells.find(c => c.date === '2026-10-28').state, 'worked');
  assert.deepEqual([done.today.requiredMinutes, done.today.leaveAt], [597, tenAm + 597 * 60000]);

  // WFH, or marked away: nothing to sit today.
  const wfh = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...base, day('2026-10-28', 300, { isWFH: true })] });
  assert.equal(wfh.remainingDays, 2);
  assert.equal(wfh.cells.find(c => c.date === '2026-10-28').state, 'wfh');
  assert.equal(wfh.today, null);
  assert.equal(planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: base, overrides: { '2026-10-28': 'away' } }).today, null);
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

test('Include today off: a last OUT punch (lunch) leaves today in progress, not a short finished day', () => {
  const base = octoberDays();
  const before = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: base });
  // Out for lunch after 3h 10m: the plan doesn't move, and today shows its hours so far.
  const lunch = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...base, day('2026-10-28', 190)] });
  assert.equal(lunch.remainingDays, before.remainingDays);
  assert.equal(lunch.requiredPerDay, before.requiredPerDay);
  assert.equal(lunch.countedDays, before.countedDays);
  assert.equal(lunch.cells.find(c => c.date === '2026-10-28').state, 'plan-office');
  assert.equal(lunch.today.requiredMinutes, before.requiredPerDay);
  // The same day with Include today on counts as a finished 3h 10m day (after clock-out, that's right).
  const counted = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...base, day('2026-10-28', 190)], includeToday: true });
  assert.equal(counted.remainingDays, before.remainingDays - 1);
  assert.equal(counted.countedDays, before.countedDays + 1);
  assert.ok(counted.requiredPerDay > before.requiredPerDay);
  assert.equal(counted.today.requiredMinutes, before.requiredPerDay, "today's own figure doesn't depend on the switch");
  // Still clocked in: never counted, either way.
  const open = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...base, day('2026-10-28', 190, { isIncomplete: true })], includeToday: true });
  assert.equal(open.remainingDays, before.remainingDays);
});

// ---------- Overview's Today card ----------
const { todayCard } = require('../src/content/planner.js');

const T = hhmm => new Date(`2026-10-28T${hhmm}:00`).getTime();
const MIN = 60000;

test('today card, office day: not in yet → in (left) → done; uses the plan\'s time for today', () => {
  const days = octoberDays();
  const plan0 = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days });
  const req = plan0.today.requiredMinutes;
  const notIn = todayCard({ plan: plan0, todayKey: '2026-10-28', day: null, wfh: null, now: T('09:05') });
  assert.equal(notIn.kind, 'not-in');
  assert.equal(notIn.required, req);
  assert.equal(notIn.wfh, false);

  const today = day('2026-10-28', 437, { isIncomplete: true, firstIn: '2026-10-28T09:48:00' });
  const plan = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...days, today] });
  const c = todayCard({ plan, todayKey: '2026-10-28', day: today, now: T('17:05') });
  assert.equal(c.kind, 'in');
  assert.equal(c.firstIn, T('09:48'));
  assert.equal(c.leaveAt, T('09:48') + req * MIN, 'first clock-in + today\'s time');
  assert.equal(c.leftMs, c.leaveAt - T('17:05'));
  assert.ok(c.pct > 0 && c.pct < 1);
  const done = todayCard({ plan, todayKey: '2026-10-28', day: today, now: c.leaveAt + 9 * MIN });
  assert.equal(done.kind, 'done');
  assert.equal(done.overMs, 9 * MIN);
  assert.equal(done.pct, 1);
});

test('today card, office day clocked out: a break keeps the time; out after it is done', () => {
  const days = octoberDays();
  const brk = day('2026-10-28', 197, { firstIn: '2026-10-28T09:48:00' }); // out at 1:05 PM
  const plan = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...days, brk] });
  const c = todayCard({ plan, todayKey: '2026-10-28', day: brk, now: T('14:00') });
  assert.equal(c.kind, 'out');
  assert.equal(c.lastOut, T('13:05'));
  assert.equal(c.leaveAt, T('09:48') + plan.today.requiredMinutes * MIN);
  const late = day('2026-10-28', 600, { firstIn: '2026-10-28T09:48:00' });
  const plan2 = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...days, late] });
  assert.equal(todayCard({ plan: plan2, todayKey: '2026-10-28', day: late, now: T('20:00') }).kind, 'out-done');
});

test('today card, WFH day: a 9h day from the first WFH clock-in (not the plan\'s time)', () => {
  const days = octoberDays();
  const wfhDay = day('2026-10-28', 0, { isWFH: true });
  const plan = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...days, wfhDay] });
  const c = todayCard({ plan, todayKey: '2026-10-28', day: wfhDay, wfh: { state: 'in', firstIn: T('10:27'), lastOut: null }, now: T('17:05') });
  assert.equal(c.wfh, true);
  assert.equal(c.kind, 'in');
  assert.equal(c.leaveAt, T('19:27'));
  // The table may not show the WFH day yet: the WFH punches alone make it one.
  const c2 = todayCard({ plan: planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days }), todayKey: '2026-10-28', day: null, wfh: { state: 'in', firstIn: T('10:27') }, now: T('17:05') });
  assert.equal(c2.wfh, true);
  assert.equal(c2.leaveAt, T('19:27'));
  // WFH in the table, not clocked in yet.
  assert.equal(todayCard({ plan, todayKey: '2026-10-28', day: wfhDay, wfh: { state: 'none' }, now: T('09:00') }).kind, 'not-in');
});

test('today card: leave / week-off show what\'s next; outside the month there is none', () => {
  const days = octoberDays();
  const leave = day('2026-10-28', 0, { isLeave: true });
  const plan = planMonth({ monthKey: '2026-10', todayKey: '2026-10-28', days: [...days, leave] });
  const c = todayCard({ plan, todayKey: '2026-10-28', day: leave, now: T('12:00') });
  assert.deepEqual([c.kind, c.reason, c.next], ['off', 'leave', '2026-10-29']);
  assert.equal(c.nextRequired, plan.requiredPerDay);
  // Saturday 24 Oct: next is Monday 26.
  const upTo23 = octoberDays().filter(d => d.date <= '2026-10-23');
  const sat = planMonth({ monthKey: '2026-10', todayKey: '2026-10-24', days: upTo23 });
  const s = todayCard({ plan: sat, todayKey: '2026-10-24', day: null, now: T('12:00') });
  assert.deepEqual([s.kind, s.reason, s.next], ['off', 'week-off', '2026-10-26']);
  // Saturday 31 Oct: no office days left this month.
  assert.equal(todayCard({ plan: planMonth({ monthKey: '2026-10', todayKey: '2026-10-31', days }), todayKey: '2026-10-31', now: T('12:00') }).next, null);
  // A past month's plan has no today.
  assert.equal(todayCard({ plan: planMonth({ monthKey: '2026-09', todayKey: '2026-10-28', days: [] }), todayKey: '2026-10-28', now: T('12:00') }), null);
});

test('today card: average already safe → any time; a long day shows Keka\'s 12h limit; past it, clock out by the limit', () => {
  const cells = [{ date: '2026-10-28', state: 'plan-office' }];
  const firstIn = '2026-10-28T09:48:00';
  const safe = todayCard({ plan: { cells, today: null, status: 'secured', targetMinutes: 540 }, todayKey: '2026-10-28', day: day('2026-10-28', 300, { isIncomplete: true, firstIn }), now: T('14:48') });
  assert.equal(safe.kind, 'safe');
  assert.equal(safe.nineAt, T('18:48'));
  const long = todayCard({ plan: { cells, today: { requiredMinutes: 692, firstIn: T('09:48') }, status: 'needed', targetMinutes: 540 }, todayKey: '2026-10-28', day: day('2026-10-28', 437, { isIncomplete: true, firstIn }), now: T('17:05') });
  assert.equal(long.kind, 'in');
  assert.equal(long.long, true);
  assert.equal(long.limitAt, T('21:48'));
  const over = todayCard({ plan: { cells, today: { requiredMinutes: 760, firstIn: T('09:48') }, status: 'needed', targetMinutes: 540 }, todayKey: '2026-10-28', day: day('2026-10-28', 437, { isIncomplete: true, firstIn }), now: T('17:05') });
  assert.equal(over.kind, 'too-late');
  assert.equal(over.shortMs, 40 * MIN);
});
