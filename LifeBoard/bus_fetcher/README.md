# LifeBoard bus fetcher

Manual local fetcher for the LifeBoard bus realtime fallback.

GAS `UrlFetchApp` is currently blocked by the NAVITIME/CloudFront side. This
folder keeps the test local and manual: Windows fetches the NAVITIME JSON, then
posts a normalized snapshot to LifeBoard. LifeBoard still tries direct GAS fetch
first, and uses this snapshot only when direct fetch fails.

## Dry run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\bus_fetcher\run_manual.ps1 -DryRun
```

This writes:

```text
LifeBoard\data\bus_snapshot.json
```

## Post to LifeBoard

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\bus_fetcher\run_manual.ps1
```

`run_manual.ps1` reads `LIFEBOARD_IMPORT_TOKEN` from the environment. If it is
not set, it falls back to the existing local TimeTree bat file:

```text
LifeBoard\tools\sync_timetree_calendar.local.bat
```

Optional local overrides can be placed in an ignored file:

```text
LifeBoard\bus_fetcher\bus_fetcher.local.ps1
```

Example:

```powershell
$env:LIFEBOARD_IMPORT_TOKEN = "your-token"
$env:LIFEBOARD_IMPORT_URL = "https://script.google.com/macros/s/.../exec"
```

Manual runs append logs to:

```text
LifeBoard\logs\bus_fetcher_manual.log
```
