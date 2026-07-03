#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxgGdT-E3xm8XKNklnKwzPDxkE4kXHt-xh1n0eOlTST6APtbbZ4jOAJ_kw_BIGLbg_jxg/exec';
const TIMETABLE_PAGE_BASE_URL = 'https://transfer-cloud.navitime.biz/keiseibus-group/courses/timetables';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ROUTES = [
  {
    routeId: 'home_to_station',
    label: '松本橋東詰 → 小岩駅',
    busstopId: '00020186',
    courseSequence: '0008201896-15',
    courseName: '小76',
    referer: 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings?departure-busstop=00020186&arrival-busstop=00020002'
  },
  {
    routeId: 'station_to_home',
    label: '小岩駅 → 松本橋東詰',
    busstopId: '00020002',
    courseSequence: '0008201895-1',
    courseName: '小76',
    referer: 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings?departure-busstop=00020002&arrival-busstop=00020186'
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
    routes.push(await fetchRouteTimetable(route));
  }

  const rows = routes.flatMap((route) => route.rows);
  const payload = {
    source: 'navitime-timetable-page',
    generatedAt: new Date().toISOString(),
    note: 'NAVITIME 京成バスナビ 時刻表ページから取得',
    routes: routes.map((route) => ({
      routeId: route.routeId,
      label: route.label,
      sourceUrl: route.sourceUrl,
      rows: route.rows.length
    })),
    rows
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
    outPath: process.env.BUS_TIMETABLE_OUT || path.join(repoRoot, 'LifeBoard', 'data', 'bus_timetable.json'),
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

async function fetchRouteTimetable(route) {
  const sourceUrl = buildTimetableUrl(route);
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      Referer: route.referer,
      'User-Agent': USER_AGENT
    }
  });
  const html = await response.text();
  if (!response.ok) {
    throw new Error('Timetable page request failed for ' + route.routeId + ': HTTP ' + response.status + ' ' + html.slice(0, 200));
  }

  const rows = parseTimetableRows(route, html, sourceUrl);
  if (!rows.length) {
    throw new Error('No timetable rows parsed for ' + route.routeId);
  }

  return {
    routeId: route.routeId,
    label: route.label,
    sourceUrl,
    rows
  };
}

function parseTimetableRows(route, html, sourceUrl) {
  const rows = [];
  const seen = new Set();
  const blockPattern = /<ul\b[^>]*\bid="(weekday|weekend)-(\d{1,2})"[^>]*>([\s\S]*?)<\/ul>/gi;
  let blockMatch;
  while ((blockMatch = blockPattern.exec(html))) {
    const serviceType = blockMatch[1] === 'weekday' ? '平日' : '土休日';
    const block = blockMatch[3];
    const linkPattern = /<a\b[^>]*\bhref="([^"]*datetime=([^"&]+)[^"]*)"[^>]*>(\d{1,2})<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkPattern.exec(block))) {
      const isoText = decodeURIComponent(linkMatch[2]);
      const departureTime = isoToTimeText(isoText);
      if (!departureTime) {
        continue;
      }
      const key = [route.routeId, serviceType, departureTime].join('|');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      rows.push({
        routeId: route.routeId,
        serviceDate: '',
        serviceType,
        departureTime,
        courseName: route.courseName,
        destination: '',
        via: '',
        enabled: true,
        note: sourceUrl
      });
    }
  }
  return rows.sort((a, b) => {
    if (a.serviceType !== b.serviceType) {
      return a.serviceType === '平日' ? -1 : 1;
    }
    return a.departureTime.localeCompare(b.departureTime);
  });
}

function isoToTimeText(isoText) {
  const match = String(isoText || '').match(/T(\d{2}):(\d{2}):/);
  return match ? match[1] + ':' + match[2] : '';
}

async function postPayload(options, payload) {
  if (!options.token) {
    throw new Error('LIFEBOARD_IMPORT_TOKEN or --token is required when using --post');
  }

  const url = new URL(options.webAppUrl);
  url.searchParams.set('action', 'importBusTimetable');
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
    throw new Error('LifeBoard timetable import returned non-JSON response: HTTP ' + response.status + ' ' + text.slice(0, 300));
  }
  if (!response.ok || !parsed.ok) {
    const message = parsed && parsed.error && parsed.error.message ? parsed.error.message : text;
    throw new Error('LifeBoard timetable import failed: HTTP ' + response.status + ' ' + message);
  }
  return parsed.data || {};
}

function buildTimetableUrl(route) {
  const url = new URL(TIMETABLE_PAGE_BASE_URL);
  url.searchParams.set('busstop', route.busstopId);
  url.searchParams.set('course-sequence', route.courseSequence);
  return url.toString();
}

function printSummary(payload, options, importResult) {
  const summary = {
    mode: options.post ? 'posted' : 'dry-run',
    output: path.resolve(options.outPath),
    generatedAt: payload.generatedAt,
    importResult: importResult || null,
    rows: payload.rows.length,
    routes: payload.routes.map((route) => ({
      routeId: route.routeId,
      label: route.label,
      rows: route.rows,
      firstRows: payload.rows
        .filter((row) => row.routeId === route.routeId)
        .slice(0, 5)
        .map((row) => row.serviceType + ' ' + row.departureTime)
    }))
  };
  console.log(JSON.stringify(summary, null, 2));
}

function printHelp() {
  console.log([
    'Usage:',
    '  node LifeBoard/bus_fetcher/sync_bus_timetable.js --dry-run',
    '  node LifeBoard/bus_fetcher/sync_bus_timetable.js --post',
    '',
    'Options:',
    '  --dry-run          Fetch NAVITIME timetable pages and write JSON only.',
    '  --post             Fetch and post to LifeBoard GAS bus_timetable.',
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
