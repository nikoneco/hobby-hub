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

To also write an actual 64x64 PNG preview:

```powershell
node .\LifeBoard\pixoo_display\pixoo_lifeboard.js --png-preview .\LifeBoard\data\pixoo_preview_64.png
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

## Existing scheduled task

The existing hidden bus fetcher task runs:

```text
LifeBoard\bus_fetcher\run_manual.ps1
```

That runner now also reads `pixoo_display.local.ps1`. If `PIXOO_IP` is set, the
task pushes the latest frame to Pixoo64 after a successful bus fetch and
LifeBoard post. If `PIXOO_IP` is not set, it logs a skip and continues normally.

## Notes

- Pixoo64 receives a raw 64x64 RGB frame through its local HTTP API.
- This script intentionally uses only Node.js built-in APIs.
- Keep refreshes around the existing bus-fetch cadence, such as 1 to 5 minutes.
  Pixoo libraries warn against pushing frames more than once per second.
- The display is ASCII-only at 64x64: route labels are shortened to `HOME>STA`
  and `STA>HOME`.
