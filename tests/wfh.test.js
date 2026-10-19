'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../src/shared/wfh.js');
const { trimWfhRequest, trimClockinResponse, trimDayRequests } = require('../src/page/network-hook.js');

const DATE = '2026-10-16';
const at = (hhmm, date = DATE) => W.atTime(date, hhmm);
const p = (hhmm, isIn) => ({ at: `${DATE}T${hhmm}:00`, in: isIn });
const day = (punches, extra = {}) => ({ ...W.emptyDay(DATE), source: 'api', punches, updatedAt: at('10:00'), ...extra });
const DEFAULTS = { everyDay: '18:30', today: null };

// Your real sequence from the HAR captures (16 Oct): in, out, in, out, in.
const REAL = [p('10:25', true), p('11:01', false), p('11:04', true), p('12:07', false), p('12:09', true)];

// ---------- page hook: only dates and punch directions survive ----------

const kekaEntry = (ts, status, extra = {}) => ({
  actualTimestamp: `${ts}.3501303`, timestamp: ts, punchStatus: status, originalPunchStatus: status,
  isDeleted: false, locationAddress: { latitude: 10.0, longitude: 76.3, addressLine1: 'home' }, ipAddress: '1.2.3.4',
  premiseName: 'x', note: 'wfh', manualClockinType: 12, ...extra,
});
const kekaRequest = entries => ({ id: 'abc', employeeId: 'emp', requestDate: DATE, requestStatus: 0, requestType: 5, timeEntries: entries });

test('hook: a WFH request keeps only date + punch times/directions (no location, IP, ids)', () => {
  const rec = trimWfhRequest(kekaRequest([
    kekaEntry(`${DATE}T11:01:34`, 1),
    kekaEntry(`${DATE}T10:25:04`, 0),
    kekaEntry(`${DATE}T11:02:00`, 0, { isDeleted: true }),
  ]));
  assert.deepEqual(rec, { date: DATE, punches: [{ at: `${DATE}T10:25:04`, in: true }, { at: `${DATE}T11:01:34`, in: false }] });
  assert.doesNotMatch(JSON.stringify(rec), /latitude|1\.2\.3\.4|home|emp|abc/);
});

test('hook: clock-in/out click response and page-load day requests', () => {
  const click = trimClockinResponse({ data: { request: kekaRequest([kekaEntry(`${DATE}T10:25:04`, 0)]) }, succeeded: true });
  assert.deepEqual(click, { records: [{ date: DATE, punches: [{ at: `${DATE}T10:25:04`, in: true }] }], complete: false });

  const load = trimDayRequests({ data: { workfromhome: [kekaRequest([kekaEntry(`${DATE}T10:25:04`, 0)])], webclockin: [] } });
  assert.equal(load.complete, true);
  assert.equal(load.records.length, 1);

  // No WFH request at all today (office day): still a complete answer.
  assert.deepEqual(trimDayRequests({ data: { workfromhome: null } }), { records: [], complete: true });
  assert.equal(trimDayRequests({ nope: 1 }), null);
});

// ---------- state from punches ----------

test('real sequence: clocked in, limits from the FIRST clock-in', () => {
  const s = W.punchState(day(REAL));
  assert.equal(s.state, 'in');
  assert.equal(s.firstIn, at('10:25'));
  assert.equal(s.lastIn, at('12:09'));
  assert.equal(W.punchState(day(REAL.slice(0, 4))).state, 'out', 'on a break');
  assert.equal(W.punchState(day([])).state, 'none');
});

test('WFH pending approval works: only punches matter', () => {
  // attendancedayrequests lists the request with requestStatus 0 (pending); the
  // table says "Pending approval" / "Absent". The punches are all we use.
  const d = W.applyObservation(W.emptyDay(DATE), { records: [{ date: DATE, punches: [p('10:25', true)] }], complete: true }, at('10:30'));
  const pl = W.plan(d, DEFAULTS, at('10:30'));
  assert.equal(pl.state, 'in');
  assert.equal(pl.remindAt, at('18:30'));
});

// ---------- when the reminder fires ----------

test('default 6:30 PM; day ends at 10 PM when clocked in at 10:25', () => {
  const pl = W.plan(day(REAL), DEFAULTS, at('15:00'));
  assert.equal(pl.remindAt, at('18:30'));
  assert.equal(pl.reason, 'time');
  assert.equal(pl.end, at('22:00'));
  assert.equal(pl.endReason, '10pm');
  assert.equal(pl.nextAt, at('18:30'));
  assert.equal(pl.due, false);
  assert.equal(W.plan(day(REAL), DEFAULTS, at('18:30')).due, true);
});

