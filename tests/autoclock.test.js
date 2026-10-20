'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { clockOut } = require('../src/content/autoclock.js');

/**
 * A fake Actions card that behaves like Keka's (from your screenshots):
 * "WFH Clock-out" → ("Clock-out" + "Cancel") → spinner → "WFH Clock-In".
 * `script` overrides what's on screen at each stage.
 */
function fakeKeka({ loadSteps = 2, confirmSteps = 1, doneSteps = 2, start = 'in', confirmLabel = 'Clock-out', signedOut = false } = {}) {
  let stage = start === 'in' ? 'loading' : 'out';
  let ticks = 0;
  const clicked = [];
  const labels = () => {
    if (signedOut) return [];
    switch (stage) {
      case 'loading': return ticks >= loadSteps ? ['WFH Clock-out', 'Work From Home', 'Attendance Policy'] : [];
      case 'confirming': return ticks >= confirmSteps ? [confirmLabel, 'Cancel'] : [];
      case 'saving': return ticks >= doneSteps ? ['WFH Clock-In', 'Work From Home'] : [];
      case 'out': return ['WFH Clock-In', 'Work From Home'];
      default: return [];
    }
  };
  const dom = {
    find: re => labels().find(l => re.test(l)) || null,
    click: label => {
      clicked.push(label);
      if (label === 'WFH Clock-out') { stage = 'confirming'; ticks = 0; }
      else if (label === 'Clock-out') { stage = 'saving'; ticks = 0; }
      else if (label === 'Cancel') { stage = 'loading'; ticks = 99; }
    },
  };
  const wait = async () => { ticks += 1; };
  return { dom, wait, clicked };
}

test('clicks WFH Clock-out, then the Clock-out confirm (never Cancel), and sees WFH Clock-In', async () => {
  const k = fakeKeka();
  const reports = [];
  const res = await clockOut(k.dom, { wait: k.wait, report: r => reports.push(r) });
  assert.deepEqual(res, { result: 'done' });
  assert.deepEqual(k.clicked, ['WFH Clock-out', 'Clock-out']);
  assert.deepEqual(reports, [{ result: 'clicked' }]);
});

test('already clocked out: clicks nothing', async () => {
  const k = fakeKeka({ start: 'out' });
  assert.deepEqual(await clockOut(k.dom, { wait: k.wait }), { result: 'already-out' });
  assert.deepEqual(k.clicked, []);
});

test('signed out of Keka (no Actions card): gives up without clicking', async () => {
  const k = fakeKeka({ signedOut: true });
  const res = await clockOut(k.dom, { wait: k.wait, step: 500, timeouts: { card: 3000, confirm: 1000, done: 1000 } });
  assert.deepEqual(res, { result: 'failed', reason: 'no-clock-out-button' });
  assert.deepEqual(k.clicked, []);
});

test('unexpected confirm step: stops after the first click', async () => {
  const k = fakeKeka({ confirmLabel: 'Submit' });
  const res = await clockOut(k.dom, { wait: k.wait, step: 500, timeouts: { card: 3000, confirm: 2000, done: 1000 } });
  assert.deepEqual(res, { result: 'failed', reason: 'no-confirm-button' });
  assert.deepEqual(k.clicked, ['WFH Clock-out']);
});

test('confirmed but Keka is slow to show WFH Clock-In: "clicked" (the worker waits for Keka\'s response)', async () => {
  const k = fakeKeka({ doneSteps: 99 });
  const res = await clockOut(k.dom, { wait: k.wait, step: 500, timeouts: { card: 3000, confirm: 2000, done: 2000 } });
  assert.deepEqual(res, { result: 'clicked' });
  assert.deepEqual(k.clicked, ['WFH Clock-out', 'Clock-out']);
});

test('gives up on real elapsed time too (laptop slept mid-run), not just poll count', async () => {
  const k = fakeKeka({ signedOut: true });
  let t = 0;
  // Each poll "takes" 20 s of wall-clock time (e.g. the machine was asleep).
  const res = await clockOut(k.dom, { wait: async () => { t += 20000; }, step: 1000, clock: () => t, timeouts: { card: 45000, confirm: 10000, done: 20000 } });
  assert.deepEqual(res, { result: 'failed', reason: 'no-clock-out-button' });
  assert.ok(t <= 60000, `stopped after ~${t / 1000}s of real time, not 45 polls`);
});
