/*
 * WFH clock-out reminder rules (pure; shared by the service worker and the
 * WFH tab, unit-tested). No chrome.* calls here.
 *
 * Office attendance is biometric only, so any web punch (Keka's
 * "WFH Clock-In / Clock-out") means a WFH day, approved or not.
 *
 *  - Reminder at a fixed time of day: 6:30 PM unless the user picks another
 *    time (latest 10 PM), on every WFH day. In the tab it's set in a pop-up
 *    with −/+ 15 min (12 PM–10 PM) and a few quick picks.
 *  - Safety net: Keka marks a missed clock-out 12h after the first clock-in,
 *    so if first clock-in + 11h comes earlier, remind then instead.
 *  - Clocked in (or back in from a break) after the reminder time: remind
 *    30 min after that clock-in.
 *  - Ignored reminders repeat every 15 min. Snooze: 30 min from the
 *    notification, +15 min per click in the tab. "Stop for today" turns it
 *    off until the next day (the tab can turn it back on).
 *  - Everything stops quietly at the day's end: 10 PM, or Keka's 12h cutoff
 *    if that's earlier. Clocking out stops it at once.
 *
 * Auto clock-out (opt-in): at its own time (default reminder + 30 min, latest
 * 10 PM, never later than first clock-in + 11h), a 5-min heads-up
 * (Skip today / +15 min), then the worker opens Keka Attendance in a
 * background tab and clicks WFH Clock-out → Clock-out. At most once a day,
 * and only if you're clocked in then and clocked in before that time.
 *
 * Day state (persisted by the worker, one day at a time):
 *   { date: 'YYYY-MM-DD', source: 'api' | 'dom' | null, punches: [{ at, in }],
 *     domIn, updatedAt, snoozeUntil, lastShownAt, announcedFor, stoppedAt,
 *     autoSkip, autoDelay, autoHeadsUpFor, autoStatus, autoStartedAt, autoTabId, autoDoneAt }
 * Settings: { everyDay: 'HH:MM', auto: { every: { on, time } } }
 * (Older "today only" overrides are ignored: every setting applies to every WFH day.)
 * A time picked after it has already passed today starts on the next day; until then today
 * keeps what it had: { everyDayFrom, prevEveryDay } and auto: { from, prev: { on, time } }.
 */