test('the reminder time applies on every WFH day; capped at 10 PM; old "today only" ignored', () => {
  const s = { everyDay: '19:00' };
  assert.equal(W.plan(day(REAL), s, at('12:00')).remindAt, at('19:00'));
  const tomorrow = { ...W.emptyDay('2026-10-17'), source: 'api', punches: [{ at: '2026-10-17T10:00:00', in: true }] };
  assert.equal(W.plan(tomorrow, s, at('12:00', '2026-10-17')).remindAt, at('19:00', '2026-10-17'));
  // A "today only" override saved by an older version no longer applies.
  const old = { everyDay: '19:00', today: { date: DATE, time: '20:15' } };
  assert.equal(W.plan(day(REAL), old, at('12:00')).remindAt, at('19:00'));
  assert.deepEqual(W.normalizeSettings(old), { everyDay: '19:00', auto: { every: { on: false, time: null } } });
  assert.equal(W.validTime('22:00'), '22:00');
  assert.equal(W.validTime('22:01'), null);
  assert.equal(W.normalizeSettings({ everyDay: '23:30' }).everyDay, '18:30', 'invalid -> default');
});

test('slider: 12 PM–8 PM, snaps to half hours, clamps at the ends', () => {
  assert.deepEqual(W.SLIDER, { min: 720, max: 1200, step: 30 });
  assert.equal(W.sliderValueAt(0), 720); // 12:00 PM
  assert.equal(W.sliderValueAt(1), 1200); // 8:00 PM
  assert.equal(W.sliderValueAt(0.5), 960); // 4:00 PM
  // 6:14 PM rounds down to 6:00, 6:15 to 6:30.
  assert.equal(W.snapToSlider(18 * 60 + 14), 1080);
  assert.equal(W.snapToSlider(18 * 60 + 15), 1110);
  assert.equal(W.sliderValueAt(-0.3), 720, 'dragged past the left end');
  assert.equal(W.sliderValueAt(1.4), 1200, 'dragged past the right end');
  assert.equal(W.snapToSlider(NaN), 720);
  // Every step is a whole half hour, and there are 17 of them.
  const steps = new Set(Array.from({ length: 201 }, (_, i) => W.sliderValueAt(i / 200)));
  assert.equal(steps.size, 17);
  for (const v of steps) assert.equal(v % 30, 0);
  // Positions, including custom times off the scale.
  assert.equal(W.sliderFraction(1080), 0.75);
  assert.ok(W.sliderFraction(21 * 60 + 30) > 1);
  assert.equal(W.timeFromMinutes(1110), '18:30');
  assert.equal(W.timeFromMinutes(W.sliderValueAt(0)), '12:00');
});

test('safety net: early starter is reminded at first clock-in + 11h', () => {
  const d = day([p('08:15', true)]);
  const pl = W.plan(d, { everyDay: '21:00' }, at('12:00'));
  assert.equal(pl.remindAt, at('19:15'));
  assert.equal(pl.reason, 'safety');
  assert.equal(pl.end, at('20:15'), "Keka's 12h cutoff is before 10 PM");
  assert.equal(pl.endReason, 'cutoff');
  // Default 6:30 PM is already safe for an 8:15 start.
  assert.equal(W.plan(d, DEFAULTS, at('12:00')).reason, 'time');
});

test('clocked in after the reminder time: 30 min after clock-in', () => {
  const pl = W.plan(day([p('19:05', true)]), DEFAULTS, at('19:06'));
  assert.equal(pl.remindAt, at('19:35'));
  assert.equal(pl.reason, 'late');
});

test('back from a break after the reminder time: 30 min after re-clock-in', () => {
  const d = day([p('10:00', true), p('18:20', false), p('18:50', true)]);
  assert.equal(W.plan(d, DEFAULTS, at('18:51')).remindAt, at('19:20'));
  // A break before 6:30 PM changes nothing.
  assert.equal(W.plan(day(REAL), DEFAULTS, at('13:00')).remindAt, at('18:30'));
});

test('clocked in too late to remind before the end: no reminder', () => {
  const pl = W.plan(day([p('21:45', true)]), DEFAULTS, at('21:46'));
  assert.equal(pl.remindAt, null);
  assert.equal(pl.reason, 'too-late');
  assert.equal(pl.nextAt, null);
});

