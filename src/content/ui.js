/*
 * Widget rendering. Lives in a Shadow DOM under a single
 * <keka-hours-widget id="keka-hours-extension"> host, so Keka's CSS can't
 * leak in and ours can't leak out. Rendering only — no parsing/calculation.
 */
(function (root) {
  'use strict';

  const fmt = root.KekaHours.format;
  const W = root.KekaHours.wfh;
  const HOST_ID = 'keka-hours-extension';

  const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_MIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_INFO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.9" r="1.15" fill="currentColor"/></svg>';
  const ICON_AUTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9.5V13l2.3 1.6M10 3.5h4M12 3.5v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.8 6.2l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

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
.pill:focus-visible, .icon-btn:focus-visible, .tab:focus-visible, .cal-cell:focus-visible, .switch:focus-visible, .info-btn:focus-visible, .btn-sm:focus-visible, .btn-primary:focus-visible, .set-time:focus-visible, .link-btn:focus-visible, .te-step:focus-visible, .te-pick:focus-visible, .te-time:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
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

/* ---------- scrollbars: a thin rounded thumb that fades into the card ---------- */
.panel::-webkit-scrollbar, .day-list::-webkit-scrollbar { width: 10px; }
.panel::-webkit-scrollbar-track, .day-list::-webkit-scrollbar-track { background: transparent; margin: 14px 0; }
.panel::-webkit-scrollbar-thumb, .day-list::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 999px; background: var(--line-hover) padding-box; }
.panel::-webkit-scrollbar-thumb:hover, .day-list::-webkit-scrollbar-thumb:hover { background: var(--subtle) padding-box; }
.panel::-webkit-scrollbar-button, .day-list::-webkit-scrollbar-button { display: none; }

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
.pane[data-pane="wfh"] { display: flex; flex-direction: column; }

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
.hero-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
/* Plan is the tallest tab: its switch overlaps the hero's padding, so the card doesn't grow. */
.pane[data-pane="plan"] .hero-top { margin: -4px 0; }

/* Hover tooltip (Include today switch). */
.has-tip { position: relative; display: inline-flex; border-radius: 8px; }
.tip {
  position: absolute; top: calc(100% + 4px); left: -2px; z-index: 5;
  width: 290px; padding: 12px 14px; text-align: left; white-space: normal;
  background: var(--bg); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-panel);
  font-size: 13px; color: var(--muted); cursor: default; pointer-events: none;
  opacity: 0; visibility: hidden; transform: translateY(-4px);
  transition: opacity .16s ease, transform .16s cubic-bezier(.2,.8,.2,1), visibility 0s linear .16s;
}
.tip::before { content: ""; position: absolute; top: -6px; left: 22px; width: 10px; height: 10px; background: var(--bg); border-left: 1px solid var(--line); border-top: 1px solid var(--line); transform: rotate(45deg); }
.tip.end { left: auto; right: -2px; width: max-content; padding: 7px 11px; border-radius: 9px; font-size: 12.5px; color: var(--text); white-space: nowrap; }
.tip.end::before { left: auto; right: 22px; }
.has-tip:hover .tip, .has-tip:focus-visible .tip, .has-tip:has(:focus-visible) .tip {
  opacity: 1; visibility: visible; transform: none;
  transition: opacity .16s ease .12s, transform .16s cubic-bezier(.2,.8,.2,1) .12s, visibility 0s linear .12s;
}
/* ---------- average info button + day-by-day modal (centred on the page) ---------- */
.eyebrow-wrap { display: flex; align-items: center; gap: 4px; min-width: 0; }
.info-btn { flex: none; width: 20px; height: 20px; padding: 2px; border-radius: 50%; color: var(--subtle); transition: color .14s ease, background .14s ease; }
.info-btn:hover { color: var(--brand-text); background: var(--brand-soft); }
.modal { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 24px; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, .38); backdrop-filter: blur(2px); animation: kh-fade-in .18s ease; }
.root[data-theme="dark"] .modal-backdrop { background: rgba(0, 0, 0, .55); }
.modal-card { position: relative; display: flex; flex-direction: column; width: min(460px, 100%); max-height: min(640px, calc(100vh - 48px)); background: var(--bg); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow-panel); animation: kh-pop .2s cubic-bezier(.2,.8,.2,1); }
.modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 16px 12px 22px; }
.modal-title { font-size: 15.5px; font-weight: 650; letter-spacing: -.005em; }
.modal-sub { font-size: 12.5px; color: var(--muted); }
.modal-sum { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 22px 10px; padding: 12px 14px; border-radius: 12px; background: var(--surface); color: var(--muted); font-size: 13.5px; }
.modal-sum b { font-size: 24px; font-weight: 700; letter-spacing: -.02em; color: var(--text); white-space: nowrap; }
.modal-sum b.good { color: var(--good); }
.modal-sum b.warn { color: var(--warn); }
.modal-foot { padding: 10px 22px 16px; border-top: 1px solid var(--line); font-size: 12px; line-height: 1.45; color: var(--subtle); }
.day-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; margin-right: 6px; padding: 0 12px 6px 22px; }
.day-row { display: grid; grid-template-columns: 7px 104px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 32px; font-size: 13.5px; color: var(--text); }
.day-row + .day-row { border-top: 1px solid var(--line); }
.day-row .dot.off { background: transparent; box-shadow: inset 0 0 0 1.5px var(--stub-hover); }
.day-date { font-weight: 600; white-space: nowrap; }
.day-type { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.day-hrs { font-weight: 650; text-align: right; white-space: nowrap; }
.day-hrs.good { color: var(--good); }
.day-hrs.warn { color: var(--warn); }
.day-row.off .day-date, .day-row.off .day-type, .day-row.off .day-hrs { color: var(--subtle); font-weight: 500; }

/* "Include today" switch: a soft brand-tinted capsule when on. */
.switch { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 26px; padding: 0 4px 0 10px; border-radius: 999px; background: var(--surface); font-size: 12.5px; font-weight: 600; color: var(--muted); white-space: nowrap; transition: background .22s ease, color .22s ease; }
.switch:hover { color: var(--text); }
.switch[aria-checked="true"] { background: var(--brand-soft); color: var(--brand-text); }
.switch .track { position: relative; flex: none; width: 30px; height: 18px; border-radius: 999px; background: var(--meter-off); transition: background .22s ease; }
.switch[aria-checked="true"] .track { background: var(--brand); }
.switch .thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(15, 23, 42, .25); transition: transform .22s cubic-bezier(.3,.9,.3,1); }
.switch[aria-checked="true"] .thumb { transform: translateX(12px); }
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
.tab-ind { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / 3); border-radius: 8px; background: var(--tab-ind); box-shadow: var(--tab-ind-shadow); transition: transform .26s cubic-bezier(.3,.9,.3,1); }
.tabs[data-tab="plan"] .tab-ind { transform: translateX(100%); }
.tabs[data-tab="wfh"] .tab-ind { transform: translateX(200%); }
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
.today-strip { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding: 10px 11px; border-radius: 11px; background: var(--brand-soft); font-size: 12.5px; color: var(--brand-text); }
.today-strip .tdot { position: relative; width: 7px; height: 7px; border-radius: 50%; background: var(--brand); flex: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent); }
/* While the clock-out countdown runs, the dot pulses like the WFH tab's clocked-in dot. */
.today-strip.live .tdot { box-shadow: none; }
.today-strip.live .tdot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--brand); animation: kh-ping 1.8s cubic-bezier(0, 0, .2, 1) infinite; }
.today-strip b { font-weight: 700; white-space: nowrap; }
.today-strip .ttext { flex: 1; min-width: 0; }
.today-strip .tleft { flex: none; font-weight: 700; white-space: nowrap; }
.today-strip .tleft.done { color: var(--good); }
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

