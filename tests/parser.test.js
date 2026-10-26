'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/content/parser.js');
const { trimSummaryRecord } = require('../src/page/network-hook.js');
const { calculateSummary } = require('../src/content/calculator.js');

const today = new Date(2026, 9, 5, 12, 0); // 5 Oct 2026
const ctxFor = headerText => ({ today, todayKey: '2026-10-05', header: P.parseHeader(headerText) });

// Row snapshots mirroring what Keka renders (text, .badge text, xhrtooltip values).
const rows = {
  office: { dateText: 'Wed, 30 Sept', text: 'Wed, 30 Sept 0h 0m 8h 26m On Time', durationText: '8h 26m', badges: [], tooltips: ['Present'] },
  wfh: { dateText: 'Mon, 21 Sept', text: 'Mon, 21 Sept Wfh 0h 0m 8h 24m On Time', durationText: '8h 24m', badges: ['Wfh'], tooltips: ['Work From Home', 'Click here to view map', 'Present'] },
  holidayWorked: { dateText: 'Fri, 04 Sept', text: 'Fri, 04 Sept HLDY 0h 0m 11h 18m', durationText: '11h 18m', badges: ['HLDY'], tooltips: ['Present'] },
  weeklyOff: { dateText: 'Sun, 27 Sept', text: 'Sun, 27 Sept W-OFF Full day Weekly-off', durationText: null, badges: ['W-OFF'], tooltips: [] },
  leave: { dateText: 'Fri, 18 Sept', text: 'Comp Offs Fri, 18 Sept Leave', durationText: null, badges: ['Leave'], tooltips: [] },
  saturdayWorked: { dateText: 'Sat, 26 Sept', text: 'Sat, 26 Sept W-OFF 0h 0m 8h 20m', durationText: '8h 20m', badges: ['W-OFF'], tooltips: ['Present'] },
};

function apiRec(date, { status = 1, dayType = 0, leave = false, partialLeave = false, inT = '10:00:00', outT = '19:00:30', lastPunch = 1 } = {}) {
  const pairs = inT ? [[`${date}T${inT}`, outT ? `${date}T${outT}` : null]] : [];
  let grossHours = 0;
  if (inT && outT) grossHours = Math.round(((Date.parse(`${date}T${outT}`) - Date.parse(`${date}T${inT}`)) / 36e5) * 100) / 100;
  const mins = Math.round(grossHours * 60);
  return {
    date, dayType, status, remoteDay: status === 2, leave, partialLeave, grossHours,
    grossText: `${Math.floor(mins / 60)}h ${mins % 60}m`, pairs,
    firstLog: pairs[0] ? pairs[0][0] : null, lastLog: pairs[0] ? pairs[0][1] : null, lastPunch,
  };
}

test('header: month detection, no hard-coded month', () => {
  assert.deepEqual(P.parseHeader('September, 2026'), { isMonth: true, label: 'September 2026', year: 2026, month: 8, monthKey: '2026-09' });
  assert.equal(P.parseHeader('August, 2026').monthKey, '2026-08');
  assert.equal(P.parseHeader(' July 2026 ').label, 'July 2026');
  assert.equal(P.parseHeader('Last 30 Days').isMonth, false);
  assert.equal(P.parseHeader('').label, null);
});

test('row dates: "Sept", header year, and rolling-window year inference', () => {
  const sep = P.parseHeader('September, 2026');
  assert.equal(P.resolveRowDate('Fri, 04 Sept', sep, today), '2026-09-04');
  assert.equal(P.resolveRowDate('Thu, 1 Oct', P.parseHeader('30 Days'), today), '2026-10-01');
  const jan = new Date(2027, 0, 10);
  assert.equal(P.resolveRowDate('Mon, 28 Dec', P.parseHeader('30 Days'), jan), '2026-12-28');
  assert.equal(P.resolveRowDate('Mon, 31 Sept', sep, today), null);
  assert.equal(P.resolveRowDate('nonsense', sep, today), null);
});

