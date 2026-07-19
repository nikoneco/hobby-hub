#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_WEATHERNEWS_URL = 'https://weathernews.jp/v/wl/35.697986/139.8808895/temp=c&lang=ja&type=hour';
const DEFAULT_LOCATION = {
  locationId: 'edogawa',
  displayName: '江戸川区'
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const html = options.inputHtml
    ? fs.readFileSync(options.inputHtml, 'utf8')
    : await fetchWeathernewsHtml(options.url);
  const snapshot = buildWeatherSnapshot(html, options);
  const payload = {
    source: 'weathernews-scraper',
    generatedAt: new Date().toISOString(),
    locations: [snapshot]
  };

  if (options.outPath) {
    fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
    fs.writeFileSync(options.outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
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
    url: process.env.WEATHERNEWS_URL || DEFAULT_WEATHERNEWS_URL,
    outPath: process.env.WEATHER_SNAPSHOT_OUT || path.join(repoRoot, 'LifeBoard', 'data', 'weather_snapshot.json'),
    webAppUrl: process.env.LIFEBOARD_IMPORT_URL || '',
    token: process.env.LIFEBOARD_IMPORT_TOKEN || '',
    locationId: process.env.WEATHER_LOCATION_ID || DEFAULT_LOCATION.locationId,
    displayName: process.env.WEATHER_DISPLAY_NAME || DEFAULT_LOCATION.displayName,
    inputHtml: '',
    post: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--url') options.url = args[++i];
    else if (arg === '--out') options.outPath = path.resolve(args[++i]);
    else if (arg === '--input-html') options.inputHtml = path.resolve(args[++i]);
    else if (arg === '--post') options.post = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--web-app-url') options.webAppUrl = args[++i];
    else if (arg === '--token') options.token = args[++i];
    else if (arg === '--location-id') options.locationId = args[++i];
    else if (arg === '--display-name') options.displayName = args[++i];
    else throw new Error('Unknown argument: ' + arg);
  }

  if (options.dryRun) {
    options.post = false;
  }
  if (options.inputHtml) {
    options.inputHtml = path.resolve(options.inputHtml);
  }
  return options;
}

async function fetchWeathernewsHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error('Weathernews request failed: HTTP ' + response.status + ' ' + text.slice(0, 200));
  }
  return text;
}

function buildWeatherSnapshot(html, options) {
  const rows = parseHourlyRows(html);
  if (!rows.length) {
    throw new Error('Weathernews hourly table was not found');
  }

  const observed = parseObservedWeather(html);
  const now = new Date();
  const lookaheadHours = getLookaheadHours(now);
  const windowRows = rows.slice(0, Math.max(1, lookaheadHours));
  const analysis = analyzeWeatherWindow(windowRows);
  const temps24h = rows.slice(0, 24).map((row) => row.temp).filter(Number.isFinite);
  const high24h = temps24h.length ? Math.max.apply(null, temps24h) : '';
  const low24h = temps24h.length ? Math.min.apply(null, temps24h) : '';
  const currentTemp = Number.isFinite(observed.temperature) ? observed.temperature : rows[0].temp;
  const statusText = analysis.label || observed.statusText || labelForKind(analysis.kind);
  const rainText = buildRainText(analysis.precipitationMax);

  return {
    locationId: options.locationId,
    displayName: options.displayName,
    statusText,
    weatherClass: weatherClassForKind(analysis.kind),
    weatherKind: analysis.kind,
    weatherMode: analysis.mode,
    fromKind: analysis.fromKind || '',
    toKind: analysis.toKind || '',
    weatherLabel: analysis.label,
    temperatureText: formatTemperature(currentTemp),
    apparentText: '-',
    humidityText: observed.humidity === '' ? '-' : String(observed.humidity) + '%',
    precipitationText: rainText,
    windText: Number.isFinite(rows[0].wind) ? String(rows[0].wind) + 'm' : '-',
    highLowText: formatHighLow(high24h, low24h),
    high24hText: high24h === '' ? '-' : formatTemperature(high24h),
    rainChanceText: '-',
    umbrellaText: buildUmbrellaText(analysis.kind, analysis.precipitationMax),
    rainNowcast: {
      source: 'WEATHERNEWS_HOURLY',
      precipitationText: rainText,
      rainNowcastText: analysis.precipitationMax > 0 ? labelForKind(analysis.kind) : '雨なし',
      precipitationMax: analysis.precipitationMax,
      lookaheadHours
    },
    rainOutlook: {
      source: 'WEATHERNEWS_HOURLY',
      outlookText: analysis.label,
      lookaheadHours
    },
    clothingText: '',
    astronomy: {},
    hourly: rows.slice(0, 24).map((row) => ({
      time: row.isoTime,
      hourText: row.timeText,
      weatherText: labelForKind(row.kind),
      weatherKind: row.kind,
      weatherIconCode: row.iconCode,
      temperatureText: formatTemperature(row.temp),
      precipitationText: row.rain === '' ? '-' : String(row.rain) + 'mm',
      windText: Number.isFinite(row.wind) ? String(row.wind) + 'm' : '-'
    })),
    sourceUpdatedAtText: formatLocalDateTime(now),
    sourceUrl: options.url,
    detailText: 'Weathernews HTML scrape; high is next 24h max',
    fetchedAt: now.toISOString()
  };
}