test('ignored reminders repeat every 15 min and stop quietly at the end', () => {
  let d = { ...day(REAL), lastShownAt: at('18:30') };
  assert.equal(W.plan(d, DEFAULTS, at('18:31')).nextAt, at('18:45'));
  d = { ...d, lastShownAt: at('21:50') };
  assert.equal(W.plan(d, DEFAULTS, at('21:51')).nextAt, null, '22:05 is past 10 PM');
});

test('asleep through several reminders: one catch-up now, then every 15 min', () => {
  const d = day(REAL);
  const pl = W.plan(d, DEFAULTS, at('20:10'));
  assert.equal(pl.due, true);
  assert.equal(W.plan({ ...d, lastShownAt: at('20:10') }, DEFAULTS, at('20:10')).nextAt, at('20:25'));
});

test('clocking out stops reminders and clears the snooze; back in re-arms', () => {
  const d = { ...day(REAL), lastShownAt: at('18:30'), snoozeUntil: at('19:00') };
  const out = W.applyObservation(d, { records: [{ date: DATE, punches: [...REAL, p('18:40', false)] }], complete: true }, at('18:40'));
  const pl = W.plan(out, DEFAULTS, at('18:41'));
  assert.equal(pl.state, 'out');
  assert.equal(pl.nextAt, null);
  assert.equal(out.snoozeUntil, null);
  assert.equal(W.badge(pl, at('18:41')), null);
  const back = W.applyObservation(out, { records: [{ date: DATE, punches: [...REAL, p('18:40', false), p('18:45', true)] }] }, at('18:45'));
  assert.equal(W.plan(back, DEFAULTS, at('18:46')).nextAt, at('19:15'));
});

// ---------- snooze ----------

test('snooze 30 min, +15 per click, cancel = remind now', () => {
  let d = { ...day(REAL), lastShownAt: at('18:30') };
  d = W.snooze(d, DEFAULTS, at('18:30'));
  let pl = W.plan(d, DEFAULTS, at('18:45'));
  assert.equal(pl.snoozed, true);
  assert.equal(pl.nextAt, at('19:00'));
  assert.equal(pl.due, false, 'no 15-min repeat while snoozed');
  d = W.extendSnooze(d, DEFAULTS, at('18:45'));
  d = W.extendSnooze(d, DEFAULTS, at('18:45'));
  assert.equal(W.plan(d, DEFAULTS, at('18:46')).nextAt, at('19:30'));
  d = W.cancelSnooze(d, at('18:50'));
  assert.equal(W.plan(d, DEFAULTS, at('18:50')).due, true);
});

test('snooze never passes the last call (5 min before the end)', () => {
  let d = { ...day(REAL), lastShownAt: at('21:40') };
  d = W.snooze(d, DEFAULTS, at('21:40'));
  assert.equal(d.snoozeUntil, at('21:55'));
  assert.equal(W.extendSnooze(d, DEFAULTS, at('21:41')).snoozeUntil, at('21:55'));
  // Snoozing during the last call means "enough for today".
  const late = W.snooze({ ...day(REAL), lastShownAt: at('21:57') }, DEFAULTS, at('21:57'));
  assert.equal(W.plan(late, DEFAULTS, at('21:58')).nextAt, null);
});

test('"Stop for today" silences reminders and the badge; "Turn back on" resumes', () => {
  let d = { ...day(REAL), lastShownAt: at('18:30'), snoozeUntil: at('19:00') };
  d = W.stop(d, at('18:35'));
  let pl = W.plan(d, DEFAULTS, at('19:30'));
  assert.equal(pl.stopped, true);
  assert.equal(pl.nextAt, null);
  assert.equal(pl.due, false);
  assert.equal(d.snoozeUntil, null);
  assert.equal(W.badge(pl, at('19:30')), null);
  assert.equal(W.shouldAnnounce(d, W.plan(d, { everyDay: '21:00' }, at('19:30')), at('19:30')), false);
  // Still off after a break and back in: it was stopped for the day.
  const back = W.applyObservation(d, { records: [{ date: DATE, punches: [...REAL, p('19:40', false), p('19:50', true)] }] }, at('19:50'));
  assert.equal(W.plan(back, DEFAULTS, at('19:51')).nextAt, null);
  // Turned back on: the overdue reminder comes right away.
  pl = W.plan(W.resume(d), DEFAULTS, at('19:30'));
  assert.equal(pl.stopped, false);
  assert.equal(pl.due, true);
});