test('row classification covers every Keka row type', () => {
  const ctx = ctxFor('September, 2026');
  const c = k => P.classifyRow(rows[k], ctx);
  assert.equal(c('office').grossMinutes, 506);
  assert.equal(c('office').isWFH, false);
  assert.equal(c('wfh').isWFH, true);
  assert.equal(c('holidayWorked').isHoliday, true);
  assert.equal(c('holidayWorked').grossMinutes, 678);
  assert.equal(c('weeklyOff').isWeeklyOff, true);
  assert.equal(c('weeklyOff').grossMinutes, 0);
  assert.equal(c('leave').isLeave, true);
  assert.equal(c('saturdayWorked').isWeeklyOff, true);
  assert.equal(c('saturdayWorked').grossMinutes, 500);
  for (const k of Object.keys(rows)) assert.equal(c(k).sourcePrecision, 'display-rounded');
});

test('classification + calculation: holiday & Saturday worked count, WFH/leave/W-OFF do not', () => {
  const ctx = ctxFor('September, 2026');
  const days = Object.values(rows).map(r => P.classifyRow(r, ctx));
  const s = calculateSummary(days, 540);
  assert.equal(s.trackedDays, 3); // office, holiday worked, saturday worked
  assert.equal(s.wfhDays, 1);
  assert.equal(s.leaveDays, 1);
  assert.equal(s.noTimeDays, 1);
  assert.equal(s.totalMinutes, 506 + 678 + 500);
});

test('precise seconds come from punch timestamps only when they match Keka total', () => {
  const rec = apiRec('2026-09-01', { inT: '10:52:27', outT: '22:37:28' }); // 11h 45m 01s
  assert.equal(P.preciseSeconds(rec), 42301);
  assert.equal(P.preciseSeconds({ ...rec, grossHours: 10 }), null); // inconsistent -> no fake precision
  assert.equal(P.preciseSeconds({ ...rec, grossHours: undefined }), null);
  const day = P.normalizeApiRecord(rec, ctxFor('September, 2026'));
  assert.equal(day.sourcePrecision, 'precise');
  assert.ok(Math.abs(day.grossMinutes - 42301 / 60) < 1e-9);
});

test('API status mapping: WFH, leave, holiday, weekly-off', () => {
  const ctx = ctxFor('September, 2026');
  assert.equal(P.normalizeApiRecord(apiRec('2026-09-10', { status: 2 }), ctx).isWFH, true);
  assert.equal(P.normalizeApiRecord(apiRec('2026-09-18', { status: 0, leave: true, inT: null }), ctx).isLeave, true);
  assert.equal(P.normalizeApiRecord(apiRec('2026-09-04', { dayType: 1 }), ctx).isHoliday, true);
  assert.equal(P.normalizeApiRecord(apiRec('2026-09-05', { dayType: 2, status: 0, inT: null }), ctx).isWeeklyOff, true);
});

test('merge: API precision is used only when it agrees with the table', () => {
  const ctx = ctxFor('September, 2026');
  const dom = P.classifyRow(rows.office, ctx); // 8h 26m displayed
  const fresh = P.normalizeApiRecord(apiRec('2026-09-30', { inT: '10:00:00', outT: '18:26:17' }), ctx);
  const merged = P.mergeDay(dom, fresh);
  assert.equal(merged.sourcePrecision, 'precise');
  assert.ok(Math.abs(merged.grossMinutes - (8 * 60 + 26 + 17 / 60)) < 1e-9);

  const stale = P.normalizeApiRecord(apiRec('2026-09-30', { inT: '10:00:00', outT: '15:00:00' }), ctx);
  const kept = P.mergeDay(dom, stale);
  assert.equal(kept.sourcePrecision, 'display-rounded');
  assert.equal(kept.grossMinutes, 506);
});