function parseHourlyRows(html) {
  const rows = [];
  const groupPattern = /<div class="wTable__group">(?<body>[\s\S]*?)(?=<div class="wTable__group">|<\/section>)/g;
  const rowPattern = /<div class="wTable__row">(?<row>[\s\S]*?)<\/div>/g;
  let dateCursor = localDateParts(new Date());
  let previousDay = 0;

  for (const groupMatch of html.matchAll(groupPattern)) {
    const body = groupMatch.groups.body;
    const dayMatch = body.match(/<div class="wTable__day"><p class="wTable__item">(\d+)日/);
    if (!dayMatch) {
      continue;
    }
    const day = Number(dayMatch[1]);
    if (previousDay && day < previousDay) {
      dateCursor = addMonths(dateCursor, 1);
    }
    previousDay = day;

    for (const rowMatch of body.matchAll(rowPattern)) {
      const rowHtml = rowMatch.groups.row;
      const timeText = extract(rowHtml, /class="wTable__item time">\s*([^<]+)/);
      if (timeText === '') {
        continue;
      }
      const rain = parseNumber(extract(rowHtml, /class="wTable__item r">\s*([^<]+)/));
      const temp = parseNumber(extract(rowHtml, /class="wTable__item t">\s*([^<]+)/));
      const wind = parseNumber(extract(rowHtml, /class="wTable__item w">[\s\S]*?<\/i>\s*([^<]+)/));
      const iconCode = extract(rowHtml, /wxicon\/(\d+)\.png/);
      const kind = classifyHourlyKind(iconCode, rain);
      rows.push({
        dateText: day + '日',
        timeText,
        isoTime: buildTokyoIso(dateCursor.year, dateCursor.month, day, Number(timeText)),
        iconCode,
        rain,
        temp,
        wind,
        kind
      });
    }
  }
  return rows;
}

function parseObservedWeather(html) {
  const weather = extract(html, /<li><span class="tit">天気<\/span>([^<]+)/);
  const temperature = parseNumber(extract(html, /<li><span class="tit">気温<\/span>\s*([-\d.]+)/));
  const humidity = parseNumber(extract(html, /<li><span class="tit">湿度<\/span>\s*(\d+)/));
  return {
    statusText: weather,
    temperature,
    humidity: Number.isFinite(humidity) ? humidity : ''
  };
}