// ---------- DOM fallback ----------

test('DOM fallback arms without a clock-in time; Keka data replaces it', () => {
  let d = W.applyDom(W.emptyDay(DATE), 'in', at('11:00'));
  let pl = W.plan(d, DEFAULTS, at('11:00'));
  assert.equal(pl.state, 'in');
  assert.equal(pl.firstIn, null);
  assert.equal(pl.remindAt, at('18:30'));
  assert.equal(pl.end, at('22:00'));
  d = W.applyObservation(d, { records: [{ date: DATE, punches: [p('08:15', true)] }], complete: true }, at('11:01'));
  assert.equal(W.plan(d, { everyDay: '21:00' }, at('11:01')).reason, 'safety');
  // Once Keka's data is in, the DOM can't override it.
  assert.equal(W.applyDom(d, 'out', at('11:02')), d);
});

test('day requests without today: no web clock-in today', () => {
  const d = W.applyObservation(day(REAL), { records: [{ date: '2026-10-15', punches: [] }], complete: true }, at('12:00'));
  assert.equal(W.plan(d, DEFAULTS, at('12:00')).state, 'none');
  // A click response for another day changes nothing.
  assert.equal(W.applyObservation(day(REAL), { records: [{ date: '2026-10-15', punches: [] }] }, at('12:00')).punches.length, 5);
});

// ---------- notifications and badge ----------

test('"reminder set" announced once per distinct time, never for one already due', () => {
  const d = day(REAL);
  const pl = W.plan(d, DEFAULTS, at('12:10'));
  assert.equal(W.shouldAnnounce(d, pl, at('12:10')), true);
  assert.equal(W.announcement(pl).title, 'WFH clock-out reminder set for 6:30 PM');
  assert.match(W.announcement(pl).message, /10:25 AM/);
  const announced = { ...d, announcedFor: pl.remindAt };
  assert.equal(W.shouldAnnounce(announced, pl, at('12:11')), false);
  // Time moved (e.g. changed in the tab): announce again.
  const moved = W.plan(announced, { everyDay: '19:00' }, at('12:12'));
  assert.equal(W.shouldAnnounce(announced, moved, at('12:12')), true);
  assert.equal(W.shouldAnnounce(d, W.plan(d, DEFAULTS, at('18:31')), at('18:31')), false);
  assert.match(W.announcement(W.plan(day([p('08:15', true)]), { everyDay: '21:00' }, at('09:00'))).message, /11h after your 8:15 AM/);
});

test('reminder text: start time and a plain nudge, no limit wording', () => {
  const r = W.reminder(W.plan(day(REAL), DEFAULTS, at('18:30')));
  assert.deepEqual(r, { title: 'Time to clock out', message: 'You clocked in at 10:25 AM. Don\'t forget to clock out in Keka.' });
  // Same wording late in the day and for an early starter.
  assert.equal(W.reminder(W.plan(day(REAL), DEFAULTS, at('21:40'))).title, 'Time to clock out');
  assert.doesNotMatch(W.reminder(W.plan(day([p('08:15', true)]), DEFAULTS, at('19:00'))).message, /limit|missed|10:00/);
  assert.equal(W.reminder(W.plan(W.applyDom(W.emptyDay(DATE), 'in', at('11:00')), DEFAULTS, at('19:00'))).message, 'Don\'t forget to clock out in Keka.');
});

test('badge: countdown, amber while snoozed, red OUT once due, hidden when out', () => {
  const d = day(REAL);
  assert.deepEqual(W.badge(W.plan(d, DEFAULTS, at('16:25')), at('16:25')), { text: '2:05', color: '#1f9d6b' });
  assert.deepEqual(W.badge(W.plan(d, DEFAULTS, at('18:00')), at('18:00')), { text: '30m', color: '#1f9d6b' });
  const shown = { ...d, lastShownAt: at('18:30') };
  assert.equal(W.badge(W.plan(shown, DEFAULTS, at('18:31')), at('18:31')).text, 'OUT');
  const snoozed = W.snooze(shown, DEFAULTS, at('18:31'));
  assert.deepEqual(W.badge(W.plan(snoozed, DEFAULTS, at('18:41')), at('18:41')), { text: '20m', color: '#d97706' });
  assert.equal(W.badge(W.plan(day(REAL.slice(0, 4)), DEFAULTS, at('13:00')), at('13:00')), null);
  // After the last call there's no next reminder, but it stays red until the day ends.
  const lastCall = { ...d, lastShownAt: at('21:50') };
  assert.equal(W.badge(W.plan(lastCall, DEFAULTS, at('21:51')), at('21:51')).text, 'OUT');
  assert.equal(W.badge(W.plan(lastCall, DEFAULTS, at('22:00')), at('22:00')), null);
});