test('today: open punch / unconfirmed table value is not counted', () => {
  const ctx = ctxFor('October, 2026');
  const row = { dateText: 'Mon, 05 Oct', text: 'Mon, 05 Oct 0h 0m 3h 10m', durationText: '3h 10m', badges: [], tooltips: ['Present'] };
  const dom = P.classifyRow(row, ctx);
  assert.equal(P.mergeDay(dom, null).isIncomplete, true);
  const open = P.normalizeApiRecord(apiRec('2026-10-05', { inT: '09:00:00', outT: '12:10:00', lastPunch: 0 }), ctx);
  assert.equal(P.mergeDay(dom, open).isIncomplete, true);
  const done = P.normalizeApiRecord(apiRec('2026-10-05', { inT: '09:00:00', outT: '12:10:00', lastPunch: 1 }), ctx);
  assert.equal(P.mergeDay(dom, done).isIncomplete, false);
});

test('view: rows from the previous month while header changed => loading, never stale numbers', () => {
  const snap = { headerText: 'August, 2026', listPresent: true, rows: [rows.office, rows.wfh] };
  const v = P.buildView(snap, new Map(), { today, todayKey: '2026-10-05' });
  assert.equal(v.status, 'loading');
  assert.equal(v.label, 'August 2026');
});

test('view: month switch changes label, days and signature', () => {
  const ctx = { today, todayKey: '2026-10-05' };
  const sep = P.buildView({ headerText: 'September, 2026', listPresent: true, rows: [rows.office] }, new Map(), ctx);
  const augRow = { dateText: 'Mon, 31 Aug', text: 'Mon, 31 Aug 0h 0m 10h 32m', durationText: '10h 32m', badges: [], tooltips: ['Present'] };
  const aug = P.buildView({ headerText: 'August, 2026', listPresent: true, rows: [augRow] }, new Map(), ctx);
  assert.equal(sep.status, 'ok');
  assert.equal(aug.status, 'ok');
  assert.equal(aug.label, 'August 2026');
  assert.equal(aug.days[0].date, '2026-08-31');
  assert.notEqual(P.signature(sep), P.signature(aug));
});

test('view: clock-out update changes the signature', () => {
  const ctx = { today, todayKey: '2026-10-05' };
  const before = P.buildView({ headerText: 'September, 2026', listPresent: true, rows: [rows.office] }, new Map(), ctx);
  const after = P.buildView({ headerText: 'September, 2026', listPresent: true,
    rows: [{ ...rows.office, durationText: '9h 02m', text: 'Wed, 30 Sept 0h 0m 9h 02m' }] }, new Map(), ctx);
  assert.notEqual(P.signature(before), P.signature(after));
  // Same data re-rendered by Angular => same signature (no re-render).
  const again = P.buildView({ headerText: 'September, 2026', listPresent: true, rows: [{ ...rows.office }] }, new Map(), ctx);
  assert.equal(P.signature(before), P.signature(again));
});

test('view: calendar mode (no table) falls back to API data for the header month only', () => {
  const api = new Map([
    ['2026-09-01', apiRec('2026-09-01')],
    ['2026-08-31', apiRec('2026-08-31')],
  ]);
  const v = P.buildView({ headerText: 'September, 2026', listPresent: false, rows: [] }, api, { today, todayKey: '2026-10-05' });
  assert.equal(v.status, 'ok');
  assert.equal(v.source, 'api');
  assert.deepEqual(v.days.map(d => d.date), ['2026-09-01']);
  const none = P.buildView({ headerText: 'July, 2026', listPresent: false, rows: [] }, api, { today, todayKey: '2026-10-05' });
  assert.equal(none.status, 'loading');
});

