# LifeBoard Pixoo64 display

PC-based Pixoo64 output for LifeBoard bus snapshots.

This keeps the current flow:

1. Windows fetches NAVITIME bus realtime data with `LifeBoard/bus_fetcher`.
2. The snapshot is written to `LifeBoard/data/bus_snapshot.json`.
3. This folder renders a 64x64 RGB frame from that snapshot.
4. If a Pixoo64 IP is configured, the frame is sent to the Pixoo64 on the local network.

No Raspberry Pi is required for this first version. When moving to a Pi later,
`pixoo_lifeboard.js` can stay mostly the same and only the runner changes.

## Local config

Create this ignored file:

```text
LifeBoard\pixoo_display\pixoo_display.local.ps1
```

Example:

```powershell
$env:PIXOO_IP = "192.168.1.50"
$env:PIXOO_BRIGHTNESS = "35"
$env:LIFEBOARD_PIXOO_PAGE_SECONDS = "60"
# Native 6-frame animation is enabled by default for status motion.
# Set this to "0" only when a static display is needed.
# $env:LIFEBOARD_PIXOO_ANIMATE_BUS_BAR = "0"
$env:LIFEBOARD_PIXOO_ANIMATION_SPEED_MS = "650"
```

`run_pixoo_manual.ps1` also reads the existing bus fetcher local config:

```text
LifeBoard\bus_fetcher\bus_fetcher.local.ps1
```

So `LIFEBOARD_IMPORT_URL` and `LIFEBOARD_IMPORT_TOKEN` can continue to live in
the current PC-side setup.

## Preview only

Use this before sending anything to the device:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_display\run_pixoo_manual.ps1 -DryRun -SkipBusFetch
```

This reads the latest local snapshot and writes:

```text
LifeBoard\data\pixoo_preview.svg
```

To also write an actual 64x64 PNG preview through the PowerShell runner:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_display\run_pixoo_manual.ps1 -DryRun -SkipBusFetch -PngPreview
```

## Fetch bus data and preview

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_display\run_pixoo_manual.ps1 -DryRun
```

This refreshes `bus_snapshot.json` locally, but does not post to LifeBoard and
does not send to Pixoo64.

## Fetch, post to LifeBoard, and push to Pixoo64

After `PIXOO_IP` is set:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_display\run_pixoo_manual.ps1
```

Optional one-time brightness override:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_display\run_pixoo_manual.ps1 -Brightness 25
```

Manual Pixoo runs append logs to:

```text
LifeBoard\logs\pixoo_manual.log
```

## Scheduled task

Pixoo updates should be separate from NAVITIME fetches. Register the hidden
Pixoo display task with a 1 minute interval:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_display\register_task.ps1
```

The task is registered as:

```text
\LifeBoard\LifeBoard Pixoo Display
```

It runs `run_hidden.vbs`, which launches:

```text
run_pixoo_manual.ps1 -SkipBusFetch -NoPreview
```

So NAVITIME is not fetched by this task. It only reads the latest local
`bus_snapshot.json`, reads LifeBoard's web API for JR/weather/garbage if
`LIFEBOARD_IMPORT_URL` is available, and pushes the composed frame to Pixoo64.

To start immediately after registration:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_display\register_task.ps1 -RunNow
```

To remove it:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_display\unregister_task.ps1
```

## Notes

- Pixoo64 receives a raw 64x64 RGB frame through its local HTTP API.
- The bus header uses a bus icon instead of the `バス` label. It stays parked on
  the right during normal operation, then moves across six positions from right
  to left when the first bus is 5 minutes or less away.
- At 1 minute or less, the bus stops at the left edge, flashes its headlight,
  and opens/closes its front door instead of continuing to move.
- The left bus bar also blinks only when the first bus is 5 minutes or less away.
- The last bus exits left once when service ends. Overnight, an empty route uses
  a moon-and-stars scene. During 06:00-06:00:59, a sunrise replaces the bus icon
  for one minute even if first-bus data has already arrived; the bus returns at
  06:01. One-shot transition state is stored in
  `LifeBoard\data\pixoo_runtime_state.json`.
- Weather uses a compact animated icon: sun rays pulse, clouds drift, drizzle
  uses sparse drops, rain uses regular drops, heavy rain uses vertical streaks,
  thunder flashes, and snow uses a sparkling crystal. Weather text keeps its
  severity color, while icon parts use natural colors: gray clouds, blue rain,
  and yellow lightning.
- When garbage is scheduled for the displayed day, the small bin lid opens and
  closes. A no-collection day remains static.
- Rail delay and suspension alerts blink between their warning color and a dim
  version of the same color. Multiple rail issues rotate through the same
  six-frame sequence and show their current position, such as `1/2`.
- Animation frames are registered under one Pixoo `PicID` with sequential
  `PicOffset` values. Each frame is sent as its own `Draw/SendHttpGif` request;
  `Draw/CommandList` is not used for animation frames. Pixoo assembles the
  completed set and plays it natively on the device.
- The Windows runner enables the lightweight Pixoo item overlay. The 6-frame
  base animation is uploaded only when its structural pixels change. The clock
  and bus remaining minutes are updated through `Draw/SendHttpItemList`, so a
  normal minute tick does not reload the animation or show the Pixoo hourglass.
- The clock uses Pixoo time item type `6` with official time-dial font `18`
  (`3*5; minimum pixel characters`). Pixoo advances `HH:MM:SS` locally. Bus
  remaining time uses plain-text item type `22` with the same font and is
  refreshed by the Windows runner.
