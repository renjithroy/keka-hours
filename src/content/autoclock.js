/*
 * Auto clock-out: the two clicks a person makes on Keka's Actions card,
 *   "WFH Clock-out"  →  "Clock-out" (confirm; never "Cancel")
 * run only in the background tab the worker opened for it. Keka sends its own
 * request; we never build one or touch tokens. Exact-text matches only, so a
 * changed or unexpected UI stops it (and the worker falls back to a reminder).
 *
 * clockOut(dom, opts) with dom = { find(regex) -> element | null, click(el) }
 * resolves to { result: 'done' | 'clicked' | 'already-out' | 'failed', reason? }.
 */
(function (root) {
  'use strict';

  const WFH_OUT = /^wfh\s*clock[\s-]*out$/i;
  const CONFIRM = /^clock[\s-]*out$/i;
  const WFH_IN = /^wfh\s*clock[\s-]*in$/i;
  // 75 s worst case, inside the worker's 90 s limit. Steps of 1 s match how
  // often Chrome lets timers run in a background tab.
  const TIMEOUTS = { card: 45000, confirm: 10000, done: 20000 };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitFor(check, timeout, wait, step) {
    for (let waited = 0; ; waited += step) {
      const found = check();
      if (found) return found;
      if (waited >= timeout) return null;
      await wait(step);
    }
  }

  async function clockOut(dom, { wait = sleep, step = 1000, timeouts = TIMEOUTS, report = () => {} } = {}) {
    // Keka may still be loading (or show its sign-in page, where this never appears).
    const first = await waitFor(() => dom.find(WFH_OUT) || (dom.find(WFH_IN) ? 'already-out' : null), timeouts.card, wait, step);
    if (!first) return { result: 'failed', reason: 'no-clock-out-button' };
    if (first === 'already-out') return { result: 'already-out' };
    dom.click(first);

    const confirm = await waitFor(() => dom.find(CONFIRM), timeouts.confirm, wait, step);
    if (!confirm) return { result: 'failed', reason: 'no-confirm-button' };
    dom.click(confirm);
    report({ result: 'clicked' });

    // Keka swaps the buttons back to "WFH Clock-In" once it has recorded it.
    const done = await waitFor(() => dom.find(WFH_IN), timeouts.done, wait, step);
    return done ? { result: 'done' } : { result: 'clicked' };
  }

  /** The real page: buttons / links on Keka's Actions card, by exact text. */
  function kekaDom(doc) {
    return {
      find(re) {
        const card = doc.querySelector('employee-attendance-request-actions');
        if (!card) return null;
        return [...card.querySelectorAll('button, a')]
          .find(el => !el.disabled && re.test(String(el.textContent || '').replace(/\s+/g, ' ').trim())) || null;
      },
      click(el) { el.click(); },
    };
  }

  const api = { clockOut, kekaDom, WFH_OUT, CONFIRM, WFH_IN };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.KekaHours = root.KekaHours || {}).autoclock = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
