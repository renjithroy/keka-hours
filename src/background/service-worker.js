/*
 * Background service worker: WFH clock-out reminders (rules in shared/wfh.js).
 *
 * The content script forwards trimmed WFH punches (from Keka's clock-in/out
 * click and page-load responses, or the Actions card as a fallback) and the
 * WFH tab's actions. We keep today's state in chrome.storage.local and wake
 * via chrome.alarms, so reminders arrive as system notifications whatever tab
 * (or app) is in front, even after every Keka tab is closed. The toolbar badge
 * counts down to the reminder. Nothing here makes network requests.
 */
importScripts('../shared/wfh.js');

const W = self.KekaHours.wfh;
const DAY_KEY = 'wfhDay';
const SETTINGS_KEY = 'wfhSettings';
const ALARM_NEXT = 'wfh-next';
const ALARM_TICK = 'wfh-tick'; // keeps the badge countdown fresh while clocked in
const N_REMINDER = 'wfh-reminder';
const N_ARMED = 'wfh-armed';
const N_TEST = 'wfh-test';
const KEKA_URL = 'https://hatio.keka.com/#/me/attendance/logs';
const ICON = 'icons/icon128.png';
// Clicking the notification itself opens Keka.
const REMINDER_BUTTONS = [{ title: 'Snooze 30 min' }, { title: 'Stop for today' }];

async function load(now) {
  const got = await chrome.storage.local.get({ [DAY_KEY]: null, [SETTINGS_KEY]: null });
  const today = W.dateKeyOf(now);
  const day = got[DAY_KEY] && got[DAY_KEY].date === today ? got[DAY_KEY] : W.emptyDay(today);
  return { day, settings: W.normalizeSettings(got[SETTINGS_KEY], today) };
}

function notify(id, { title, message }, urgent) {
  return chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(ICON),
    title,
    message,
    priority: urgent ? 2 : 0,
    requireInteraction: urgent,
    buttons: urgent ? REMINDER_BUTTONS : undefined,
  });
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
  if (change) day = change(day, settings, now) || day;
  let plan = W.plan(day, settings, now);

  if (plan.due) {
    // Clear first so the OS pops it up again rather than silently updating it.
    await chrome.notifications.clear(N_REMINDER);
    await notify(N_REMINDER, W.reminder(plan, now), true);
    day = { ...day, lastShownAt: now, announcedFor: plan.remindAt };
    plan = W.plan(day, settings, now);
  } else if (W.shouldAnnounce(day, plan, now)) {
    await chrome.notifications.clear(N_ARMED);
    await notify(N_ARMED, W.announcement(plan), false);
    day = { ...day, announcedFor: plan.remindAt };
  }
  if (plan.state !== 'in' || plan.stopped) await chrome.notifications.clear(N_REMINDER);

  // The WFH tab re-renders on changes, so only write real ones.
  if (JSON.stringify(day) !== before) await chrome.storage.local.set({ [DAY_KEY]: day });
  const b = W.badge(plan, now);
  await setBadge(b);

  if (plan.nextAt == null) await chrome.alarms.clear(ALARM_NEXT);
  else await chrome.alarms.create(ALARM_NEXT, { when: Math.max(plan.nextAt, now + 1000) });
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
    default:
      return false;
  }
});

// Reminder time changed in the WFH tab (any Keka tab).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[SETTINGS_KEY]) run();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NEXT || alarm.name === ALARM_TICK) run();
});

function openKeka() {
  chrome.tabs.create({ url: KEKA_URL });
}

chrome.notifications.onButtonClicked.addListener((id, index) => {
  if (id !== N_REMINDER && id !== N_TEST) return;
  chrome.notifications.clear(id);
  if (id !== N_REMINDER) return; // the test reminder's buttons do nothing
  if (index === 0) run((day, s, now) => W.snooze(day, s, now));
  else run((day, s, now) => W.stop(day, now));
});

chrome.notifications.onClicked.addListener(id => {
  if (id !== N_REMINDER && id !== N_ARMED && id !== N_TEST) return;
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
