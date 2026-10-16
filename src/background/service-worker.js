/*
 * Background service worker: WFH clock-out reminders (rules in shared/wfh.js).
 *
 * The content script forwards trimmed WFH punches (from Keka's clock-in/out
 * click and page-load responses, or the Actions card as a fallback) and the
 * WFH tab's actions. We keep today's state in chrome.storage.local and wake
 * via chrome.alarms, so reminders arrive as system notifications whatever tab
 * (or app) is in front, even after every Keka tab is closed. The toolbar badge
 * counts down to the reminder. Nothing here makes network requests.
 *
 * Auto clock-out (opt-in): a 5-min heads-up, then Keka Attendance opens in a
 * background tab where the content script clicks WFH Clock-out → Clock-out
 * (Keka sends its own request). Success is read from Keka's response; the tab
 * is closed either way, and a failure falls back to an on-screen alert.
 */
importScripts('../shared/wfh.js');

const W = self.KekaHours.wfh;
const DAY_KEY = 'wfhDay';
const SETTINGS_KEY = 'wfhSettings';
const ALARM_NEXT = 'wfh-next';
const ALARM_TICK = 'wfh-tick'; // keeps the badge countdown fresh while clocked in
const ALARM_AUTO = 'wfh-auto'; // auto clock-out: heads-up, start, timeout
const N_REMINDER = 'wfh-reminder';
const N_ARMED = 'wfh-armed';
const N_TEST = 'wfh-test';
const N_AUTO_SOON = 'wfh-auto-soon';
const N_AUTO_RESULT = 'wfh-auto-result';
const N_AUTO_FAILED = 'wfh-auto-failed';
const KEKA_URL = 'https://hatio.keka.com/#/me/attendance/logs';
const ICON = 'icons/icon128.png';
// Clicking the notification itself opens Keka.
const REMINDER_BUTTONS = [{ title: 'Snooze 30 min' }, { title: 'Stop for today' }];
const AUTO_SOON_BUTTONS = [{ title: 'Skip today' }, { title: '+15 min' }];

async function load(now) {
  const got = await chrome.storage.local.get({ [DAY_KEY]: null, [SETTINGS_KEY]: null });
  const today = W.dateKeyOf(now);
  const day = got[DAY_KEY] && got[DAY_KEY].date === today ? got[DAY_KEY] : W.emptyDay(today);
  return { day, settings: W.normalizeSettings(got[SETTINGS_KEY], today) };
}

function notify(id, { title, message }, urgent, buttons = urgent ? REMINDER_BUTTONS : undefined) {
  return chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(ICON),
    title,
    message,
    priority: urgent ? 2 : 0,
    requireInteraction: urgent,
    buttons,
  });
}

/** Keka Attendance in a tab the user isn't looking at (a minimized window if none is open). */
async function openKekaInBackground() {
  try {
    const tab = await chrome.tabs.create({ url: KEKA_URL, active: false });
    return tab.id;
  } catch (_) {
    const win = await chrome.windows.create({ url: KEKA_URL, focused: false, state: 'minimized' });
    return win && win.tabs && win.tabs[0] ? win.tabs[0].id : null;
  }
}

async function closeTab(id) {
  if (id == null) return;
  try { await chrome.tabs.remove(id); } catch (_) { /* already closed */ }
}

/**
 * Auto clock-out bookkeeping for this step: finish a running one (Keka's data
 * shows the clock-out, or it timed out), show the heads-up, or start it.
 */
async function stepAuto(day, settings, now) {
  let ap = W.autoPlan(day, settings, now);
  if (ap.status === 'running') {
    const ok = W.autoClockedOut(day);
    if (ok || now - day.autoStartedAt > W.AUTO_TIMEOUT_MS) day = await finishAuto(day, ok, now);
  } else if (ap.status === 'heads-up' && day.autoHeadsUpFor !== ap.at) {
    await chrome.notifications.clear(N_AUTO_SOON);
    await notify(N_AUTO_SOON, W.autoHeadsUp(ap), true, AUTO_SOON_BUTTONS);
    day = { ...day, autoHeadsUpFor: ap.at };
  } else if (ap.status === 'due') {
    await chrome.notifications.clear(N_AUTO_SOON);
    day = W.autoStart(day, now);
    day = { ...day, autoTabId: await openKekaInBackground() };
  }
  return day;
}

