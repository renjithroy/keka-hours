/*
 * Widget rendering. Lives in a Shadow DOM under a single
 * <keka-hours-widget id="keka-hours-extension"> host, so Keka's CSS can't
 * leak in and ours can't leak out. Rendering only — no parsing/calculation.
 */
(function (root) {
  'use strict';

  const fmt = root.KekaHours.format;
  const HOST_ID = 'keka-hours-extension';

  const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_MIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
.root {
  --bg: #ffffff;
  --text: #0f172a;
  --muted: #475569;
  --subtle: #64748b;
  --line: #e9eef4;
  --surface: #f6f8fb;
  /* Brand accents follow Keka's theme (--kh-* are set on the host from
     Keka's --primary-color / --primary-color-light). Status colours below
     (good = >= 9h, warn = < 9h) stay fixed because they carry meaning. */
  --brand: var(--kh-primary, #1f9d6b);
  --brand-soft: var(--kh-primary-light, #e7f6ef);
  --brand-text: color-mix(in srgb, var(--brand) 72%, #000);
  --brand-line: color-mix(in srgb, var(--brand) 50%, #fff);
  --good: #15803d;
  --good-soft: #e8f6ee;
  --warn: #b45309;
  --warn-soft: #fdf3e6;
  --shadow: 0 1px 2px rgba(15, 23, 42, .06), 0 10px 30px -6px rgba(15, 23, 42, .18);
  font-family: Inter, "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14.5px;
  line-height: 1.4;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
  text-align: left;
}
button { font: inherit; color: inherit; background: none; border: 0; margin: 0; padding: 0; cursor: pointer; }
svg { width: 100%; height: 100%; display: block; }
[hidden] { display: none !important; }

/* ---------- minimized pill ---------- */
.pill {
  display: flex; align-items: center; gap: 10px;
  width: 290px; max-width: calc(100vw - 24px);
  padding: 9px 10px 9px 9px;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow);
  transition: transform .16s cubic-bezier(.2,.8,.2,1), box-shadow .16s ease, border-color .16s ease;
  animation: kh-fade .18s cubic-bezier(.2,.8,.2,1);
}
.pill:hover { transform: translateY(-1px); border-color: #dbe3ec; box-shadow: 0 2px 4px rgba(15,23,42,.06), 0 14px 34px -8px rgba(15,23,42,.24); }
.pill:focus-visible, .icon-btn:focus-visible, .tab:focus-visible, .cal-cell:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.badge-icon {
  flex: none; width: 30px; height: 30px; padding: 6px;
  border-radius: 9px; color: var(--brand); background: var(--brand-soft);
}
.pill-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pill-title { font-size: 14px; font-weight: 600; letter-spacing: -.005em; white-space: nowrap; }
.pill-sub { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pill-value { display: flex; align-items: center; gap: 6px; font-size: 16.5px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap; }
.pill-value.muted { font-size: 13.5px; font-weight: 500; color: var(--muted); }
.chev { flex: none; width: 16px; height: 16px; color: var(--subtle); transition: transform .16s ease, color .16s ease; }
.pill:hover .chev { color: var(--muted); transform: translateX(1px); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--subtle); flex: none; }
.dot.good { background: #22a05b; }
.dot.warn { background: #e08a1e; }
.dot.pulse { animation: kh-pulse 1.2s ease-in-out infinite; }

/* ---------- expanded panel ---------- */
.panel {
  width: 424px; max-width: calc(100vw - 24px);
  max-height: calc(100vh - 32px); overflow-y: auto; overflow-x: hidden;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(15,23,42,.06), 0 24px 60px -12px rgba(15,23,42,.28);
  transform-origin: bottom right;
  animation: kh-in .19s cubic-bezier(.2,.8,.2,1);
}
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 18px 14px 22px; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.title { font-size: 15px; font-weight: 600; letter-spacing: -.005em; }
.month { font-size: 12.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.icon-btn { flex: none; width: 30px; height: 30px; padding: 6px; border-radius: 8px; color: var(--muted); transition: background .14s ease, color .14s ease; }
.icon-btn:hover { background: var(--surface); color: var(--text); }

.content { padding: 2px 22px 6px; }
/* Both tabs share one grid cell, so the card is always as tall as the taller
   tab and switching never makes the (bottom-anchored) card jump. */
.panes { display: grid; }
.pane { grid-area: 1 / 1; min-width: 0; }
.pane.off { visibility: hidden; pointer-events: none; }
.pane[data-pane="overview"] { display: flex; flex-direction: column; }

/* ---------- daily chart (fills the space left by the taller Plan tab) ---------- */
.spark-section { flex: 1; display: flex; flex-direction: column; min-height: 92px; }
.spark-head { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--muted); }
.spark { position: relative; flex: 1; min-height: 48px; margin-top: 8px; padding-right: 24px; display: flex; align-items: flex-end; gap: 3px; }
.spark .bar { flex: 1 1 0; max-width: 18px; min-height: 3px; border-radius: 4px 4px 2px 2px; background: #9fd9b9; transition: background .14s ease; }
.spark .bar.warn { background: #f3c48a; }
.spark .bar:hover { background: #34b46d; }
.spark .bar.warn:hover { background: #e08a1e; }
.spark .line { position: absolute; left: 0; right: 0; border-top: 1.5px dashed #94a3b8; pointer-events: none; }
.spark .line span { position: absolute; right: 0; top: -7px; line-height: 12px; font-size: 11px; font-weight: 600; color: var(--subtle); background: var(--bg); padding-left: 4px; }
.spark-foot { display: flex; justify-content: space-between; margin-top: 5px; padding-right: 24px; font-size: 11.5px; color: var(--subtle); }
.hero { padding: 6px 0 16px; }
.eyebrow { font-size: 12.5px; font-weight: 500; color: var(--muted); }
.hero-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
.hero-value { font-size: 44px; line-height: 1.05; font-weight: 700; letter-spacing: -.035em; }
.chip { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: var(--surface); color: var(--muted); white-space: nowrap; transform: translateY(-6px); }
.chip.good { background: var(--good-soft); color: var(--good); }
.chip.warn { background: var(--warn-soft); color: var(--warn); }

.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tile { background: var(--surface); border-radius: 12px; padding: 10px 12px; min-width: 0; }
.tile-value { font-size: 18.5px; font-weight: 650; letter-spacing: -.015em; white-space: nowrap; }
.tile-value small { font-size: 13.5px; font-weight: 500; color: var(--muted); letter-spacing: 0; }
.tile-label { font-size: 12.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.section { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 26px; }
.row-label { color: var(--muted); }
.row-value { font-weight: 600; }
.row-value.good { color: var(--good); }
.row-value.warn { color: var(--warn); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mini-label { font-size: 12.5px; color: var(--muted); }
.mini-value { font-size: 16.5px; font-weight: 650; letter-spacing: -.01em; margin-top: 1px; }
.mini-sub { font-size: 12.5px; color: var(--subtle); }

.meter-head { display: flex; justify-content: space-between; font-size: 13.5px; color: var(--muted); }
.meter-head b { color: var(--text); font-weight: 650; margin-left: 4px; }
.meter { display: flex; gap: 3px; height: 6px; margin-top: 7px; }
.meter span { border-radius: 999px; min-width: 6px; }
.meter .above { background: #34b46d; }
.meter .below { background: #e6ebf1; }

.tags { display: flex; gap: 6px; }
.tag { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 999px; background: var(--surface); font-size: 12.5px; color: var(--muted); }
.tag b { color: var(--text); font-weight: 650; }

.note { margin-top: 12px; padding: 8px 10px; border-radius: 10px; background: var(--surface); font-size: 12.5px; color: var(--muted); }
.note b { color: var(--text); font-weight: 600; }

.waiting { padding: 6px 0 14px; }
.waiting .msg { margin-top: 10px; font-size: 13.5px; color: var(--muted); }
.skel { height: 40px; width: 150px; border-radius: 10px; background: linear-gradient(90deg, #eef2f6 0%, #f7f9fb 50%, #eef2f6 100%); background-size: 200% 100%; animation: kh-shimmer 1.3s linear infinite; }
.skel.sm { height: 52px; width: 100%; margin-top: 12px; }

/* ---------- tabs ---------- */
.tabs { position: relative; display: flex; margin: 0 22px 14px; padding: 3px; background: var(--surface); border-radius: 10px; }
/* White highlight that glides under the selected tab. */
.tab-ind { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 8px; background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.08), 0 0 0 1px rgba(15,23,42,.04); transition: transform .26s cubic-bezier(.3,.9,.3,1); }
.tabs[data-tab="plan"] .tab-ind { transform: translateX(100%); }
.tab { position: relative; z-index: 1; flex: 1; height: 31px; border-radius: 8px; font-size: 14px; font-weight: 600; color: var(--muted); transition: color .2s ease; }
.tab:hover { color: var(--text); }
.tab[aria-selected="true"] { color: var(--brand-text); }

/* ---------- plan ---------- */
.plan-sub { margin-top: 6px; font-size: 13.5px; color: var(--muted); }
.plan-sub b { color: var(--text); font-weight: 600; }
.hero-value.word { font-size: 34px; }
.today-strip { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 12px; border-radius: 11px; background: var(--brand-soft); font-size: 13.5px; color: var(--brand-text); }
.today-strip .tdot { width: 7px; height: 7px; border-radius: 50%; background: var(--brand); flex: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent); }
.today-strip b { font-weight: 700; }
.cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; }
.cal-h { padding-bottom: 2px; font-size: 11.5px; font-weight: 600; color: var(--subtle); text-align: center; }
.cal-cell { position: relative; height: 48px; min-width: 0; border-radius: 9px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--text); transition: transform .12s ease, border-color .12s ease, background .12s ease; }
.cal-d { font-size: 13.5px; font-weight: 600; line-height: 1; }
.cal-v { font-size: 10.5px; line-height: 1; color: var(--muted); white-space: nowrap; }
.s-worked.good { background: var(--good-soft); }
.s-worked.good .cal-v { color: var(--good); font-weight: 600; }
.s-worked.warn { background: var(--warn-soft); }
.s-worked.warn .cal-v { color: var(--warn); font-weight: 600; }
.s-wfh, .s-leave { background: var(--surface); }
.s-off, .s-holiday, .s-none, .s-absent { color: var(--subtle); }
.s-off .cal-v, .s-holiday .cal-v, .s-absent .cal-v { color: var(--subtle); }
.s-plan-office { border: 1.5px dashed var(--brand-line); background: #fff; }
.s-plan-office .cal-v { color: var(--brand-text); font-weight: 700; }
.s-plan-away { color: var(--subtle); background: repeating-linear-gradient(135deg, #f4f6f9 0 4px, #fff 4px 8px); border: 1.5px solid transparent; }
button.cal-cell:hover { transform: translateY(-1px); border-color: var(--brand); border-style: solid; }
.cal-cell.today::after { content: ""; position: absolute; inset: -3px; border: 2px solid var(--text); border-radius: 11px; pointer-events: none; }
.cal-cell.overridden::before { content: ""; position: absolute; top: 4px; right: 4px; width: 5px; height: 5px; border-radius: 50%; background: #e08a1e; }
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 10px; font-size: 12px; color: var(--muted); }
.legend i { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 3px; vertical-align: -1px; }
.legend .lw { background: var(--good-soft); box-shadow: inset 0 0 0 1px #bfe5cf; }
.legend .lu { background: var(--warn-soft); box-shadow: inset 0 0 0 1px #f2d3ad; }
.legend .lx { background: var(--surface); box-shadow: inset 0 0 0 1px #e1e7ee; }
.legend .lp { border: 1.5px dashed var(--brand-line); }
.legend .la { background: repeating-linear-gradient(135deg, #e9edf2 0 2px, #fff 2px 4px); box-shadow: inset 0 0 0 1px #e1e7ee; }
.legend .hint { flex-basis: 100%; color: var(--subtle); }

.foot { display: flex; justify-content: space-between; gap: 12px; margin-top: 16px; padding: 12px 22px 14px; border-top: 1px solid var(--line); font-size: 12px; color: var(--subtle); }
.foot span:last-child { text-align: right; }

@keyframes kh-in { from { opacity: 0; transform: translateY(4px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes kh-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes kh-pulse { 50% { opacity: .35; } }
@keyframes kh-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
@media (max-width: 480px) {
  .hero-value { font-size: 38px; } .cal-cell { height: 44px; }
  .head { padding: 16px 14px 12px 16px; } .content { padding: 2px 16px 6px; } .tabs { margin: 0 16px 12px; } .foot { padding: 12px 16px 14px; }
}
`;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function tone(summary) {
    if (!summary || summary.averageMinutes == null) return '';
    return summary.deltaMinutesPerDay >= 0 ? 'good' : 'warn';
  }

  function precisionText(p) {
    if (p === 'precise') return 'Exact punch times';
    if (p === 'mixed') return 'Partly from displayed hours';
    if (p === 'display-rounded') return 'Based on displayed Keka hours';
    return '';
  }


  const WEEK_HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  function overviewHtml(s) {
    const t = tone(s);
    const worked = [];
    if (s.workedHolidays) worked.push(`${s.workedHolidays} holiday${s.workedHolidays > 1 ? 's' : ''}`);
    if (s.workedWeeklyOffs) worked.push(`${s.workedWeeklyOffs} week-off${s.workedWeeklyOffs > 1 ? 's' : ''}`);
    if (s.halfLeaveDays) worked.push(`${s.halfLeaveDays} half-day${s.halfLeaveDays > 1 ? 's' : ''}`);
    const trackedLabel = worked.length ? `Tracked · incl. ${worked.join(', ')}` : 'Tracked';
    const total = s.daysAtOrAboveTarget + s.daysBelowTarget;
    const pct = total ? (s.daysAtOrAboveTarget / total) * 100 : 0;
    const target = fmt.duration(s.targetMinutes).replace(' 00m', '');
    const d = s.deltaMinutesPerDay;

    return `
      <div class="hero">
        <div class="eyebrow">Average gross hours / day</div>
        <div class="hero-row">
          <span class="hero-value">${fmt.duration(s.averageMinutes)}</span>
          ${d == null ? '' : `<span class="chip ${t}">${d === 0 ? `On ${target}` : `${fmt.delta(d)} vs ${target}`}</span>`}
        </div>
      </div>

      <div class="tiles">
        <div class="tile"><div class="tile-value">${fmt.duration(s.totalMinutes)}</div><div class="tile-label">Total</div></div>
        <div class="tile"><div class="tile-value">${s.trackedDays} <small>${s.trackedDays === 1 ? 'day' : 'days'}</small></div><div class="tile-label" title="${esc(trackedLabel)}">${esc(trackedLabel)}</div></div>
      </div>

      ${s.trackedDays ? `
      <div class="section pair">
        <div><div class="mini-label">Longest</div><div class="mini-value">${fmt.duration(s.longestDay.grossMinutes)}</div><div class="mini-sub">${fmt.dayDate(s.longestDay.date)}</div></div>
        <div><div class="mini-label">Shortest</div><div class="mini-value">${fmt.duration(s.shortestDay.grossMinutes)}</div><div class="mini-sub">${fmt.dayDate(s.shortestDay.date)}</div></div>
      </div>

      <div class="section">
        <div class="meter-head"><span>≥ ${target}<b>${s.daysAtOrAboveTarget}</b></span><span>&lt; ${target}<b>${s.daysBelowTarget}</b></span></div>
        <div class="meter" role="img" aria-label="${s.daysAtOrAboveTarget} of ${total} days at or above ${target}">
          ${s.daysAtOrAboveTarget ? `<span class="above" style="flex:${pct}"></span>` : ''}
          ${s.daysBelowTarget ? `<span class="below" style="flex:${100 - pct}"></span>` : ''}
        </div>
      </div>` : ''}

      ${sparkHtml(s)}

      <div class="section row">
        <span class="row-label">Not counted</span>
        <span class="tags"><span class="tag">WFH <b>${s.wfhDays}</b></span><span class="tag">Leave <b>${s.leaveDays}</b></span></span>
      </div>
      ${s.pendingToday ? `<div class="note">Today <b>${fmt.duration(s.pendingToday.grossMinutes)}</b> so far — counted once you clock out.</div>` : ''}`;
  }

  /** Bar per counted day vs the 9h line. Scale starts at 5h so differences are visible. */
  function sparkHtml(s) {
    const days = s.includedDays || [];
    if (!days.length) return '';
    const lo = 5 * 60;
    const hi = Math.max(11 * 60, ...days.map(d => d.grossMinutes));
    const y = min => Math.max(0, Math.min(100, ((min - lo) / (hi - lo)) * 100));
    const target = fmt.duration(s.targetMinutes).replace(' 00m', '');
    const bars = days.map(d => {
      const warn = d.grossMinutes < s.targetMinutes;
      const title = `${fmt.dayDate(d.date)} · ${fmt.duration(d.grossMinutes)}`;
      return `<span class="bar${warn ? ' warn' : ''}" style="height:${Math.max(4, y(d.grossMinutes)).toFixed(1)}%" title="${esc(title)}"></span>`;
    }).join('');
    const first = fmt.dayDate(days[0].date).split(', ')[1];
    const last = fmt.dayDate(days[days.length - 1].date).split(', ')[1];
    return `
      <div class="section spark-section">
        <div class="spark-head"><span>Daily hours</span><span>${days.length} day${days.length === 1 ? '' : 's'}</span></div>
        <div class="spark" role="img" aria-label="Daily hours: ${s.daysAtOrAboveTarget} days at or above ${target}, ${s.daysBelowTarget} below">
          ${bars}
          <div class="line" style="bottom:${y(s.targetMinutes).toFixed(1)}%"><span>${target}</span></div>
        </div>
        <div class="spark-foot"><span>${esc(first)}</span><span>${days.length > 1 ? esc(last) : ''}</span></div>
      </div>`;
  }

  function planHeroHtml(p) {
    const month = fmt.monthName(p.monthKey);
    const target = fmt.duration(p.targetMinutes).replace(' 00m', '');
    const days = n => `${n} office day${n === 1 ? '' : 's'}`;
    const soFar = p.countedDays
      ? `So far <b>${fmt.duration(p.currentAverage)}</b> avg over ${p.countedDays} day${p.countedDays === 1 ? '' : 's'}.`
      : 'No office days counted yet.';

    if (p.status === 'complete') {
      const ok = p.currentAverage != null && p.currentAverage >= p.targetMinutes;
      return `
        <div class="hero">
          <div class="eyebrow">${esc(month)} finished at</div>
          <div class="hero-row"><span class="hero-value">${fmt.duration(p.currentAverage)}</span>
            ${p.currentAverage == null ? '' : `<span class="chip ${ok ? 'good' : 'warn'}">${ok ? `≥ ${target}` : `${fmt.delta(p.currentAverage - p.targetMinutes)} vs ${target}`}</span>`}</div>
          <div class="plan-sub">Over ${days(p.countedDays)}. Open <b>30 DAYS</b> to plan the current month.</div>
        </div>`;
    }
    if (p.status === 'no-days') {
      return `
        <div class="hero">
          <div class="eyebrow">No office days left in ${esc(month)}</div>
          <div class="hero-row"><span class="hero-value">${fmt.duration(p.currentAverage)}</span></div>
          <div class="plan-sub">${soFar} Tap a day below to add an office day.</div>
        </div>`;
    }
    if (p.status === 'secured') {
      return `
        <div class="hero">
          <div class="eyebrow">To end ${esc(month)} at ${target}+ average</div>
          <div class="hero-row"><span class="hero-value word">You're set</span><span class="chip good">${days(p.remainingDays)} left</span></div>
          <div class="plan-sub">${soFar} Any office time on the remaining days keeps ${esc(month)} at ${target} or above.</div>
        </div>`;
    }
    const hard = p.requiredPerDay > 12 * 60;
    const t = p.requiredPerDay <= p.targetMinutes ? 'good' : 'warn';
    return `
      <div class="hero">
        <div class="eyebrow">Sit on each remaining office day</div>
        <div class="hero-row"><span class="hero-value">${fmt.duration(p.requiredPerDay)}</span>
          <span class="chip ${hard ? 'warn' : t}">${hard ? 'Tough — check your away days' : `avg · ${days(p.remainingDays)}`}</span></div>
        <div class="plan-sub">${soFar} That's <b>${fmt.duration(p.neededMinutes)}</b> more to end ${esc(month)} at ${target}.</div>
      </div>`;
  }

  function todayHtml(p) {
    const td = p.today;
    if (!td || !td.planned || p.status !== 'needed') return '';
    let text;
    if (td.leaveAt) text = `Today · clock out after <b>${fmt.timeOfDay(td.leaveAt)}</b>`;
    else if (td.soFarMinutes) text = `Today · <b>${fmt.duration(td.soFarMinutes)}</b> so far, <b>${fmt.duration(td.moreMinutes)}</b> more`;
    else text = `Today · sit <b>${fmt.duration(p.requiredPerDay)}</b>`;
    return `<div class="today-strip"><span class="tdot"></span><span>${text}</span></div>`;
  }

  function cellHtml(c, p) {
    const cls = ['cal-cell', `s-${c.state}`];
    if (c.isToday) cls.push('today');
    if (c.overridden) cls.push('overridden');
    const label = fmt.dayDate(c.date);
    let value = '';
    let title = label;
    switch (c.state) {
      case 'worked':
        cls.push(c.minutes >= p.targetMinutes ? 'good' : 'warn');
        value = fmt.compact(c.minutes);
        title += ` · ${fmt.duration(c.minutes)}`;
        break;
      case 'wfh': value = 'WFH'; title += ' · WFH (not counted)'; break;
      case 'leave': value = 'Leave'; title += ' · Leave (not counted)'; break;
      case 'holiday': value = 'Hol'; title += ' · Holiday'; break;
      case 'absent': value = '—'; title += ' · No time'; break;
      case 'plan-office':
        value = p.status === 'needed' ? fmt.compact(p.requiredPerDay) : '•';
        title += ' · Office (tap to mark away)';
        break;
      case 'plan-away':
        value = c.reason || 'Away';
        title += ' · Not in office (tap to make it an office day)';
        break;
      default: break;
    }
    const inner = `<span class="cal-d">${c.day}</span><span class="cal-v">${esc(value)}</span>`;
    return c.state === 'plan-office' || c.state === 'plan-away'
      ? `<button class="${cls.join(' ')}" type="button" data-act="toggle" data-date="${c.date}" title="${esc(title)}" aria-label="${esc(title)}">${inner}</button>`
      : `<div class="${cls.join(' ')}" title="${esc(title)}">${inner}</div>`;
  }

  function planHtml(p) {
    if (!p) return '<div class="waiting"><div class="msg">Open a month (or <b>30 DAYS</b>) in the Attendance Log to plan.</div></div>';
    const blanks = Array.from({ length: p.firstWeekday }, () => '<div></div>').join('');
    const editable = p.cells.some(c => c.state === 'plan-office' || c.state === 'plan-away');
    const target = fmt.duration(p.targetMinutes).replace(' 00m', '');
    return `
      ${planHeroHtml(p)}
      ${todayHtml(p)}
      <div class="cal" role="grid" aria-label="${esc(fmt.monthName(p.monthKey))} plan">
        ${WEEK_HEAD.map(h => `<div class="cal-h">${h}</div>`).join('')}
        ${blanks}${p.cells.map(c => cellHtml(c, p)).join('')}
      </div>
      <div class="legend">
        <span><i class="lw"></i>≥ ${target}</span>
        <span><i class="lu"></i>&lt; ${target}</span>
        <span><i class="lx"></i>WFH / Leave</span>
        ${editable ? `<span><i class="lp"></i>Office (plan)</span><span><i class="la"></i>Away</span>
        <span class="hint">Tap an upcoming day to switch office ↔ away (WFH / leave / off)</span>` : ''}
      </div>`;
  }

  const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;

  /** Keka's current theme colours (from CSS variables on <html>), validated. */
  function readKekaTheme() {
    try {
      const cs = getComputedStyle(document.documentElement);
      const pick = name => {
        const v = cs.getPropertyValue(name).trim();
        return COLOR_RE.test(v) ? v : null;
      };
      return { primary: pick('--primary-color'), light: pick('--primary-color-light') };
    } catch (_) {
      return { primary: null, light: null };
    }
  }

  function createWidget(handlers) {
    let host = document.getElementById(HOST_ID);
    if (host && host.__kekaHours) return host.__kekaHours;
    if (host) host.remove(); // left over from a reloaded extension version

    host = document.createElement('keka-hours-widget');
    host.id = HOST_ID;
    const pin = (prop, value) => host.style.setProperty(prop, value, 'important');
    pin('position', 'fixed');
    pin('right', 'max(12px, min(20px, 2vw))');
    pin('bottom', 'max(12px, min(20px, 2vw))');
    pin('z-index', '2147483647');
    pin('display', 'none');

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${CSS}</style>
      <div class="root">
        <button class="pill" type="button" aria-expanded="false"></button>
        <section class="panel" role="dialog" aria-label="Keka Hours" hidden>
          <div class="head">
            <div class="brand">
              <span class="badge-icon">${ICON_CLOCK}</span>
              <div style="min-width:0"><div class="title">Keka Hours</div><div class="month"></div></div>
            </div>
            <button class="icon-btn" type="button" data-act="collapse" aria-label="Minimize" title="Minimize">${ICON_MIN}</button>
          </div>
          <div class="tabs" role="tablist" data-tab="overview" hidden>
            <span class="tab-ind" aria-hidden="true"></span>
            <button class="tab" type="button" role="tab" data-act="tab" data-tab="overview" aria-selected="true">Overview</button>
            <button class="tab" type="button" role="tab" data-act="tab" data-tab="plan" aria-selected="false">Plan</button>
          </div>
          <div class="content" role="tabpanel"></div>
          <div class="foot"><span class="updated"></span><span class="precision"></span></div>
        </section>
      </div>`;

    const $ = sel => shadow.querySelector(sel);
    const pill = $('.pill');
    const panel = $('.panel');
    const content = $('.content');
    const tabs = $('.tabs');

    let model = null;
    let expanded = false;
    let tab = 'overview';

    // Keep Keka's global keyboard shortcuts away from our widget.
    for (const type of ['keydown', 'keyup', 'keypress']) {
      host.addEventListener(type, e => {
        if (type === 'keydown' && e.key === 'Escape' && expanded) collapse(true);
        e.stopPropagation();
      });
    }

    // Click / tap anywhere outside the card collapses it back to the pill.
    document.addEventListener('pointerdown', e => {
      if (!expanded || !host.isConnected) return;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (!path.includes(host)) collapse(false);
    }, true);

    // detail === 0 => keyboard activation; only then move focus into the panel.
    pill.addEventListener('click', e => expand(e.detail === 0));
    shadow.addEventListener('click', e => {
      const el = e.target.closest && e.target.closest('[data-act]');
      if (!el) return;
      const act = el.getAttribute('data-act');
      if (act === 'collapse') collapse(e.detail === 0);
      else if (act === 'tab') {
        const next = el.getAttribute('data-tab');
        if (next !== tab) { const prev = tab; tab = next; showTab(prev); }
      }
      else if (act === 'toggle') handlers.onToggleDay(el.getAttribute('data-date'));
    });

    function expand(viaKeyboard) {
      if (expanded) return;
      expanded = true;
      handlers.onExpand(); // verifies freshness, then calls render()
      pill.hidden = true;
      pill.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      renderPanel();
      if (viaKeyboard) $('[data-act="collapse"]').focus({ preventScroll: true });
    }

    function collapse(viaKeyboard) {
      if (!expanded) return;
      expanded = false;
      panel.hidden = true;
      pill.hidden = false;
      pill.setAttribute('aria-expanded', 'false');
      if (viaKeyboard) pill.focus({ preventScroll: true });
    }

    function renderPill() {
      const m = model;
      const s = m.summary;
      let value;
      let sub;
      if (m.state === 'ok' && s && s.averageMinutes != null) {
        value = `<span class="dot ${tone(s)}"></span>${fmt.duration(s.averageMinutes)}`;
        sub = `Avg · ${esc(fmt.shortLabel(m.label))}`;
        pill.setAttribute('aria-label', `Keka Hours: ${fmt.duration(s.averageMinutes)} average per day, ${m.label}. Show details`);
      } else if (m.state === 'ok') {
        value = '—';
        sub = `No office days · ${esc(fmt.shortLabel(m.label))}`;
        pill.setAttribute('aria-label', `Keka Hours: no tracked office days in ${m.label}. Show details`);
      } else {
        value = `<span class="dot pulse"></span>${m.state === 'unavailable' ? 'Waiting' : 'Updating…'}`;
        sub = m.state === 'unavailable' ? 'Waiting for attendance' : esc(m.label ? fmt.shortLabel(m.label) : 'Reading attendance');
        pill.setAttribute('aria-label', 'Keka Hours: waiting for attendance data. Show details');
      }
      const valueClass = m.state === 'ok' ? 'pill-value' : 'pill-value muted';
      pill.innerHTML = `
        <span class="badge-icon">${ICON_CLOCK}</span>
        <span class="pill-text"><span class="pill-title">Keka Hours</span><span class="pill-sub">${sub}</span></span>
        <span class="${valueClass}">${value}</span>
        <span class="chev">${ICON_CHEVRON}</span>`;
    }

    function renderPanel() {
      if (!expanded || !model) return;
      const m = model;
      const s = m.summary;
      const ok = m.state === 'ok' && s;
      $('.month').textContent = ok && m.monthToDate && m.todayKey
        ? fmt.monthToDateRange(m.todayKey)
        : (m.label || 'Attendance');
      $('.updated').textContent = m.verifiedAt ? `Updated ${fmt.relative(m.verifiedAt)}` : '';
      $('.precision').textContent = ok ? precisionText(s.sourcePrecision) : '';
      tabs.hidden = !ok;
      for (const b of tabs.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));

      if (!ok) {
        content.innerHTML = `
          <div class="waiting">
            <div class="skel"></div>
            <div class="skel sm"></div>
            <div class="msg">${m.state === 'unavailable'
              ? 'Waiting for Keka attendance data. Open the <b>Attendance Log</b> list to calculate.'
              : 'Reading attendance…'}</div>
          </div>`;
        return;
      }
      content.innerHTML = `
        <div class="panes">
          <div class="pane" data-pane="overview">${overviewHtml(s)}</div>
          <div class="pane" data-pane="plan">${planHtml(m.plan)}</div>
        </div>`;
      showTab();
    }

    const TAB_ORDER = ['overview', 'plan'];
    const reduceMotion = () => {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
    };

    /**
     * Switch tabs without re-rendering: toggle visibility only. With `from`
     * (a user tab click) the panes animate: the old one fades/slides out, the
     * new one slides in from the side of the tab you moved to.
     */
    function showTab(from) {
      tabs.setAttribute('data-tab', tab);
      for (const b of tabs.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));
      const dir = from ? Math.sign(TAB_ORDER.indexOf(tab) - TAB_ORDER.indexOf(from)) || 1 : 0;
      const animate = dir !== 0 && typeof Element.prototype.animate === 'function' && !reduceMotion();

      for (const pane of content.querySelectorAll('.pane')) {
        const name = pane.getAttribute('data-pane');
        const on = name === tab;
        pane.getAnimations().forEach(a => a.cancel());
        pane.inert = !on; // hidden tab's buttons can't be focused
        if (on) pane.removeAttribute('aria-hidden'); else pane.setAttribute('aria-hidden', 'true');

        if (on) {
          pane.classList.remove('off');
          if (animate) {
            pane.animate([
              { opacity: 0, transform: `translateX(${dir * 18}px)` },
              { opacity: 1, transform: 'translateX(0)' },
            ], { duration: 260, delay: 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
          }
        } else if (animate && name === from) {
          // Keep it visible while it leaves, then hide.
          pane.classList.remove('off');
          pane.animate([
            { opacity: 1, transform: 'translateX(0)' },
            { opacity: 0, transform: `translateX(${-dir * 18}px)` },
          ], { duration: 160, easing: 'cubic-bezier(.4,0,1,1)' })
            .finished.then(() => { if (pane.getAttribute('data-pane') !== tab) pane.classList.add('off'); }).catch(() => {});
        } else {
          pane.classList.add('off');
        }
      }
    }

    function render(next) {
      model = next;
      if (!next.visible) {
        // Leaving the logs page: close and remove the widget entirely.
        collapse();
        host.remove();
        return;
      }
      host.style.setProperty('display', 'block', 'important');
      applyTheme();
      renderPill();
      renderPanel();
    }

    /** Match Keka's theme colour (green, pink, …); falls back to green. */
    function applyTheme() {
      const t = readKekaTheme();
      for (const [prop, value] of [['--kh-primary', t.primary], ['--kh-primary-light', t.light]]) {
        if (value) host.style.setProperty(prop, value); else host.style.removeProperty(prop);
      }
    }

    /** Cheap periodic refresh of the "Updated …" text only. */
    function tick() {
      if (expanded && model && model.verifiedAt) $('.updated').textContent = `Updated ${fmt.relative(model.verifiedAt)}`;
    }

    function mount() {
      if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
    }

    const api = { render, tick, mount, applyTheme, contains: node => host === node || host.contains(node), isExpanded: () => expanded, host };
    host.__kekaHours = api;
    return api;
  }

  root.KekaHours.ui = { createWidget, HOST_ID };
})(globalThis);