// ---------- auto clock-out ----------

const AUTO_ON = { everyDay: '18:30', auto: { every: { on: true, time: null } } };

test('auto clock-out: off by default; default time is reminder + 30 min (max 10 PM)', () => {
  assert.equal(W.autoPlan(day(REAL), DEFAULTS, at('12:00')).status, 'off');
  assert.equal(W.autoFor(AUTO_ON).time, '19:00');
  assert.equal(W.autoFor({ everyDay: '21:45', auto: { every: { on: true } } }).time, '22:00');
  // An older "today only" auto clock-out is ignored; the every-day setting applies.
  const s = { everyDay: '18:30', auto: { every: { on: false, time: '20:00' }, today: { date: DATE, on: true, time: '21:00' } } };
  assert.deepEqual(W.autoFor(s), { on: false, time: '20:00' });
  // Reminder settings saved without `auto` keep working.
  assert.equal(W.normalizeSettings({ everyDay: '19:00' }).auto.every.on, false);
});

test('auto clock-out: scheduled → heads-up 5 min before → due', () => {
  const d = day(REAL);
  assert.equal(W.autoPlan(d, AUTO_ON, at('18:00')).status, 'scheduled');
  const hu = W.autoPlan(d, AUTO_ON, at('18:55'));
  assert.equal(hu.status, 'heads-up');
  assert.equal(hu.at, at('19:00'));
  assert.equal(W.autoHeadsUp(hu).title, 'Auto clock-out at 7:00 PM');
  assert.equal(W.autoPlan(d, AUTO_ON, at('19:00')).status, 'due');
  // Asleep at 7 PM, awake at 9 PM and still clocked in: do it now.
  assert.equal(W.autoPlan(d, AUTO_ON, at('21:00')).status, 'due');
  assert.equal(W.autoPlan(d, AUTO_ON, at('22:00')).status, 'ended');
});

test('auto clock-out: +15 min and skip today', () => {
  let d = W.autoPostpone(day(REAL), AUTO_ON, at('18:55'));
  let ap = W.autoPlan(d, AUTO_ON, at('18:56'));
  assert.equal(ap.at, at('19:15'));
  assert.equal(ap.status, 'scheduled', 'heads-up shows again 5 min before the new time');
  // Never past the last call before 10 PM.
  const late = { everyDay: '18:30', auto: { every: { on: true, time: '21:50' } } };
  // (clocked in at 11:00, so the 11h safety cap is 10 PM, not in play)
  d = W.autoPostpone(day([p('11:00', true)]), late, at('21:46'));
  assert.equal(W.autoPlan(d, late, at('21:46')).at, at('21:55'));
  assert.equal(W.autoPlan(W.autoSkipToday(day(REAL)), AUTO_ON, at('19:00')).status, 'skipped');
});

test('auto clock-out: never runs on someone who clocked in after its time', () => {
  // Started the day late.
  assert.equal(W.autoPlan(day([p('19:10', true)]), AUTO_ON, at('19:40')).status, 'late-start');
  // On a break across the time, back afterwards: skipped for today.
  const brk = day([p('10:00', true), p('18:50', false), p('19:20', true)]);
  assert.equal(W.autoPlan(brk, AUTO_ON, at('19:30')).status, 'late-start');
  // On a break at the time and still out: nothing to clock out.
  assert.equal(W.autoPlan(day([p('10:00', true), p('18:50', false)]), AUTO_ON, at('19:05')).status, 'missed');
  // Clocked out before the time: paused; back in before it: scheduled again.
  const out = day([p('10:00', true), p('18:00', false)]);
  assert.equal(W.autoPlan(out, AUTO_ON, at('18:30')).status, 'standby');
  assert.equal(W.autoPlan(day([p('10:00', true), p('18:00', false), p('18:20', true)]), AUTO_ON, at('18:30')).status, 'scheduled');
  // Not clocked in at all: waits (no WFH day yet).
  assert.equal(W.autoPlan(W.emptyDay(DATE), AUTO_ON, at('19:05')).status, 'waiting');
});

