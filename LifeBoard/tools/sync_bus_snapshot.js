#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxgGdT-E3xm8XKNklnKwzPDxkE4kXHt-xh1n0eOlTST6APtbbZ4jOAJ_kw_BIGLbg_jxg/exec';
const API_BASE_URL = 'https://transfer-cloud.navitime.biz/apiv1/';
const CUSTOMER = 'keiseibus-group';
const TIMEZONE = 'Asia/Tokyo';
const MAX_ITEMS_PER_ROUTE = 3;

const ROUTES = [
  {
    route_id: 'home_to_station',
    label: '松本橋東詰 → 小岩駅',
    departure_busstop_id: '00020186',
    departure_name: '松本橋東詰',
    arrival_busstop_id: '00020002',
    arrival_name: '小岩駅',
    official_url: 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings?departure-busstop=00020186&arrival-busstop=00020002'
  },
  {
    route_id: 'station_to_home',
    label: '小岩駅 → 松本橋東詰',
    departure_busstop_id: '00020002',
    departure_name: '小岩駅',
    arrival_busstop_id: '00020186',
    arrival_name: '松本橋東詰',
    official_url: 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings?departure-busstop=00020002&arrival-busstop=00020186'
  }
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const routes = [];
  for (const route of ROUTES) {
    routes.push(await fetchRouteSnapshot(route));
  }

  const payload = {
    source: 'local-bus-sync',
    generatedAt: new Date().toISOString(),
    routes
  };

  if (options.outPath) {
    const outPath = path.resolve(options.outPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  if (options.post) {
    await postPayload(options, payload);
  }

  printSummary(payload, options);
}

function parseArgs(args) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const options = {
    outPath: process.env.LIFEBOARD_BUS_JSON_OUT || path.join(repoRoot, 'LifeBoard', 'data', 'bus_snapshot.json'),
    webAppUrl: process.env.LIFEBOARD_IMPORT_URL || DEFAULT_WEB_APP_URL,
    token: process.env.LIFEBOARD_IMPORT_TOKEN || '',
    post: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--out') options.outPath = args[++i];
    else if (arg === '--post') options.post = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--web-app-url') options.webAppUrl = args[++i];
    else if (arg === '--token') options.token = args[++i];
    else throw new Error('Unknown argument: ' + arg);
  }

  if (options.dryRun) {
    options.post = false;
  }
  return options;
}

async function fetchRouteSnapshot(route) {
  const url = buildBusApiUrl(route);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      Referer: route.official_url,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(route.route_id + ' bus API failed: HTTP ' + response.status + ' ' + text.slice(0, 160));
  }

  const payload = JSON.parse(text);
  return {
    routeId: String(route.route_id || ''),
    label: String(route.label || ''),
    departureName: String(route.departure_name || payload.departureName || ''),
    arrivalName: String(route.arrival_name || payload.arrivalName || ''),
    officialUrl: String(route.official_url || buildOfficialBusPageUrl(route)),
    sourceUpdatedAt: payload.updatedAt || '',
    sourceUpdatedAtText: formatDateTime(payload.updatedAt),
    items: (payload.approachings || [])
      .slice(0, MAX_ITEMS_PER_ROUTE)
      .map(normalizeApproaching)
  };
}

function normalizeApproaching(item) {
  const departure = item.departure || {};
  const previousStops = item.numberOfPreviousBusstopsDeparted;
  return {
    courseName: item.courseName || '',
    destination: item.destination || '',
    via: item.via || '',
    vehicleNumber: item.vehicleNumber || '',
    scheduledDepartureTime: departure.scheduledDepartureTime || '',
    scheduledDepartureText: formatTime(departure.scheduledDepartureTime),
    predictedDepartureTime: departure.predictedDepartureTime || '',
    predictedDepartureText: formatTime(departure.predictedDepartureTime),
    delayText: formatDelay(departure.delayOfDeparture),
    remainingMinutes: parseIsoDurationMinutes(departure.remainingTimeUntilDeparture),
    remainingText: formatRemaining(departure.remainingTimeUntilDeparture),
    previousStops: previousStops == null ? '' : previousStops,
    locationText: formatLocationText(previousStops, departure.poleName)
  };
}

