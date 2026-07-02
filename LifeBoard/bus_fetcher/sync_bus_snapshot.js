#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxgGdT-E3xm8XKNklnKwzPDxkE4kXHt-xh1n0eOlTST6APtbbZ4jOAJ_kw_BIGLbg_jxg/exec';
const API_BASE_URL = 'https://transfer-cloud.navitime.biz/apiv1/keiseibus-group/busstops/approachings';
const PAGE_BASE_URL = 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings';
const MAX_ITEMS_PER_ROUTE = 3;

const ROUTES = [
  {
    routeId: 'home_to_station',
    label: '松本橋東詰 → 小岩駅',
    departureBusstopId: '00020186',
    departureName: '松本橋東詰',
    arrivalBusstopId: '00020002',
    arrivalName: '小岩駅'
  },
  {
    routeId: 'station_to_home',
    label: '小岩駅 → 松本橋東詰',
    departureBusstopId: '00020002',
    departureName: '小岩駅',
    arrivalBusstopId: '00020186',
    arrivalName: '松本橋東詰'
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
    source: 'manual-bus-fetcher',
    generatedAt: new Date().toISOString(),
    routes
  };

  if (options.outPath) {
    const outPath = path.resolve(options.outPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  let importResult = null;
  if (options.post) {
    importResult = await postPayload(options, payload);
  }

  printSummary(payload, options, importResult);
}

function parseArgs(args) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const options = {
    outPath: process.env.BUS_SNAPSHOT_OUT || path.join(repoRoot, 'LifeBoard', 'data', 'bus_snapshot.json'),
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
  const url = buildApiUrl(route);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      Referer: 'https://transfer-cloud.navitime.biz/keiseibus-group/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error('Bus API request failed for ' + route.routeId + ': HTTP ' + response.status + ' ' + text.slice(0, 200));
  }
  const payload = JSON.parse(text);
  const countdownBaseAt = payload.updatedAt || new Date().toISOString();
  return {
    routeId: route.routeId,
    label: route.label,
    departureName: route.departureName || payload.departureName || '',
    arrivalName: route.arrivalName || payload.arrivalName || '',
    officialUrl: buildOfficialUrl(route),
    sourceUpdatedAt: payload.updatedAt || '',
    sourceUpdatedAtText: formatDateTime(payload.updatedAt),
    countdownBaseAt,
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

async function postPayload(options, payload) {
  if (!options.token) {
    throw new Error('LIFEBOARD_IMPORT_TOKEN or --token is required when using --post');
  }

  const url = new URL(options.webAppUrl);
  url.searchParams.set('action', 'importBusSnapshot');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(Object.assign({}, payload, { token: options.token }))
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error('LifeBoard import returned non-JSON response: HTTP ' + response.status + ' ' + text.slice(0, 300));
  }
  if (!response.ok || !parsed.ok) {
    const message = parsed && parsed.error && parsed.error.message ? parsed.error.message : text;
    throw new Error('LifeBoard import failed: HTTP ' + response.status + ' ' + message);
  }
  return parsed.data || {};
}

function buildApiUrl(route) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('busstop-id', route.departureBusstopId);
  url.searchParams.set('arrival-busstop-id', route.arrivalBusstopId);
  url.searchParams.set('with-other-buses', 'false');
  url.searchParams.set('order', 'numberOfPreviousBusstopsDeparted');
  url.searchParams.set('language', 'ja');
  return url.toString();
}

function buildOfficialUrl(route) {
  const url = new URL(PAGE_BASE_URL);
  url.searchParams.set('departure-busstop', route.departureBusstopId);
  url.searchParams.set('arrival-busstop', route.arrivalBusstopId);
  return url.toString();
}

function parseIsoDurationMinutes(value) {
  if (!value) {
    return '';
  }
  const match = String(value).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return '';
  }
  const total = (Number(match[1] || 0) * 60) + Number(match[2] || 0) + (Number(match[3] || 0) / 60);
  return Math.max(0, Math.round(total));
}

function formatRemaining(value) {
  const minutes = parseIsoDurationMinutes(value);
  if (minutes === '') {
    return '出発前';
  }
  return 'あと約' + minutes + '分';
}

function formatDelay(value) {
  const minutes = parseIsoDurationMinutes(value);
  if (minutes === '' || minutes === 0) {
    return '遅れなし';
  }
  return '+' + minutes + '分';
}

function formatLocationText(previousStops, poleName) {
  if (previousStops == null || previousStops === '') {
    return poleName ? poleName + '番のりば / 出発前' : '出発前/始発付近';
  }
  return previousStops + '個前から接近中';
}

function formatTime(isoText) {
  if (!isoText) {
    return '';
  }
  return formatDate(isoText, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatDateTime(isoText) {
  if (!isoText) {
    return '';
  }
  return formatDate(isoText, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function formatDate(isoText, options) {
  const formatter = new Intl.DateTimeFormat('ja-JP', Object.assign({
    timeZone: 'Asia/Tokyo'
  }, options));
  return formatter.format(new Date(isoText)).replace(/\//g, '/');
}

function printSummary(payload, options, importResult) {
  const summary = {
    mode: options.post ? 'posted' : 'dry-run',
    output: path.resolve(options.outPath),
    generatedAt: payload.generatedAt,
    importResult: importResult || null,
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
  };
  console.log(JSON.stringify(summary, null, 2));
}

function printHelp() {
  console.log([
    'Usage:',
    '  node LifeBoard/bus_fetcher/sync_bus_snapshot.js --dry-run',
    '  node LifeBoard/bus_fetcher/sync_bus_snapshot.js --post',
    '',
    'Options:',
    '  --dry-run          Fetch NAVITIME and write JSON only.',
    '  --post             Fetch and post to LifeBoard GAS.',
    '  --out PATH         Output JSON path.',
    '  --web-app-url URL  LifeBoard GAS web app URL.',
    '  --token TOKEN      LifeBoard import token.',
    '',
    'Environment:',
    '  LIFEBOARD_IMPORT_TOKEN is required by --post.',
    '  LIFEBOARD_IMPORT_URL overrides the web app URL.'
  ].join('\n'));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