test('auto clock-out: early starter is clocked out 11h after clock-in, before Keka cuts off', () => {
  const ap = W.autoPlan(day([p('08:15', true)]), { everyDay: '18:30', auto: { every: { on: true, time: '21:00' } } }, at('12:00'));
  assert.equal(ap.at, at('19:15'));
  assert.equal(ap.reason, 'safety');
});

test('auto clock-out: running → done when Keka shows the clock-out; at most once a day', () => {
  let d = W.autoStart(day(REAL), at('19:00'));
  assert.equal(W.autoPlan(d, AUTO_ON, at('19:00')).status, 'running');
  assert.equal(W.autoClockedOut(d), false);
  d = W.applyObservation(d, { records: [{ date: DATE, punches: [...REAL, p('19:00', false)] }] }, at('19:00'));
  assert.equal(W.autoClockedOut(d), true);
  d = W.autoFinish(d, true, at('19:00'));
  assert.equal(W.autoPlan(d, AUTO_ON, at('19:01')).status, 'done');
  // Clocking back in afterwards doesn't trigger it again.
  d = W.applyObservation(d, { records: [{ date: DATE, punches: [...REAL, p('19:00', false), p('19:10', true)] }] }, at('19:10'));
  assert.equal(W.autoPlan(d, AUTO_ON, at('20:00')).status, 'done');
  assert.equal(W.autoPlan(W.autoFinish(W.autoStart(day(REAL), at('19:00')), false, at('19:02')), AUTO_ON, at('19:03')).status, 'failed');
});

test('auto clock-out: Reset clears today\'s skip / +15 / result, not while running', () => {
  const skipped = W.autoSkipToday(day(REAL));
  assert.equal(W.autoResettable(skipped), true);
  assert.equal(W.autoPlan(W.autoReset(skipped), AUTO_ON, at('18:00')).status, 'scheduled');
  const delayed = W.autoPostpone(day(REAL), AUTO_ON, at('18:55'));
  assert.equal(W.autoResettable(delayed), true);
  assert.equal(W.autoPlan(W.autoReset(delayed), AUTO_ON, at('18:00')).at, at('19:00'));
  const failed = W.autoFinish(W.autoStart(day(REAL), at('19:00')), false, at('19:02'));
  assert.equal(W.autoResettable(failed), true);
  assert.equal(W.autoPlan(W.autoReset(failed), AUTO_ON, at('19:03')).status, 'due', 'runs again when reset after its time');
  const running = W.autoStart(day(REAL), at('19:00'));
  assert.equal(W.autoResettable(running), false);
  assert.equal(W.autoReset(running), running);
  assert.equal(W.autoResettable(day(REAL)), false, 'nothing to reset');
});

test('auto clock-out: never without a heads-up (after Reset, or waking past the time)', () => {
  // Reset at 7:02 PM after a skip: due again, but no heads-up was shown for it.
  const reset = W.autoReset(W.autoSkipToday(day(REAL)));
  assert.equal(W.autoPlan(reset, AUTO_ON, at('19:02')).status, 'due');
  const d = W.autoDeferForHeadsUp(reset, AUTO_ON, at('19:02'));
  const ap = W.autoPlan(d, AUTO_ON, at('19:02'));
  assert.equal(ap.at, at('19:07'));
  assert.equal(ap.status, 'heads-up');
  // Normal path: the heads-up was shown for this time, so it runs on time.
  const warned = { ...day(REAL), autoHeadsUpFor: at('19:00') };
  assert.equal(W.autoDeferForHeadsUp(warned, AUTO_ON, at('19:00')), warned);
  // Early starter past the 11h point: the delay still applies on top of the safety time.
  const early = day([p('08:00', true)]);
  const s = { everyDay: '18:30', auto: { every: { on: true, time: '21:00' } } };
  const e = W.autoPlan(W.autoDeferForHeadsUp(early, s, at('19:30')), s, at('19:30'));
  assert.equal(e.at, at('19:35'));
  assert.equal(e.status, 'heads-up');
  // No room left before the end: run now rather than miss it.
  const last = day([p('11:00', true)]);
  assert.equal(W.autoDeferForHeadsUp(last, AUTO_ON, at('21:58')), last);
});
