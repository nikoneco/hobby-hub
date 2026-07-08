#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 64;
const PIXELS = SIZE * SIZE;
const DEFAULT_INPUT = path.resolve(__dirname, '..', 'data', 'bus_snapshot.json');
const DEFAULT_PREVIEW = path.resolve(__dirname, '..', 'data', 'pixoo_preview.svg');
const DEFAULT_PNG_PREVIEW = path.resolve(__dirname, '..', 'data', 'pixoo_preview_64.png');

const COLORS = {
  black: [0, 0, 0],
  dim: [28, 28, 34],
  white: [210, 220, 220],
  muted: [92, 100, 105],
  green: [0, 210, 120],
  blue: [55, 160, 255],
  cyan: [70, 220, 240],
  amber: [255, 155, 35],
  red: [255, 55, 55],
  purple: [170, 110, 255]
};

const FONT_3X5 = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  'A': ['111', '101', '111', '101', '101'],
  'B': ['110', '101', '110', '101', '110'],
  'C': ['111', '100', '100', '100', '111'],
  'D': ['110', '101', '101', '101', '110'],
  'E': ['111', '100', '110', '100', '111'],
  'F': ['111', '100', '110', '100', '100'],
  'G': ['111', '100', '101', '101', '111'],
  'H': ['101', '101', '111', '101', '101'],
  'I': ['111', '010', '010', '010', '111'],
  'J': ['001', '001', '001', '101', '111'],
  'K': ['101', '101', '110', '101', '101'],
  'L': ['100', '100', '100', '100', '111'],
  'M': ['101', '111', '111', '101', '101'],
  'N': ['101', '111', '111', '111', '101'],
  'O': ['111', '101', '101', '101', '111'],
  'P': ['111', '101', '111', '100', '100'],
  'Q': ['111', '101', '101', '111', '001'],
  'R': ['111', '101', '111', '110', '101'],
  'S': ['111', '100', '111', '001', '111'],
  'T': ['111', '010', '010', '010', '010'],
  'U': ['101', '101', '101', '101', '111'],
  'V': ['101', '101', '101', '101', '010'],
  'W': ['101', '101', '111', '111', '101'],
  'X': ['101', '101', '010', '101', '101'],
  'Y': ['101', '101', '010', '010', '010'],
  'Z': ['111', '001', '010', '100', '111'],
  ':': ['000', '010', '000', '010', '000'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '?': ['111', '001', '010', '000', '010'],
  '>': ['100', '010', '001', '010', '100'],
  '/': ['001', '001', '010', '100', '100'],
  '.': ['000', '000', '000', '000', '010'],
  ' ': ['000', '000', '000', '000', '000']
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const snapshot = readSnapshot(options.input);
  const lifeData = await readLifeBoardData(options);
  const frame = renderLifeBoardFrame(snapshot, lifeData, options);

  if (options.preview) {
    writeSvgPreview(frame, options.preview);
  }
  if (options.pngPreview) {
    writePngPreview(frame, options.pngPreview);
  }

  if (options.push) {
    if (!options.pixooIp) {
      throw new Error('PIXOO_IP or --pixoo-ip is required when using --push');
    }
    await pushFrameToPixoo(options.pixooIp, frame, options);
  }

  printSummary(snapshot, lifeData, options);
}