test('network hook keeps only calculation fields (no location / IP / notes)', () => {
  const raw = {
    attendanceDate: '2026-09-21T00:00:00Z', dayType: 0, attendanceDayStatus: 2,
    leaveDayStatuses: [], leaveDetails: [], totalGrossHours: 8.4, grossHoursInHHMM: '8h 24m',
    validInOutPairs: [{ inTime: '2026-09-21T10:31:00', outTime: '2026-09-21T18:54:50', totalDuration: 8.4 }],
    firstLogOfTheDay: '2026-09-21T10:31:00', lastLogOfTheDay: '2026-09-21T18:54:50',
    isFullyWorkedOnWorkingRemotelyDay: true,
    timeEntries: [
      { punchStatus: 0, ipAddress: '10.0.0.1', locationAddress: { city: 'X' }, note: 'secret' },
      { punchStatus: 1, ipAddress: '10.0.0.1', locationAddress: { city: 'X' } },
    ],
    employeeId: 123,
  };
  const t = trimSummaryRecord(raw);
  assert.deepEqual(Object.keys(t).sort(), ['date', 'dayType', 'firstLog', 'grossHours', 'grossText', 'lastLog', 'lastPunch', 'leave', 'entryCount', 'pairs', 'partialLeave', 'remoteDay', 'status'].sort());
  assert.equal(t.date, '2026-09-21');
  assert.equal(t.lastPunch, 1);
  assert.doesNotMatch(JSON.stringify(t), /10\.0\.0\.1|secret|city|123/);
});

test('"Last 30 Days" view: only the current month up to today is used', () => {
  const ctx = { today, todayKey: '2026-10-05' };
  const row = (dt, dur, badges = []) => ({ dateText: dt, text: `${dt} ${badges.join(' ')} 0h 0m ${dur}`, durationText: dur, badges, tooltips: ['Present'] });
  const snap = { headerText: 'Last 30 Days', listPresent: true, rows: [
    row('Mon, 05 Oct', '9h 57m', ['Wfh']),
    row('Thu, 01 Oct', '10h 40m'),
    row('Wed, 30 Sept', '8h 26m'),
    row('Tue, 29 Sept', '10h 26m'),
  ] };
  const v = P.buildView(snap, new Map(), ctx);
  assert.equal(v.status, 'ok');
  assert.equal(v.label, 'October 2026');
  assert.equal(v.monthToDate, true);
  assert.deepEqual(v.days.map(d => d.date).sort(), ['2026-10-01', '2026-10-05']);
  const s = calculateSummary(v.days, 540);
  assert.equal(s.trackedDays, 1);
  assert.equal(s.averageMinutes, 640);
  assert.equal(s.wfhDays, 1);
});

test('"Last 30 Days" view fills early-month days outside the window from API data', () => {
  const ctx = { today: new Date(2026, 9, 31, 20), todayKey: '2026-10-31' };
  const snap = { headerText: 'Last 30 Days', listPresent: true, rows: [
    { dateText: 'Fri, 30 Oct', text: 'Fri, 30 Oct 0h 0m 9h 0m', durationText: '9h 0m', badges: [], tooltips: [] },
    { dateText: 'Fri, 02 Oct', text: 'Fri, 02 Oct 0h 0m 9h 0m', durationText: '9h 0m', badges: [], tooltips: [] },
  ] };
  const api = new Map([['2026-10-01', apiRec('2026-10-01')], ['2026-09-30', apiRec('2026-09-30')]]);
  const v = P.buildView(snap, api, ctx);
  assert.deepEqual(v.days.map(d => d.date).sort(), ['2026-10-01', '2026-10-02', '2026-10-30']);
});

test('half-day leave with office time counts; half-day leave + WFH does not; full leave never does', () => {
  const ctx = ctxFor('August, 2026');
  const halfOffice = P.normalizeApiRecord(apiRec('2026-08-21', { status: 1, leave: true, partialLeave: true, inT: '09:30:00', outT: '14:01:00' }), ctx);
  const halfWfh = P.normalizeApiRecord(apiRec('2026-08-22', { status: 2, leave: true, partialLeave: true, inT: '09:30:00', outT: '14:01:00' }), ctx);
  const halfAbsent = P.normalizeApiRecord(apiRec('2026-08-23', { status: 0, leave: true, partialLeave: true, inT: null }), ctx);
  const full = P.normalizeApiRecord(apiRec('2026-08-24', { status: 1, leave: true, inT: '10:00:00', outT: '17:00:00' }), ctx);
  assert.equal(halfOffice.isHalfLeave, true);
  assert.equal(halfOffice.isLeave, false);
  const s = calculateSummary([halfOffice, halfWfh, halfAbsent, full], 540);
  assert.equal(s.trackedDays, 1);
  assert.equal(s.totalMinutes, 4 * 60 + 31);
  assert.equal(s.halfLeaveDays, 1);
  assert.equal(s.wfhDays, 1);
  assert.equal(s.leaveDays, 2);
});