function analyzeWeatherWindow(rows) {
  const kinds = rows.map((row) => row.kind);
  const precipitationMax = Math.max.apply(null, rows.map((row) => Number.isFinite(row.rain) ? row.rain : 0));
  const half = Math.max(1, Math.ceil(rows.length / 2));
  const firstKind = dominantKind(kinds.slice(0, half));
  const secondKind = dominantKind(kinds.slice(half));
  const hasDry = kinds.some((kind) => kind === 'clear' || kind === 'cloud');
  const wetKinds = kinds.filter(isWetKind);
  const hasWet = wetKinds.length > 0;

  if (firstKind && secondKind && firstKind !== secondKind && (isWetKind(firstKind) || isWetKind(secondKind))) {
    const fromKind = applySuperClear(firstKind, rows);
    const toKind = applySuperClear(secondKind, rows);
    return {
      kind: highestPriorityKind([fromKind, toKind]),
      mode: 'later',
      fromKind,
      toKind,
      precipitationMax,
      label: labelForKind(fromKind) + 'のち' + labelForKind(toKind)
    };
  }

  if (hasDry && hasWet) {
    const dryKind = dominantKind(kinds.filter((kind) => kind === 'clear' || kind === 'cloud')) || 'cloud';
    const wetKind = highestPriorityKind(wetKinds);
    const fromKind = applySuperClear(dryKind, rows);
    return {
      kind: wetKind,
      mode: 'sometimes',
      fromKind,
      toKind: wetKind,
      precipitationMax,
      label: labelForKind(fromKind) + '時々' + labelForKind(wetKind)
    };
  }

  const kind = applySuperClear(highestPriorityKind(kinds), rows);
  return {
    kind,
    mode: 'single',
    fromKind: '',
    toKind: '',
    precipitationMax,
    label: labelForKind(kind)
  };
}

function classifyHourlyKind(iconCode, rain) {
  if (Number.isFinite(rain) && rain >= 5) return 'heavy';
  if (Number.isFinite(rain) && rain >= 1) return 'rain';
  if (Number.isFinite(rain) && rain > 0) return 'drizzle';
  const code = Number(iconCode);
  if (!Number.isFinite(code)) return 'unknown';
  if (code >= 500 && code < 600) return 'thunder';
  if (code >= 400 && code < 500) return 'snow';
  if (code >= 300 && code < 400) return 'rain';
  if ((code >= 200 && code < 300) || (code >= 600 && code < 700)) return 'cloud';
  if (code >= 100 && code < 200) return 'clear';
  return 'unknown';
}

function dominantKind(kinds) {
  const counts = new Map();
  kinds.filter(Boolean).forEach((kind) => counts.set(kind, (counts.get(kind) || 0) + 1));
  let best = '';
  for (const kind of counts.keys()) {
    if (!best || counts.get(kind) > counts.get(best) || (counts.get(kind) === counts.get(best) && priorityOf(kind) < priorityOf(best))) {
      best = kind;
    }
  }
  return best;
}

function highestPriorityKind(kinds) {
  return kinds.filter(Boolean).sort((a, b) => priorityOf(a) - priorityOf(b))[0] || 'unknown';
}

function priorityOf(kind) {
  return {
    thunder: 1,
    snow: 2,
    heavy: 3,
    rain: 4,
    drizzle: 5,
    superclear: 6,
    clear: 7,
    cloud: 8,
    unknown: 99
  }[kind] || 99;
}

function applySuperClear(kind, rows) {
  if (kind !== 'clear') {
    return kind;
  }
  const high24h = Math.max.apply(null, rows.map((row) => row.temp).filter(Number.isFinite));
  return Number.isFinite(high24h) && high24h >= 35 ? 'superclear' : kind;
}

function isWetKind(kind) {
  return ['drizzle', 'rain', 'heavy', 'thunder', 'snow'].includes(kind);
}

function weatherClassForKind(kind) {
  if (kind === 'superclear' || kind === 'clear') return 'clear';
  if (kind === 'cloud') return 'cloud';
  if (kind === 'snow') return 'snow';
  if (kind === 'thunder' || kind === 'heavy') return 'storm';
  if (kind === 'rain' || kind === 'drizzle') return 'rain';
  return 'unknown';
}

function labelForKind(kind) {
  return {
    superclear: '超晴れ',
    clear: '晴れ',
    cloud: 'くもり',
    drizzle: '小雨',
    rain: '雨',
    heavy: '大雨',
    thunder: '雷',
    snow: '雪'
  }[kind] || '天気情報';
}

function buildUmbrellaText(kind, precipitationMax) {
  if (kind === 'snow' || kind === 'thunder' || kind === 'heavy' || kind === 'rain') {
    return '雨具推奨';
  }
  if (kind === 'drizzle' || precipitationMax > 0) {
    return '折りたたみ推奨';
  }
  return '雨具不要';
}