function parseArgs(args) {
  const options = {
    input: process.env.LIFEBOARD_PIXOO_INPUT || DEFAULT_INPUT,
    lifeInput: process.env.LIFEBOARD_PIXOO_LIFE_INPUT || '',
    lifeUrl: process.env.LIFEBOARD_PIXOO_LIFE_URL || process.env.LIFEBOARD_IMPORT_URL || '',
    preview: process.env.LIFEBOARD_PIXOO_PREVIEW || DEFAULT_PREVIEW,
    pngPreview: process.env.LIFEBOARD_PIXOO_PNG_PREVIEW || '',
    pixooIp: process.env.PIXOO_IP || '',
    brightness: process.env.PIXOO_BRIGHTNESS ? Number(process.env.PIXOO_BRIGHTNESS) : '',
    pageIntervalSeconds: process.env.LIFEBOARD_PIXOO_PAGE_SECONDS ? Number(process.env.LIFEBOARD_PIXOO_PAGE_SECONDS) : 60,
    push: false,
    noPreview: false,
    help: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--input') options.input = args[++i];
    else if (arg === '--life-input') options.lifeInput = args[++i];
    else if (arg === '--life-url') options.lifeUrl = args[++i];
    else if (arg === '--preview') options.preview = args[++i];
    else if (arg === '--png-preview') options.pngPreview = args[++i] || DEFAULT_PNG_PREVIEW;
    else if (arg === '--no-preview') options.noPreview = true;
    else if (arg === '--push') options.push = true;
    else if (arg === '--pixoo-ip') options.pixooIp = args[++i];
    else if (arg === '--brightness') options.brightness = Number(args[++i]);
    else if (arg === '--page-seconds') options.pageIntervalSeconds = Number(args[++i]);
    else throw new Error('Unknown argument: ' + arg);
  }

  if (options.noPreview) {
    options.preview = '';
  }
  options.input = path.resolve(options.input);
  if (options.lifeInput) {
    options.lifeInput = path.resolve(options.lifeInput);
  }
  if (options.preview) {
    options.preview = path.resolve(options.preview);
  }
  if (options.pngPreview) {
    options.pngPreview = path.resolve(options.pngPreview);
  }
  return options;
}

async function readLifeBoardData(options) {
  try {
    if (options.lifeInput) {
      const parsed = JSON.parse(fs.readFileSync(options.lifeInput, 'utf8'));
      return parsed && parsed.ok && parsed.data ? parsed.data : parsed;
    }
    if (!options.lifeUrl) {
      return null;
    }
    const url = new URL(options.lifeUrl);
    url.searchParams.set('api', 'lifeBoardData');
    url.searchParams.set('callback', '__pixooLifeBoard');
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' ' + text.slice(0, 120));
    }
    const match = text.match(/^__pixooLifeBoard\(([\s\S]*)\);?\s*$/);
    if (!match) {
      throw new Error('LifeBoard API returned non-JSONP response');
    }
    const parsed = JSON.parse(match[1]);
    if (!parsed.ok) {
      const message = parsed.error && parsed.error.message ? parsed.error.message : 'LifeBoard API error';
      throw new Error(message);
    }
    return parsed.data || null;
  } catch (error) {
    console.warn('LifeBoard side data unavailable: ' + (error && error.message ? error.message : String(error)));
    return {
      pixooError: error && error.message ? error.message : String(error)
    };
  }
}

