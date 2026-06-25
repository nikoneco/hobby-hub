# LifeBoard

Morning dashboard prototype for HobbyHUB.

## Current prototype

- Reads bus route settings from the Google Sheet `LifeBoard`.
- Fetches Keisei Bus approach information for two fixed directions.
- Shows scheduled time, delay, previous bus stop count, and remaining minutes.
- Supports manual refresh and optional 10-minute browser-side auto refresh.

## Google Sheet

- Spreadsheet ID: `1-vYY2ekc3UCz8_QKYpR4dXUt2uQ9y6gJRLM_Qccrcg0`
- `bus_routes`: route configuration.
- `bus_latest_sample`: manually seeded sample of the expected output shape.