test('table "Leave" badge + time: API decides half vs full day', () => {
  const ctx = ctxFor('August, 2026');
  const row = { dateText: 'Fri, 21 Aug', text: 'Fri, 21 Aug Leave 0h 0m 4h 31m', durationText: '4h 31m', badges: ['Leave'], tooltips: ['Present'] };
  const dom = P.classifyRow(row, ctx);
  assert.equal(dom.isLeave, true); // alone, the badge is treated as full-day (conservative)
  const half = P.normalizeApiRecord(apiRec('2026-08-21', { leave: true, partialLeave: true, inT: '09:30:00', outT: '14:01:00' }), ctx);
  const merged = P.mergeDay(dom, half);
  assert.equal(merged.isLeave, false);
  assert.equal(merged.isHalfLeave, true);
  const halfText = P.classifyRow({ ...row, badges: ['Leave'], text: row.text + ' Second half' }, ctx);
  assert.equal(halfText.isHalfLeave, true);
});

test('network hook: leaveDayStatus 1 = full day, 2/3 = half day', () => {
  const base = { attendanceDate: '2026-08-21T00:00:00Z', timeEntries: [], validInOutPairs: [] };
  assert.equal(trimSummaryRecord({ ...base, leaveDayStatuses: [3], leaveDetails: [{ leaveDayStatus: 3 }] }).partialLeave, true);
  assert.equal(trimSummaryRecord({ ...base, leaveDayStatuses: [1], leaveDetails: [{ leaveDayStatus: 1 }] }).partialLeave, false);
  assert.equal(trimSummaryRecord({ ...base, leaveDayStatuses: [], leaveDetails: [] }).leave, false);
});

test('today exposes its first clock-in (for the clock-out time), breaks or not', () => {
  const ctx = ctxFor('October, 2026');
  const rec = { ...apiRec('2026-10-05', { inT: '10:00:00', outT: null, lastPunch: 0 }), entryCount: 1, grossHours: 0 };
  assert.equal(P.normalizeApiRecord(rec, ctx).firstIn, '2026-10-05T10:00:00');
  // Gross hours run from the first clock-in, so a break doesn't change it.
  const afterBreak = { ...rec, entryCount: 3, pairs: [['2026-10-05T10:00:00', '2026-10-05T13:00:00'], ['2026-10-05T14:00:00', null]] };
  assert.equal(P.normalizeApiRecord(afterBreak, ctx).firstIn, '2026-10-05T10:00:00');
  assert.equal(P.normalizeApiRecord({ ...afterBreak, firstLog: null }, ctx).firstIn, '2026-10-05T10:00:00', 'from the first pair');
  assert.equal(P.normalizeApiRecord({ ...rec, date: '2026-10-04' }, ctx).firstIn, null, 'today only');
});

test('Actions card labels -> WFH clock state (from the saved Keka pages)', () => {
  // Clocked in (approved or pending approval): a "WFH Clock-out" button.
  assert.equal(P.clockStateFromLabels(['WFH Clock-out', 'Work From Home', 'Partial Day Request', 'Attendance Policy']), 'in');
  // Clocked out: only the "WFH Clock-In" link.
  assert.equal(P.clockStateFromLabels(['WFH Clock-In', 'Work From Home', 'Partial Day Request', 'Attendance Policy']), 'out');
  assert.equal(P.clockStateFromLabels(['Work From Home', 'Attendance Policy']), null);
  assert.equal(P.clockStateFromLabels([]), null);
});