(function (root) {
  'use strict';

  const MIN = 60000;
  const HOUR = 60 * MIN;
  const DEFAULT_TIME = '18:30';
  const LATEST_TIME = '22:00';
  const SAFETY_MS = 11 * HOUR;
  const CUTOFF_MS = 12 * HOUR;
  const LATE_START_MS = 30 * MIN;
  const REPEAT_MS = 15 * MIN;
  const SNOOZE_MS = 30 * MIN;
  const SNOOZE_STEP_MS = 15 * MIN;
  // Snoozing never swallows the last call before the day's end.
  const LAST_CALL_MS = 5 * MIN;
  const AUTO_AFTER_REMINDER_MS = 30 * MIN; // default auto clock-out time
  const AUTO_HEADS_UP_MS = 5 * MIN;
  const AUTO_DELAY_STEP_MS = 15 * MIN;
  const AUTO_TIMEOUT_MS = 90 * 1000; // give the background tab this long to clock out
  // Auto clock-out may run as late as 1 min before the day's end (Keka's cutoff / 10 PM).
  const AUTO_LAST_MS = MIN;

  const pad2 = n => String(n).padStart(2, '0');

  function dateKeyOf(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /** 'HH:MM' (24h) -> minutes since midnight, or null. */
  function parseTime(value) {
    const m = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    return h < 24 && mm < 60 ? h * 60 + mm : null;
  }

  /** A usable reminder time ('HH:MM', not after 10 PM), else null. */
  function validTime(value) {
    const t = parseTime(value);
    return t != null && t <= parseTime(LATEST_TIME) ? value : null;
  }

  /** Local epoch ms of 'HH:MM' on 'YYYY-MM-DD'. */
  function atTime(dateKey, hhmm) {
    const [y, mo, d] = dateKey.split('-').map(Number);
    const t = parseTime(hhmm);
    return new Date(y, mo - 1, d, Math.floor(t / 60), t % 60).getTime();
  }

  /** epoch ms -> "6:30 PM" */
  function timeLabel(ms) {
    const d = new Date(ms);
    const h = d.getHours();
    return `${h % 12 || 12}:${pad2(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
  }

  /** 'HH:MM' -> "6:30 PM" */
  function hhmmLabel(hhmm) {
    const t = parseTime(hhmm);
    return t == null ? '' : timeLabel(new Date(2000, 0, 1, Math.floor(t / 60), t % 60).getTime());
  }

  /** 125 min -> "2:05", 45 min -> "45m", 630 min -> "10h" (toolbar badge, max 4 chars). */
  function shortLeft(ms) {
    const total = Math.max(0, Math.ceil(ms / MIN));
    if (total >= 600) return `${Math.floor(total / 60)}h`; // "10h": "10:29" doesn't fit
    return total >= 60 ? `${Math.floor(total / 60)}:${pad2(total % 60)}` : `${total}m`;
  }

  const validDate = d => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

  function normalizeSettings(s) {
    const everyDay = validTime(s && s.everyDay) || DEFAULT_TIME;
    const from = validDate(s && s.everyDayFrom);
    const prev = validTime(s && s.prevEveryDay);
    const a = (s && s.auto) || {};
    const every = { on: !!(a.every && a.every.on === true), time: validTime(a.every && a.every.time) };
    const auto = { every };
    const aFrom = validDate(a.from);
    if (aFrom && a.prev) auto.prev = { on: a.prev.on === true, time: validTime(a.prev.time) };
    if (auto.prev) auto.from = aFrom;
    return from && prev ? { everyDay, everyDayFrom: from, prevEveryDay: prev, auto } : { everyDay, auto };
  }

  /** 'YYYY-MM-DD' -> the next calendar day. */
  function nextDateKey(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return dateKeyOf(new Date(y, m - 1, d + 1).getTime());
  }

  /** Has 'HH:MM' already passed today? */
  function passedToday(hhmm, now) {
    return atTime(dateKeyOf(now), hhmm) <= now;
  }

  /** 'HH:MM' + minutes, capped at 10 PM. */
  function addMinutes(hhmm, minutes) {
    const t = Math.min(parseTime(hhmm) + minutes, parseTime(LATEST_TIME));
    return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
  }

  /**
   * Auto clock-out on `dateKey`: { on, time } (default time: reminder + 30 min).
   * If a change starts later, also { next: { on, time }, from } and today keeps the old one.
   */
  function autoFor(settings, dateKey) {
    const s = normalizeSettings(settings);
    const fallback = addMinutes(timeFor(settings, dateKey).time, AUTO_AFTER_REMINDER_MS / MIN);
    const current = { on: s.auto.every.on, time: s.auto.every.time || fallback };
    if (s.auto.from && dateKey && dateKey < s.auto.from) {
      return { on: s.auto.prev.on, time: s.auto.prev.time || fallback, next: current, from: s.auto.from };
    }
    return current;
  }

  /** The reminder time on `dateKey`: { time }, plus { next, from } while a later change waits. */
  function timeFor(settings, dateKey) {
    const s = normalizeSettings(settings);
    if (s.everyDayFrom && dateKey && dateKey < s.everyDayFrom) return { time: s.prevEveryDay, next: s.everyDay, from: s.everyDayFrom };
    return { time: s.everyDay };
  }

  /**
   * Settings with a new reminder time. A time that has already passed today
   * starts on the next day; today keeps the time it was using.
   */
  function withReminderTime(settings, time, now) {
    const s = normalizeSettings(settings);
    const today = dateKeyOf(now);
    const base = { everyDay: time, auto: s.auto };
    const todays = timeFor(settings, today).time;
    if (!passedToday(time, now) || todays === time) return base;
    return { ...base, everyDayFrom: nextDateKey(today), prevEveryDay: todays };
  }

  /**
   * Settings with a new auto clock-out. Turning it on when today's run would
   * already be due starts it on the next day (today keeps what it had). That's
   * judged on the time it would really run today — the 11h safety time can
   * be earlier than the time picked — so it never clocks you out by surprise.
   * Anything else, including turning it off, applies now. `day` is today's
   * state (punches); without it only the picked time counts.
   */
  function withAutoClockOut(settings, { on, time }, now, day) {
    const s = normalizeSettings(settings);
    const today = dateKeyOf(now);
    const next = { on: !!on, time };
    const base = { ...s, auto: { every: next } };
    if (!on) return base;
    const todays = autoFor(settings, today);
    if (todays.on && todays.time === time) return base; // no change for today
    const d = day && day.date === today ? day : emptyDay(today);
    if (autoPlan(d, base, now).at > now) return base;
    return { ...s, auto: { every: next, prev: { on: todays.on, time: todays.time }, from: nextDateKey(today) } };
  }

  /** Would saving this reminder time make it start only on the next WFH day? */
  function reminderStartsTomorrow(settings, time, now) {
    return !!withReminderTime(settings, time, now).everyDayFrom;
  }

  /** Would saving this auto clock-out make it start only on the next WFH day? */
  function autoStartsTomorrow(settings, change, now, day) {
    return !!withAutoClockOut(settings, change, now, day).auto.from;
  }

  // ---- The time pop-up: −/+ 15 min between 12 PM and 10 PM, plus quick picks.
  const TIME_STEPS = { min: 12 * 60, max: parseTime(LATEST_TIME), step: 15 };
  const QUICK_TIMES = ['18:00', '18:30', '19:00', '19:30', '20:00'];

  /** Minutes since midnight -> 'HH:MM'. */
  function timeFromMinutes(m) {
    return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  }

  /**
   * −/+ (dir -1 / +1): to the neighbouring quarter hour, kept between 12 PM
   * and 10 PM. A time off the quarter hours (6:40 PM) goes to its neighbour
   * (6:30 / 6:45); one before 12 PM (an old custom 11:30 AM) only moves up.
   */
  function stepTime(minutes, dir) {
    const S = TIME_STEPS;
    if (dir > 0) {
      if (minutes >= S.max) return minutes;
      return Math.min(S.max, Math.floor(minutes / S.step) * S.step + S.step);
    }
    if (minutes <= S.min) return minutes;
    return Math.max(S.min, Math.ceil(minutes / S.step) * S.step - S.step);
  }

  function emptyDay(date) {
    return {
      date, source: null, punches: [], domIn: false, updatedAt: 0, snoozeUntil: null, lastShownAt: null, announcedFor: null, stoppedAt: null,
      autoSkip: false, autoDelay: 0, autoHeadsUpFor: null, autoStatus: null, autoStartedAt: null, autoTabId: null, autoDoneAt: null,
      autoSession: null,
    };
  }

  /** Punches -> { state: 'none' | 'in' | 'out', firstIn, lastIn, lastOut } (epoch ms). */
  function punchState(day) {
    const punches = (day && Array.isArray(day.punches) ? day.punches : [])
      .map(p => ({ at: Date.parse(p.at), in: p.in === true }))
      .filter(p => Number.isFinite(p.at))
      .sort((a, b) => a.at - b.at);
    if (!punches.length) {
      // DOM fallback: we know they're clocked in, not since when.
      const domIn = day && day.source === 'dom' && day.domIn === true;
      return { state: domIn ? 'in' : 'none', firstIn: null, lastIn: null, lastOut: null };
    }
    const ins = punches.filter(p => p.in);
    const outs = punches.filter(p => !p.in);
    return {
      state: punches[punches.length - 1].in ? 'in' : 'out',
      firstIn: ins.length ? ins[0].at : null,
      lastIn: ins.length ? ins[ins.length - 1].at : null,
      lastOut: outs.length ? outs[outs.length - 1].at : null,
    };
  }

  /**
   * Everything the worker and the WFH tab need for `day` at `now`.
   * remindAt: when reminding starts (null if it can't happen before the end).
   * reason: 'time' (the set time) | 'safety' (11h net) | 'late' (30 min after clock-in) | 'too-late'.
   * nextAt: the next notification (null when none is coming).
   */
  function plan(day, settings, now) {
    const ps = punchState(day);
    const chosen = timeFor(settings, day.date);
    const configured = atTime(day.date, chosen.time);
    const tenPm = atTime(day.date, LATEST_TIME);
    const cutoff = ps.firstIn != null ? ps.firstIn + CUTOFF_MS : null;
    const end = cutoff != null && cutoff < tenPm ? cutoff : tenPm;
    const endReason = end === tenPm ? '10pm' : 'cutoff';

    let remindAt = configured;
    let reason = 'time';
    if (ps.firstIn != null && ps.firstIn + SAFETY_MS < remindAt) {
      remindAt = ps.firstIn + SAFETY_MS;
      reason = 'safety';
    }
    if (ps.lastIn != null && ps.lastIn >= remindAt) {
      remindAt = ps.lastIn + LATE_START_MS;
      reason = 'late';
    }
    if (remindAt >= end) {
      // Back from a break near Keka's cutoff, or a time set at the 10 PM limit: still
      // remind once, 5 min before the end, if they were clocked in before then.
      if (ps.lastIn == null || ps.lastIn < end - LAST_CALL_MS) {
        remindAt = Math.max(end - LAST_CALL_MS, ps.lastIn != null ? ps.lastIn + MIN : 0);
      } else {
        remindAt = null;
        reason = 'too-late';
      }
    }

    const stopped = day.stoppedAt != null;
    let nextAt = null;
    if (ps.state === 'in' && remindAt != null && !stopped) {
      nextAt = remindAt;
      if (day.lastShownAt != null && day.lastShownAt >= remindAt) nextAt = day.lastShownAt + REPEAT_MS;
      if (day.snoozeUntil != null && day.snoozeUntil > (day.lastShownAt || 0)) nextAt = day.snoozeUntil;
      if (nextAt >= end) nextAt = null;
    }

    return {
      ...ps,
      date: day.date,
      time: chosen.time,
      // A different time picked for later days (it had already passed today).
      nextTime: chosen.next || null,
      nextFrom: chosen.from || null,
      configured,
      remindAt,
      reason,
      end,
      endReason,
      nextAt,
      stopped,
      due: nextAt != null && nextAt <= now,
      snoozed: ps.state === 'in' && day.snoozeUntil != null && day.snoozeUntil > now && nextAt === day.snoozeUntil,
      reminding: ps.state === 'in' && remindAt != null && day.lastShownAt != null && day.lastShownAt >= remindAt,
      updatedAt: day.updatedAt || 0,
    };
  }

  /** Clear the snooze whenever the clock state flips (out for a break, back in). */
  function withPunches(day, next) {
    const before = punchState(day).state;
    const after = punchState(next).state;
    return before === after ? next : { ...next, snoozeUntil: null };
  }

  /**
   * A captured Keka response: records [{ date, punches }]. `complete` means the
   * response lists every WFH day request (attendancedayrequests), so a missing
   * `day.date` means no web punches today.
   */
  function applyObservation(day, obs, now) {
    const records = obs && Array.isArray(obs.records) ? obs.records : [];
    const rec = records.find(r => r && r.date === day.date);
    if (!rec && !(obs && obs.complete)) return day;
    const punches = rec && Array.isArray(rec.punches) ? rec.punches : [];
    return withPunches(day, { ...day, source: 'api', punches, domIn: false, updatedAt: now });
  }

  /** DOM fallback (Actions card button): used only until Keka's data arrives. */
  function applyDom(day, domState, now) {
    if (day.source === 'api' || (domState !== 'in' && domState !== 'out')) return day;
    return withPunches(day, { ...day, source: 'dom', domIn: domState === 'in', updatedAt: now });
  }

  /** Notification "Snooze 30 min". */
  function snooze(day, settings, now, ms = SNOOZE_MS) {
    const p = plan(day, settings, now);
    if (p.state !== 'in') return day;
    const cap = p.end - LAST_CALL_MS;
    // Snoozing inside the last call means "enough for today".
    const until = cap <= now ? p.end : Math.min(now + ms, cap);
    return { ...day, snoozeUntil: until };
  }

  /** Tab "+15 min": push the current snooze further. */
  function extendSnooze(day, settings, now) {
    const p = plan(day, settings, now);
    if (!p.snoozed) return day;
    return { ...day, snoozeUntil: Math.min(day.snoozeUntil + SNOOZE_STEP_MS, Math.max(p.end - LAST_CALL_MS, day.snoozeUntil)) };
  }

  /** Tab "Cancel snooze": remind right now. */
  function cancelSnooze(day, now) {
    return day.snoozeUntil != null && day.snoozeUntil > now ? { ...day, snoozeUntil: now } : day;
  }

  /** "Stop for today" (notification or tab). */
  function stop(day, now) {
    return { ...day, stoppedAt: now, snoozeUntil: null };
  }

  /** Tab "Turn back on": reminders resume from the schedule (repeats if already past). */
  function resume(day) {
    return { ...day, stoppedAt: null };
  }

  /**
   * Auto clock-out for `day` at `now`.
   * status: 'off' | 'waiting' (not clocked in yet) | 'standby' (clocked out before the time;
   *   runs only if you clock back in) | 'scheduled' | 'heads-up' | 'due' |
   *   'running' | 'done' | 'failed' | 'skipped' | 'late-start' (clocked in after the time) |
   *   'missed' (not clocked in at the time) | 'ended' (past the day's end)
   * at: when it runs; headsUpAt: when the 5-min warning shows.
   */
  function autoPlan(day, settings, now) {
    const a = autoFor(settings, day.date);
    const p = plan(day, settings, now);
    let at = atTime(day.date, a.time);
    let reason = 'time';
    if (p.firstIn != null && p.firstIn + SAFETY_MS < at) { at = p.firstIn + SAFETY_MS; reason = 'safety'; }
    // +15 min / heads-up delays apply on top, but never later than 1 min before the end.
    at += day.autoDelay || 0;
    if (at > p.end - AUTO_LAST_MS) at = p.end - AUTO_LAST_MS;
    const base = { on: a.on, time: a.time, next: a.next || null, from: a.from || null, at, headsUpAt: at - AUTO_HEADS_UP_MS, reason, end: p.end, doneAt: day.autoDoneAt || null };
    let status;
    // A run that started (or ended) today keeps its status even if auto clock-out was
    // turned off meanwhile, so it still finishes, closes its tab and reports.
    if (['running', 'done', 'failed', 'expired'].includes(day.autoStatus)) status = day.autoStatus;
    else if (!a.on) status = 'off';
    else if (day.autoSkip) status = 'skipped';
    else if (p.state === 'none') status = now >= p.end ? 'ended' : 'waiting';
    else if (p.lastIn != null && p.lastIn >= at) status = 'late-start';
    else if (now >= p.end) status = 'ended';
    else if (now >= at) status = p.state === 'in' ? 'due' : 'missed';
    else if (p.state !== 'in') status = 'standby';
    else if (now >= at - AUTO_HEADS_UP_MS) status = 'heads-up';
    else status = 'scheduled';
    return { ...base, status };
  }

  /** Whole minutes a heads-up "+N min" can still add (0 = can't postpone), at most 15. */
  function autoPostponeMinutes(ap) {
    const room = (ap.end - AUTO_LAST_MS) - ap.at;
    return Math.max(0, Math.min(AUTO_DELAY_STEP_MS, room) / MIN | 0);
  }

  /** Heads-up "+15 min" (or whatever room is left before the end). */
  function autoPostpone(day, settings, now) {
    const ap = autoPlan(day, settings, now);
    if (ap.status !== 'scheduled' && ap.status !== 'heads-up' && ap.status !== 'due') return day;
    const minutes = autoPostponeMinutes(ap);
    if (!minutes) return day;
    return { ...day, autoDelay: (day.autoDelay || 0) + minutes * MIN, autoHeadsUpFor: null };
  }

  function autoSkipToday(day) {
    return { ...day, autoSkip: true };
  }

  /**
   * Due without a heads-up for this time yet (after a Reset, or waking from
   * sleep past it): move it so the heads-up comes first — 5 min from now, or
   * as much as is left before the end. With under a minute left there's no
   * time to warn, so it's called off for today ('expired'); the reminder
   * carries on. It never clocks out without a heads-up.
   */
  function autoDeferForHeadsUp(day, settings, now) {
    const ap = autoPlan(day, settings, now);
    if (ap.status !== 'due' || day.autoHeadsUpFor === ap.at) return day;
    const target = Math.min(now + AUTO_HEADS_UP_MS, ap.end - AUTO_LAST_MS);
    if (target - now < MIN) return { ...day, autoStatus: 'expired' };
    return { ...day, autoDelay: (day.autoDelay || 0) + (target - ap.at) };
  }

  /** Is there anything of today's auto clock-out to reset (skip, +15, done, failed)? Not while running. */
  function autoResettable(day) {
    return day.autoStatus !== 'running' &&
      (day.autoSkip === true || (day.autoDelay || 0) > 0 || ['done', 'failed', 'expired'].includes(day.autoStatus));
  }

  /** Tab "Reset": forget today's skip / delay / result, so it runs again at its set time. */
  function autoReset(day) {
    if (day.autoStatus === 'running') return day;
    return { ...day, autoSkip: false, autoDelay: 0, autoHeadsUpFor: null, autoStatus: null, autoStartedAt: null, autoTabId: null, autoDoneAt: null, autoSession: null };
  }

  function autoStart(day, now) {
    return { ...day, autoStatus: 'running', autoStartedAt: now, autoTabId: null };
  }

  /** Did Keka's data show the clock-out we started? */
  function autoClockedOut(day) {
    if (day.autoStatus !== 'running' || day.autoStartedAt == null) return false;
    const ps = punchState(day);
    return ps.state === 'out' && ps.lastOut != null && ps.lastOut >= day.autoStartedAt - 2 * MIN;
  }

  function autoFinish(day, ok, now) {
    return { ...day, autoStatus: ok ? 'done' : 'failed', autoDoneAt: ok ? now : null, autoTabId: null };
  }

  function autoHeadsUp(ap, now) {
    const minutes = now == null ? 5 : Math.max(1, Math.round((ap.at - now) / MIN));
    return {
      title: `Auto clock-out at ${timeLabel(ap.at)}`,
      message: `Keka Hours will clock you out in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    };
  }

  /** Should we post "reminder set for …"? Once per distinct reminder time, never for one already due. */
  function shouldAnnounce(day, p, now) {
    return p.state === 'in' && !p.stopped && p.remindAt != null && p.remindAt > now && day.announcedFor !== p.remindAt;
  }

  function announcement(p) {
    const at = timeLabel(p.remindAt);
    let message;
    if (p.reason === 'safety') {
      message = `That's 11h after your ${timeLabel(p.firstIn)} clock-in, earlier than ${hhmmLabel(p.time)}: Keka marks a missed clock-out at 12h.`;
    } else if (p.reason === 'late') {
      message = `You clocked in at ${timeLabel(p.lastIn)}, after ${hhmmLabel(p.time)}, so the reminder is 30 min later.`;
    } else if (p.firstIn != null) {
      message = `You clocked in at ${timeLabel(p.firstIn)}. Change the time in Keka Hours → WFH.`;
    } else {
      message = 'Change the time in Keka Hours → WFH.';
    }
    return { title: `WFH clock-out reminder set for ${at}`, message };
  }

  /** The reminder itself: when you started, and a nudge to clock out. */
  function reminder(p) {
    const since = p.firstIn != null ? `You clocked in at ${timeLabel(p.firstIn)}. ` : '';
    return { title: 'Time to clock out', message: `${since}Don't forget to clock out in Keka.` };
  }

  /**
   * Toolbar badge: countdown to the reminder, amber while snoozed, red "OUT"
   * once due — until clocked out or the day's end.
   */
  function badge(p, now) {
    if (p.state !== 'in' || p.stopped || p.remindAt == null || now >= p.end) return null;
    if (p.snoozed) return { text: shortLeft(p.nextAt - now), color: '#d97706' };
    if (p.reminding || p.due) return { text: 'OUT', color: '#dc2626' };
    return { text: shortLeft(p.remindAt - now), color: '#1f9d6b' };
  }

  const api = {
    DEFAULT_TIME, LATEST_TIME, SAFETY_MS, CUTOFF_MS, REPEAT_MS, SNOOZE_MS, SNOOZE_STEP_MS,
    dateKeyOf, parseTime, validTime, atTime, timeLabel, hhmmLabel, shortLeft,
    normalizeSettings, timeFor, emptyDay, punchState, plan,
    TIME_STEPS, QUICK_TIMES, timeFromMinutes, stepTime,
    nextDateKey, passedToday, withReminderTime, withAutoClockOut, reminderStartsTomorrow, autoStartsTomorrow,
    applyObservation, applyDom, snooze, extendSnooze, cancelSnooze, stop, resume,
    shouldAnnounce, announcement, reminder, badge,
    AUTO_TIMEOUT_MS, addMinutes, autoFor, autoPlan, autoPostpone, autoSkipToday, autoDeferForHeadsUp, autoPostponeMinutes, autoResettable, autoReset, autoStart, autoClockedOut, autoFinish, autoHeadsUp,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.KekaHours = root.KekaHours || {}).wfh = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