function readSnapshot(inputPath) {
  if (!fs.existsSync(inputPath)) {
    return {
      generatedAt: '',
      routes: []
    };
  }
  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

function renderLifeBoardFrame(snapshot, lifeData, options) {
  const frame = createFrame(COLORS.black);
  const routes = Array.isArray(snapshot.routes) ? snapshot.routes : [];
  const home = routes.find((route) => route.routeId === 'home_to_station') || routes[0] || null;
  const age = snapshot.generatedAt ? ageMinutes(snapshot.generatedAt) : '';
  const stale = age !== '' && age >= 15;
  const railStatus = buildRailStatus(lifeData);

  drawText(frame, nowTextWithSeconds(), 0, 0, stale ? COLORS.amber : COLORS.white);
  if (stale) {
    drawText(frame, 'OLD', 38, 0, COLORS.amber);
  }
  drawLine(frame, 0, 6, 63, 6, COLORS.dim);

  drawRoutePanel(frame, {
    y: 8,
    accent: COLORS.green,
    label: 'HOME>STA',
    route: home
  });
  drawLine(frame, 0, 37, 63, 37, COLORS.dim);
  if (railStatus.issue && isAlternatePageDue(options.pageIntervalSeconds)) {
    drawRailAlertPage(frame, railStatus);
  } else {
    drawStatusLine(frame, 40, railStatus);
    drawStatusLine(frame, 48, buildWeatherStatus(lifeData));
    drawStatusLine(frame, 56, buildGarbageStatus(lifeData));
  }

  return frame;
}

function drawRoutePanel(frame, config) {
  const item = firstItem(config.route);
  drawRect(frame, 0, config.y, 1, 24, config.accent);
  drawText(frame, config.label, 3, config.y, config.accent);

  if (!item) {
    drawText(frame, 'NO DATA', 6, config.y + 11, COLORS.amber, 2);
    return;
  }

  const time = shortTime(item.predictedDepartureText || item.scheduledDepartureText || '--:--');
  const delay = normalizeDelay(item.delayText);
  const delayColor = delay === 'OK' ? COLORS.green : COLORS.amber;
  const remaining = normalizeRemaining(item.remainingMinutes);
  const location = normalizeLocation(item.previousStops, item.locationText);
  const next = nextItem(config.route);

  drawText(frame, time, 4, config.y + 9, COLORS.white, 2);
  drawText(frame, delay, 45, config.y + 9, delayColor);
  drawText(frame, remaining, 45, config.y + 16, remainingColor(item.remainingMinutes));
  drawText(frame, location, 4, config.y + 25, COLORS.cyan);
  if (next) {
    drawText(frame, 'NXT ' + shortTime(next.predictedDepartureText || next.scheduledDepartureText), 30, config.y + 25, COLORS.muted);
  }
}

function drawStatusLine(frame, y, status) {
  drawText(frame, fitText(status.text, 16), 0, y, status.color || COLORS.white);
}

function drawRailAlertPage(frame, railStatus) {
  drawText(frame, 'JR ALERT', 0, 40, railStatus.color || COLORS.amber);
  drawText(frame, fitText(railStatus.line + ' ' + railStatus.code, 16), 0, 48, railStatus.color || COLORS.amber);
  drawText(frame, 'CHECK WEB', 0, 56, COLORS.white);
}

function isAlternatePageDue(pageIntervalSeconds) {
  const seconds = Number(pageIntervalSeconds);
  const interval = Number.isFinite(seconds) && seconds >= 15 ? seconds : 60;
  return Math.floor(Date.now() / (interval * 1000)) % 2 === 1;
}

function buildRailStatus(lifeData) {
  const routes = lifeData && lifeData.rail && Array.isArray(lifeData.rail.routes) ? lifeData.rail.routes : [];
  if (!routes.length) {
    return { text: 'JR ?', color: COLORS.muted };
  }
  const issue = routes.find((route) => isRailIssue(route));
  if (issue) {
    const severity = String(issue.severity || '').toLowerCase();
    const code = normalizeRailIssueCode(issue);
    return {
      text: severity === 'suspended' ? 'JR STOP' : 'JR CHECK',
      line: normalizeRailLineName(issue),
      code,
      issue,
      color: severity === 'suspended' ? COLORS.red : COLORS.amber
    };
  }
  return { text: 'JR OK', line: 'JR', code: 'OK', issue: null, color: COLORS.green };
}

function isRailIssue(route) {
  const severity = String(route && route.severity || '').toLowerCase();
  const status = String(route && route.statusText || '');
  return (severity && severity !== 'normal') || (status && status !== '平常運転' && status !== '通常運転');
}

function normalizeRailLineName(route) {
  const text = String(route && (route.displayName || route.routeId || route.lineId) || '');
  if (/総武|soubu|sobu/i.test(text)) return 'SOBU';
  if (/中央|chuo/i.test(text)) return 'CHUO';
  if (/山手|yamanote/i.test(text)) return 'YAMA';
  if (/京浜|keihin/i.test(text)) return 'KEIH';
  if (/常磐|joban/i.test(text)) return 'JOBN';
  if (/京葉|keiyo/i.test(text)) return 'KEIY';
  return 'LINE';
}

function normalizeRailIssueCode(route) {
  const severity = String(route && route.severity || '').toLowerCase();
  const status = String(route && route.statusText || '');
  if (severity === 'suspended' || status.indexOf('見合わせ') >= 0) return 'STOP';
  if (severity === 'delay' || status.indexOf('遅') >= 0) return 'DELAY';
  if (severity === 'unknown') return 'UNK';
  return 'INFO';
}

function buildWeatherStatus(lifeData) {
  const locations = lifeData && lifeData.weather && Array.isArray(lifeData.weather.locations) ? lifeData.weather.locations : [];
  const location = locations[0];
  if (!location) {
    return { text: 'WX ?', color: COLORS.muted };
  }
  const temp = extractRoundedNumber(location.temperatureText);
  const advice = normalizeUmbrellaText(location.umbrellaText);
  const tempText = temp === '' ? '--C' : String(temp) + 'C';
  return {
    text: 'WX ' + tempText + ' ' + advice.label,
    color: advice.color
  };
}

function normalizeUmbrellaText(value) {
  const text = String(value || '');
  if (text.indexOf('不要') >= 0 || text.toUpperCase().indexOf('NONE') >= 0) {
    return { label: 'CLEAR', color: COLORS.blue };
  }
  if (text.indexOf('折') >= 0) {
    return { label: 'FOLD', color: COLORS.amber };
  }
  if (text.indexOf('傘') >= 0 || text.indexOf('雨具') >= 0 || text.indexOf('雨') >= 0) {
    return { label: 'RAIN', color: COLORS.amber };
  }
  if (text.indexOf('不可') >= 0 || text === '-') {
    return { label: '?', color: COLORS.muted };
  }
  return { label: 'WX', color: COLORS.white };
}

function buildGarbageStatus(lifeData) {
  const days = lifeData && lifeData.garbage && Array.isArray(lifeData.garbage.days) ? lifeData.garbage.days : [];
  const today = days[0] || null;
  const tomorrow = days[1] || null;
  const todayText = summarizeGarbageDay(today);
  if (todayText) {
    return { text: 'GB T ' + todayText, color: COLORS.amber };
  }
  const tomorrowText = summarizeGarbageDay(tomorrow);
  if (tomorrowText) {
    return { text: 'GB M ' + tomorrowText, color: COLORS.cyan };
  }
  if (!days.length) {
    return { text: 'GB ?', color: COLORS.muted };
  }
  return { text: 'GB NONE', color: COLORS.green };
}

function summarizeGarbageDay(day) {
  const items = day && Array.isArray(day.items) ? day.items : [];
  const labels = Array.from(new Set(items.map((item) => normalizeGarbageLabel(item && item.label)).filter(Boolean)));
  return labels.slice(0, 2).join('+');
}

function normalizeGarbageLabel(value) {
  const text = String(value || '');
  if (!text) return '';
  if (/プラ|plastic/i.test(text)) return 'PLA';
  if (/ペット|PET/i.test(text)) return 'PET';
  if (/資源|resource/i.test(text)) return 'RES';
  if (/古紙|紙|paper/i.test(text)) return 'PAPER';
  if (/びん|ビン|瓶|缶|can|bottle/i.test(text)) return 'CAN';
  if (/不燃|燃やさない|non/i.test(text)) return 'NON';
  if (/可燃|燃やす|燃える|burn/i.test(text)) return 'BURN';
  return 'ITEM';
}

function extractRoundedNumber(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return '';
  }
  return Math.round(Number(match[0]));
}

