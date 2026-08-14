# LifeBoard

LifeBoard is the household dashboard inside HobbyHUB. It serves the same data to
the browser PWA and to a Pixoo64 display.

## Runtime overview

1. Windows fetchers collect bus and Weathernews snapshots and post them to the
   LifeBoard Google Apps Script web app.
2. GAS stores imported snapshots in Google Sheets and combines them with rail,
   garbage, calendar, and fallback weather data.
3. The PWA reads the public JSONP allowlist endpoint once per minute.
4. The Windows runner renders and pushes Pixoo every minute from 06:00 through
   22:59, and at fixed 15-minute boundaries from 23:00 through 05:59.

Current fetch cadence:

- Bus: every minute from 06:00 through 06:59, every three minutes from 07:00
  through 22:59, and stopped from 23:00 through 05:59.
- Weathernews: every 15 minutes.
- PWA refresh: every minute while the PWA tab is visible.
- Pixoo render: every minute from 06:00 through 22:59. Overnight it runs at
  `:00`, `:15`, `:30`, and `:45`; the device-managed clock continues locally
  between sends.
- TimeTree: optional hourly import. It requires Python, a server-local TimeTree
  configuration, and task registration without `-SkipTimeTree`.

## Source of truth

- `gas/`: GAS backend and the source HTML/CSS/JavaScript for LifeBoard.
- `bus_fetcher/`: Windows-side NAVITIME snapshot fetcher.
- `weather_fetcher/`: Windows-side Weathernews snapshot fetcher.
- `pixoo_display/`: Pixoo renderer and local push client.
- `windows_ops/`: hidden task runner, setup, and server-share deployment.
- `../docs/lifeboard/`: generated GitHub Pages output. Do not edit it directly.

Run `node tools/build-pages.js` from the HobbyHUB repository root after changing
the PWA source. The builder derives a content hash for asset and service-worker
cache versions, so a changed build is not left behind an old PWA cache.

## Fallback behavior

- Bus: GAS periodically probes direct NAVITIME access. When that path is blocked,
  it uses the latest Windows snapshot; stale real-time data falls back to the
  timetable display.
- Weather: a recent Weathernews snapshot is preferred. Open-Meteo and JMA remain
  fallback sources when the server snapshot is missing or stale.
- Rail: Yahoo! route information is parsed on the GAS side and cached briefly.

## Local-only configuration

Tokens, web-app URLs, Pixoo IP addresses, logs, and runtime snapshots belong in
ignored `*.local.*`, `logs/`, or `data/` files. Do not add spreadsheet IDs,
tokens, or private network details to tracked documentation.

The server runtime is updated with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\windows_ops\Deploy-ToServerShare.ps1 -TargetRoot P:\
```

That deployment intentionally leaves server-local settings, logs, and data
untouched.

Run the dependency-free logic regression checks with:

```powershell
node .\LifeBoard\tests\lifeboard_logic.test.js
```
