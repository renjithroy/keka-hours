/*
 * Background service worker: WFH clock-out reminders.
 *
 * The content script forwards today's / yesterday's trimmed Keka summary
 * records (whenever Keka loads them on any hatio.keka.com page). From those we
 * keep one session in chrome.storage.local and wake via chrome.alarms, so
 * reminders arrive as system notifications whatever tab (or app) is in front,
 * even after every Keka tab is closed. Nothing here makes network requests.
 */
importScripts('reminder.js');

const R = self.KekaReminder;
const KEY = 'clockoutSession';
const ALARM = 'clockout-reminder';
const NOTIFICATION = 'clockout-reminder';
const KEKA_URL = 'https://hatio.keka.com/#/me/attendance/logs';

async function load() {
  const got = await chrome.storage.local.get({ [KEY]: null });
  return got[KEY];
}

async function save(session) {
  if (session) await chrome.storage.local.set({ [KEY]: session });
  else await chrome.storage.local.remove(KEY);
}

/** Show whatever is due now, then arm the alarm for the next reminder. */
async function tick(session) {
  const now = Date.now();
  const due = R.reminderFor(session, now);
  if (due) {
    await chrome.notifications.clear(NOTIFICATION);
    await chrome.notifications.create(NOTIFICATION, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: due.title,
      message: due.message,
      priority: due.urgent ? 2 : 1,
      requireInteraction: due.urgent,
      buttons: [{ title: 'Open Keka' }, { title: 'I\'ve clocked out' }],
    });
    session = { ...session, sentIndex: due.index };
    await save(session);
  }
  const at = R.nextAlarmAt(session, Date.now());
  if (at == null) await chrome.alarms.clear(ALARM);
  else await chrome.alarms.create(ALARM, { when: Math.max(at, Date.now() + 1000) });
}

async function stop() {
  await chrome.alarms.clear(ALARM);
  await chrome.notifications.clear(NOTIFICATION);
}

async function onRecords(records) {
  const before = await load();
  let session = before;
  const now = Date.now();
  for (const rec of [...records].sort((a, b) => (a.date < b.date ? -1 : 1))) session = R.applyRecord(session, rec, now);
  if (JSON.stringify(session) !== JSON.stringify(before)) await save(session);
  if (!session || session.dismissedAt != null) await stop();
  else await tick(session);
}

async function markClockedOut() {
  const session = await load();
  if (session) await save({ ...session, dismissedAt: session.entryCount });
  await stop();
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.type !== 'attendance-today' || !Array.isArray(msg.records)) return;
  onRecords(msg.records.slice(0, 2)).catch(() => {});
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM) load().then(s => (s ? tick(s) : stop())).catch(() => {});
});

chrome.notifications.onButtonClicked.addListener((id, index) => {
  if (id !== NOTIFICATION) return;
  if (index === 0) chrome.tabs.create({ url: KEKA_URL });
  else markClockedOut().catch(() => {});
});

chrome.notifications.onClicked.addListener(id => {
  if (id !== NOTIFICATION) return;
  chrome.tabs.create({ url: KEKA_URL });
  chrome.notifications.clear(NOTIFICATION);
});

// Alarms don't reliably survive a browser restart; re-arm from storage.
const rearm = () => load().then(s => (s ? tick(s) : null)).catch(() => {});
chrome.runtime.onStartup.addListener(rearm);
chrome.runtime.onInstalled.addListener(rearm);