function buildRainText(precipitationMax) {
  if (!Number.isFinite(precipitationMax) || precipitationMax <= 0) {
    return '現在 0mm/h';
  }
  return '最大 ' + trimNumber(precipitationMax) + 'mm/h';
}

function getLookaheadHours(date) {
  const hour = Number(new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: 'numeric',
    hour12: false
  }).format(date));
  return hour < 12 ? 12 : 6;
}

async function postPayload(options, payload) {
  if (!options.token) {
    throw new Error('LIFEBOARD_IMPORT_TOKEN or --token is required when using --post');
  }
  if (!options.webAppUrl) {
    throw new Error('LIFEBOARD_IMPORT_URL or --web-app-url is required when using --post');
  }

  const url = new URL(options.webAppUrl);
  url.searchParams.set('action', 'importWeatherSnapshot');
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

function extract(text, pattern) {
  const match = text.match(pattern);
  return match ? decodeHtml(match[1]).trim() : '';
}

function parseNumber(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function formatTemperature(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return trimNumber(value) + '℃';
}

function formatHighLow(high, low) {
  if (!Number.isFinite(high) || !Number.isFinite(low)) {
    return '-';
  }
  return trimNumber(low) + '℃ / ' + trimNumber(high) + '℃';
}

function trimNumber(value) {
  return String(Math.round(Number(value) * 10) / 10).replace(/\.0$/, '');
}

function buildTokyoIso(year, month, day, hour) {
  return [
    String(year).padStart(4, '0'),
    '-',
    String(month).padStart(2, '0'),
    '-',
    String(day).padStart(2, '0'),
    'T',
    String(hour).padStart(2, '0'),
    ':00:00+09:00'
  ].join('');
}

function localDateParts(date) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(date).reduce((memo, part) => {
    if (part.type !== 'literal') memo[part.type] = Number(part.value);
    return memo;
  }, {});
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day
  };
}

function addMonths(parts, count) {
  let year = parts.year;
  let month = parts.month + count;
  while (month > 12) {
    year += 1;
    month -= 12;
  }
  return { year, month, day: parts.day };
}

function formatLocalDateTime(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function printSummary(payload, options, importResult) {
  const location = payload.locations[0];
  console.log(JSON.stringify({
    mode: options.post ? 'posted' : 'dry-run',
    output: path.resolve(options.outPath),
    generatedAt: payload.generatedAt,
    importResult: importResult || null,
    location: {
      locationId: location.locationId,
      statusText: location.statusText,
      weatherKind: location.weatherKind,
      weatherMode: location.weatherMode,
      fromKind: location.fromKind,
      toKind: location.toKind,
      temperatureText: location.temperatureText,
      high24hText: location.high24hText,
      precipitationText: location.precipitationText,
      umbrellaText: location.umbrellaText,
      lookaheadHours: location.rainNowcast.lookaheadHours
    }
  }, null, 2));
}

function printHelp() {
  console.log([
    'Usage:',
    '  node LifeBoard/weather_fetcher/sync_weathernews_snapshot.js --dry-run',
    '  node LifeBoard/weather_fetcher/sync_weathernews_snapshot.js --post',
    '',
    'Options:',
    '  --dry-run          Fetch Weathernews and write JSON only.',
    '  --post             Fetch and post to LifeBoard GAS.',
    '  --url URL          Weathernews hourly forecast URL.',
    '  --input-html PATH  Parse a saved Weathernews HTML file instead of fetching.',
    '  --out PATH         Output JSON path.',
    '  --web-app-url URL  LifeBoard GAS web app URL.',
    '  --token TOKEN      LifeBoard import token.',
    '  --location-id ID   LifeBoard weather location id.',
    '  --display-name TXT LifeBoard weather display name.',
    '',
    'Environment:',
    '  LIFEBOARD_IMPORT_TOKEN and LIFEBOARD_IMPORT_URL are required by --post.',
    '  WEATHERNEWS_URL overrides the default Weathernews URL.'
  ].join('\n'));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
