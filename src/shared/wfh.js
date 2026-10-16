/*
 * WFH clock-out reminder rules (pure; shared by the service worker and the
 * WFH tab, unit-tested). No chrome.* calls here.
 *
 * Office attendance is biometric only, so any web punch (Keka's
 * "WFH Clock-In / Clock-out") means a WFH day, approved or not.
 *
 *  - Reminder at a fixed time of day: 6:30 PM unless the user picks another
 *    time (latest 10 PM), for today only or every WFH day.
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
 * Day state (persisted by the worker, one day at a time):
 *   { date: 'YYYY-MM-DD', source: 'api' | 'dom' | null, punches: [{ at, in }],
 *     domIn, updatedAt, snoozeUntil, lastShownAt, announcedFor, stoppedAt }
 * Settings: { everyDay: 'HH:MM', today: { date, time } | null }
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

  /** 125 min -> "2:05", 45 min -> "45m" (toolbar badge, max 4 chars). */
  function shortLeft(ms) {
    const total = Math.max(0, Math.ceil(ms / MIN));
    return total >= 60 ? `${Math.floor(total / 60)}:${pad2(total % 60)}` : `${total}m`;
  }

  function normalizeSettings(s, todayKey) {
    const everyDay = validTime(s && s.everyDay) || DEFAULT_TIME;
    const t = s && s.today;
    const today = t && t.date === todayKey && validTime(t.time) ? { date: t.date, time: t.time } : null;
    return { everyDay, today };
  }

  /** The reminder time that applies on `dateKey`, and whether it's today's one-off. */
  function timeFor(settings, dateKey) {
    const s = normalizeSettings(settings, dateKey);
    return s.today ? { time: s.today.time, scope: 'today' } : { time: s.everyDay, scope: 'every' };
  }

  function emptyDay(date) {
    return { date, source: null, punches: [], domIn: false, updatedAt: 0, snoozeUntil: null, lastShownAt: null, announcedFor: null, stoppedAt: null };
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
      remindAt = null;
      reason = 'too-late';
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
      scope: chosen.scope,
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

  function reminder(p, now) {
    const left = p.end - now;
    const title = left <= 30 * MIN ? `Clock out now: ${shortLeft(left)} left` : 'Time to clock out';
    const since = p.firstIn != null ? `WFH since ${timeLabel(p.firstIn)}. ` : '';
    const limit = p.endReason === 'cutoff'
      ? `Keka marks a missed clock-out at ${timeLabel(p.end)}.`
      : `Clock out before the ${timeLabel(p.end)} limit.`;
    return { title, message: since + limit };
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
    applyObservation, applyDom, snooze, extendSnooze, cancelSnooze, stop, resume,
    shouldAnnounce, announcement, reminder, badge,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.KekaHours = root.KekaHours || {}).wfh = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
