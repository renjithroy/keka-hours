'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/background/reminder.js');

const H = 3600000;
const M = 60000;
const IN = '2026-10-12T09:30:00';
const t0 = Date.parse(IN);

const rec = (over = {}) => ({
  date: '2026-10-12', status: 2, remoteDay: false, lastPunch: 0, entryCount: 1,
  firstLog: IN, pairs: [[IN, null]], ...over,
});
const out = (over = {}) => rec({ lastPunch: 1, entryCount: 2, pairs: [[IN, '2026-10-12T18:40:00']], ...over });

test('opens a session only on a WFH day that is clocked in', () => {
  assert.deepEqual(R.openWfhSession(rec()), { date: '2026-10-12', clockIn: t0, entryCount: 1 });
  assert.equal(R.openWfhSession(rec({ status: 1 })), null, 'office day');
  assert.ok(R.openWfhSession(rec({ status: 1, remoteDay: true })), 'remote flag counts as WFH');
  assert.equal(R.openWfhSession(out()), null, 'already clocked out');
  assert.equal(R.openWfhSession(rec({ firstLog: null, pairs: [] })), null, 'no clock-in time');
});

test('no reminder before 9h; first one at exactly 9h', () => {
  const s = R.applyRecord(null, rec(), t0 + H);
  assert.equal(R.reminderFor(s, t0 + 9 * H - 1), null);
  assert.equal(R.nextAlarmAt(s, t0 + H), t0 + 9 * H);
  const r = R.reminderFor(s, t0 + 9 * H);
  assert.equal(r.index, 0);
  assert.equal(r.urgent, false);
  assert.match(r.message, /9:30 AM/);
  assert.match(r.message, /9:30 PM/);
});

test('after sending, the next alarm is the next offset; urgent near the deadline', () => {
  let s = R.applyRecord(null, rec(), t0);
  s = { ...s, sentIndex: 0 };
  assert.equal(R.reminderFor(s, t0 + 9 * H + 10 * M), null, 'already sent');
  assert.equal(R.nextAlarmAt(s, t0 + 9 * H + 10 * M), t0 + 9.5 * H);
  const late = R.reminderFor(s, t0 + 11 * H + 31 * M);
  assert.equal(late.urgent, true);
  assert.match(late.title, /29m left/);
});

test('waking up late sends only the latest due reminder, once', () => {
  const s = R.applyRecord(null, rec(), t0);
  const now = t0 + 10 * H + 40 * M;
  const r = R.reminderFor(s, now);
  assert.equal(r.index, 3); // 10h30
  assert.equal(R.nextAlarmAt(s, now), now);
  assert.equal(R.nextAlarmAt({ ...s, sentIndex: r.index }, now), t0 + 11 * H);
});

test('nothing at or after the 12h deadline', () => {
  const s = { ...R.applyRecord(null, rec(), t0), sentIndex: R.OFFSETS_MS.length - 1 };
  assert.equal(R.nextAlarmAt(s, t0 + 11 * H + 56 * M), null);
  assert.equal(R.reminderFor(s, t0 + 12 * H), null);
  assert.equal(R.applyRecord(null, rec(), t0 + 12 * H), null, 'stale open record after deadline');
});

test('clocking out ends the session; a stale or other-day record does not', () => {
  const s = { ...R.applyRecord(null, rec(), t0), sentIndex: 1 };
  assert.equal(R.applyRecord(s, out(), t0 + 10 * H), null);
  const nextDay = { date: '2026-10-13', status: 0, lastPunch: null, pairs: [], entryCount: 0 };
  assert.equal(R.applyRecord(s, nextDay, t0 + 10 * H), s, 'past midnight: today has no punches yet');
  assert.equal(R.applyRecord(s, rec(), t0 + 10 * H).sentIndex, 1, 'same record keeps progress');
});

test('"I\'ve clocked out" silences until Keka shows a new punch', () => {
  const s = { ...R.applyRecord(null, rec(), t0), sentIndex: 0, dismissedAt: 1 };
  assert.equal(R.reminderFor(s, t0 + 10 * H), null);
  assert.equal(R.nextAlarmAt(s, t0 + 10 * H), null);
  // Out for a break and back in: 3 entries, still open.
  const back = rec({ entryCount: 3, pairs: [[IN, '2026-10-12T13:00:00'], ['2026-10-12T14:00:00', null]] });
  const re = R.applyRecord(s, back, t0 + 10 * H);
  assert.equal(re.dismissedAt, null);
  assert.ok(R.reminderFor(re, t0 + 10 * H));
});
