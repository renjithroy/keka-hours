# Keka Hours

A small Chrome extension that shows your **average gross hours per office day** for the
month you're viewing in Keka (`hatio.keka.com → Me → Attendance`). It helps you see at a glance
whether you're keeping up the daily minimum.

Everything runs locally in your browser. Nothing is sent anywhere.

<table>
  <tr>
    <th>Overview</th>
    <th>Plan</th>
  </tr>
  <tr>
    <td><img src="docs/overview.png" alt="Overview tab: average gross hours per day, totals, longest/shortest day and daily-hours chart" width="360"></td>
    <td><img src="docs/plan.png" alt="Plan tab: month calendar with hours worked per day" width="360"></td>
  </tr>
</table>

<p align="center">
  <img src="docs/in-keka.png" alt="Keka Hours card open on Keka's Attendance Log page" width="760">
  <br><sub>Sits bottom-right on Keka's Attendance Log, following Keka's theme colour.</sub>
</p>

## Install (unpacked)

1. Download/unzip this folder.
2. Open `chrome://extensions` and turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `keka-hours` folder (the one containing `manifest.json`).
4. Open (or reload) https://hatio.keka.com/#/me/attendance/logs.

The card appears only on the Attendance Log page and is removed as soon as you navigate anywhere else.

A compact card appears bottom-right. Click it for details. The daily target is fixed at the
company standard of **9h 00m**.

Use the moon/sun button in the card's header to switch between light and dark mode. Your choice is
remembered across visits (and shared between Keka tabs); until you pick one it follows your OS setting.

- **Overview**: average, total, tracked days, longest/shortest, days ≥ / < 9h, WFH / leave.
  Hover the average to see every day behind it: date, type (office / WFH / leave / week-off…) and
  hours, with counted days highlighted, then total ÷ counted days. The list scrolls for long months.
  Today is left out of every Overview figure, the chart, and the minimised pill unless you turn on
  **Include today** (off by default). Only turn it on once you've clocked out and today's hours show in
  the attendance table (hover the switch for the checklist). The Plan tab always uses today. The setting is remembered.
- **Plan**: a month calendar showing how long to sit on each remaining office day to end the
  month at a 9h+ average. Weekdays count as office days by default, and weekends and
  Keka-known holidays don't. Tap any upcoming day to switch it between office and away
  (WFH / leave / off). Your choices are saved locally per month. If you're clocked in today with
  a single punch, it also shows the time you can clock out.

### WFH clock-out reminders

Keka hides the clock-out button 12 hours after you clock in and marks a missed clock-out. On a
**WFH day**, once you're clocked in, the extension sends system notifications. These appear whichever
tab or app you're in, even with Keka closed:

- from **9h** after clock-in, every 30 min,
- from **11h**, every 15 min,
- from **11h 30m**, a notification that stays on screen until you act on it, with the last ones at 11h 50m and 11h 55m.

Each one shows your clock-in time and the deadline. **Open Keka** takes you to the attendance page.
**I've clocked out** silences reminders for the day (they start again if Keka later shows you clocked
back in). They also stop as soon as Keka's data shows you clocked out.

The extension only learns your clock-in from Keka's attendance data, so open Keka's Attendance page
once after clocking in. Chrome must be running, and notifications must be allowed for Chrome in
your OS settings.

In the **30 DAYS** tab the card shows the current month to date (1st → today), not the rolling
30 days.

## What counts

A day counts toward the average only if it is **not WFH**, **not Leave**, and has **tracked time > 0**.

| Day                                      | Counted? |
| ---------------------------------------- | -------- |
| Office day with time                     | ✅       |
| Holiday / weekly-off where you clocked in | ✅ (e.g. comp-off work) |
| WFH (any day, any hours)                 | ❌       |
| Leave (even if some time shows)          | ❌       |
| W-OFF / holiday / absent with 0h         | ❌       |
| Today, while still clocked in            | ❌ until you clock out (shown as a note) |

There's no Monday–Friday logic. The attendance record decides.

## Precision and rounding

Keka's table shows minute-rounded hours. Keka's own attendance response, which the page already
loads, includes the exact punch timestamps. The extension reads a copy of that one response and
uses the exact durations. It does this only when they match Keka's own total for that day **and**
the minute value currently shown in the table. Otherwise it uses the displayed (minute-rounded)
value for that day.

Rounding matches HR: each day's seconds are dropped, and the average is truncated, never rounded
up. Rounding up would often show 1 minute more than HR reports.
Truncating also means the card never shows you meeting the target when you're a few seconds short.

### Plan accuracy

The plan uses the same HR rules: days count in whole minutes and the average is truncated, so
`avg ≥ 9h ⟺ total ≥ 9h × days`. The figure shown is
`ceil((9h × (counted + remaining) − counted total) / remaining)`. Sitting that long on every
remaining office day ends the month at 9h or above, and one minute less doesn't (tested). It's
only as accurate as the calendar, so mark WFH / leave days.

## Privacy

- Permissions: `storage` (which upcoming days you marked away/office in Plan, your light/dark theme choice, and today's WFH clock-in time for reminders), `alarms` and `notifications` (clock-out reminders). No `tabs`, `cookies`, `webRequest`, or host permissions.
- Runs only on `https://hatio.keka.com/*`.
- Never makes network requests. It doesn't read credentials, tokens, or cookies.
- It reads only `/attendance/api/mytime/attendance/summary/*`. It keeps only dates, status flags,
  durations, and punch times, and drops locations, IPs, and notes. The data lives only in memory on
  that page. The one exception is the clock-in time of an open WFH day, which is stored locally so reminders
  still fire after the tab is closed.

## How it stays current

The card re-reads the attendance table when any of these happen: URL changes (including Angular's `pushState` navigations, which fire no hash events), attendance-area
DOM changes (debounced 300 ms), Keka reloading its attendance data, tab focus or visibility, and
expanding the card. It also re-checks once a minute while the tab is visible. A signature of the
parsed data means it re-renders only when something actually changed. If the month header
changes before Keka has replaced the rows, the card shows **Updating…** and never the previous
month's numbers.

## Project layout

```
manifest.json
src/page/network-hook.js     MAIN world: passive copy of Keka's attendance summary response
src/content/parser.js        DOM snapshot + pure normalisation/merge → AttendanceDay[]
src/content/calculator.js    pure calculateSummary(days, targetMinutes)
src/content/format.js        display formatting
src/content/planner.js       pure planMonth(): required minutes per remaining office day
src/content/settings.js      chrome.storage.local (planner day overrides + theme)
src/content/ui.js            Shadow-DOM widget (minimised pill + expanded card)
src/content/main.js          controller: events, debouncing, signatures, freshness
src/background/reminder.js   pure WFH clock-out reminder schedule
src/background/service-worker.js  alarms + system notifications for clock-out reminders
tests/                       node --test unit tests
```

Run tests: `npm test` (or `node --test tests/`). Requires Node 18+.

## Known limitations

- Keka's numeric codes are inferred from real data, not documented: `dayType` 1 = holiday,
  2 = weekly-off; `attendanceDayStatus` 2 = WFH. The table badges (Wfh / Leave / HLDY / W-OFF)
  are checked as well.
- If Keka changes its markup or API, the card falls back to "Waiting for attendance" instead of
  showing wrong numbers. The parser may then need updating.
- A half-day leave combined with a half-day WFH or office day is excluded entirely.