function fitText(value, maxChars) {
  const text = String(value || '');
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function firstItem(route) {
  const items = route && Array.isArray(route.items) ? route.items : [];
  return items[0] || null;
}

function nextItem(route) {
  const items = route && Array.isArray(route.items) ? route.items : [];
  return items[1] || null;
}

function shortTime(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  return match ? pad2(match[1]) + ':' + match[2] : '--:--';
}

function normalizeDelay(value) {
  const text = String(value || '');
  if (!text || text === '遅れなし') {
    return 'OK';
  }
  const match = text.match(/([+-]?\d+)/);
  return match ? '+' + Math.abs(Number(match[1])) : 'DLY';
}

function normalizeRemaining(value) {
  if (value === '' || value == null || Number.isNaN(Number(value))) {
    return '--M';
  }
  const minutes = Math.max(0, Math.round(Number(value)));
  if (minutes >= 100) {
    return '99M';
  }
  return String(minutes) + 'M';
}

function remainingColor(value) {
  const minutes = Number(value);
  if (Number.isNaN(minutes)) {
    return COLORS.muted;
  }
  if (minutes <= 5) {
    return COLORS.red;
  }
  if (minutes <= 10) {
    return COLORS.amber;
  }
  return COLORS.green;
}

function normalizeLocation(previousStops, locationText) {
  if (previousStops !== '' && previousStops != null && !Number.isNaN(Number(previousStops))) {
    return Math.max(0, Number(previousStops)) + 'STP';
  }
  if (String(locationText || '').indexOf('出発前') >= 0) {
    return 'DEP';
  }
  return 'STP?';
}

function ageMinutes(isoText) {
  const ms = Date.now() - Date.parse(isoText);
  if (!Number.isFinite(ms)) {
    return '';
  }
  return Math.max(0, Math.floor(ms / 60000));
}

function nowTextWithSeconds() {
  const date = new Date();
  return pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds());
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function createFrame(rgb) {
  const frame = Buffer.alloc(PIXELS * 3);
  for (let i = 0; i < PIXELS; i += 1) {
    const offset = i * 3;
    frame[offset] = rgb[0];
    frame[offset + 1] = rgb[1];
    frame[offset + 2] = rgb[2];
  }
  return frame;
}

function drawText(frame, text, x, y, rgb, scale) {
  const value = String(text || '').toUpperCase();
  const size = scale || 1;
  let cursor = x;
  for (const character of value) {
    const glyph = FONT_3X5[character] || FONT_3X5[' '];
    drawGlyph(frame, glyph, cursor, y, rgb, size);
    cursor += (4 * size);
  }
}

function drawGlyph(frame, glyph, x, y, rgb, scale) {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let col = 0; col < glyph[row].length; col += 1) {
      if (glyph[row][col] !== '1') {
        continue;
      }
      drawRect(frame, x + (col * scale), y + (row * scale), scale, scale, rgb);
    }
  }
}