/* ---------- WFH: today first, then the settings for every WFH day ---------- */
.wfh { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.wfh-sec { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.wfh-sec.next { margin-top: 10px; }
.wfh-sec h3 { margin: 0; font-size: 13.5px; font-weight: 650; letter-spacing: -.005em; }
.wfh-sec span { font-size: 12.5px; color: var(--subtle); white-space: nowrap; }

/* Today: clock-in status, then what the reminder and auto clock-out will do (relative times). */
.today { padding: 0 14px 4px; border-radius: 14px; background: var(--surface); }
.today.warn { background: var(--warn-soft); }
.today-head { display: flex; align-items: center; gap: 10px; padding: 14px 0 12px; }
.today-head .t { font-size: 15.5px; font-weight: 650; letter-spacing: -.01em; }
.today.warn .today-head .t { color: var(--warn); }
.today-head .r { margin-left: auto; font-size: 12.5px; color: var(--subtle); white-space: nowrap; }
.live-dot { position: relative; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--subtle); }
.live-dot.on { background: var(--dot-good); }
.live-dot.on::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--dot-good); animation: kh-ping 1.8s cubic-bezier(0, 0, .2, 1) infinite; }
.t-line { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 14px; }
.today.warn .t-line { border-top-color: var(--legend-warn); }
.t-line .n { flex: 1; min-width: 0; }
.t-line .n small { display: block; font-size: 12.5px; color: var(--muted); text-wrap: pretty; }
.t-line .n.good { color: var(--good); }
.t-line .n.warn { color: var(--warn); }
.t-line .n.off { color: var(--muted); }
.t-line .w { font-weight: 650; white-space: nowrap; }
.t-line .w.brand { color: var(--brand-text); }
.t-line .w.warn { color: var(--warn); }
.t-line .btn-sm { height: 28px; padding: 0 10px; }
.t-line.note { font-size: 13px; line-height: 1.45; color: var(--muted); text-wrap: pretty; }
.t-line.note b { color: var(--text); font-weight: 600; }
.t-acts { display: flex; gap: 8px; margin-top: -2px; padding: 0 0 12px 36px; }
.w-badge { flex: none; width: 26px; height: 26px; padding: 5px; border-radius: 50%; background: var(--brand); color: #fff; }
.w-badge.auto { background: var(--bg); color: var(--brand-text); box-shadow: inset 0 0 0 2px var(--brand); }
.w-badge.warn { background: var(--warn); color: #fff; box-shadow: none; }
.w-badge.off { background: var(--bg); color: var(--subtle); box-shadow: inset 0 0 0 2px var(--line-hover); }
.w-badge.lg { width: 30px; height: 30px; padding: 6px; }
.root[data-theme="dark"] .w-badge.warn, .root[data-theme="dark"] .btn-sm.warn { color: #1a1206; }

/* Every WFH day: one row per feature, the same pattern for both. */
.set-list { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.set-row { display: flex; align-items: center; gap: 10px; min-height: 62px; padding: 10px 8px 10px 13px; cursor: pointer; transition: background .14s ease; }
.set-row:hover { background: var(--surface); }
.set-row + .set-row { border-top: 1px solid var(--line); }
.set-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; }
.set-name small { display: block; font-size: 12.5px; font-weight: 400; color: var(--muted); }
.set-name small.next { color: var(--warn); }
.set-time { flex: none; display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; min-width: 88px; height: 34px; padding: 0 2px 0 6px; border-radius: 9px; font-size: 15px; font-weight: 650; letter-spacing: -.01em; white-space: nowrap; }
.set-row.off .set-time { color: var(--subtle); font-weight: 600; }
.set-time .chev { width: 16px; height: 16px; }
.set-row:hover .chev { color: var(--muted); }
.switch.bare { padding: 0 4px; height: 26px; background: transparent; }
.set-row .switch[aria-checked="false"] .track { background: color-mix(in srgb, var(--guide) 45%, transparent); }

.wfh-note { font-size: 12.5px; line-height: 1.45; color: var(--subtle); }
.wfh-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); }
.link-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; margin-left: -6px; padding: 0 8px 0 6px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--muted); transition: background .14s ease, color .14s ease; }
.link-btn:hover { background: var(--surface); color: var(--text); }
.link-btn .i { width: 16px; height: 16px; }