- Pixoo may reset its clock preference to 12-hour mode after a power loss or
  device reboot. Every LifeBoard push reapplies `Device/SetTime24Flag` with
  `Mode: 1`, so the next scheduled send restores the 24-hour clock automatically.
- A structural change such as a new bus, location/delay change, rail alert,
  weather/garbage/work change, or a night/transition scene still requires one
  complete base-animation upload. The hourglass may appear for that upload.
- Set `LIFEBOARD_PIXOO_ANIMATE_BUS_BAR=0` to force static-frame operation.
- This script intentionally uses only Node.js built-in APIs.
- If `LifeBoard\misaki_png_2021-05-05a\misaki_gothic.png` exists, the garbage
  row and the weather glyph are rendered with Misaki Gothic bitmap Japanese text.
  If the font PNG is missing, the display falls back to ASCII labels.
- Keep NAVITIME fetches on the existing bus-fetch cadence. Pixoo display pushes
  can run every 1 minute because they do not fetch NAVITIME.
- Windows Task Scheduler repetition is minute-based. A 30 second Pixoo push loop
  would need a separate resident loop runner, not the standard task interval.
- When JR has an issue, the bus panel stays visible and the lower 3 rows are
  used as a fixed `JR ALERT` page instead of the normal `JR/WX/GB` rows.
- The top clock line shows `YY/MM/DD HH:MM:SS`. The date is part of the base
  image; `HH:MM:SS` is the device-managed Pixoo item.
- The bus panel header is rendered as `バス` when Misaki Gothic is available.
  If LifeBoard calendar data contains a TimeTree work symbol for today, a short
  work marker is shown beside it, such as `D勤`, `D勤中`, `明け`, `休日`,
  `有給`, or `10H`. The marker is right-aligned; regular work is green,
  active work is pink, and leave/off/10H states are blue.
- The calendar snapshot also carries the previous day's events for overnight
  shift context. A `/` day following an actual `N` remains `N勤中` until 08:09.
  If that preceding `N` was overridden by `AL`, `SV`, or `10H`, the `/` day is
  shown as `休日` instead.
- A TimeTree event whose category is exactly `試験関係` takes priority over the
  work marker. Its event title is shown from 08:00 through 16:59 for an all-day
  event; a timed event uses its own start/end time. The title uses a fixed
  30-pixel area at the right edge and is shortened to fit without scrolling.
- The main bus time shows the scheduled departure time. Delay and remaining
  time are shown separately, such as `19:42 +2 / 3M`.
- The `次` bus time also uses the scheduled departure time. A temporary
  NAVITIME predicted-time change does not replace the timetable time.
- The Windows server fetches NAVITIME every minute from 06:00 through 06:59,
  every 3 minutes from 07:00 through 22:59, and stops bus acquisition from
  23:00 through 05:59. Pixoo rendering runs every minute from 06:00 through
  22:59 and only at `:00`, `:15`, `:30`, and `:45` overnight. The Pixoo-managed
  clock continues to advance between those overnight sends.
- When the home-to-station route has no remaining bus items for the day, the
  bus panel shows `本日のバスは` / `終わりました！`.
- Weather shows the current temperature and the next-24-hour high temperature,
  such as `天気27/35C`. The actual condition is expressed by the right-side
  icon. Weathernews snapshots can supply `later` (`clear -> rain`) and
  `sometimes` modes; both keep two icons visible, with `>` for later and `+`
  for sometimes (no alternating replacement). Rain/sun animation remains active.
  Both layouts use x=43..50 and x=56..63 for full-size icons, with a white
  separator at x=52..54: a 3x5 `>` chevron or a 3x3 `+`. One blank column
  on either side keeps clouds from overwriting the separator.
- If Weathernews wind data reports strong wind in the active lookahead window,
  the garbage row reserves the bottom-right 8x8 area for a `風` marker. The
  marker appears at 8 m/s, turns yellow at 12 m/s, and blinks red at 15 m/s.
- Garbage (`GB`) shows today (`TDY`) before 10:00. From 10:00 onward, it shows
  tomorrow (`TMR`) so the display helps with the next preparation cycle.
- Garbage labels are shortened for Pixoo64: burnable garbage is `BURN`,
  non-burnable garbage is `NON`, and recyclables/resource garbage is `RES`.
- Japanese garbage labels are rendered as compact phrases such as `ゴミ今日可燃`
  or `ゴミ明日資源`.
- At 64x64, status labels are kept short for legibility. Japanese labels are
  used only where the Misaki Gothic bitmap font is available; otherwise the
  script falls back to compact ASCII labels.

## Troubleshooting animation uploads

- A failed animation update can appear as `Loading`, a brief corrupted/noise
  screen, and then a return to the previously displayed LifeBoard frame. The
  Pixoo local API may still return `error_code: 0`, so an API success response
  alone does not prove that the device committed the complete animation.
- First confirm that animation frames are sent as separate
  `Draw/SendHttpGif` requests with one shared `PicID`, matching `PicNum`, and
  sequential `PicOffset` values. Do not put animation frames in
  `Draw/CommandList`.
- If sequential upload repeatedly stops partway, or the device keeps returning
  to an old frame, restart the Pixoo64 once. Restarting can clear an incomplete
  animation-receive state left in the device. This was effective after a failed
  upload stopped at frame 5 of 6.
- After restart, wait for the Pixoo network API to respond, then verify at least
  two consecutive scheduled six-frame pushes in `lifeboard_ops_runner.log` and
  confirm the new animation on the physical display. The Windows scheduled task
  does not need to be re-registered for a Pixoo-only restart.