function drawRect(frame, x, y, width, height, rgb) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(frame, xx, yy, rgb);
    }
  }
}

function drawLine(frame, x1, y1, x2, y2, rgb) {
  const dx = Math.abs(x2 - x1);
  const sx = x1 < x2 ? 1 : -1;
  const dy = -Math.abs(y2 - y1);
  const sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;
  let x = x1;
  let y = y1;

  while (true) {
    setPixel(frame, x, y, rgb);
    if (x === x2 && y === y2) {
      break;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function setPixel(frame, x, y, rgb) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) {
    return;
  }
  const offset = ((y * SIZE) + x) * 3;
  frame[offset] = clamp(rgb[0]);
  frame[offset + 1] = clamp(rgb[1]);
  frame[offset + 2] = clamp(rgb[2]);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

async function pushFrameToPixoo(ipAddress, frame, options) {
  const baseUrl = 'http://' + ipAddress.replace(/^https?:\/\//, '').replace(/\/.*$/, '') + '/post';
  if (options.brightness !== '' && !Number.isNaN(options.brightness)) {
    await postPixoo(baseUrl, {
      Command: 'Channel/SetBrightness',
      Brightness: Math.max(0, Math.min(100, Math.round(options.brightness)))
    });
  }

  let picId = 1;
  try {
    const current = await postPixoo(baseUrl, { Command: 'Draw/GetHttpGifId' });
    picId = Number(current.PicId || 0) + 1;
    if (picId >= 32) {
      await postPixoo(baseUrl, { Command: 'Draw/ResetHttpGifId' });
      picId = 1;
    }
  } catch (error) {
    picId = 1;
  }

  await postPixoo(baseUrl, {
    Command: 'Draw/SendHttpGif',
    PicNum: 1,
    PicWidth: SIZE,
    PicOffset: 0,
    PicID: picId,
    PicSpeed: 1000,
    PicData: frame.toString('base64')
  });
}

async function postPixoo(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error('Pixoo returned non-JSON response: HTTP ' + response.status + ' ' + text.slice(0, 200));
  }
  if (!response.ok || (parsed.error_code != null && Number(parsed.error_code) !== 0)) {
    throw new Error('Pixoo request failed: HTTP ' + response.status + ' ' + text.slice(0, 300));
  }
  return parsed;
}

function writeSvgPreview(frame, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const rects = [];
  rects.push('<rect width="64" height="64" fill="#000"/>');
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const offset = ((y * SIZE) + x) * 3;
      const r = frame[offset];
      const g = frame[offset + 1];
      const b = frame[offset + 2];
      if (r === 0 && g === 0 && b === 0) {
        continue;
      }
      rects.push('<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="rgb(' + r + ',' + g + ',' + b + ')"/>');
    }
  }
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64" shape-rendering="crispEdges">',
    '<title>LifeBoard Pixoo preview</title>',
    rects.join(''),
    '</svg>'
  ].join('');
  fs.writeFileSync(outputPath, svg, 'utf8');
}

