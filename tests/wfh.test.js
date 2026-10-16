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

test('custom time: today only vs every WFH day; capped at 10 PM', () => {
  const s = { everyDay: '19:00', today: { date: DATE, time: '20:15' } };
  assert.equal(W.plan(day(REAL), s, at('12:00')).remindAt, at('20:15'));
  assert.equal(W.plan(day(REAL), s, at('12:00')).scope, 'today');
  const tomorrow = { ...W.emptyDay('2026-10-17'), source: 'api', punches: [{ at: '2026-10-17T10:00:00', in: true }] };
  assert.equal(W.plan(tomorrow, s, at('12:00', '2026-10-17')).remindAt, at('19:00', '2026-10-17'), 'one-off expired');
  assert.equal(W.validTime('22:00'), '22:00');
  assert.equal(W.validTime('22:01'), null);
  assert.equal(W.normalizeSettings({ everyDay: '23:30' }, DATE).everyDay, '18:30', 'invalid -> default');
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

test('reminder text: deadline wording and last-30-min urgency', () => {
  assert.equal(W.reminder(W.plan(day(REAL), DEFAULTS, at('18:30')), at('18:30')).title, 'Time to clock out');
  const last = W.reminder(W.plan(day(REAL), DEFAULTS, at('21:40')), at('21:40'));
  assert.equal(last.title, 'Clock out now: 20m left');
  assert.match(W.reminder(W.plan(day([p('08:15', true)]), DEFAULTS, at('19:00')), at('19:00')).message, /missed clock-out at 8:15 PM/);
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
