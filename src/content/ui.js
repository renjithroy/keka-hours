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
.pill:focus-visible, .icon-btn:focus-visible, .tab:focus-visible, .cal-cell:focus-visible, .switch:focus-visible, .info-btn:focus-visible, .seg button:focus-visible, .btn-sm:focus-visible, .btn-primary:focus-visible, .time-sel:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
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

/* ---------- WFH clock-out reminder ---------- */
.wfh { flex: 1; display: flex; flex-direction: column; gap: 12px; padding-top: 0; }
.wfh-intro h3 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -.01em; }
.wfh-intro p { margin: 3px 0 0; font-size: 13px; line-height: 1.45; color: var(--muted); }

/* Today: status, the reminder time (the one big thing), and the day so far. */
.rem { display: flex; flex-direction: column; gap: 12px; padding: 12px 14px 14px; border-radius: 14px; box-shadow: inset 0 0 0 1px var(--line); }
.rem-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rem-head h3 { margin: 0; font-size: 14.5px; font-weight: 650; letter-spacing: -.005em; }
.rem .wfh-today { margin: 0 -14px; padding: 10px 14px 12px; background: var(--surface); }
.rem .how { padding-top: 12px; border-top: 1px solid var(--line); }
.wfh-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wfh-state { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.live-dot { position: relative; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--subtle); }
.live-dot.on { background: var(--dot-good); }
.live-dot.on::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--dot-good); animation: kh-ping 1.8s cubic-bezier(0, 0, .2, 1) infinite; }
.wfh-label { font-size: 13px; color: var(--muted); white-space: nowrap; }
.wfh-big { margin-top: 2px; }
.wfh-big { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wfh-time-big { font-size: 44px; line-height: 1.05; font-weight: 700; letter-spacing: -.035em; color: var(--brand-text); }
.wfh-time-big.word { font-size: 34px; }
.wfh-time-big.warn { color: var(--warn); }
.wfh-time-big.off { color: var(--subtle); }
.wfh-in { font-size: 13.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.wfh-sub { margin-top: 4px; font-size: 13px; line-height: 1.45; color: var(--muted); text-wrap: pretty; }
.wfh-sub b { color: var(--text); font-weight: 600; }
/* Reminder time slider: 12 PM–8 PM, half-hour steps; shows today's progress when clocked in. */
.rs-head { display: flex; align-items: center; gap: 8px; min-height: 30px; }
.rs-title { font-size: 13.5px; font-weight: 600; }
.rs-hint { font-size: 12px; color: var(--subtle); }
.rs-hint.past { color: var(--warn); font-weight: 600; }
.rs-note { margin-top: 8px; padding: 8px 10px; border-radius: 9px; background: var(--warn-soft); color: var(--warn); font-size: 12.5px; line-height: 1.45; text-wrap: pretty; }
.rs-note b { font-weight: 700; }
.modal-note.past { color: var(--warn); }
.rs-saved { font-size: 12px; font-weight: 600; color: var(--good); animation: kh-saved 2.2s ease forwards; }
.rs-head .btn-sm { margin-left: auto; }
.rs-rail { position: relative; padding: 38px 11px 0; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }
.rs-track { position: relative; height: 6px; border-radius: 999px; background: var(--meter-off); }
.rs-fill { position: absolute; top: 0; bottom: 0; border-radius: inherit; background: color-mix(in srgb, var(--guide) 45%, transparent); }
.rs-now { position: absolute; top: -5px; width: 2px; height: 16px; margin-left: -1px; border-radius: 1px; background: var(--text); opacity: .55; }
.rs-ghost { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: color-mix(in srgb, var(--brand) 30%, transparent); pointer-events: none; opacity: 0; transition: opacity .12s ease; }
.rs-rail:hover .rs-ghost.on { opacity: 1; }
.rs.dragging .rs-ghost { opacity: 0 !important; }
.rs-thumb { position: absolute; top: 50%; z-index: 1; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 0 3px var(--bg), 0 1px 5px rgba(15, 23, 42, .35); cursor: grab; outline: none; transition: transform .12s ease, box-shadow .12s ease; }
.rs-thumb:hover { transform: scale(1.08); }
.rs-thumb:focus-visible { box-shadow: 0 0 0 3px var(--bg), 0 0 0 5px var(--brand); }
.rs.dragging .rs-thumb { cursor: grabbing; transform: scale(1.15); }
.rs.dragging .rs-rail { cursor: grabbing; }
.rs-thumb.off { background: var(--bg); box-shadow: inset 0 0 0 2.5px var(--brand), 0 0 0 3px var(--bg); }
.rs-bubble { position: absolute; bottom: calc(100% + 9px); left: 50%; transform: translateX(-50%); padding: 3px 8px; border-radius: 7px; background: var(--brand-soft); color: var(--brand-text); font-size: 12px; font-weight: 700; line-height: 16px; white-space: nowrap; pointer-events: none; transition: background .12s ease, color .12s ease; }
.rs-bubble.l { left: -4px; transform: none; }
.rs-bubble.r { left: auto; right: -4px; transform: none; }
.rs.dragging .rs-bubble, .rs-thumb:focus-visible .rs-bubble { background: var(--brand); color: #fff; }
.rs-ticks { position: relative; height: 22px; margin-top: 7px; pointer-events: none; }
.rs-tick { position: absolute; top: 0; width: 3px; height: 3px; margin-left: -1.5px; border-radius: 50%; background: var(--guide); opacity: .55; }
.rs-tick.hour { width: 1px; height: 5px; margin-left: -.5px; border-radius: 0; opacity: .8; }
.rs-tick.lab { width: auto; height: auto; margin-left: 0; padding-top: 7px; border-radius: 0; background: none; opacity: 1; transform: translateX(-50%); font-size: 11.5px; color: var(--subtle); white-space: nowrap; }
.rs-tick.lab::before { content: ""; position: absolute; top: 0; left: 50%; width: 1px; height: 5px; background: var(--guide); }
.rs-tick.lab.start { transform: translateX(-4px); }
.rs-tick.lab.start::before { left: 4px; }
.rs-tick.lab.end { transform: translateX(calc(-100% + 4px)); }
.rs-tick.lab.end::before { left: auto; right: 4px; }
.wfh-snooze { display: flex; gap: 6px; flex: none; }

/* Auto clock-out: a highlighted card in the tab; set up in a pop-up. */
.auto-card { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 14px; border-radius: 14px; border: 1.5px dashed var(--brand-line); background: var(--bg); }
.auto-card.on { border: 1.5px solid transparent; background: var(--brand-soft); }
.auto-ic { flex: none; width: 36px; height: 36px; padding: 7px; border-radius: 11px; color: var(--brand-text); background: var(--brand-soft); }
.auto-card.on .auto-ic { color: #fff; background: var(--brand); }
.auto-text { flex: 1; min-width: 0; }
.auto-title { font-size: 14.5px; font-weight: 650; letter-spacing: -.005em; }
.auto-status { margin-top: 1px; font-size: 12.5px; line-height: 1.4; color: var(--muted); }
.auto-status b { color: var(--brand-text); font-weight: 700; }
.auto-status.good { color: var(--good); }
.auto-status.warn { color: var(--warn); }
.auto-actions { display: flex; align-items: center; gap: 4px; flex: none; }
.auto-card .btn-primary { height: 34px; padding: 0 14px; }
.modal-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 22px 6px; }
.modal-body .wfh-h { margin-top: 16px; }
.auto-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 12px; background: var(--surface); }
.auto-switch b { font-size: 14px; font-weight: 600; }
.auto-switch small { display: block; font-size: 12.5px; color: var(--muted); }
.auto-fields.off { opacity: .5; }
.switch.bare { padding: 0 4px; height: 26px; }
.how b { white-space: nowrap; }
.modal-note { margin-top: 12px; font-size: 12.5px; line-height: 1.45; color: var(--subtle); text-wrap: pretty; }
.modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 12px 22px 16px; border-top: 1px solid var(--line); }
.modal-actions .btn-sm { height: 36px; padding: 0 14px; }

/* Changing the time: 12-hour pickers, scope, and an explicit Update. */
.wfh-h { margin: 0 0 9px; font-size: 13.5px; font-weight: 600; }
.time-row { display: flex; align-items: center; gap: 6px; }
.time-sel { height: 38px; padding: 0 30px 0 13px; border: 1px solid var(--line-hover); border-radius: 10px; color: var(--text); font: inherit; font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; cursor: pointer; appearance: none; -webkit-appearance: none;
  background: var(--bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5' fill='none' stroke='%238793a1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 9px center / 15px; }
.time-sel:hover { border-color: var(--brand-line); }
.time-sel:focus { outline: none; border-color: var(--brand); }
.time-colon { font-size: 18px; font-weight: 700; color: var(--subtle); }
.seg { display: flex; padding: 3px; border-radius: 10px; background: var(--surface); }
.seg button { flex: 1; height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--muted); white-space: nowrap; transition: background .18s ease, color .18s ease, box-shadow .18s ease; }
.seg button:hover { color: var(--text); }
.seg button[aria-checked="true"] { background: var(--tab-ind); box-shadow: var(--tab-ind-shadow); color: var(--brand-text); }
.time-row .seg { margin-left: 6px; }
.form-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.form-row .seg { flex: 1; min-width: 0; }
.btn-primary { flex: none; height: 36px; padding: 0 16px; border-radius: 10px; background: var(--brand); color: #fff; font-size: 13.5px; font-weight: 650; white-space: nowrap; transition: filter .14s ease, background .14s ease; }
.btn-primary:hover { filter: brightness(1.06); }
.btn-primary:disabled { background: var(--meter-off); color: var(--subtle); cursor: default; filter: none; }
.form-msg { margin-top: 8px; font-size: 12.5px; color: var(--good); }
.form-msg.err { color: var(--warn); }

/* The rules, in plain words. */
.how { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.how li { position: relative; padding-left: 15px; font-size: 13px; line-height: 1.45; color: var(--muted); text-wrap: pretty; }
.how li::before { content: ""; position: absolute; left: 2px; top: .58em; width: 5px; height: 5px; border-radius: 50%; background: var(--brand-line); }
.how b { color: var(--text); font-weight: 600; }

.wfh-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); }
.wfh-foot-note { flex: 1; min-width: 0; font-size: 12px; line-height: 1.45; color: var(--subtle); }
.btn-sm { height: 30px; padding: 0 11px; border-radius: 8px; background: var(--bg); box-shadow: inset 0 0 0 1px var(--line-hover); font-size: 12.5px; font-weight: 600; color: var(--text); white-space: nowrap; transition: box-shadow .14s ease; }
.btn-sm:hover { box-shadow: inset 0 0 0 1px var(--brand); }
.btn-sm:disabled { opacity: .55; cursor: default; box-shadow: inset 0 0 0 1px var(--line); }
.btn-sm.quiet { margin-left: auto; background: transparent; box-shadow: none; color: var(--muted); }
.btn-sm.quiet:hover { color: var(--text); box-shadow: inset 0 0 0 1px var(--line-hover); }


@keyframes kh-in { from { opacity: 0; transform: translateY(4px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes kh-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes kh-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes kh-pop { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes kh-pulse { 50% { opacity: .35; } }
@keyframes kh-saved { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }
@keyframes kh-ping { 0% { transform: scale(1); opacity: .6; } 75%, 100% { transform: scale(2.8); opacity: 0; } }
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

  function includeSwitchHtml(on) {
    return `
      <div class="has-tip">
        <button class="switch" type="button" role="switch" data-act="include-today" aria-checked="${on}" aria-describedby="include-tip">
          <span>Include today</span><span class="track"><span class="thumb"></span></span>
        </button>
        <div class="tip end" role="tooltip" id="include-tip">Use after clock-out, once today shows in the table</div>
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
    const period = m.monthToDate && m.todayKey ? fmt.monthToDateRange(m.todayKey) : (m.label || '');
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

  const pad2 = n => String(n).padStart(2, '0');

  /** 'HH:MM' -> { hour: 1-12, minute, ap: 'AM' | 'PM' } */
  function to12(hhmm) {
    const t = W.parseTime(hhmm) || 0;
    const h = Math.floor(t / 60);
    return { hour: h % 12 || 12, minute: t % 60, ap: h < 12 ? 'AM' : 'PM' };
  }

  /** { hour, minute, ap } -> 'HH:MM' */
  function to24({ hour, minute, ap }) {
    return `${pad2((hour % 12) + (ap === 'PM' ? 12 : 0))}:${pad2(minute)}`;
  }

  /** 179 min -> "in 2h 59m", 12 -> "in 12 min" */
  function inLabel(ms) {
    const m = Math.max(0, Math.ceil(ms / 60000));
    return m >= 60 ? `in ${Math.floor(m / 60)}h ${pad2(m % 60)}m` : `in ${m} min`;
  }

  /** 1140 -> "7 PM" (slider hour labels) */
  function hourLabelOf(minutes) {
    const h = Math.floor(minutes / 60);
    return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
  }

  /** Minutes since midnight of a timestamp (for placing it on the slider). */
  function minutesOf(ms) {
    const d = new Date(ms);
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }

  /** Thumb / bubble placement for a minute value: { x: '37.50', edge: '' | 'l' | 'r', onScale }. */
  function sliderPlace(minutes) {
    const f = Math.max(0, Math.min(1, W.sliderFraction(minutes)));
    return { x: (f * 100).toFixed(2), edge: f < 0.09 ? 'l' : f > 0.91 ? 'r' : '', onScale: minutes >= W.SLIDER.min && minutes <= W.SLIDER.max };
  }

  /** "7:00 PM", or "9:30 PM ›" / "‹ 11:30 AM" for a custom time past either end. */
  function sliderText(minutes) {
    const label = W.hhmmLabel(W.timeFromMinutes(minutes));
    if (minutes > W.SLIDER.max) return `${label} ›`;
    if (minutes < W.SLIDER.min) return `‹ ${label}`;
    return label;
  }

  /**
   * The reminder time slider (12 PM–8 PM, half hours). The thumb is the set
   * time; when clocked in, the track also shows the day so far and "now".
   * A custom time off the scale sits at the nearest end as a hollow thumb.
   */
  function sliderHtml(p, now, savedAt) {
    const S = W.SLIDER;
    const setting = p.nextTime || p.time; // the saved time (today may still use an earlier one)
    const value = W.parseTime(setting);
    const at = sliderPlace(value);
    const label = W.hhmmLabel(setting);
    const pct = m => (Math.max(0, Math.min(1, W.sliderFraction(m))) * 100).toFixed(2);
    const marks = [];
    for (let m = S.min; m <= S.max; m += S.step) {
      if (m % 120 === 0) {
        const edge = m === S.min ? ' start' : m === S.max ? ' end' : '';
        marks.push(`<span class="rs-tick lab${edge}" style="left:${pct(m)}%">${hourLabelOf(m)}</span>`);
      } else {
        marks.push(`<span class="rs-tick${m % 60 === 0 ? ' hour' : ''}" style="left:${pct(m)}%"></span>`);
      }
    }
    let day = '';
    if (p.state === 'in' && p.firstIn != null) {
      const from = Number(pct(minutesOf(p.firstIn)));
      const to = minutesOf(now);
      day = `<span class="rs-fill" style="left:${from}%;width:${Math.max(0, Number(pct(to)) - from).toFixed(2)}%"></span>`;
      if (to >= S.min && to <= S.max) day += `<span class="rs-now" style="left:${pct(to)}%" title="Now, ${W.timeLabel(now)}"></span>`;
    }
    const saved = savedAt && Date.now() - savedAt < 2200 ? '<span class="rs-saved" role="status">Saved</span>' : '';
    return `
      <div class="rs" data-value="${value}" data-saved="${value}">
        <div class="rs-head">
          <span class="rs-title">Reminder time</span>
          ${saved || '<span class="rs-hint">drag to change</span>'}
          <button class="btn-sm" type="button" data-act="rem-custom" aria-haspopup="dialog">Custom time</button>
        </div>
        <div class="rs-rail">
          <div class="rs-track">
            ${day}
            <span class="rs-ghost"></span>
            <span class="rs-thumb${at.onScale ? '' : ' off'}" role="slider" tabindex="0" aria-label="Reminder time"
              aria-valuemin="${S.min}" aria-valuemax="${S.max}" aria-valuenow="${W.snapToSlider(value)}"
              aria-valuetext="${esc(label)}${at.onScale ? '' : ' (custom)'}" style="left:${at.x}%"><span class="rs-bubble${at.edge ? ` ${at.edge}` : ''}"${at.onScale ? '' : ' title="Custom time, off the 12 PM–8 PM scale"'}>${esc(sliderText(value))}</span></span>
          </div>
          <div class="rs-ticks">${marks.join('')}</div>
        </div>
        ${p.nextTime ? `<div class="rs-note"><b>${esc(label)}</b> starts on your next WFH day, as it had already passed today. Today's reminder stays at <b>${esc(W.hhmmLabel(p.time))}</b>.</div>` : ''}
      </div>`;
  }

  /** Hour : minute selects and the AM / PM buttons (named by `act`) for a 12-hour time. */
  function timePartsHtml(v, act) {
    const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
    if (!minutes.includes(v.minute)) minutes.push(v.minute);
    minutes.sort((a, b) => a - b);
    const opt = (value, label, on) => `<option value="${value}"${on ? ' selected' : ''}>${label}</option>`;
    const seg = (value, on) => `<button type="button" role="radio" data-act="${act}" data-value="${value}" aria-checked="${on}">${value}</button>`;
    return {
      selects: `
        <select class="time-sel" data-field="hour" aria-label="Hour">${Array.from({ length: 12 }, (_, i) => i + 1).map(h => opt(h, h, h === v.hour)).join('')}</select>
        <span class="time-colon">:</span>
        <select class="time-sel" data-field="minute" aria-label="Minute">${minutes.map(m => opt(m, pad2(m), m === v.minute)).join('')}</select>`,
      ampm: `<div class="seg" role="radiogroup" aria-label="AM or PM">${seg('AM', v.ap === 'AM')}${seg('PM', v.ap === 'PM')}</div>`,
    };
  }

  /** Separate selects + AM-PM (the auto clock-out pop-up). */
  function timePickerHtml(v, act) {
    const t = timePartsHtml(v, act);
    return `<div class="time-row">${t.selects}${t.ampm}</div>`;
  }

  /** The tab's auto clock-out card: what will happen today, Set up / Edit, and Reset for today's state. */
  function autoRowHtml(ap, resettable) {
    const t = W.timeLabel;
    const upcoming = ap.next && ap.next.on ? ap.next : null; // starts on the next WFH day
    const on = ap.on || !!upcoming;
    let text;
    let tone = '';
    switch (ap.status) {
      case 'off': text = 'Let Keka Hours clock you out at a set time on WFH days.'; break;
      case 'scheduled': case 'heads-up':
        text = `Clocks you out at <b>${t(ap.at)}</b>${upcoming ? ' today' : ' on WFH days'}.`; break;
      case 'waiting': text = `On at <b>${t(ap.at)}</b>, once you clock in.`; break;
      case 'standby': text = 'Paused: you\'re clocked out.'; break;
      case 'due': case 'running': text = 'Clocking you out…'; break;
      case 'done': text = `Clocked you out at ${t(ap.doneAt || ap.at)}.`; tone = 'good'; break;
      case 'failed': text = 'Didn\'t work today. Clock out yourself.'; tone = 'warn'; break;
      case 'skipped': text = `Skipped today (${t(ap.at)}).`; break;
      case 'late-start': text = `Not today: you clocked in after ${t(ap.at)}.`; break;
      case 'missed': text = `Not today: you weren't clocked in at ${t(ap.at)}.`; break;
      default: text = 'Not today.';
    }
    if (upcoming && !ap.on) text = `Starts on your next WFH day at <b>${W.hhmmLabel(upcoming.time)}</b>.`;
    else if (upcoming && upcoming.time !== ap.time) text += ` From your next WFH day: <b>${W.hhmmLabel(upcoming.time)}</b>.`;
    const reset = resettable && ap.on
      ? '<button class="btn-sm quiet" type="button" data-act="wfh-auto-reset" title="Clear today\'s skip, delay or result so it runs again at its time">Reset</button>'
      : '';
    const open = on
      ? '<button class="btn-sm" type="button" data-act="auto-open" aria-haspopup="dialog">Edit</button>'
      : '<button class="btn-primary" type="button" data-act="auto-open" aria-haspopup="dialog">Set up</button>';
    return `
      <section class="auto-card${on ? ' on' : ''}" aria-label="Auto clock-out">
        <span class="auto-ic">${ICON_AUTO}</span>
        <div class="auto-text"><div class="auto-title">Auto clock-out</div><div class="auto-status ${tone}">${text}</div></div>
        <div class="auto-actions">${reset}${open}</div>
      </section>`;
  }

  /** Auto clock-out pop-up. `v` = { on, hour, minute, ap }. */
  function autoModalHtml(v, error) {
    const past = v.on && pickPassed(v);
    return `
      <div class="modal-head">
        <div><div class="modal-title" id="kh-modal-title">Auto clock-out</div><div class="modal-sub">Clocks you out of Keka at a set time on WFH days.</div></div>
        <button class="icon-btn" type="button" data-act="modal-close" aria-label="Close" title="Close">${ICON_CLOSE}</button>
      </div>
      <div class="modal-body auto-form">
        <div class="auto-switch">
          <div><b>Clock me out automatically</b><small>${v.on ? 'On, at the time below' : 'Off'}</small></div>
          <button class="switch bare" type="button" role="switch" data-act="auto-toggle" aria-checked="${v.on}" aria-label="Auto clock-out"><span class="track"><span class="thumb"></span></span></button>
        </div>
        <div class="auto-fields${v.on ? '' : ' off'}">
          <h4 class="wfh-h">Clock me out at</h4>
          ${timePickerHtml(v, 'auto-ap')}
          ${error ? `<div class="form-msg err" role="status">${esc(error)}</div>` : ''}
          ${past ? '<div class="modal-note past" role="status">That time has already passed today, so auto clock-out starts on your next WFH day. Today stays as it is.</div>' : ''}
        </div>
        <h4 class="wfh-h">What happens</h4>
        <ul class="how">
          <li>5 min before, a notification lets you <b>skip today</b> or add <b>15 min</b>.</li>
          <li>At the time, Keka opens in a background tab, clicks <b>WFH Clock-out</b> and confirms, then the tab closes.</li>
          <li>If it can't, you get an alert to clock out yourself.</li>
          <li>Never after <b>${W.hhmmLabel(W.LATEST_TIME)}</b>, and only if you're clocked in then.</li>
        </ul>
        <div class="modal-note">Needs Chrome running, your laptop awake, and you signed in to Keka.</div>
      </div>
      <div class="modal-actions">
        <button class="btn-sm" type="button" data-act="modal-close">Cancel</button>
        <button class="btn-primary" type="button" data-act="auto-save">Save</button>
      </div>`;
  }

  /** True when the 12-hour pick `v` is a valid time that has already passed today. */
  function pickPassed(v) {
    const time = to24(v);
    return !!W.validTime(time) && W.passedToday(time, Date.now());
  }

  /** "Custom time" pop-up for the reminder. `v` = { hour, minute, ap }. */
  function remTimeModalHtml(v, error) {
    const past = pickPassed(v);
    return `
      <div class="modal-head">
        <div><div class="modal-title" id="kh-modal-title">Custom reminder time</div><div class="modal-sub">Any time up to ${W.hhmmLabel(W.LATEST_TIME)}, on every WFH day.</div></div>
        <button class="icon-btn" type="button" data-act="modal-close" aria-label="Close" title="Close">${ICON_CLOSE}</button>
      </div>
      <div class="modal-body rem-form">
        <h4 class="wfh-h">Remind me at</h4>
        ${timePickerHtml(v, 'rem-ap')}
        ${error ? `<div class="form-msg err" role="status">${esc(error)}</div>` : ''}
        <div class="modal-note${past ? ' past' : ''}" role="status">${past
          ? 'That time has already passed today, so it starts on your next WFH day. Today keeps its current reminder.'
          : 'The slider covers 12 PM to 8 PM in half hours. Use this for any other time.'}</div>
      </div>
      <div class="modal-actions">
        <button class="btn-sm" type="button" data-act="modal-close">Cancel</button>
        <button class="btn-primary" type="button" data-act="rem-save">Save</button>
      </div>`;
  }

  /**
   * WFH tab. `wfhState` = { settings, day } from storage (the worker owns the
   * day); everything shown is derived with the same rules the worker uses.
   * `form` = { savedAt, testMsg } held by the widget between renders.
   */
  function wfhHtml(wfhState, now, form) {
    const today = W.dateKeyOf(now);
    const settings = W.normalizeSettings(wfhState && wfhState.settings);
    const raw = wfhState && wfhState.day;
    const p = W.plan(raw && raw.date === today ? raw : W.emptyDay(today), settings, now);
    const t = W.timeLabel;
    const set = W.hhmmLabel(p.time);

    // ---- today
    let state;
    if (p.state === 'in') state = `<span class="live-dot on"></span>${p.firstIn != null ? `Clocked in ${t(p.firstIn)}` : 'Clocked in'}`;
    else if (p.state === 'out') state = `<span class="live-dot"></span>Clocked out at ${t(p.lastOut)}`;
    else state = '<span class="live-dot"></span>Not clocked in';

    let label;
    let big;
    let right = '';
    let sub = '';
    let extra = '';
    if (p.state === 'none') {
      label = 'Today\'s reminder';
      big = `<span class="wfh-time-big" data-live="time" data-orig="${t(p.configured)}">${t(p.configured)}</span>`;
      sub = 'Starts when you use WFH Clock-In.';
    } else if (p.state === 'out') {
      label = 'Today\'s reminder';
      big = '<span class="wfh-time-big word off">Off</span>';
      sub = 'You\'re clocked out. It comes back on if you clock in again.';
    } else if (p.remindAt == null) {
      label = 'Today\'s reminder';
      big = '<span class="wfh-time-big word off">None</span>';
      sub = `You clocked in too late to be reminded before the ${t(p.end)} limit.`;
    } else if (p.stopped) {
      label = 'Today\'s reminder';
      big = '<span class="wfh-time-big word off">Off</span>';
      sub = 'You stopped it for today.';
      right = '<button class="btn-sm" type="button" data-act="wfh-resume">Turn back on</button>';
    } else if (p.snoozed) {
      label = 'Snoozed until';
      big = `<span class="wfh-time-big word warn">${t(p.nextAt)}</span>`;
      sub = `Next reminder ${inLabel(p.nextAt - now)}.`;
      const atCap = p.nextAt >= p.end - 5 * 60000;
      right = `
        <span class="wfh-snooze">
          <button class="btn-sm" type="button" data-act="wfh-snooze-cancel">Cancel snooze</button>
          <button class="btn-sm" type="button" data-act="wfh-snooze-more"${atCap ? ' disabled title="Can\'t snooze past the limit"' : ''}>+15 min</button>
        </span>`;
    } else if (p.reminding || p.due) {
      label = 'Past your reminder';
      big = '<span class="wfh-time-big word warn">Clock out</span>';
      sub = p.nextAt != null
        ? `Next at <b>${t(p.nextAt)}</b>, then every 15 min until ${t(p.end)}.`
        : `Reminders ended at the ${t(p.end)} limit.`;
      if (p.nextAt != null) right = '<button class="btn-sm" type="button" data-act="wfh-stop">Stop for today</button>';
    } else {
      label = 'Reminder at';
      // The set time itself: follows the slider live while it's dragged.
      const live = p.reason === 'time';
      big = `<span class="wfh-time-big"${live ? ` data-live="time" data-orig="${t(p.remindAt)}"` : ''}>${t(p.remindAt)}</span>`;
      right = `<span class="wfh-in"${live ? ` data-live-in data-orig="${inLabel(p.remindAt - now)}"` : ''}>${inLabel(p.remindAt - now)}</span>`;
      if (p.reason === 'late') sub = `You clocked in after ${set}, so it's 30 min after clock-in.`;
    }
    if (p.state === 'in' && p.firstIn == null) sub = 'Couldn\'t read your clock-in time yet. Reload this page to load it.';

    const synced = p.updatedAt ? `Synced with Keka ${fmt.relative(p.updatedAt, now)}.` : 'Not synced with Keka yet today.';

    return `
      <div class="wfh">
        ${autoRowHtml(W.autoPlan(raw && raw.date === today ? raw : W.emptyDay(today), settings, now), !!(raw && raw.date === today && W.autoResettable(raw)))}

        <section class="rem" aria-labelledby="kh-rem-title">
          <div class="rem-head"><h3 id="kh-rem-title">Clock-out reminder</h3><span class="wfh-state">${state}</span></div>

          <div class="wfh-today">
            <div class="wfh-label">${label}</div>
            <div class="wfh-big">${big}${right}</div>
            ${sub ? `<div class="wfh-sub">${sub}</div>` : ''}
            ${extra}
          </div>

          ${sliderHtml(p, now, form.savedAt)}

          <ul class="how" aria-label="How the reminder works">
            <li>At <b>${set}</b> a Chrome notification reminds you to clock out, and stays until you act on it.</li>
            <li><b>${W.hhmmLabel(W.LATEST_TIME)}</b> is the hard limit: reminders can't go past it.</li>
          </ul>
        </section>

        <div class="wfh-foot">
          <span class="wfh-foot-note">${esc(form.testMsg || synced)}</span>
          <button class="btn-sm" type="button" data-act="wfh-test">Send test reminder</button>
        </div>
      </div>`;
  }

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
    // WFH tab form, kept across re-renders: unsaved edits, the last Update result, the test result.
    const wfhForm = { savedAt: 0, testMsg: null };
    let wfhPending = false; // a re-render waiting for the slider / a time picker to be let go
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
    let modalKind = 'daylog'; // 'daylog' (average's ⓘ) | 'auto' (auto clock-out) | 'remtime' (custom reminder time)
    let autoDraft = null; // the auto clock-out form while the pop-up is open
    let autoError = null;
    let remDraft = null; // the custom reminder time while its pop-up is open
    let remError = null;

    /** Fill the modal. The day log follows the model (keeping its scroll); the auto form only redraws on its own edits. */
    function renderModal(force) {
      if (!modalOpen) return;
      if (modalKind === 'auto' || modalKind === 'remtime') {
        if (force) modalCard.innerHTML = modalKind === 'auto' ? autoModalHtml(autoDraft, autoError) : remTimeModalHtml(remDraft, remError);
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
      const opener = { auto: '[data-act="auto-open"]', remtime: '[data-act="rem-custom"]' }[modalKind] || '[data-act="avg-info"]';
      const back = restoreFocus && content.querySelector(opener);
      if (back) back.focus({ preventScroll: true });
    }

    /** Open the auto clock-out pop-up with the current settings. */
    function openAuto() {
      const a = W.autoFor(wfhState.settings, W.dateKeyOf(Date.now()));
      const saved = a.next || a; // what's saved, even if today still runs an earlier one
      autoDraft = { on: saved.on, ...to12(saved.time) };
      autoError = null;
      openModal('auto');
    }

    /** Pull the open pop-up's hour / minute selects into `draft` (buttons update it directly). */
    function readModalSelects(draft) {
      const hour = modalCard.querySelector('[data-field="hour"]');
      const minute = modalCard.querySelector('[data-field="minute"]');
      if (!draft || !hour || !minute) return;
      draft.hour = Number(hour.value);
      draft.minute = Number(minute.value);
    }

    function saveAuto() {
      readModalSelects(autoDraft);
      const time = to24(autoDraft);
      if (!W.validTime(time)) {
        autoError = `Pick a time up to ${W.hhmmLabel(W.LATEST_TIME)}.`;
        renderModal(true);
        return;
      }
      // The Auto clock-out card shows the result; no separate message.
      handlers.onAutoSave({ on: autoDraft.on, time });
      closeModal(true);
      renderWfh();
    }

    /** "Custom time" for the reminder: the same 12-hour picker, any time up to 10 PM. */
    function openRemTime() {
      const t = W.timeFor(wfhState.settings, W.dateKeyOf(Date.now()));
      remDraft = to12(t.next || t.time);
      remError = null;
      openModal('remtime');
    }

    function saveRemTime() {
      readModalSelects(remDraft);
      const time = to24(remDraft);
      if (!W.validTime(time)) {
        remError = `Pick a time up to ${W.hhmmLabel(W.LATEST_TIME)}.`;
        renderModal(true);
        return;
      }
      wfhForm.savedAt = Date.now();
      handlers.onWfhSaveTime({ time });
      closeModal(true);
      renderWfh();
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
      else if (act === 'rem-custom') openRemTime();
      else if (act === 'rem-save') saveRemTime();
      else if (act === 'rem-ap') {
        readModalSelects(remDraft);
        remDraft.ap = el.getAttribute('data-value');
        remError = null;
        renderModal(true);
        const again = modalCard.querySelector(`[data-act="rem-ap"][data-value="${remDraft.ap}"]`);
        if (again && e.detail === 0) again.focus({ preventScroll: true });
      }
      else if (act === 'wfh-snooze-cancel' || act === 'wfh-snooze-more' || act === 'wfh-stop' || act === 'wfh-resume' || act === 'wfh-auto-reset') handlers.onWfhAction(act);
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
          const next = $('[data-act="include-today"]');
          if (viaKeyboard && next) next.focus({ preventScroll: true });
        }, reduceMotion() ? 0 : 180);
      }
      else if (act === 'avg-info') openModal('daylog');
      else if (act === 'auto-open') openAuto();
      else if (act === 'auto-save') saveAuto();
      else if (act === 'auto-toggle' || act === 'auto-ap') {
        readModalSelects(autoDraft);
        if (act === 'auto-toggle') autoDraft.on = !autoDraft.on;
        else autoDraft.ap = el.getAttribute('data-value');
        autoError = null;
        renderModal(true);
        const again = modalCard.querySelector(`[data-act="${act}"]${act === 'auto-toggle' ? '' : `[data-value="${el.getAttribute('data-value')}"]`}`);
        if (again && e.detail === 0) again.focus({ preventScroll: true });
      }
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
      // Don't yank a time picker away while it's open.
      const editing = editingWfh();
      const keep = editing ? content.querySelector('[data-pane="wfh"]') : null;
      content.innerHTML = `
        <div class="panes">
          <div class="pane" data-pane="overview">${overviewHtml(s, m)}</div>
          <div class="pane" data-pane="plan">${planHtml(m.plan)}</div>
          <div class="pane" data-pane="wfh">${keep ? '' : wfhHtml(wfhState, Date.now(), wfhForm)}</div>
        </div>`;
      if (keep) { content.querySelector('[data-pane="wfh"]').replaceWith(keep); wfhPending = true; }
      showTab();
    }

    // ---- Reminder time slider -------------------------------------------
    // Pointer: press anywhere on the rail to jump, drag to adjust (snaps to
    // half hours), release to save. Keyboard on the thumb: ← → / ↑ ↓ 30 min,
    // PgUp / PgDn 1 h, Home / End, saved 0.8 s after the last key (or on blur
    // / Enter). The tab never re-renders mid-edit.
    let slide = null; // { rs, track, rail, pointerId } while dragging
    let slideKeys = null; // { rs, timer } while a keyboard change waits to be saved

    function editingWfh() {
      if (slide || slideKeys) return true;
      const a = shadow.activeElement;
      return !!(a && a.classList && a.classList.contains('time-sel'));
    }

    /** Re-render only the WFH tab (cheap; leaves the other tabs' scroll / hover alone). */
    function renderWfh() {
      const pane = content.querySelector('[data-pane="wfh"]');
      if (!expanded || !pane) return;
      if (editingWfh()) { wfhPending = true; return; }
      wfhPending = false;
      const a = shadow.activeElement;
      const thumbFocused = !!(a && a.classList && a.classList.contains('rs-thumb'));
      pane.innerHTML = wfhHtml(wfhState, Date.now(), wfhForm);
      if (thumbFocused) {
        const thumb = pane.querySelector('.rs-thumb');
        if (thumb) thumb.focus({ preventScroll: true });
      }
    }

    function setWfh(next) {
      wfhState = next || { settings: null, day: null };
      renderWfh();
    }

    /** The slider's value at a pointer x position. */
    function slideValueAt(track, clientX) {
      const r = track.getBoundingClientRect();
      return W.sliderValueAt(r.width > 0 ? (clientX - r.left) / r.width : 0);
    }

    /** Show `minutes` on the slider (thumb, bubble, a11y) and live in the card. Doesn't save. */
    function showSlide(rs, minutes) {
      const thumb = rs.querySelector('.rs-thumb');
      const bubble = rs.querySelector('.rs-bubble');
      const at = sliderPlace(minutes);
      const label = W.hhmmLabel(W.timeFromMinutes(minutes));
      rs.dataset.value = String(minutes);
      thumb.style.left = `${at.x}%`;
      thumb.classList.toggle('off', !at.onScale);
      thumb.setAttribute('aria-valuenow', String(minutes));
      thumb.setAttribute('aria-valuetext', label);
      bubble.textContent = sliderText(minutes);
      bubble.removeAttribute('title');
      bubble.classList.toggle('l', at.edge === 'l');
      bubble.classList.toggle('r', at.edge === 'r');
      // A time that has already passed today only starts on the next WFH day:
      // say so, and keep today's time in the card. Otherwise today follows along.
      const past = W.passedToday(W.timeFromMinutes(minutes), Date.now());
      const hint = rs.querySelector('.rs-hint');
      if (hint) {
        hint.textContent = past ? 'past for today: starts next WFH day' : 'drag to change';
        hint.classList.toggle('past', past);
      }
      const pane = rs.closest('[data-pane="wfh"]');
      const big = pane && pane.querySelector('[data-live="time"]');
      if (big) big.textContent = past ? big.dataset.orig : label;
      const until = pane && pane.querySelector('[data-live-in]');
      if (until) {
        const d = new Date();
        const at2 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60).getTime();
        until.textContent = past ? until.dataset.orig : inLabel(at2 - Date.now());
      }
    }

    /** Save the slider's value if it changed; then let the tab re-render. */
    function commitSlide(rs) {
      const value = Number(rs.dataset.value);
      const saved = Number(rs.dataset.saved);
      if (slideKeys) clearTimeout(slideKeys.timer);
      slide = null;
      slideKeys = null;
      rs.classList.remove('dragging');
      if (value !== saved && W.validTime(W.timeFromMinutes(value))) {
        rs.dataset.saved = String(value);
        wfhForm.savedAt = Date.now();
        handlers.onWfhSaveTime({ time: W.timeFromMinutes(value) }); // re-renders via setWfh
      } else if (wfhPending) {
        renderWfh();
      }
    }

    /** Put the slider back to its saved value (a cancelled drag). */
    function revertSlide(rs) {
      slide = null;
      rs.classList.remove('dragging');
      showSlide(rs, Number(rs.dataset.saved));
      if (wfhPending) renderWfh();
    }

    shadow.addEventListener('pointerdown', e => {
      const rail = e.target.closest && e.target.closest('.rs-rail');
      if (!rail || slide) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rs = rail.closest('.rs');
      const track = rs.querySelector('.rs-track');
      e.preventDefault(); // no text selection / focus jump
      if (slideKeys) { clearTimeout(slideKeys.timer); slideKeys = null; }
      slide = { rs, track, rail, pointerId: e.pointerId };
      try { rail.setPointerCapture(e.pointerId); } catch (_) { /* synthetic / already released */ }
      rs.classList.add('dragging');
      rs.querySelector('.rs-thumb').focus({ preventScroll: true });
      showSlide(rs, slideValueAt(track, e.clientX));
    });

    shadow.addEventListener('pointermove', e => {
      if (slide) {
        if (e.pointerId === slide.pointerId) showSlide(slide.rs, slideValueAt(slide.track, e.clientX));
        return;
      }
      // Mouse hover: a faint dot where a click would land.
      if (e.pointerType !== 'mouse') return;
      const rail = e.target.closest && e.target.closest('.rs-rail');
      if (!rail) return;
      const track = rail.querySelector('.rs-track');
      const ghost = rail.querySelector('.rs-ghost');
      ghost.style.left = `${sliderPlace(slideValueAt(track, e.clientX)).x}%`;
      ghost.classList.add('on');
    });

    const endSlide = e => {
      if (!slide || e.pointerId !== slide.pointerId) return;
      const { rs, rail } = slide;
      try { rail.releasePointerCapture(e.pointerId); } catch (_) { /* not captured */ }
      if (e.type === 'pointercancel') revertSlide(rs);
      else commitSlide(rs);
    };
    shadow.addEventListener('pointerup', endSlide);
    shadow.addEventListener('pointercancel', endSlide);
    shadow.addEventListener('lostpointercapture', endSlide);
    // Belt and braces: if pointer capture isn't available, a drag that leaves
    // the card still follows the pointer and still ends where it's released.
    window.addEventListener('pointermove', e => {
      if (slide && e.pointerId === slide.pointerId) showSlide(slide.rs, slideValueAt(slide.track, e.clientX));
    }, true);
    window.addEventListener('pointerup', endSlide, true);
    window.addEventListener('pointercancel', endSlide, true);

    const SLIDE_KEYS = { ArrowLeft: -30, ArrowDown: -30, ArrowRight: 30, ArrowUp: 30, PageDown: -60, PageUp: 60 };
    shadow.addEventListener('keydown', e => {
      const thumb = e.target.classList && e.target.classList.contains('rs-thumb') ? e.target : null;
      if (!thumb || slide) return;
      const rs = thumb.closest('.rs');
      const S = W.SLIDER;
      const current = W.snapToSlider(Number(rs.dataset.value));
      let next;
      if (e.key in SLIDE_KEYS) next = W.snapToSlider(current + SLIDE_KEYS[e.key]);
      else if (e.key === 'Home') next = S.min;
      else if (e.key === 'End') next = S.max;
      else if (e.key === 'Enter') { e.preventDefault(); if (slideKeys) commitSlide(rs); return; }
      else return;
      e.preventDefault();
      showSlide(rs, next);
      if (slideKeys) clearTimeout(slideKeys.timer);
      slideKeys = { rs, timer: setTimeout(() => commitSlide(rs), 800) };
    });

    // Pop-up time pickers: keep the draft and the "already passed today" note in step.
    shadow.addEventListener('change', e => {
      const el = e.target;
      if (!modalOpen || !el.classList || !el.classList.contains('time-sel') || !modalCard.contains(el)) return;
      const draft = modalKind === 'auto' ? autoDraft : modalKind === 'remtime' ? remDraft : null;
      if (!draft) return;
      readModalSelects(draft);
      if (modalKind === 'auto') autoError = null; else remError = null;
      renderModal(true);
      const again = modalCard.querySelector(`[data-field="${el.getAttribute('data-field')}"]`);
      if (again) again.focus({ preventScroll: true });
    });

    shadow.addEventListener('focusout', e => {
      const el = e.target;
      if (el.classList && el.classList.contains('rs-thumb') && slideKeys && !slide) commitSlide(slideKeys.rs);
      // A time picker or the slider let go: apply anything that arrived meanwhile.
      if (el.classList && (el.classList.contains('time-sel') || el.classList.contains('rs-thumb'))) {
        setTimeout(() => { if (wfhPending) renderWfh(); }, 0);
      }
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

    const api = { render, mount, applyTheme, setTheme, setWfh, renderWfh, contains: node => host === node || host.contains(node), isExpanded: () => expanded, host };
    host.__kekaHours = api;
    return api;
  }

  root.KekaHours.ui = { createWidget, HOST_ID };
})(globalThis);
