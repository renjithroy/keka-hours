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
  const ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

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
     Keka's --primary-color; the soft tint is mixed from it rather than read
     from Keka's own light colour, which can be dark). Status colours below
     (good = >= 9h, warn = < 9h) stay fixed because they carry meaning. */
  --brand: var(--kh-primary, #1f9d6b);
  --brand-soft: color-mix(in srgb, var(--brand) 12%, var(--bg));
  --brand-text: color-mix(in srgb, var(--brand) 72%, #000);
  --brand-line: color-mix(in srgb, var(--brand) 50%, #fff);
  --good: #15803d;
  --good-soft: #e8f6ee;
  --warn: #b45309;
  --warn-soft: #fdf3e6;
  --shadow: 0 1px 2px rgba(15, 23, 42, .06), 0 10px 30px -6px rgba(15, 23, 42, .18);
  --shadow-hover: 0 2px 4px rgba(15,23,42,.06), 0 14px 34px -8px rgba(15,23,42,.24);
  --shadow-panel: 0 2px 6px rgba(15,23,42,.06), 0 24px 60px -12px rgba(15,23,42,.28);
  --line-hover: #dbe3ec;
  --dot-good: #22a05b;
  --dot-warn: #e08a1e;
  --bar: #9fd9b9;
  --bar-warn: #f3c48a;
  --bar-hover: #34b46d;
  --bar-warn-hover: #e08a1e;
  --wfh-a: #d5dce5;
  --wfh-b: #edf1f5;
  --wfh-hover-a: #b9c3cf;
  --wfh-hover-b: #e3e8ee;
  --stub: #e3e8ee;
  --stub-hover: #cbd3dd;
  --guide: #94a3b8;
  --skel-a: #eef2f6;
  --skel-b: #f7f9fb;
  --tab-ind: #fff;
  --tab-ind-shadow: 0 1px 2px rgba(15,23,42,.08), 0 0 0 1px rgba(15,23,42,.04);
  --meter-on: #34b46d;
  --meter-off: #e6ebf1;
  --plan-bg: #fff;
  --away-a: #f4f6f9;
  --away-b: #fff;
  --legend-good: #bfe5cf;
  --legend-warn: #f2d3ad;
  --legend-neutral: #e1e7ee;
  --legend-away-a: #e9edf2;
  --legend-away-b: #fff;
  font-family: Inter, "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14.5px;
  line-height: 1.4;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
  text-align: left;
}
.root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #161b22;
  --text: #e6edf3;
  --muted: #a7b1bd;
  --subtle: #8793a1;
  --line: #2a323c;
  --surface: #1f262f;
  --brand-soft: color-mix(in srgb, var(--brand) 18%, var(--bg));
  --brand-text: color-mix(in srgb, var(--brand) 60%, #fff);
  --brand-line: color-mix(in srgb, var(--brand) 55%, #000);
  --good: #4ade80;
  --good-soft: #14301f;
  --warn: #fbbf24;
  --warn-soft: #382a12;
  --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 10px 30px -6px rgba(0, 0, 0, .6);
  --shadow-hover: 0 2px 4px rgba(0,0,0,.4), 0 14px 34px -8px rgba(0,0,0,.7);
  --shadow-panel: 0 2px 6px rgba(0,0,0,.4), 0 24px 60px -12px rgba(0,0,0,.75);
  --line-hover: #3a4552;
  --dot-good: #3fb97a;
  --dot-warn: #e6a23c;
  --bar: #2f7a54;
  --bar-warn: #9a6a2e;
  --bar-hover: #4ade80;
  --bar-warn-hover: #fbbf24;
  --wfh-a: #38424f;
  --wfh-b: #232a33;
  --wfh-hover-a: #4b5766;
  --wfh-hover-b: #2c353f;
  --stub: #2f3944;
  --stub-hover: #43505e;
  --guide: #6b7785;
  --skel-a: #1f262f;
  --skel-b: #2a323c;
  --tab-ind: #2e3743;
  --tab-ind-shadow: 0 1px 2px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.04);
  --meter-on: #3fb97a;
  --meter-off: #2f3944;
  --plan-bg: var(--bg);
  --away-a: #232a33;
  --away-b: #161b22;
  --legend-good: #276846;
  --legend-warn: #7a5524;
  --legend-neutral: #38424f;
  --legend-away-a: #38424f;
  --legend-away-b: #161b22;
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
.pill:hover { transform: translateY(-1px); border-color: var(--line-hover); box-shadow: var(--shadow-hover); }
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
.dot.good { background: var(--dot-good); }
.dot.warn { background: var(--dot-warn); }
.dot.pulse { animation: kh-pulse 1.2s ease-in-out infinite; }

/* ---------- expanded panel ---------- */
.panel {
  width: 424px; max-width: calc(100vw - 24px);
  max-height: calc(100vh - 32px); overflow-y: auto; overflow-x: hidden;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: var(--shadow-panel);
  transform-origin: bottom right;
  animation: kh-in .19s cubic-bezier(.2,.8,.2,1);
}
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 18px 14px 22px; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.title { font-size: 15px; font-weight: 600; letter-spacing: -.005em; }
.month { font-size: 12.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.icon-btn { flex: none; width: 30px; height: 30px; padding: 6px; border-radius: 8px; color: var(--muted); transition: background .14s ease, color .14s ease; }
.icon-btn:hover { background: var(--surface); color: var(--text); }
.head-actions { display: flex; align-items: center; gap: 2px; flex: none; }

.content { padding: 2px 22px 22px; }
/* Both tabs share one grid cell, so the card is always as tall as the taller
   tab and switching never makes the (bottom-anchored) card jump. */
.panes { display: grid; }
.pane { grid-area: 1 / 1; min-width: 0; }
.pane.off { visibility: hidden; pointer-events: none; }
.pane[data-pane="overview"] { display: flex; flex-direction: column; }

/* ---------- daily chart (fills the space left by the taller Plan tab) ---------- */
.spark-section { flex: 1; display: flex; flex-direction: column; }
.spark-head { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--muted); }
.spark { position: relative; flex: 1; min-height: 64px; max-height: 96px; margin-top: 8px; padding-right: 24px; display: flex; align-items: flex-end; gap: 3px; }
.spark .bar { flex: 1 1 0; max-width: 18px; min-height: 3px; border-radius: 4px 4px 2px 2px; background: var(--bar); transition: background .14s ease; }
.spark .bar.warn { background: var(--bar-warn); }
.spark .bar:hover { background: var(--bar-hover); }
.spark .bar.warn:hover { background: var(--bar-warn-hover); }
.spark.dense { gap: 2px; }
.spark .bar.wfh { background: repeating-linear-gradient(135deg, var(--wfh-a) 0 3px, var(--wfh-b) 3px 6px); }
.spark .bar.wfh:hover { background: repeating-linear-gradient(135deg, var(--wfh-hover-a) 0 3px, var(--wfh-hover-b) 3px 6px); }
.spark .bar.stub { height: 5px; flex: 1 1 0; min-height: 0; border-radius: 2px; background: var(--stub); }
.spark .bar.stub:hover { background: var(--stub-hover); }
.spark .bar.live { background: transparent; box-shadow: inset 0 0 0 1.5px var(--brand-line); }
.spark .bar.live:hover { background: var(--brand-soft); }
.spark .line { position: absolute; left: 0; right: 0; border-top: 1.5px dashed var(--guide); pointer-events: none; }
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
.tiles.excluded { margin-top: 14px; }
.tiles.excluded .tile { padding: 8px 12px; }
.tiles.excluded .tile-value { font-size: 16px; }

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
.meter .above { background: var(--meter-on); }
.meter .below { background: var(--meter-off); }

.tags { display: flex; gap: 6px; }
.tag { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 999px; background: var(--surface); font-size: 12.5px; color: var(--muted); }
.tag b { color: var(--text); font-weight: 650; }

.note { margin-top: 12px; padding: 8px 10px; border-radius: 10px; background: var(--surface); font-size: 12.5px; color: var(--muted); }
.note b { color: var(--text); font-weight: 600; }

.waiting { padding: 6px 0 14px; }
.waiting .msg { margin-top: 10px; font-size: 13.5px; color: var(--muted); }
.skel { height: 40px; width: 150px; border-radius: 10px; background: linear-gradient(90deg, var(--skel-a) 0%, var(--skel-b) 50%, var(--skel-a) 100%); background-size: 200% 100%; animation: kh-shimmer 1.3s linear infinite; }
.skel.sm { height: 52px; width: 100%; margin-top: 12px; }

/* ---------- tabs ---------- */
.tabs { position: relative; display: flex; margin: 0 22px 14px; padding: 3px; background: var(--surface); border-radius: 10px; }
/* Highlight that glides under the selected tab. */
.tab-ind { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 8px; background: var(--tab-ind); box-shadow: var(--tab-ind-shadow); transition: transform .26s cubic-bezier(.3,.9,.3,1); }
.tabs[data-tab="plan"] .tab-ind { transform: translateX(100%); }
.tab { position: relative; z-index: 1; flex: 1; height: 31px; border-radius: 8px; font-size: 14px; font-weight: 600; color: var(--muted); transition: color .2s ease; }
.tab:hover { color: var(--text); }
.tab[aria-selected="true"] { color: var(--brand-text); }

/* ---------- plan ---------- */
.plan-stats { display: grid; grid-template-columns: 1fr 1fr; margin: -4px 0 12px; border-radius: 10px; background: var(--surface); }
.ps-cell { padding: 6px 12px; min-width: 0; }
.ps-cell + .ps-cell { border-left: 1px solid var(--line); }
.ps-label { font-size: 12px; color: var(--muted); }
.ps-value { font-size: 15px; font-weight: 650; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ps-value small { font-size: 12px; font-weight: 500; color: var(--muted); letter-spacing: 0; }
.ps-value.good { color: var(--good); }
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
.s-plan-office { border: 1.5px dashed var(--brand-line); background: var(--plan-bg); }
.s-plan-office .cal-v { color: var(--brand-text); font-weight: 700; }
.s-plan-away { color: var(--subtle); background: repeating-linear-gradient(135deg, var(--away-a) 0 4px, var(--away-b) 4px 8px); border: 1.5px solid transparent; }
button.cal-cell:hover { transform: translateY(-1px); border-color: var(--brand); border-style: solid; }
.cal-cell.today::after { content: ""; position: absolute; inset: -3px; border: 2px solid var(--text); border-radius: 11px; pointer-events: none; }
.cal-cell.overridden::before { content: ""; position: absolute; top: 4px; right: 4px; width: 5px; height: 5px; border-radius: 50%; background: var(--dot-warn); }
.legend { display: grid; grid-template-columns: repeat(3, 1fr); align-items: center; gap: 8px 22px; margin-top: 14px; font-size: 13.5px; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; }
.legend i { display: inline-block; flex: none; width: 14px; height: 14px; margin-right: 7px; border-radius: 4px; }
.legend .lw { background: var(--good-soft); box-shadow: inset 0 0 0 1px var(--legend-good); }
.legend .lu { background: var(--warn-soft); box-shadow: inset 0 0 0 1px var(--legend-warn); }
.legend .lx { background: var(--surface); box-shadow: inset 0 0 0 1px var(--legend-neutral); }
.legend .lp { border: 1.5px dashed var(--brand-line); }
.legend .la { background: repeating-linear-gradient(135deg, var(--legend-away-a) 0 2px, var(--legend-away-b) 2px 4px); box-shadow: inset 0 0 0 1px var(--legend-neutral); }
.legend .hint { grid-column: 1 / -1; margin-top: 2px; font-size: 13px; color: var(--subtle); }


@keyframes kh-in { from { opacity: 0; transform: translateY(4px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes kh-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes kh-pulse { 50% { opacity: .35; } }
@keyframes kh-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
@media (max-width: 480px) {
  .hero-value { font-size: 38px; } .cal-cell { height: 44px; }
  .head { padding: 16px 14px 12px 16px; } .content { padding: 2px 16px 16px; } .tabs { margin: 0 16px 12px; }
}
`;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function tone(summary) {
    if (!summary || summary.averageMinutes == null) return '';
    return summary.deltaMinutesPerDay >= 0 ? 'good' : 'warn';
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

      <div class="tiles excluded">
        <div class="tile"><div class="tile-value">${s.wfhDays} <small>${s.wfhDays === 1 ? 'day' : 'days'}</small></div><div class="tile-label">WFH · not counted</div></div>
        <div class="tile"><div class="tile-value">${s.leaveDays} <small>${s.leaveDays === 1 ? 'day' : 'days'}</small></div><div class="tile-label">Leave · not counted</div></div>
      </div>
      ${s.pendingToday ? `<div class="note">Today <b>${fmt.duration(s.pendingToday.grossMinutes)}</b> so far — counted once you clock out.</div>` : ''}`;
  }

  /**
   * One bar per day in the view vs the 9h line (scale starts at 5h so
   * differences are visible). Counted days are green / amber; WFH days show
   * their hours as a striped grey bar (not counted); leave, holidays,
   * week-offs and no-time days are a short grey stub; today while clocked in
   * is a dashed outline.
   */
  function sparkHtml(s) {
    const days = s.allDays && s.allDays.length ? s.allDays : (s.includedDays || []).map(d => ({ ...d, kind: 'included' }));
    if (!days.length) return '';
    const lo = 5 * 60;
    const hi = Math.max(11 * 60, ...days.map(d => d.grossMinutes || 0));
    const y = min => Math.max(0, Math.min(100, ((min - lo) / (hi - lo)) * 100));
    const target = fmt.duration(s.targetMinutes).replace(' 00m', '');
    const bars = days.map(d => {
      const label = fmt.dayDate(d.date);
      const h = Math.max(4, y(d.grossMinutes)).toFixed(1);
      switch (d.kind) {
        case 'included': {
          const warn = d.grossMinutes < s.targetMinutes;
          return `<span class="bar${warn ? ' warn' : ''}" style="height:${h}%" title="${esc(`${label} · ${fmt.duration(d.grossMinutes)}`)}"></span>`;
        }
        case 'wfh':
          return d.grossMinutes
            ? `<span class="bar wfh" style="height:${h}%" title="${esc(`${label} · WFH ${fmt.duration(d.grossMinutes)} (not counted)`)}"></span>`
            : `<span class="bar stub" title="${esc(`${label} · WFH`)}"></span>`;
        case 'incomplete':
          return `<span class="bar live" style="height:${h}%" title="${esc(`${label} · ${fmt.duration(d.grossMinutes)} so far`)}"></span>`;
        default: {
          const what = d.kind === 'leave' ? 'Leave' : d.isHoliday ? 'Holiday' : d.isWeeklyOff ? 'Weekly off' : 'No time';
          return `<span class="bar stub" title="${esc(`${label} · ${what}`)}"></span>`;
        }
      }
    }).join('');
    const first = fmt.dayDate(days[0].date).split(', ')[1];
    const last = fmt.dayDate(days[days.length - 1].date).split(', ')[1];
    const counted = s.trackedDays;
    return `
      <div class="section spark-section">
        <div class="spark-head"><span>Daily hours</span><span>${counted} counted · ${days.length} day${days.length === 1 ? '' : 's'}</span></div>
        <div class="spark${days.length > 20 ? ' dense' : ''}" role="img" aria-label="Daily hours: ${s.daysAtOrAboveTarget} counted days at or above ${target}, ${s.daysBelowTarget} below, ${days.length - counted} not counted">
          ${bars}
          <div class="line" style="bottom:${y(s.targetMinutes).toFixed(1)}%"><span>${target}</span></div>
        </div>
        <div class="spark-foot"><span>${esc(first)}</span><span>${days.length > 1 ? esc(last) : ''}</span></div>
      </div>`;
  }

  /** Small two-up card under the plan hero: [label / value / sub] × 2. */
  function statsCard(left, right) {
    const cell = c => `
      <div class="ps-cell">
        <div class="ps-label">${c.label}</div>
        <div class="ps-value${c.tone ? ` ${c.tone}` : ''}">${c.value}${c.sub ? ` <small>${c.sub}</small>` : ''}</div>
      </div>`;
    return `<div class="plan-stats">${cell(left)}${cell(right)}</div>`;
  }

  function planHeroHtml(p) {
    const month = fmt.monthName(p.monthKey);
    const mon = month.slice(0, 3);
    const target = fmt.duration(p.targetMinutes).replace(' 00m', '');
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const soFar = {
      label: 'So far',
      value: p.countedDays ? fmt.duration(p.currentAverage) : '—',
      sub: p.countedDays ? `avg · ${plural(p.countedDays, 'day')}` : 'no office days yet',
    };

    if (p.status === 'complete') {
      const ok = p.currentAverage != null && p.currentAverage >= p.targetMinutes;
      return `
        <div class="hero">
          <div class="eyebrow">${esc(month)} finished at</div>
          <div class="hero-row"><span class="hero-value">${fmt.duration(p.currentAverage)}</span>
            ${p.currentAverage == null ? '' : `<span class="chip ${ok ? 'good' : 'warn'}">${ok ? `≥ ${target}` : `${fmt.delta(p.currentAverage - p.targetMinutes)} vs ${target}`}</span>`}</div>
        </div>
        ${statsCard(
          { label: 'Office days', value: p.countedDays, sub: '' },
          { label: 'Total', value: fmt.duration(p.countedMinutes), sub: '' })}`;
    }
    if (p.status === 'no-days') {
      return `
        <div class="hero">
          <div class="eyebrow">No office days left in ${esc(month)}</div>
          <div class="hero-row"><span class="hero-value">${fmt.duration(p.currentAverage)}</span></div>
        </div>
        ${statsCard(soFar, { label: 'Days left', value: '0', sub: 'tap a day to add' })}`;
    }
    if (p.status === 'secured') {
      return `
        <div class="hero">
          <div class="eyebrow">To end ${esc(month)} at ${target}+ average</div>
          <div class="hero-row"><span class="hero-value word">You're set</span></div>
        </div>
        ${statsCard(soFar, { label: 'Days left', value: p.remainingDays, tone: 'good', sub: `any time keeps ${target}+` })}`;
    }
    const hard = p.requiredPerDay > 12 * 60;
    const t = p.requiredPerDay <= p.targetMinutes ? 'good' : 'warn';
    return `
      <div class="hero">
        <div class="eyebrow">Sit on each remaining office day</div>
        <div class="hero-row"><span class="hero-value">${fmt.duration(p.requiredPerDay)}</span>
          <span class="chip ${hard ? 'warn' : t}">${hard ? 'Tough — check your away days' : `avg · ${plural(p.remainingDays, 'office day')}`}</span></div>
      </div>
      ${statsCard(soFar, { label: 'Still needed', value: fmt.duration(p.neededMinutes), sub: `to end ${esc(mon)} at ${target}` })}`;
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
        <span class="hint">Tap an upcoming day to switch office / away</span>` : ''}
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
      return { primary: pick('--primary-color') };
    } catch (_) {
      return { primary: null };
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
            <div class="head-actions">
              <button class="icon-btn" type="button" data-act="theme" aria-pressed="false"></button>
              <button class="icon-btn" type="button" data-act="collapse" aria-label="Minimize" title="Minimize">${ICON_MIN}</button>
            </div>
          </div>
          <div class="tabs" role="tablist" data-tab="overview" hidden>
            <span class="tab-ind" aria-hidden="true"></span>
            <button class="tab" type="button" role="tab" data-act="tab" data-tab="overview" aria-selected="true">Overview</button>
            <button class="tab" type="button" role="tab" data-act="tab" data-tab="plan" aria-selected="false">Plan</button>
          </div>
          <div class="content" role="tabpanel"></div>
        </section>
      </div>`;

    const $ = sel => shadow.querySelector(sel);
    const rootEl = $('.root');
    const themeBtn = $('[data-act="theme"]');
    const pill = $('.pill');
    const panel = $('.panel');
    const content = $('.content');
    const tabs = $('.tabs');

    let model = null;
    let expanded = false;
    let closing = null; // running close animation, if any
    let tab = 'overview';
    let theme = 'light';

    /** Apply 'light' | 'dark'; null (never chosen) follows the OS preference. */
    function setTheme(value) {
      theme = value === 'dark' || value === 'light' ? value : (systemPrefersDark() ? 'dark' : 'light');
      const dark = theme === 'dark';
      rootEl.setAttribute('data-theme', theme);
      themeBtn.innerHTML = dark ? ICON_SUN : ICON_MOON;
      themeBtn.setAttribute('aria-pressed', String(dark));
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeBtn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    const systemPrefersDark = () => {
      try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) { return false; }
    };
    setTheme(null);

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
      else if (act === 'theme') {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        handlers.onThemeChange(theme);
      }
    });

    function expand(viaKeyboard) {
      if (expanded) return;
      expanded = true;
      if (closing || resetClose) {
        closing = null;
        if (resetClose) resetClose();
      }
      handlers.onExpand(); // verifies freshness, then calls render()
      pill.hidden = true;
      pill.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      renderPanel();
      if (viaKeyboard) $('[data-act="collapse"]').focus({ preventScroll: true });
    }

    let resetClose = null; // undoes the temporary close-animation state

    /**
     * Minimize to the pill. Animated as one motion: the card shrinks into the
     * pill's exact size and spot (both share the bottom-right corner) while
     * its contents fade, and the pill fades in underneath as it arrives.
     * Instant when `instant` (e.g. leaving the logs page) or reduced motion.
     */
    function collapse(viaKeyboard, instant) {
      if (!expanded) return;
      expanded = false;
      const done = () => {
        if (resetClose) resetClose();
        panel.hidden = true;
        pill.hidden = false;
        pill.setAttribute('aria-expanded', 'false');
        if (viaKeyboard) pill.focus({ preventScroll: true });
      };
      if (instant || typeof panel.animate !== 'function' || reduceMotion()) { done(); return; }

      const from = panel.getBoundingClientRect();
      // Lift the card out of flow (pinned to the same corner) and show the pill beneath it.
      panel.style.position = 'absolute';
      panel.style.right = '0';
      panel.style.bottom = '0';
      pill.style.animation = 'none'; // don't replay the pill's own entrance fade
      pill.hidden = false;
      const to = pill.getBoundingClientRect();
      const sx = Math.max(0.05, to.width / from.width);
      const sy = Math.max(0.05, to.height / from.height);
      const ease = 'cubic-bezier(.32,.72,0,1)';

      const anims = [
        panel.animate([
          { transform: 'none', opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.55 },
          { transform: `scale(${sx}, ${sy})`, opacity: 0, offset: 1 },
        ], { duration: 320, easing: ease, fill: 'forwards' }), // hold the end state until hidden
        ...[...panel.children].map(child => child.animate(
          [{ opacity: 1 }, { opacity: 0 }], { duration: 80, easing: 'ease-out', fill: 'forwards' })),
        pill.animate(
          [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }],
          { duration: 200, delay: 160, easing: 'ease-out', fill: 'backwards' }),
      ];
      resetClose = () => {
        resetClose = null;
        anims.forEach(an => an.cancel());
        panel.style.position = '';
        panel.style.right = '';
        panel.style.bottom = '';
      };
      closing = anims[0];
      closing.finished.then(() => { closing = null; if (!expanded) done(); }).catch(() => { /* cancelled by re-open */ });
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
        collapse(false, true);
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
      if (t.primary) host.style.setProperty('--kh-primary', t.primary); else host.style.removeProperty('--kh-primary');
    }

    function mount() {
      if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
    }

    const api = { render, mount, applyTheme, setTheme, contains: node => host === node || host.contains(node), isExpanded: () => expanded, host };
    host.__kekaHours = api;
    return api;
  }

  root.KekaHours.ui = { createWidget, HOST_ID };
})(globalThis);
