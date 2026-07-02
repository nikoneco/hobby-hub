# TimeTree calendar sync

Local helper for the LifeBoard calendar import flow.

## Dry run

```powershell
node .\LifeBoard\tools\sync_timetree_calendar.js --dry-run
```

This reads `C:\Users\aqua_\my_calendar.ics`, extracts upcoming events, and writes:

```text
LifeBoard\data\timetree_events.json
```

## Refresh ICS and build JSON

Double-click helper:

```text
LifeBoard\tools\sync_timetree_calendar.local.bat
```

Leave the email/password blank to use the same interactive prompt as before.
Fill these lines in the bat file when you want unattended export:

```bat
set "LIFEBOARD_TIMETREE_EMAIL=your@example.com"
set "LIFEBOARD_TIMETREE_PASSWORD=your password"
set "LIFEBOARD_TIMETREE_CALENDAR_SELECTION=1"
```

Set `SYNC_MODE=POST` after the GAS import token has been configured. This sends
the converted JSON to LifeBoard and overwrites `calendar_events` with the latest
local export.

Manual prompt mode:

```powershell
node .\LifeBoard\tools\sync_timetree_calendar.js --export --dry-run
```

The exporter asks in this order:

1. email address
2. password
3. calendar selection number

Unattended input mode:

```powershell
$env:TIMETREE_EMAIL = "your@example.com"
$env:TIMETREE_PASSWORD = "your temporary password"
$env:TIMETREE_CALENDAR_SELECTION = "1"
node .\LifeBoard\tools\sync_timetree_calendar.js --export --dry-run
```

With the current exporter, email/password are read from environment variables.
Only the calendar selection number is sent to the prompt automatically.

By default, event descriptions are not included in JSON/POST. Add
`--include-description` only when LifeBoard needs notes from the calendar body.

## POST to LifeBoard GAS

The GAS import endpoint is added separately. Once it exists:

```powershell
$env:TIMETREE_EMAIL = "your@example.com"
$env:TIMETREE_PASSWORD = "your temporary password"
$env:TIMETREE_CALENDAR_SELECTION = "1"
$env:LIFEBOARD_IMPORT_TOKEN = "set-this-token-in-gas"
node .\LifeBoard\tools\sync_timetree_calendar.js --export --post
```

Recommended automation later:

- Windows sign-in: `--export --post`
- Daily early morning: `--export --post`

Keep the TimeTree password out of the script file. Use environment variables or a temporary password.

## Windows scheduled task

Register logon + hourly sync:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\tools\register_timetree_sync_task.ps1
```

Change interval:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\tools\register_timetree_sync_task.ps1 -IntervalMinutes 120
```

Unregister:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\tools\register_timetree_sync_task.ps1 -Unregister
```

Scheduled runs write logs to:

```text
LifeBoard\logs\timetree_sync.log
```

The scheduled task launches `run_timetree_sync_hidden.vbs` through `wscript.exe`.
The VBS runner starts PowerShell with window style `0`, avoiding the brief
PowerShell window flash that can happen when Task Scheduler points directly at
`powershell.exe`. The `.local.bat` is kept for manual runs and as the place
where the local account/token values are stored.
