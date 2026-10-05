/*
 * Controller: decides *when* to re-read Keka, keeps one summary state, and
 * hands it to the UI. Freshness is event-driven:
 *
 *   URL changes (hashchange, popstate, Navigation API, pushState via the
 *   page hook, href check on DOM mutations) -> route check + refresh
 *   MutationObserver (filtered)    -> debounced refresh (attendance area only)
 *   captured API records           -> refresh
 *   visibilitychange / focus       -> refresh
 *   expand click                   -> synchronous refresh before rendering
 *   60s timer (visible tab only)   -> safety net (midnight, missed events)
 *
 * Every refresh re-parses the (small) attendance table and compares a
 * signature; the UI only re-renders when the data actually changed.
 */
(function (root) {
  'use strict';

  const K = root.KekaHours;
  if (!K || K.__started) return;
  K.__started = true;

  const { parser, calculator, planner, settings, ui } = K;
  const CHANNEL = 'keka-hours-extension';
  // Shown only on Me → Attendance → Attendance Log.
  const ROUTE_RE = /^#\/me\/attendance\/logs\/?(\?.*)?$/i;
  const AREA_SELECTOR = 'employee-attendance-logs, employee-attendance-list-view';
  const DEBOUNCE_MS = 300;
  const MAX_WAIT_MS = 1200;
  const SAFETY_INTERVAL_MS = 60000;
  const UNAVAILABLE_AFTER_MS = 12000;

  const state = {
    targetMinutes: calculator.DEFAULT_TARGET, // fixed company standard: 9h 00m
    apiRecords: new Map(),
    apiVersion: 0,
    overrides: {}, // planner: { 'YYYY-MM': { date: 'office' | 'away' } }
    signature: null,
    model: { visible: false, state: 'loading', label: null, summary: null, verifiedAt: 0, targetMinutes: calculator.DEFAULT_TARGET },
    loadingSince: 0,
  };

  let widget = null;
  let observer = null;
  let themeObserver = null;
  let debounceTimer = null;
  let firstPendingAt = 0;
  let intervalId = null;
  let stopped = false;

  const alive = () => {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; }
  };

  const onRoute = () => ROUTE_RE.test(location.hash || '');
  let lastHref = location.href;

  /** Any URL change: hide immediately when leaving the logs page, refresh when arriving. */
  function onUrlChange() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    refresh();
  }

  function render() {
    if (!widget) return;
    if (state.model.visible) widget.mount();
    widget.render(state.model);
  }

  /** Re-read Keka and recompute if anything relevant changed. Never throws. */
  function refresh() {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    firstPendingAt = 0;
    if (stopped || !widget) return;
    if (!alive()) { teardown(); return; }
    lastHref = location.href;

    try {
      if (!onRoute()) {
        if (state.model.visible) {
          state.model = { ...state.model, visible: false };
          state.signature = null;
          render();
        }
        return;
      }

      const now = new Date();
      const view = parser.buildView(parser.snapshot(document), state.apiRecords, {
        today: now,
        todayKey: parser.localDateKey(now),
      });
      const todayKey = parser.localDateKey(now);
      const monthOverrides = (view.monthKey && state.overrides[view.monthKey]) || {};
      const sig = `${parser.signature(view)}#${todayKey}#${state.apiVersion}#${JSON.stringify(monthOverrides)}`;
      const verifiedAt = Date.now();

      if (view.status === 'ok') {
        state.loadingSince = 0;
        if (sig !== state.signature || !state.model.visible) {
          state.signature = sig;
          state.model = {
            visible: true,
            state: 'ok',
            label: view.label,
            monthToDate: !!view.monthToDate,
            todayKey,
            monthKey: view.monthKey || null,
            summary: calculator.calculateSummary(view.days, state.targetMinutes),
            plan: view.monthKey ? planner.planMonth({
              monthKey: view.monthKey,
              todayKey,
              days: view.days,
              dayTypes: dayTypes(view.monthKey),
              overrides: monthOverrides,
              targetMinutes: state.targetMinutes,
            }) : null,
            verifiedAt,
            targetMinutes: state.targetMinutes,
          };
          render();
        } else {
          state.model.verifiedAt = verifiedAt;
          widget.tick();
        }
        return;
      }

      // Loading: never keep showing a previous month's numbers.
      if (!state.loadingSince) state.loadingSince = verifiedAt;
      const phase = verifiedAt - state.loadingSince > UNAVAILABLE_AFTER_MS ? 'unavailable' : 'loading';
      const loadingSig = `${sig}|${phase}`;
      if (loadingSig !== state.signature || !state.model.visible) {
        state.signature = loadingSig;
        state.model = { visible: true, state: phase, label: view.label, summary: null, verifiedAt: 0, targetMinutes: state.targetMinutes };
        render();
      }
      // Re-check soon; Keka is usually mid-render.
      if (phase === 'loading') schedule(500);
    } catch (err) {
      // Never break Keka; show a safe state and try again later.
      state.signature = null;
      state.model = { visible: onRoute(), state: 'unavailable', label: null, summary: null, verifiedAt: 0, targetMinutes: state.targetMinutes };
      try { render(); } catch (_) { /* ignore */ }
      schedule(2000);
    }
  }

  /** Keka's day types (holiday / weekly-off) for a month, incl. future days if Keka sent them. */
  function dayTypes(monthKey) {
    const map = new Map();
    for (const [date, r] of state.apiRecords) {
      if (date.slice(0, 7) === monthKey && typeof r.dayType === 'number') map.set(date, r.dayType);
    }
    return map;
  }

  async function toggleDay(date) {
    const plan = state.model.plan;
    const cell = plan && plan.cells.find(c => c.date === date);
    if (!cell || (cell.state !== 'plan-office' && cell.state !== 'plan-away')) return;
    const monthKey = date.slice(0, 7);
    const month = { ...(state.overrides[monthKey] || {}) };
    const next = cell.state === 'plan-office' ? 'away' : 'office';
    // Store only deviations from the default; flipping back clears the override.
    if (cell.overridden) delete month[date]; else month[date] = next;
    state.overrides = { ...state.overrides, [monthKey]: month };
    refresh();
    state.overrides = await settings.saveOverrides(state.overrides);
  }

  /** Trailing debounce with a max wait so constant DOM churn can't starve updates. */
  function schedule(delay = DEBOUNCE_MS) {
    if (stopped) return;
    const now = Date.now();
    if (!firstPendingAt) firstPendingAt = now;
    const wait = Math.min(delay, Math.max(0, firstPendingAt + MAX_WAIT_MS - now));
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, wait);
  }

  function isInArea(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest && el.closest(AREA_SELECTOR));
  }

  function touchesArea(node) {
    return node && node.nodeType === 1 &&
      (node.matches(AREA_SELECTOR) || !!node.querySelector(AREA_SELECTOR));
  }

  function onMutations(mutations) {
    // SPA navigations always mutate the DOM; catch URL changes no event reported.
    if (location.href !== lastHref) { onUrlChange(); return; }
    if (!onRoute()) return;
    // Until the attendance component exists, any structural change may be it arriving.
    const areaMissing = !document.querySelector('employee-attendance-logs');
    for (const m of mutations) {
      if (widget && widget.contains(m.target)) continue;
      if (areaMissing && m.type === 'childList') { schedule(); return; }
      if (isInArea(m.target)) { schedule(); return; }
      if (m.type === 'childList') {
        for (const n of m.addedNodes) if (touchesArea(n)) { schedule(); return; }
        for (const n of m.removedNodes) if (touchesArea(n)) { schedule(); return; }
      }
    }
  }

  function onMessage(event) {
    if (event.source !== window || !event.data || event.data.source !== CHANNEL) return;
    if (event.data.type === 'route-change') { onUrlChange(); return; }
    if (event.data.type !== 'attendance-records' || !Array.isArray(event.data.records)) return;
    let changed = false;
    for (const r of event.data.records) {
      if (!r || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
      state.apiRecords.set(r.date, r);
      changed = true;
    }
    if (changed) { state.apiVersion += 1; schedule(50); }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') refresh();
  }

  function teardown() {
    stopped = true;
    if (observer) observer.disconnect();
    if (themeObserver) themeObserver.disconnect();
    clearTimeout(debounceTimer);
    clearInterval(intervalId);
    window.removeEventListener('hashchange', onUrlChange);
    window.removeEventListener('popstate', onUrlChange);
    try { window.navigation.removeEventListener('currententrychange', onUrlChange); } catch (_) {}
    window.removeEventListener('focus', refresh);
    window.removeEventListener('message', onMessage);
    document.removeEventListener('visibilitychange', onVisible);
    if (widget && widget.host) widget.host.remove();
  }

  async function start() {
    state.overrides = await settings.loadOverrides();
    if (stopped) return;

    widget = ui.createWidget({
      onExpand: refresh,
      onToggleDay: toggleDay,
    });

    settings.onChange(next => {
      state.overrides = next;
      refresh();
    });

    // Keka switches theme by changing <html>'s class / inline CSS variables.
    themeObserver = new MutationObserver(() => widget.applyTheme());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

    observer = new MutationObserver(onMutations);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });

    window.addEventListener('hashchange', onUrlChange);
    window.addEventListener('popstate', onUrlChange);
    try { window.navigation.addEventListener('currententrychange', onUrlChange); } catch (_) { /* older Chrome */ }
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);

    intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && onRoute()) refresh();
    }, SAFETY_INTERVAL_MS);

    refresh();
  }

  // Listen for captured API data immediately, then ask the page hook to replay
  // anything it captured before this script loaded.
  window.addEventListener('message', onMessage);
  window.postMessage({ source: CHANNEL, type: 'replay-request' }, location.origin);

  start().catch(() => { /* never surface errors into Keka */ });
})(globalThis);