function buildBusApiUrl(route) {
  return API_BASE_URL + CUSTOMER + '/busstops/approachings?' + toQueryString({
    'busstop-id': route.departure_busstop_id,
    'arrival-busstop-id': route.arrival_busstop_id,
    'with-other-buses': 'false',
    order: 'numberOfPreviousBusstopsDeparted',
    language: 'ja'
  });
}

function buildOfficialBusPageUrl(route) {
  return 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings?' + toQueryString({
    'departure-busstop': route.departure_busstop_id,
    'arrival-busstop': route.arrival_busstop_id
  });
}

function toQueryString(params) {
  return Object.keys(params).map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(params[key])).join('&');
}

function parseIsoDurationMinutes(value) {
  if (!value) return '';
  const match = String(value).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return '';
  const total = (Number(match[1] || 0) * 60) + Number(match[2] || 0) + (Number(match[3] || 0) / 60);
  return Math.max(0, Math.round(total));
}

function formatRemaining(value) {
  const minutes = parseIsoDurationMinutes(value);
  return minutes === '' ? '出発前' : 'あと約' + minutes + '分';
}

function formatDelay(value) {
  const minutes = parseIsoDurationMinutes(value);
  return minutes === '' || minutes === 0 ? '遅れなし' : '+' + minutes + '分';
}

function formatLocationText(previousStops, poleName) {
  if (previousStops == null || previousStops === '') {
    return poleName ? poleName + '番のりば / 出発前' : '出発前/始発付近';
  }
  return previousStops + '個前から接近中';
}

function formatTime(isoText) {
  if (!isoText) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(isoText));
}

function formatDateTime(isoText) {
  if (!isoText) return '';
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date(isoText));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return map.month + '/' + map.day + ' ' + map.hour + ':' + map.minute + ':' + map.second;
}

async function postPayload(options, payload) {
  if (!options.token) {
    throw new Error('LIFEBOARD_IMPORT_TOKEN or --token is required when using --post');
  }
  const url = options.webAppUrl + (options.webAppUrl.includes('?') ? '&' : '?') + 'action=importBusSnapshot';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(Object.assign({}, payload, { token: options.token }))
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error('POST failed: HTTP ' + response.status + ' ' + text);
  }
  const result = JSON.parse(text);
  if (!result.ok) {
    throw new Error(result.error && result.error.message ? result.error.message : text);
  }
  console.log(JSON.stringify(result.data || result, null, 2));
}

function printSummary(payload, options) {
  console.log(JSON.stringify({
    mode: options.post ? 'posted' : 'dry-run',
    output: options.outPath,
    generatedAt: payload.generatedAt,
    routes: payload.routes.map((route) => ({
      routeId: route.routeId,
      label: route.label,
      sourceUpdatedAtText: route.sourceUpdatedAtText,
      items: route.items.length,
      first: route.items[0] ? {
        scheduledDepartureText: route.items[0].scheduledDepartureText,
        delayText: route.items[0].delayText,
        remainingText: route.items[0].remainingText,
        locationText: route.items[0].locationText
      } : null
    }))
  }, null, 2));
}

function printHelp() {
  console.log([
    'Usage:',
    '  node LifeBoard/tools/sync_bus_snapshot.js [options]',
    '',
    'Options:',
    '  --post                    POST payload to LifeBoard GAS.',
    '  --dry-run                 Do not POST, only write JSON and summary.',
    '  --out <path>              JSON output path.',
    '  --token <token>           Import token for GAS endpoint.',
    '  --web-app-url <url>       LifeBoard web app URL.',
    '',
    'Environment:',
    '  LIFEBOARD_IMPORT_TOKEN is used by --post.',
    '  LIFEBOARD_IMPORT_URL can override the deployed LifeBoard URL.'
  ].join('\n'));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