function writePngPreview(frame, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    const rowOffset = y * ((SIZE * 4) + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < SIZE; x += 1) {
      const sourceOffset = ((y * SIZE) + x) * 3;
      const targetOffset = rowOffset + 1 + (x * 4);
      raw[targetOffset] = frame[sourceOffset];
      raw[targetOffset + 1] = frame[sourceOffset + 1];
      raw[targetOffset + 2] = frame[sourceOffset + 2];
      raw[targetOffset + 3] = 255;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const chunks = [
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ];
  fs.writeFileSync(outputPath, Buffer.concat([signature].concat(chunks)));
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function printSummary(snapshot, lifeData, options) {
  const routes = Array.isArray(snapshot.routes) ? snapshot.routes : [];
  const rail = buildRailStatus(lifeData);
  const weather = buildWeatherStatus(lifeData);
  const garbage = buildGarbageStatus(lifeData);
  console.log(JSON.stringify({
    mode: options.push ? 'pushed' : 'preview',
    input: options.input,
    lifeInput: options.lifeInput || null,
    lifeUrl: options.lifeUrl ? '(set)' : null,
    preview: options.preview || null,
    pngPreview: options.pngPreview || null,
    pixooIp: options.push ? options.pixooIp : null,
    generatedAt: snapshot.generatedAt || '',
    status: {
      rail: rail.text,
      weather: weather.text,
      garbage: garbage.text
    },
    routes: routes.map((route) => {
      const item = firstItem(route);
      return {
        routeId: route.routeId,
        label: route.label,
        first: item ? {
          time: item.predictedDepartureText || item.scheduledDepartureText || '',
          delay: item.delayText || '',
          remaining: item.remainingText || '',
          location: item.locationText || ''
        } : null
      };
    })
  }, null, 2));
}

function printHelp() {
  console.log([
    'Usage:',
    '  node LifeBoard/pixoo_display/pixoo_lifeboard.js',
    '  node LifeBoard/pixoo_display/pixoo_lifeboard.js --push --pixoo-ip 192.168.1.50',
    '',
    'Options:',
    '  --input PATH        bus_snapshot.json path.',
    '  --life-input PATH   Optional saved lifeBoardData JSON path.',
    '  --life-url URL      Optional LifeBoard web app URL for rail/weather/garbage.',
    '  --preview PATH      Write a 64x64 SVG preview.',
    '  --png-preview PATH  Write a 64x64 PNG preview.',
    '  --no-preview        Do not write a preview file.',
    '  --push              Send the rendered frame to Pixoo64.',
    '  --pixoo-ip IP       Pixoo64 local IP address.',
    '  --brightness 0-100  Set Pixoo brightness before pushing.',
    '  --page-seconds N    Alternation interval for the lower Pixoo page.',
    '',
    'Environment:',
    '  PIXOO_IP, PIXOO_BRIGHTNESS, LIFEBOARD_IMPORT_URL, LIFEBOARD_PIXOO_INPUT, LIFEBOARD_PIXOO_LIFE_INPUT, LIFEBOARD_PIXOO_LIFE_URL, LIFEBOARD_PIXOO_PAGE_SECONDS, LIFEBOARD_PIXOO_PREVIEW, LIFEBOARD_PIXOO_PNG_PREVIEW'
  ].join('\n'));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