/* Time pop-up: the time, −/+ 15 min, quick picks. */
.te-main { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 2px; }
.te-step { flex: none; width: 42px; height: 42px; padding: 11px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--line-hover); color: var(--text); transition: box-shadow .14s ease, opacity .14s ease; }
.te-step:hover:not(:disabled) { box-shadow: inset 0 0 0 1px var(--brand); }
.te-step:disabled { opacity: .4; cursor: default; }
.te-time { padding: 0 8px; border-radius: 10px; font-size: 36px; font-weight: 700; letter-spacing: -.03em; color: var(--brand-text); white-space: nowrap; }
.te-picks { display: flex; gap: 6px; margin-top: 14px; }
.te-pick { flex: 1; height: 32px; border-radius: 8px; background: var(--surface); font-size: 12.5px; font-weight: 600; color: var(--muted); white-space: nowrap; transition: color .14s ease; }
.te-pick:hover { color: var(--text); }
.te-pick[aria-pressed="true"] { background: var(--brand-soft); box-shadow: inset 0 0 0 1.5px var(--brand); color: var(--brand-text); }
.modal-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 22px 6px; }
.modal-note { margin-top: 12px; font-size: 12.5px; line-height: 1.45; color: var(--subtle); text-wrap: pretty; }
.modal-note.warn { color: var(--warn); }
.modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 12px 22px 16px; border-top: 1px solid var(--line); }
.modal-actions .btn-sm { height: 36px; padding: 0 14px; }
.btn-primary { flex: none; height: 36px; padding: 0 16px; border-radius: 10px; background: var(--brand); color: #fff; font-size: 13.5px; font-weight: 650; white-space: nowrap; transition: filter .14s ease; }
.btn-primary:hover { filter: brightness(1.06); }

/* "How it works": the rules, in plain words. */
.how-h { margin: 14px 0 8px; font-size: 13.5px; font-weight: 650; }
.how-h:first-child { margin-top: 2px; }
.how { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.how li { position: relative; padding-left: 15px; font-size: 13px; line-height: 1.45; color: var(--muted); text-wrap: pretty; }
.how li::before { content: ""; position: absolute; left: 2px; top: .58em; width: 5px; height: 5px; border-radius: 50%; background: var(--brand-line); }
.how b { color: var(--text); font-weight: 600; white-space: nowrap; }

.btn-sm { height: 30px; padding: 0 11px; border-radius: 8px; background: var(--bg); box-shadow: inset 0 0 0 1px var(--line-hover); font-size: 12.5px; font-weight: 600; color: var(--text); white-space: nowrap; transition: box-shadow .14s ease, filter .14s ease; }
.btn-sm:hover { box-shadow: inset 0 0 0 1px var(--brand); }
.btn-sm:disabled { opacity: .55; cursor: default; box-shadow: inset 0 0 0 1px var(--line); }
.btn-sm.warn { background: var(--warn); box-shadow: none; color: #fff; }
.btn-sm.warn:hover { box-shadow: none; filter: brightness(1.08); }


@keyframes kh-in { from { opacity: 0; transform: translateY(4px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes kh-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes kh-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes kh-pop { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes kh-pulse { 50% { opacity: .35; } }
@keyframes kh-ping { 0% { transform: scale(1); opacity: .6; } 75%, 100% { transform: scale(2.8); opacity: 0; } }
@keyframes kh-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
@media (max-width: 480px) {
  .hero-value { font-size: 38px; } .cal-cell { height: 44px; }
  .head { padding: 16px 14px 12px 16px; } .content { padding: 2px 16px 16px; } .tabs { margin: 0 16px 12px; }
}
`;

  /** 1 -> "1 day", 4 -> "4 days" */
  const dayCount = n => `${n} ${n === 1 ? 'day' : 'days'}`;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function tone(summary) {
    if (!summary || summary.averageMinutes == null) return '';
    return summary.deltaMinutesPerDay >= 0 ? 'good' : 'warn';
  }

  const WEEK_HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  /** The "Include today" switch: one setting, shown on Overview and Plan (`tab` keeps the tooltip ids apart). */
  function includeSwitchHtml(on, tab = 'overview') {
    return `
      <div class="has-tip">
        <button class="switch" type="button" role="switch" data-act="include-today" aria-checked="${on}" aria-describedby="include-tip-${tab}">
          <span>Include today</span><span class="track"><span class="thumb"></span></span>
        </button>
        <div class="tip end" role="tooltip" id="include-tip-${tab}">Use after clock-out, once today shows in the table</div>
      </div>`;
  }

  /** What kind of day this was, as shown in the average's day log. */
  function dayTypeLabel(d) {
    switch (d.kind) {
      case 'included':
        if (d.isHoliday) return 'Holiday · worked';
        if (d.isWeeklyOff) return 'Week-off · worked';
        return d.isHalfLeave ? 'Office · half-day leave' : 'Office';
      case 'wfh': return 'WFH · not counted';
      case 'leave': return 'Leave';
      case 'incomplete': return 'Today · still clocked in';
      default: return d.isHoliday ? 'Holiday' : d.isWeeklyOff ? 'Week-off' : 'No time';
    }
  }

  /** Modal behind the average's ⓘ: every day in the view with its type and hours, and the sum. */
  function dayLogHtml(s, m) {
    const days = s.allDays || [];
    const rows = days.map(d => {
      const counted = d.kind === 'included';
      const hrsTone = counted ? (d.grossMinutes >= s.targetMinutes ? ' good' : ' warn') : '';
      return `
        <div class="day-row${counted ? '' : ' off'}">
          <span class="dot${hrsTone || ' off'}"></span>
          <span class="day-date">${esc(fmt.dayDate(d.date))}</span>
          <span class="day-type">${esc(dayTypeLabel(d))}</span>
          <span class="day-hrs${hrsTone}">${d.grossMinutes ? fmt.duration(d.grossMinutes) : '—'}</span>
        </div>`;
    }).join('');
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const period = m.monthToDate && m.todayKey ? fmt.monthToDateRange(m.todayKey, !m.includeToday) : (m.label || '');
    const notes = ['Counted: days with office time. WFH, leave, holidays and week-offs without work aren\'t counted.'];
    if (m.todayInView && !m.includeToday) notes.push('Today isn\'t listed: Include today is off.');

    return `
      <div class="modal-head">
        <div><div class="modal-title" id="kh-modal-title">How you got this average</div><div class="modal-sub">${esc(period)} · ${s.trackedDays} of ${plural(days.length, 'day')} counted</div></div>
        <button class="icon-btn" type="button" data-act="modal-close" aria-label="Close" title="Close">${ICON_CLOSE}</button>
      </div>
      <div class="modal-sum"><span>${fmt.duration(s.totalMinutes)} ÷ ${plural(s.trackedDays, 'day')}</span><b class="${tone(s)}">${fmt.duration(s.averageMinutes)}</b></div>
      <div class="day-list">${rows}</div>
      <div class="modal-foot">${notes.map(esc).join('<br>')}</div>`;
  }

  /** "Office hours avg this month (Oct)", or "… for September" when viewing a past month. */
  function avgLabel(m) {
    if (!m.monthKey) return 'Office hours avg';
    const month = fmt.monthName(m.monthKey);
    const current = m.todayKey && m.todayKey.slice(0, 7) === m.monthKey;
    return current ? `Office hours avg this month (${month.slice(0, 3)})` : `Office hours avg for ${month}`;
  }

  function overviewHtml(s, m) {
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
        <div class="hero-top">
          <div class="eyebrow-wrap">
            <div class="eyebrow">${esc(avgLabel(m))}</div>
            ${s.trackedDays ? `<button class="info-btn" type="button" data-act="avg-info" aria-haspopup="dialog" aria-label="See the days behind this average" title="See the days behind this average">${ICON_INFO}</button>` : ''}
          </div>
          ${m.todayInView ? includeSwitchHtml(!!m.includeToday) : ''}
        </div>
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
        <div class="meter-head"><span>≥ ${target}<b>${dayCount(s.daysAtOrAboveTarget)}</b></span><span>&lt; ${target}<b>${dayCount(s.daysBelowTarget)}</b></span></div>
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

  /** The plan's headline. `sw`: the Include today switch, beside the heading ('' when today isn't in this month). */
  function planHeroHtml(p, sw) {
    const top = text => (sw ? `<div class="hero-top"><div class="eyebrow">${text}</div>${sw}</div>` : `<div class="eyebrow">${text}</div>`);
    const month = fmt.monthName(p.monthKey);
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
          ${top(`No office days left in ${esc(month)}`)}
          <div class="hero-row"><span class="hero-value">${fmt.duration(p.currentAverage)}</span></div>
        </div>
        ${statsCard(soFar, { label: 'Days left', value: '0', sub: 'tap a day to add' })}`;
    }
    if (p.status === 'secured') {
      return `
        <div class="hero">
          ${top(`To end ${esc(month)} at ${target}+ average`)}
          <div class="hero-row"><span class="hero-value word">You're set</span></div>
        </div>
        ${statsCard(soFar, { label: 'Days left', value: p.remainingDays, tone: 'good', sub: `any time keeps ${target}+` })}`;
    }
    const hard = p.requiredPerDay > 12 * 60;
    const t = p.requiredPerDay <= p.targetMinutes ? 'good' : 'warn';
    return `
      <div class="hero">
        ${top('Sit on each remaining office day')}
        <div class="hero-row"><span class="hero-value">${fmt.duration(p.requiredPerDay)}</span>
          <span class="chip ${hard ? 'warn' : t}">${hard ? 'Tough — check your away days' : `avg · ${plural(p.remainingDays, 'office day')}`}</span></div>
      </div>`;
  }

  /** "2h 05m left" / "45m left" until a time `ms` from now; "done" once it has passed. */
  function leftLabel(ms) {
    const m = Math.ceil(ms / 60000);
    if (m <= 0) return 'done';
    return m >= 60 ? `${Math.floor(m / 60)}h ${pad2(m % 60)}m left` : `${m}m left`;
  }

  /** Today in the Plan: the time to sit today and, once clocked in, when you can clock out and how long that is. */
  function todayHtml(p) {
    const td = p.today;
    if (!td) return '';
    let text = `Today · sit <b>${fmt.duration(td.requiredMinutes)}</b>`;
    let left = '';
    let live = false;
    if (td.leaveAt) {
      text += ` · clock out at <b>${fmt.timeOfDay(td.leaveAt)}</b>`;
      const ms = td.leaveAt - Date.now();
      live = ms > 0;
      left = `<span class="tleft${ms <= 0 ? ' done' : ''}" data-until="${td.leaveAt}" title="${fmt.timeOfDay(td.firstIn)} first clock-in + ${fmt.duration(td.requiredMinutes)}">${leftLabel(ms)}</span>`;
    }
    return `<div class="today-strip${live ? ' live' : ''}"><span class="tdot"></span><span class="ttext">${text}</span>${left}</div>`;
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

  function planHtml(p, includeToday) {
    if (!p) return '<div class="waiting"><div class="msg">Open a month (or <b>30 DAYS</b>) in the Attendance Log to plan.</div></div>';
    const blanks = Array.from({ length: p.firstWeekday }, () => '<div></div>').join('');
    const editable = p.cells.some(c => c.state === 'plan-office' || c.state === 'plan-away');
    const target = fmt.duration(p.targetMinutes).replace(' 00m', '');
    return `
      ${planHeroHtml(p, p.cells.some(c => c.isToday) ? includeSwitchHtml(!!includeToday, 'plan') : '')}
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

  const pad2 = n => String(n).padStart(2, '0');

  /** 179 min -> "in 2h 59m", 12 -> "in 12 min" */
  function inLabel(ms) {
    const m = Math.max(0, Math.ceil(ms / 60000));
    return m >= 60 ? `in ${Math.floor(m / 60)}h ${pad2(m % 60)}m` : `in ${m} min`;
  }

  /** "Synced just now" / "Synced 3 min ago" / "Not synced yet today" */
  function syncedLabel(updatedAt, now) {
    return updatedAt ? `Synced ${fmt.relative(updatedAt, now)}` : 'Not synced yet today';
  }

  const badgeHtml = (icon, cls) => `<span class="w-badge${cls ? ` ${cls}` : ''}">${icon}</span>`;
  const smallHtml = text => (text ? `<small>${text}</small>` : '');
  const btnHtml = (act, label, cls) => `<button class="btn-sm${cls ? ` ${cls}` : ''}" type="button" data-act="${act}">${label}</button>`;
  const lineHtml = (badge, name, end = '', nameCls = '') => `<div class="t-line">${badge}<span class="n${nameCls ? ` ${nameCls}` : ''}">${name}</span>${end}</div>`;

  /** Today's auto clock-out, while clocked in ('' when it's off or has nothing to say). */
  function autoLineHtml(ap, now) {
    const t = W.timeLabel;
    const bad = badgeHtml(ICON_AUTO, 'auto');
    const off = badgeHtml(ICON_AUTO, 'off');
    switch (ap.status) {
      case 'off': // switched on, but only from the next WFH day
        return ap.next && ap.next.on ? lineHtml(off, `No auto clock-out today${smallHtml('It starts on your next WFH day.')}`, '', 'off') : '';
      case 'waiting': case 'standby': return '';
      case 'scheduled': case 'heads-up': {
        // Why it isn't at the set time: the 11h limit, or back on after a clock-in past it.
        const why = ap.reason === 'safety' ? '11h after you clocked in.'
          : ap.reason === 'again' ? `1h after your ${t(ap.againFor)} clock-in.` : '';
        return lineHtml(bad, `Auto clock-out${smallHtml(why)}`,
          `<span class="w${ap.status === 'heads-up' ? ' warn' : ''}" title="${t(ap.at)}">${inLabel(ap.at - now)}</span>${btnHtml('wfh-auto-skip', 'Skip today')}`);
      }
      case 'due': case 'running': return lineHtml(bad, 'Clocking you out…');
      case 'done': return lineHtml(bad, `Auto clock-out ran at ${t(ap.doneAt || ap.at)}`, '', 'off');
      case 'failed':
        // "Try again" only while it's still switched on (turned off, a reset would just end it).
        return lineHtml(badgeHtml(ICON_AUTO, 'warn'), `Auto clock-out didn't work${smallHtml('Clock out in Keka yourself.')}`, ap.on ? btnHtml('wfh-auto-reset', 'Try again') : '', 'warn');
      case 'skipped': return lineHtml(off, 'Auto clock-out skipped today', btnHtml('wfh-auto-unskip', 'Undo'), 'off');
      case 'late-start': return lineHtml(off, `No auto clock-out today${smallHtml(`You clocked in after ${t(ap.at)}.`)}`, '', 'off');
      case 'missed': return lineHtml(off, `No auto clock-out today${smallHtml(`You weren't clocked in at ${t(ap.at)}.`)}`, '', 'off');
      case 'expired': return lineHtml(off, `No auto clock-out today${smallHtml('Too close to the limit to warn you first.')}`, '', 'off');
      default: return lineHtml(off, 'No auto clock-out today', '', 'off');
    }
  }

  /**
   * The Today card: clock-in status, then the reminder and auto clock-out in relative times.
   * `remWaits`: the reminder is switched on, but only from the next WFH day.
   */
  function wfhTodayHtml(p, ap, now, remWaits) {
    const t = W.timeLabel;
    const lines = [];
    let dot = '<span class="live-dot"></span>';
    let title;
    let right = '';
    let warn = false;
    const note = text => `<div class="t-line note"><span>${text}</span></div>`;
    const nothingOn = 'Turn on the reminder or auto clock-out below.';
    if (p.state === 'none') {
      title = 'Not clocked in';
      if (p.on) lines.push(note('Reminders start when you use <b>WFH Clock-In</b> on Keka.'));
      else if (ap.on) lines.push(note('Auto clock-out starts when you use <b>WFH Clock-In</b> on Keka.'));
      else if (remWaits || (ap.next && ap.next.on)) lines.push(note('Starts on your next WFH day.'));
      else lines.push(note(nothingOn));
    } else if (p.state === 'out') {
      title = `Clocked out at ${t(p.lastOut)}`;
      // After a break, "worked" would count the break: show when the day started instead.
      if (p.firstIn != null) right = p.lastIn !== p.firstIn ? `first in ${t(p.firstIn)}` : `${fmt.duration((p.lastOut - p.firstIn) / 60000)} worked`;
      // Only when auto clock-out made this clock-out (not one of yours after clocking back in).
      if (ap.status === 'done' && !(p.lastIn > (ap.doneAt || ap.at))) lines.push(lineHtml(badgeHtml(ICON_AUTO, 'auto'), 'Done by auto clock-out', '', 'good'));
      // Clocking back in brings both back (auto clock-out re-arms for today), unless it's skipped or the day is over.
      if (p.on || (ap.on && !['skipped', 'ended'].includes(ap.status))) lines.push(note('Nothing runs while you\'re clocked out. Clock in again and it picks up.'));
    } else {
      dot = '<span class="live-dot on"></span>';
      // The latest clock-in (back from a break: when you came back), and when the day started.
      title = p.lastIn != null ? `Clocked in at ${t(p.lastIn)}` : 'Clocked in';
      if (p.firstIn != null) right = p.lastIn !== p.firstIn ? `first in ${t(p.firstIn)}` : `${fmt.duration((now - p.firstIn) / 60000)} so far`;
      if (!p.on) {
        // Switched off: no reminder line (unless it's switched on from the next WFH day).
        if (remWaits) lines.push(lineHtml(badgeHtml(ICON_BELL, 'off'), `No reminder today${smallHtml('It starts on your next WFH day.')}`, '', 'off'));
      } else if (p.remindAt == null) {
        lines.push(lineHtml(badgeHtml(ICON_BELL, 'off'), `No reminder today${smallHtml(`You clocked in too late to be reminded before ${t(p.end)}.`)}`, '', 'off'));
      } else if (p.stopped) {
        lines.push(lineHtml(badgeHtml(ICON_BELL, 'off'), 'Reminder stopped for today', btnHtml('wfh-resume', 'Turn back on'), 'off'));
      } else if (p.snoozed) {
        const atCap = p.nextAt >= p.end - 5 * 60000;
        lines.push(lineHtml(badgeHtml(ICON_BELL, 'warn'), `Snoozed until ${t(p.nextAt)}${smallHtml(`Next reminder ${inLabel(p.nextAt - now)}`)}`));
        lines.push(`<div class="t-acts">${btnHtml('wfh-snooze-cancel', 'Cancel snooze')}<button class="btn-sm" type="button" data-act="wfh-snooze-more"${atCap ? ' disabled title="Can\'t snooze past the limit"' : ''}>+15 min</button></div>`);
      } else if (p.reminding || p.due) {
        warn = true;
        title = 'Time to clock out';
        if (p.nextAt != null) {
          lines.push(lineHtml(badgeHtml(ICON_BELL, 'warn'), `Reminding every 15 min${smallHtml(`Next at ${t(p.nextAt)}`)}`));
          lines.push(`<div class="t-acts">${btnHtml('wfh-snooze', 'Snooze 30 min', 'warn')}${btnHtml('wfh-stop', 'Stop for today')}</div>`);
        } else {
          lines.push(lineHtml(badgeHtml(ICON_BELL, 'warn'), `Reminders ended${smallHtml(`Nothing after ${t(p.end)}.`)}`));
        }
      } else {
        let why = '';
        if (p.reason === 'late') why = `You clocked in after ${W.hhmmLabel(p.time)}.`;
        else if (p.reason === 'safety') why = `11h after you clocked in, before ${W.hhmmLabel(p.time)}.`;
        else if (p.nextTime) why = `At ${t(p.remindAt)} today`;
        lines.push(lineHtml(badgeHtml(ICON_BELL), `Reminder${smallHtml(why)}`, `<span class="w brand" title="${t(p.remindAt)}">${inLabel(p.remindAt - now)}</span>`));
      }
      const auto = autoLineHtml(ap, now);
      if (auto) lines.push(auto);
      if (!lines.length) lines.push(note(nothingOn));
      else if (p.firstIn == null) lines.push(note('Couldn\'t read your clock-in time yet. Reload this page to load it.'));
    }
    return `
      <section class="today${warn ? ' warn' : ''}" aria-label="Today">
        <div class="today-head">${dot}<span class="t">${title}</span>${right ? `<span class="r">${right}</span>` : ''}</div>
        ${lines.join('')}
      </section>`;
  }

  /**
   * What's saved for every WFH day, including a change that waits for the next day:
   * { remOn, remTime, auto: { on, time }, autoWaits }.
   */
  function savedSetup(settings, today) {
    const r = W.timeFor(settings, today);
    const a = W.autoFor(settings, today);
    return { remOn: W.normalizeSettings(settings).reminderOn, remTime: r.next || r.time, auto: a.next || a, autoWaits: !!a.next };
  }

  /** Every WFH day: one row per feature, each with its switch and time. Clicking a row opens its time pop-up. */
  function settingsHtml(settings, p, now) {
    const today = W.dateKeyOf(now);
    const { remOn, remTime, auto, autoWaits } = savedSetup(settings, today);
    const next = '<small class="next">From your next WFH day</small>';
    let remNote = remOn ? '<small>Repeats until you clock out</small>' : '<small>Reminds you to clock out</small>';
    if (remOn && (p.nextTime || W.reminderOnFor(settings, today).from)) remNote = next;
    let autoNote = auto.on ? '<small>Heads-up 5 min before</small>' : '<small>Clocks you out at a set time</small>';
    if (auto.on && autoWaits) autoNote = next;
    const row = (r) => `
        <div class="set-row${r.on ? '' : ' off'}" data-act="${r.edit}">
          ${badgeHtml(r.icon, r.on ? r.badge : `${r.badge} off`)}
          <div class="set-name">${r.name}${r.note}</div>
          <button class="switch bare" type="button" role="switch" data-act="${r.toggle}" aria-checked="${r.on}" aria-label="${r.name}"><span class="track"><span class="thumb"></span></span></button>
          <button class="set-time" type="button" data-act="${r.edit}" aria-haspopup="dialog" aria-label="${r.name} time: ${r.time}. Change">${r.time}<span class="chev">${ICON_CHEVRON}</span></button>
        </div>`;
    return `
      <section class="set-list" aria-label="Every WFH day">
        ${row({ edit: 'rem-edit', toggle: 'rem-switch', on: remOn, icon: ICON_BELL, badge: 'lg', name: 'Clock-out reminder', note: remNote, time: W.hhmmLabel(remTime) })}
        ${row({ edit: 'auto-edit', toggle: 'auto-switch', on: auto.on, icon: ICON_AUTO, badge: 'auto lg', name: 'Auto clock-out', note: autoNote, time: W.hhmmLabel(auto.time) })}
      </section>`;
  }

  /**
   * WFH tab. `wfhState` = { settings, day } from storage (the worker owns the
   * day); everything shown is derived with the same rules the worker uses.
   * `form` = { testMsg } held by the widget between renders.
   */
  function wfhHtml(wfhState, now, form) {
    const today = W.dateKeyOf(now);
    const settings = W.normalizeSettings(wfhState && wfhState.settings);
    const raw = wfhState && wfhState.day;
    const day = raw && raw.date === today ? raw : W.emptyDay(today);
    const p = W.plan(day, settings, now);
    return `
      <div class="wfh">
        <div class="wfh-sec"><h3>Today</h3><span>${esc(syncedLabel(p.updatedAt, now))}</span></div>
        ${wfhTodayHtml(p, W.autoPlan(day, settings, now), now, !!W.reminderOnFor(settings, today).from)}
        <div class="wfh-sec next"><h3>Every WFH day</h3></div>
        ${settingsHtml(settings, p, now)}
        ${form.testMsg ? `<div class="wfh-note" role="status">${esc(form.testMsg)}</div>` : ''}
        <div class="wfh-foot">
          <button class="link-btn" type="button" data-act="wfh-how" aria-haspopup="dialog"><span class="i">${ICON_INFO}</span>How it works</button>
          <button class="btn-sm" type="button" data-act="wfh-test">Test notification</button>
        </div>
      </div>`;
  }

  /** Time pop-up for the reminder or auto clock-out. `d` = { which: 'rem' | 'auto', minutes, on }; `note` = { text, warn }. */
  function timeModalHtml(d, note) {
    const S = W.TIME_STEPS;
    const label = W.hhmmLabel(W.timeFromMinutes(d.minutes));
    const name = d.which === 'auto' ? 'Auto clock-out' : 'Clock-out reminder';
    const step = (dir, icon, aria) => `<button class="te-step" type="button" data-act="time-step" data-dir="${dir}" aria-label="${aria}"${W.stepTime(d.minutes, dir) === d.minutes ? ' disabled' : ''}>${icon}</button>`;
    const picks = W.QUICK_TIMES.map(hhmm => {
      const m = W.parseTime(hhmm);
      return `<button class="te-pick" type="button" data-act="time-pick" data-value="${m}" aria-pressed="${m === d.minutes}">${W.hhmmLabel(hhmm)}</button>`;
    }).join('');
    return `
      <div class="modal-head">
        <div><div class="modal-title" id="kh-modal-title">${name}</div><div class="modal-sub">Every WFH day</div></div>
        <button class="icon-btn" type="button" data-act="modal-close" aria-label="Close" title="Close">${ICON_CLOSE}</button>
      </div>
      <div class="modal-body">
        <div class="te-main">
          ${step(-1, ICON_MIN, '15 min earlier')}
          <span class="te-time" role="spinbutton" tabindex="0" aria-label="${name} time" aria-valuemin="${S.min}" aria-valuemax="${S.max}" aria-valuenow="${d.minutes}" aria-valuetext="${label}">${label}</span>
          ${step(1, ICON_PLUS, '15 min later')}
        </div>
        <div class="te-picks">${picks}</div>
        <div class="modal-note${note.warn ? ' warn' : ''}" role="status">${note.text}</div>
      </div>
      <div class="modal-actions">
        <button class="btn-sm" type="button" data-act="modal-close">Cancel</button>
        <button class="btn-primary" type="button" data-act="time-save">${d.on ? 'Save' : 'Save &amp; turn on'}</button>
      </div>`;
  }

  /** "How it works": the reminder and auto clock-out rules, out of the tab's way. */
  function howModalHtml(synced) {
    const end = W.hhmmLabel(W.LATEST_TIME);
    return `
      <div class="modal-head">
        <div><div class="modal-title" id="kh-modal-title">How it works</div><div class="modal-sub">Turn each on with its switch. Times apply to every WFH day.</div></div>
        <button class="icon-btn" type="button" data-act="modal-close" aria-label="Close" title="Close">${ICON_CLOSE}</button>
      </div>
      <div class="modal-body">
        <h4 class="how-h">Clock-out reminder</h4>
        <ul class="how">
          <li>Starts when you use <b>WFH Clock-In</b> on Keka. A clock-in from the app shows up when you next open Keka here.</li>
          <li>At your time, a Chrome notification reminds you every 15 min until you clock out. <b>Snooze 30 min</b> or <b>Stop for today</b> from it.</li>
          <li>Keka marks a missed clock-out 12h after your first clock-in, so if 11h comes earlier, you're reminded then.</li>
          <li>Clocked in after your time? You're reminded 30 min later.</li>
          <li>Nothing after <b>${end}</b>. Clocking out stops it at once.</li>
        </ul>
        <h4 class="how-h">Auto clock-out</h4>
        <ul class="how">
          <li>5 min before, a notification lets you <b>Skip today</b> or add <b>15 min</b>.</li>
          <li>Keka opens in a background tab, clicks <b>WFH Clock-out</b> and confirms, then the tab closes.</li>
          <li>If it can't, you get an alert to clock out yourself.</li>
          <li>Clock in again after it has run, or after its time, and it comes back on for that day: 1h after you clock in, or at your set time if that's still to come.</li>
          <li>Needs Chrome running, your laptop awake, and you signed in to Keka.</li>
        </ul>
        <div class="modal-note">A time that has already passed today starts on your next WFH day.</div>
      </div>
      <div class="modal-foot">${esc(synced)}.</div>`;
  }

  // WFH tab buttons the worker handles (today's reminder / auto clock-out).
  const WFH_ACTIONS = ['wfh-snooze', 'wfh-snooze-cancel', 'wfh-snooze-more', 'wfh-stop', 'wfh-resume', 'wfh-auto-skip', 'wfh-auto-unskip', 'wfh-auto-reset'];

  const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;

  /** '#fff' / '#ffffff' / 'rgb(…)' -> [r, g, b], or null (unknown / fully transparent). */
  function parseRgb(value) {
    const v = String(value || '').trim();
    let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
    if (m) {
      const hex = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
      return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    }
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/i.exec(v);
    if (m && !(m[4] != null && parseFloat(m[4]) === 0)) return [m[1], m[2], m[3]].map(Number);
    return null;
  }

  /**
   * Keka's display mode: 'dark' | 'light' | null (unknown). A "dark" class on
   * <html>/<body> wins; otherwise the page background Keka sets as a CSS
   * variable on <html> decides.
   */
  function readKekaMode() {
    try {
      const classes = `${document.documentElement.className} ${document.body ? document.body.className : ''}`;
      if (/(^|[\s_-])dark([\s_-]|$)/i.test(classes)) return 'dark';
      const rgb = parseRgb(getComputedStyle(document.documentElement).getPropertyValue('--primary-background-color')) ||
        (document.body ? parseRgb(getComputedStyle(document.body).backgroundColor) : null);
      if (!rgb) return null;
      return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.45 ? 'dark' : 'light';
    } catch (_) {
      return null;
    }
  }

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
            <button class="tab" type="button" role="tab" data-act="tab" data-tab="wfh" aria-selected="false">WFH</button>
          </div>
          <div class="content" role="tabpanel"></div>
        </section>
        <div class="modal" hidden>
          <div class="modal-backdrop" data-act="modal-close"></div>
          <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="kh-modal-title"></div>
        </div>
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
    let wfhState = { settings: null, day: null };
    // WFH tab form, kept across re-renders: the test notification's result.
    const wfhForm = { testMsg: null };
    let wfhPending = false; // a re-render waiting for a press to become its click
    let theme = 'light';
    // The user's own pick, kept only while it differs from Keka's display mode.
    let themeOverride = null;
    let kekaMode = readKekaMode();

    /** Apply 'light' | 'dark' as an override; null follows Keka's display mode (then the OS). */
    function setTheme(value) {
      themeOverride = value === 'dark' || value === 'light' ? value : null;
      paintTheme();
    }

    function paintTheme() {
      theme = themeOverride || kekaMode || (systemPrefersDark() ? 'dark' : 'light');
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
        if (type === 'keydown' && e.key === 'Escape') {
          if (modalOpen) closeModal(true);
          else if (expanded) collapse(true);
        }
        e.stopPropagation();
      });
    }

    const modal = $('.modal');
    const modalCard = $('.modal-card');
    let modalOpen = false;
    let modalKind = 'daylog'; // 'daylog' (average's ⓘ) | 'time' (reminder / auto clock-out time) | 'how' (WFH rules)
    let timeDraft = null; // { which: 'rem' | 'auto', minutes, on } while the time pop-up is open

    /** Fill the modal. The day log follows the model (keeping its scroll); the WFH pop-ups only redraw on their own edits. */
    function renderModal(force) {
      if (!modalOpen) return;
      if (modalKind === 'time' || modalKind === 'how') {
        if (!force) return;
        const now = Date.now();
        modalCard.innerHTML = modalKind === 'time'
          ? timeModalHtml(timeDraft, timeNote(timeDraft, now))
          : howModalHtml(syncedLabel(todayState(now).updatedAt, now));
        return;
      }
      const s = model && model.summary;
      if (!model || model.state !== 'ok' || !s || !s.trackedDays) { closeModal(false); return; }
      const prev = modalCard.querySelector('.day-list');
      const top = prev ? prev.scrollTop : 0;
      modalCard.innerHTML = dayLogHtml(s, model);
      const list = modalCard.querySelector('.day-list');
      if (list) list.scrollTop = top;
    }

    function openModal(kind = 'daylog') {
      modalKind = kind;
      modalOpen = true;
      modal.hidden = false;
      renderModal(true);
      const close = modalCard.querySelector('[data-act="modal-close"]');
      if (close) close.focus({ preventScroll: true });
    }

    function closeModal(restoreFocus) {
      if (!modalOpen) return;
      modalOpen = false;
      modal.hidden = true;
      const opener = modalKind === 'time' ? (timeDraft && timeDraft.which === 'auto' ? 'auto-edit' : 'rem-edit')
        : modalKind === 'how' ? 'wfh-how' : 'avg-info';
      // The button: a WFH row also carries its data-act (a click anywhere on it), but can't take focus.
      const back = restoreFocus && content.querySelector(`button[data-act="${opener}"]`);
      if (back) back.focus({ preventScroll: true });
    }

    /** The time pop-up, starting at the saved time (even if today still uses an earlier one). */
    function openTime(which) {
      const s = savedSetup(wfhState.settings, W.dateKeyOf(Date.now()));
      const { time, on } = which === 'auto' ? s.auto : { time: s.remTime, on: s.remOn };
      timeDraft = { which, minutes: W.parseTime(time), on };
      openModal('time');
    }

    /** The line under the picked time: it starts tomorrow, or how it sits next to the other time. */
    function timeNote(d, now) {
      const settings = wfhState.settings;
      const today = W.dateKeyOf(now);
      const time = W.timeFromMinutes(d.minutes);
      const { remOn, remTime, auto } = savedSetup(settings, today);
      const end = W.hhmmLabel(W.LATEST_TIME);
      const passed = 'That has already passed today, so it starts on your next WFH day.';
      if (d.which === 'auto') {
        if (W.autoStartsTomorrow(settings, { on: true, time }, now, todayState(now))) return { warn: true, text: `${passed} Today stays as it is.` };
        // Only next to a reminder that's switched on.
        const remAt = W.parseTime(remTime);
        if (remOn && d.minutes < remAt) return { warn: true, text: `That's before your reminder (${W.hhmmLabel(remTime)}).` };
        if (remOn && d.minutes === remAt) return { warn: true, text: 'That\'s the same time as your reminder.' };
        return { warn: false, text: `A heads-up comes 5 min before. Up to ${end}.` };
      }
      // Judged on exactly what saving stores (main.js saves with the same W.withReminder).
      const next = W.withReminder(settings, { on: true, time }, now, todayState(now));
      const onToday = W.reminderOnFor(next, today).on;
      if (W.reminderStartsTomorrow(settings, time, now) || !onToday) {
        return { warn: true, text: onToday ? `${passed} Today stays at ${W.hhmmLabel(W.timeFor(next, today).time)}.` : passed };
      }
      if (auto.on) {
        const autoAt = W.parseTime(auto.time);
        if (d.minutes > autoAt) return { warn: true, text: `That's after your auto clock-out (${W.hhmmLabel(auto.time)}).` };
        if (d.minutes === autoAt) return { warn: true, text: 'That\'s the same time as your auto clock-out.' };
        return { warn: false, text: `Up to ${end}. Auto clock-out stays at ${W.hhmmLabel(auto.time)}.` };
      }
      return { warn: false, text: `Up to ${end}.` };
    }

    /** Move the pop-up's time; focus stays on the control used (or the time, once a −/+ runs out). */
    function moveDraft(minutes) {
      if (!timeDraft || !Number.isFinite(minutes) || minutes === timeDraft.minutes) return;
      const key = focusKey(modalCard);
      timeDraft.minutes = minutes;
      renderModal(true);
      restoreFocus(modalCard, key);
      const a = shadow.activeElement;
      if (!a || !modalCard.contains(a) || a.disabled) {
        const t = modalCard.querySelector('.te-time');
        if (t) t.focus({ preventScroll: true });
      }
    }

    function saveTime() {
      const time = W.timeFromMinutes(timeDraft.minutes);
      if (!W.validTime(time)) return;
      if (timeDraft.which === 'auto') handlers.onAutoSave({ on: true, time });
      else handlers.onReminderSave({ on: true, time }); // re-renders via setWfh (or once the press is let go)
      closeModal(true);
      if (wfhPending) renderWfh();
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
      else if (act === 'rem-edit') openTime('rem');
      else if (act === 'auto-edit') openTime('auto');
      else if (act === 'time-step' && timeDraft) moveDraft(W.stepTime(timeDraft.minutes, Number(el.getAttribute('data-dir'))));
      else if (act === 'time-pick') moveDraft(Number(el.getAttribute('data-value')));
      else if (act === 'time-save' && timeDraft) saveTime();
      else if (act === 'wfh-how') openModal('how');
      else if (act === 'rem-switch' || act === 'auto-switch') {
        const on = el.getAttribute('aria-checked') !== 'true';
        const { time } = savedSetup(wfhState.settings, W.dateKeyOf(Date.now())).auto;
        // Let the switch slide first; the re-render replaces it with the same state.
        el.setAttribute('aria-checked', String(on));
        setTimeout(() => {
          if (act === 'rem-switch') handlers.onReminderSave({ on });
          else handlers.onAutoSave({ on, time });
        }, reduceMotion() ? 0 : 180);
      }
      else if (WFH_ACTIONS.includes(act)) handlers.onWfhAction(act);
      else if (act === 'wfh-test') {
        el.disabled = true;
        el.textContent = 'Sending…';
        Promise.resolve(handlers.onWfhTest()).then(res => {
          if (!res) wfhForm.testMsg = 'Couldn\'t reach the extension. Reload this page and try again.';
          else if (res.permission === 'denied') wfhForm.testMsg = 'Chrome is blocking notifications for Keka Hours. Allow them in Chrome settings.';
          else wfhForm.testMsg = 'Sent. Didn\'t see it? Allow Chrome notifications in your OS and turn off Do Not Disturb.';
          renderWfh();
        });
      }
      else if (act === 'include-today') {
        const on = el.getAttribute('aria-checked') !== 'true';
        const viaKeyboard = e.detail === 0;
        // Let the switch slide first; the re-render replaces it with the same state.
        el.setAttribute('aria-checked', String(on));
        setTimeout(() => {
          handlers.onIncludeTodayChange(on);
          const next = content.querySelector('.pane:not(.off) [data-act="include-today"]'); // the tab you're on
          if (viaKeyboard && next) next.focus({ preventScroll: true });
        }, reduceMotion() ? 0 : 180);
      }
      else if (act === 'avg-info') openModal('daylog');
      else if (act === 'modal-close') closeModal(e.detail === 0);
      else if (act === 'theme') {
        const next = theme === 'dark' ? 'light' : 'dark';
        // Picking Keka's own mode means "follow Keka" again.
        themeOverride = next === kekaMode ? null : next;
        paintTheme();
        handlers.onThemeChange(themeOverride);
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
      closeModal(false);
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
        ? fmt.monthToDateRange(m.todayKey, !m.includeToday) // to yesterday unless Include today is on
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
      // Don't replace the WFH tab between a press and its click.
      const keep = pressing ? content.querySelector('[data-pane="wfh"]') : null;
      const key = keep ? null : focusKey(content);
      content.innerHTML = `
        <div class="panes">
          <div class="pane" data-pane="overview">${overviewHtml(s, m)}</div>
          <div class="pane" data-pane="plan">${planHtml(m.plan, m.includeToday)}</div>
          <div class="pane" data-pane="wfh">${keep ? '' : wfhHtml(wfhState, Date.now(), wfhForm)}</div>
        </div>`;
      if (keep) { content.querySelector('[data-pane="wfh"]').replaceWith(keep); wfhPending = true; }
      showTab();
      restoreFocus(content, key);
    }

    // The WFH tab never re-renders between a press and its click.
    let pressing = false; // a pointer is down in the card (a click may be on its way)

    /** A selector for the focused control in `root`, to focus its replacement after a re-render. */
    function focusKey(root) {
      const a = shadow.activeElement;
      if (!a || !root.contains(a)) return null;
      const act = a.getAttribute('data-act');
      if (!act) return null;
      // Tag-qualified: a WFH row shares its time button's data-act but can't take focus.
      let sel = `${a.localName}[data-act="${act}"]`;
      for (const attr of ['data-value', 'data-dir', 'data-tab', 'data-date']) {
        if (a.hasAttribute(attr)) sel += `[${attr}="${a.getAttribute(attr)}"]`;
      }
      return sel;
    }

    function restoreFocus(root, key) {
      const el = key && root.querySelector(key);
      if (el) el.focus({ preventScroll: true });
    }

    /** Re-render only the WFH tab (cheap; leaves the other tabs' scroll / hover alone). */
    function renderWfh() {
      const pane = content.querySelector('[data-pane="wfh"]');
      if (!expanded || !pane) return;
      if (pressing) { wfhPending = true; return; }
      wfhPending = false;
      const key = focusKey(pane);
      pane.innerHTML = wfhHtml(wfhState, Date.now(), wfhForm);
      restoreFocus(pane, key);
    }

    /** Once a minute: the Plan's "2h 05m left" countdown, and the WFH tab. */
    function tick() {
      for (const el of content.querySelectorAll('[data-until]')) {
        const ms = Number(el.getAttribute('data-until')) - Date.now();
        el.textContent = leftLabel(ms);
        el.classList.toggle('done', ms <= 0);
        const strip = el.closest('.today-strip');
        if (strip) strip.classList.toggle('live', ms > 0); // the dot stops pulsing once it's time
      }
      renderWfh();
    }

    function setWfh(next) {
      wfhState = next || { settings: null, day: null };
      renderWfh();
    }

    /** Today's day state for the shared rules (an empty day if none yet). */
    function todayState(now) {
      const today = W.dateKeyOf(now);
      const raw = wfhState.day;
      return raw && raw.date === today ? raw : W.emptyDay(today);
    }

    // Any press in the card holds re-renders until its click has been handled,
    // so a save landing in between can't replace the button being clicked.
    const releasePress = () => {
      window.removeEventListener('pointerup', releasePress, true);
      window.removeEventListener('pointercancel', releasePress, true);
      pressing = false;
      setTimeout(() => { if (wfhPending) renderWfh(); }, 0);
    };
    shadow.addEventListener('pointerdown', () => {
      if (pressing) return;
      pressing = true;
      window.addEventListener('pointerup', releasePress, true);
      window.addEventListener('pointercancel', releasePress, true);
    }, true);

    // The time pop-up from the keyboard, on the time: ↑ → / ↓ ← 15 min, PgUp / PgDn 1 h, Home / End; Enter saves.
    const TIME_KEYS = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 4, PageDown: -4 };
    shadow.addEventListener('keydown', e => {
      if (!modalOpen || modalKind !== 'time' || !timeDraft || !(e.target.classList && e.target.classList.contains('te-time'))) return;
      const S = W.TIME_STEPS;
      let next = timeDraft.minutes;
      if (e.key in TIME_KEYS) {
        for (let i = 0; i < Math.abs(TIME_KEYS[e.key]); i++) next = W.stepTime(next, Math.sign(TIME_KEYS[e.key]));
      } else if (e.key === 'Home') next = Math.min(S.min, next);
      else if (e.key === 'End') next = S.max;
      else if (e.key === 'Enter') { e.preventDefault(); saveTime(); return; }
      else return;
      e.preventDefault();
      moveDraft(next);
    });

    const TAB_ORDER = ['overview', 'plan', 'wfh'];
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
        closeModal(false);
        collapse(false, true);
        host.remove();
        return;
      }
      host.style.setProperty('display', 'block', 'important');
      applyTheme();
      renderPill();
      renderPanel();
      renderModal();
    }

    /**
     * Match Keka's theme colour (green, pink, …; falls back to green) and its
     * display mode. Switching Keka's mode drops any override, so both stay in sync.
     */
    function applyTheme() {
      const t = readKekaTheme();
      if (t.primary) host.style.setProperty('--kh-primary', t.primary); else host.style.removeProperty('--kh-primary');
      const mode = readKekaMode();
      if (mode && mode !== kekaMode) {
        const switched = kekaMode != null; // not just the first read
        kekaMode = mode;
        if (switched && themeOverride) {
          themeOverride = null;
          handlers.onThemeChange(null);
        }
        paintTheme();
      }
    }

    function mount() {
      if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
    }

    const api = { render, mount, applyTheme, setTheme, setWfh, renderWfh, tick, contains: node => host === node || host.contains(node), isExpanded: () => expanded, host };
    host.__kekaHours = api;
    return api;
  }

  root.KekaHours.ui = { createWidget, HOST_ID };
})(globalThis);