async function finishAuto(day, ok, now, note) {
  await closeTab(day.autoTabId);
  const done = W.autoFinish(day, ok, now);
  if (ok) {
    await notify(N_AUTO_RESULT, {
      title: note === 'already-out' ? 'You were already clocked out' : `Clocked out at ${W.timeLabel(now)}`,
      message: note === 'already-out' ? 'Keka shows you clocked out, so nothing was changed.' : 'Keka Hours clocked you out of Keka (WFH).',
    }, false);
  } else {
    await notify(N_AUTO_FAILED, {
      title: 'Auto clock-out didn\'t work',
      message: 'Clock out in Keka yourself now. Click to open Keka.',
    }, true, [{ title: 'Open Keka' }]);
    // The alert is this round's reminder; the next one comes 15 min later.
    return { ...done, lastShownAt: now };
  }
  return done;
}

async function setBadge(b) {
  await chrome.action.setBadgeText({ text: b ? b.text : '' });
  if (b) {
    await chrome.action.setBadgeBackgroundColor({ color: b.color });
    try { await chrome.action.setBadgeTextColor({ color: '#ffffff' }); } catch (_) { /* Chrome < 110 */ }
  }
}

/**
 * Apply `change` to today's state, then do whatever is due: show a reminder,
 * announce a newly set reminder time, update the badge and the next alarm.
 * Serialized so overlapping events never lose an update.
 */
let queue = Promise.resolve();
function run(change) {
  queue = queue.then(() => step(change)).catch(() => {});
  return queue;
}

async function step(change) {
  const now = Date.now();
  let { day, settings } = await load(now);
  const before = JSON.stringify(day);
  if (change) day = (await change(day, settings, now)) || day;
  const autoBefore = day.autoStatus;
  day = await stepAuto(day, settings, now);
  let plan = W.plan(day, settings, now);
  const auto = W.autoPlan(day, settings, now);
  // The heads-up / running clock-out / failure alert already say it all: don't also nag.
  const autoBusy = auto.status === 'heads-up' || auto.status === 'running' || (auto.status === 'failed' && autoBefore === 'running');

  if (plan.due && !autoBusy) {
    // Clear first so the OS pops it up again rather than silently updating it.
    await chrome.notifications.clear(N_REMINDER);
    await notify(N_REMINDER, W.reminder(plan), true);
    day = { ...day, lastShownAt: now, announcedFor: plan.remindAt };
    plan = W.plan(day, settings, now);
  } else if (W.shouldAnnounce(day, plan, now)) {
    await chrome.notifications.clear(N_ARMED);
    const msg = W.announcement(plan);
    if (auto.status === 'scheduled' || auto.status === 'heads-up') msg.message += ` Auto clock-out at ${W.timeLabel(auto.at)}.`;
    await notify(N_ARMED, msg, false);
    day = { ...day, announcedFor: plan.remindAt };
  }
  if (plan.state !== 'in' || plan.stopped) await chrome.notifications.clear(N_REMINDER);

  // The WFH tab re-renders on changes, so only write real ones.
  if (JSON.stringify(day) !== before) await chrome.storage.local.set({ [DAY_KEY]: day });
  const b = W.badge(plan, now);
  await setBadge(b);

  if (plan.nextAt == null) await chrome.alarms.clear(ALARM_NEXT);
  else await chrome.alarms.create(ALARM_NEXT, { when: Math.max(plan.nextAt, now + 1000) });
  const autoAt = auto.status === 'scheduled' ? auto.headsUpAt
    : auto.status === 'heads-up' ? auto.at
      : auto.status === 'running' ? day.autoStartedAt + W.AUTO_TIMEOUT_MS + 1000
        : null;
  if (autoAt == null) await chrome.alarms.clear(ALARM_AUTO);
  else await chrome.alarms.create(ALARM_AUTO, { when: Math.max(autoAt, now + 1000) });
  // Minute ticks only while there's a badge to keep current (and clear at the end).
  if (!b) await chrome.alarms.clear(ALARM_TICK);
  else if (!(await chrome.alarms.get(ALARM_TICK))) await chrome.alarms.create(ALARM_TICK, { periodInMinutes: 1 });
}

