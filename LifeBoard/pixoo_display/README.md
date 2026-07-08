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
- This script intentionally uses only Node.js built-in APIs.
- Keep NAVITIME fetches on the existing bus-fetch cadence. Pixoo display pushes
  can run every 1 minute because they do not fetch NAVITIME.
- Windows Task Scheduler repetition is minute-based. A 30 second Pixoo push loop
  would need a separate resident loop runner, not the standard task interval.
- When JR has an issue, the lower 3 rows alternate between the normal
  `JR/WX/GB` page and a `JR ALERT` page. The alternation interval follows
  `LIFEBOARD_PIXOO_PAGE_SECONDS`, default `60`.
- The display is ASCII-only at 64x64: route labels are shortened to `HOME>STA`
  and status labels are shortened for legibility.
