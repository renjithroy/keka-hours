/*
 * Auto clock-out: the two clicks a person makes on Keka's Actions card,
 *   "WFH Clock-out"  →  "Clock-out" (confirm; never "Cancel")
 * run only in the background tab the worker opened for it. Keka sends its own
 * request; we never build one or touch tokens. Exact-text matches only, so a
 * changed or unexpected UI stops it (and the worker falls back to a reminder).
 *
 * clockOut(dom, opts) with dom = { find(regex) -> element | null, click(el) }
 * resolves to { result: 'done' | 'clicked' | 'already-out' | 'failed' | 'cancelled', reason? }.
 * opts.beforeClick() -> false stops it before any click ('cancelled'): the
 * worker saw a newer clock-in in Keka's data, so this session isn't ours to end.
 * opts.show(): if a step stalls in the background tab, bring it to the front
 * once and wait again (Keka may not finish in a hidden tab). opts.trace(step)
 * records each step for diagnostics.
 */
(function (root) {
  'use strict';

  const WFH_OUT = /^wfh\s*clock[\s-]*out$/i;
  const CONFIRM = /^clock[\s-]*out$/i;
  const WFH_IN = /^wfh\s*clock[\s-]*in$/i;
  // 100 s worst case (one wait repeated once in front), inside the worker's
  // 150 s limit. Steps of 1 s match how often Chrome lets timers run in a
  // background tab.
  const TIMEOUTS = { card: 45000, confirm: 10000, done: 15000, shown: 30000 };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Poll `check` until it returns something or `timeout` passes. Time counts
   * both as polls made and as real time elapsed, so a laptop sleeping
   * mid-run (or a heavily throttled tab) still gives up on schedule.
   */
  async function waitFor(check, timeout, wait, step, clock) {
    const start = clock();
    for (let waited = 0; ; waited += step) {
      const found = check();
      if (found) return found;
      if (Math.max(waited, clock() - start) >= timeout) return null;
      await wait(step);
    }
  }

  async function clockOut(dom, { wait = sleep, step = 1000, timeouts = TIMEOUTS, report = () => {}, clock = () => Date.now(), beforeClick = null, show = null, trace = () => {} } = {}) {
    let shown = false;
    const until = async (check, timeout) => {
      const found = await waitFor(check, timeout, wait, step, clock);
      if (found || !show || shown) return found;
      // Stalled in the background: once, bring the tab to the front and wait again.
      shown = true;
      trace('shown');
      try { await show(); } catch (_) { /* best effort */ }
      return waitFor(check, timeouts.shown != null ? timeouts.shown : TIMEOUTS.shown, wait, step, clock);
    };
    // Keka may still be loading (or show its sign-in page, where this never appears).
    const first = await until(() => dom.find(WFH_OUT) || (dom.find(WFH_IN) ? 'already-out' : null), timeouts.card);
    if (!first) return { result: 'failed', reason: 'no-clock-out-button' };
    if (first === 'already-out') return { result: 'already-out' };
    trace('button');
    if (beforeClick && (await beforeClick()) === false) return { result: 'cancelled', reason: 'new-clock-in' };
    dom.click(first);
    trace('clicked-out');

    const confirm = await until(() => dom.find(CONFIRM), timeouts.confirm);
    if (!confirm) return { result: 'failed', reason: 'no-confirm-button' };
    dom.click(confirm);
    trace('clicked');
    report({ result: 'clicked' });

    // Keka swaps the buttons back to "WFH Clock-In" once it has recorded it.
    const done = await until(() => dom.find(WFH_IN), timeouts.done);
    return done ? { result: 'done' } : { result: 'clicked' };
  }

  /** The real page: buttons / links on Keka's Actions card, by exact text. */
  function kekaDom(doc) {
    return {
      /** The card's visible text, for the diagnostics trace when a run stalls. */
      text() {
        const card = doc.querySelector('employee-attendance-request-actions');
        return card ? String(card.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140) : '(no Actions card)';
      },
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