/** Tab "Send test reminder": the same notification, plus whether Chrome allows it. */
async function testReminder() {
  const level = await new Promise(resolve => chrome.notifications.getPermissionLevel(resolve));
  await chrome.notifications.clear(N_TEST);
  await notify(N_TEST, { title: 'Test: time to clock out', message: 'This is how your WFH clock-out reminder will look.' }, true);
  return { permission: level };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !msg) return false;
  switch (msg.type) {
    case 'wfh-punches':
      run((day, s, now) => W.applyObservation(day, { records: msg.records, complete: msg.complete === true }, now));
      return false;
    case 'wfh-dom':
      run((day, s, now) => W.applyDom(day, msg.state, now));
      return false;
    case 'wfh-snooze-more':
      run((day, s, now) => W.extendSnooze(day, s, now));
      return false;
    case 'wfh-snooze-cancel':
      run((day, s, now) => W.cancelSnooze(day, now));
      return false;
    case 'wfh-stop':
      run((day, s, now) => W.stop(day, now));
      return false;
    case 'wfh-resume':
      run(day => W.resume(day));
      return false;
    case 'wfh-test':
      testReminder().then(reply, () => reply({ permission: 'unknown' }));
      return true; // async reply
    case 'wfh-auto-tab': {
      // A freshly loaded Keka tab asks: "am I the one opened to clock out?"
      const tabId = sender.tab && sender.tab.id;
      queue.then(() => load(Date.now())).then(({ day }) => {
        reply({ run: tabId != null && day.autoStatus === 'running' && day.autoTabId === tabId });
      }, () => reply({ run: false }));
      return true;
    }
    case 'wfh-auto-result': {
      const tabId = sender.tab && sender.tab.id;
      run(async (day, s, now) => {
        if (day.autoStatus !== 'running' || day.autoTabId !== tabId) return day;
        if (msg.result === 'done' || msg.result === 'already-out') return finishAuto(day, true, now, msg.result);
        if (msg.result === 'failed') return finishAuto(day, false, now);
        return day; // 'clicked': wait for Keka's response (or the timeout)
      });
      return false;
    }
    default:
      return false;
  }
});

// Reminder time changed in the WFH tab (any Keka tab).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[SETTINGS_KEY]) run();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NEXT || alarm.name === ALARM_TICK || alarm.name === ALARM_AUTO) run();
});

function openKeka() {
  chrome.tabs.create({ url: KEKA_URL });
}

chrome.notifications.onButtonClicked.addListener((id, index) => {
  if (id === N_AUTO_SOON) {
    chrome.notifications.clear(id);
    if (index === 0) run(day => W.autoSkipToday(day));
    else run((day, s, now) => W.autoPostpone(day, s, now));
    return;
  }
  if (id === N_AUTO_FAILED) {
    chrome.notifications.clear(id);
    openKeka();
    return;
  }
  if (id !== N_REMINDER && id !== N_TEST) return;
  chrome.notifications.clear(id);
  if (id !== N_REMINDER) return; // the test reminder's buttons do nothing
  if (index === 0) run((day, s, now) => W.snooze(day, s, now));
  else run((day, s, now) => W.stop(day, now));
});

chrome.notifications.onClicked.addListener(id => {
  if (![N_REMINDER, N_ARMED, N_TEST, N_AUTO_SOON, N_AUTO_RESULT, N_AUTO_FAILED].includes(id)) return;
  chrome.notifications.clear(id);
  openKeka();
});

chrome.action.onClicked.addListener(openKeka);

// Alarms don't reliably survive a browser restart; re-arm from storage.
chrome.runtime.onStartup.addListener(() => run());
chrome.runtime.onInstalled.addListener(() => {
  // Drop the first version's state (2.7.0).
  chrome.storage.local.remove('clockoutSession');
  chrome.alarms.clear('clockout-reminder');
  run();
});
