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
const DEFAULT_MISAKI_GOTHIC = path.resolve(__dirname, '..', 'misaki_png_2021-05-05a', 'misaki_gothic.png');

const MISAKI_KUTEN = {
  'バ': [5, 48],
  'ス': [5, 25],
  '勤': [22, 48],
  '務': [44, 19],
  '有': [45, 13],
  '給': [21, 75],
  '休': [21, 57],
  '中': [35, 70],
  'け': [4, 17],
  '次': [28, 1],
  '駅': [17, 56],
  '前': [33, 16],
  '分': [42, 12],
  'ゴ': [5, 20],
  'ミ': [5, 63],
  '今': [26, 3],
  '日': [38, 92],
  '明': [44, 32],
  '可': [18, 36],
  '燃': [39, 19],
  '不': [41, 52],
  '資': [27, 81],
  '源': [24, 27],
  '無': [44, 21],
  'し': [4, 23],
  'プ': [5, 55],
  'ラ': [5, 73],
  '紙': [27, 70],
  '缶': [20, 44],
  'ペ': [5, 58],
  'ッ': [5, 35],
  'ト': [5, 40],
  '晴': [32, 18],
  '雨': [17, 11],
  '雲': [17, 32],
  '雪': [32, 67],
  'れ': [4, 76],
  'く': [4, 15],
  'も': [4, 66],
  'り': [4, 74],
  '強': [22, 15]
};

let misakiFontCache = null;

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
  const frames = renderLifeBoardFrames(snapshot, lifeData, options);
  const previewFrame = frames[0];

  if (options.preview) {
    writeSvgPreview(previewFrame, options.preview);
  }
  if (options.pngPreview) {
    writePngPreview(previewFrame, options.pngPreview);
  }

  if (options.push) {
    if (!options.pixooIp) {
      throw new Error('PIXOO_IP or --pixoo-ip is required when using --push');
    }
    await pushFrameToPixoo(options.pixooIp, frames, options);
  }

  printSummary(snapshot, lifeData, options);
}

function parseArgs(args) {
  const options = {
    input: process.env.LIFEBOARD_PIXOO_INPUT || DEFAULT_INPUT,
    lifeInput: process.env.LIFEBOARD_PIXOO_LIFE_INPUT || '',
    lifeUrl: process.env.LIFEBOARD_PIXOO_LIFE_URL || process.env.LIFEBOARD_IMPORT_URL || '',
    fontPng: process.env.LIFEBOARD_PIXOO_FONT_PNG || DEFAULT_MISAKI_GOTHIC,
    preview: process.env.LIFEBOARD_PIXOO_PREVIEW || DEFAULT_PREVIEW,
    pngPreview: process.env.LIFEBOARD_PIXOO_PNG_PREVIEW || '',
    pixooIp: process.env.PIXOO_IP || '',
    brightness: process.env.PIXOO_BRIGHTNESS ? Number(process.env.PIXOO_BRIGHTNESS) : '',
    pageIntervalSeconds: process.env.LIFEBOARD_PIXOO_PAGE_SECONDS ? Number(process.env.LIFEBOARD_PIXOO_PAGE_SECONDS) : 60,
    animateBusBar: process.env.LIFEBOARD_PIXOO_ANIMATE_BUS_BAR === '1',
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
    else if (arg === '--font-png') options.fontPng = args[++i];
    else if (arg === '--preview') options.preview = args[++i];
    else if (arg === '--png-preview') options.pngPreview = args[++i] || DEFAULT_PNG_PREVIEW;
    else if (arg === '--no-preview') options.noPreview = true;
    else if (arg === '--push') options.push = true;
    else if (arg === '--pixoo-ip') options.pixooIp = args[++i];
    else if (arg === '--brightness') options.brightness = Number(args[++i]);
    else if (arg === '--page-seconds') options.pageIntervalSeconds = Number(args[++i]);
    else if (arg === '--animate-bus-bar') options.animateBusBar = true;
    else throw new Error('Unknown argument: ' + arg);
  }

  if (options.noPreview) {
    options.preview = '';
  }
  options.input = path.resolve(options.input);
  if (options.lifeInput) {
    options.lifeInput = path.resolve(options.lifeInput);
  }
  if (options.fontPng) {
    options.fontPng = path.resolve(options.fontPng);
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

function renderLifeBoardFrames(snapshot, lifeData, options) {
  if (!options.animateBusBar || !hasApproachingBus(snapshot)) {
    return [renderLifeBoardFrame(snapshot, lifeData, options)];
  }
  return [
    renderLifeBoardFrame(snapshot, lifeData, Object.assign({}, options, { busBarBlinkOn: true })),
    renderLifeBoardFrame(snapshot, lifeData, Object.assign({}, options, { busBarBlinkOn: false }))
  ];
}

function renderLifeBoardFrame(snapshot, lifeData, options) {
  const frame = createFrame(COLORS.black);
  const routes = Array.isArray(snapshot.routes) ? snapshot.routes : [];
  const home = routes.find((route) => route.routeId === 'home_to_station') || routes[0] || null;
  const age = snapshot.generatedAt ? ageMinutes(snapshot.generatedAt) : '';
  const stale = age !== '' && age >= 15;
  const railStatus = buildRailStatus(lifeData);
  const workStatus = buildWorkStatus(lifeData);

  drawText(frame, nowText(), 0, 0, stale ? COLORS.amber : COLORS.white);
  if (stale) {
    drawText(frame, 'OLD', 38, 0, COLORS.amber);
  }

  drawRoutePanel(frame, {
    y: 8,
    accent: COLORS.green,
    route: home,
    workStatus
  }, options);
  if (railStatus.issue && isAlternatePageDue(options.pageIntervalSeconds)) {
    drawRailAlertPage(frame, railStatus);
  } else {
    drawStatusLine(frame, 40, railStatus);
    drawStatusLine(frame, 48, buildWeatherStatus(lifeData), options);
    drawStatusLine(frame, 56, buildGarbageStatus(lifeData), options);
  }

  return frame;
}

function drawRoutePanel(frame, config, options) {
  const item = firstItem(config.route);
  const barColor = options && options.busBarBlinkOn === false ? COLORS.dim : config.accent;
  drawRect(frame, 0, config.y, 1, 29, barColor);
  if (!drawJapaneseText(frame, 'バス', 3, config.y, config.accent, options)) {
    drawText(frame, 'BUS', 3, config.y, config.accent);
  }
  if (config.workStatus && config.workStatus.mixedText) {
    drawMixedText(frame, config.workStatus.mixedText, 24, config.y, config.workStatus.color || COLORS.purple, options);
  }

  if (!item) {
    drawText(frame, 'NO DATA', 6, config.y + 11, COLORS.amber, 2);
    return;
  }

  const scheduledTime = shortTime(item.scheduledDepartureText || item.predictedDepartureText || '--:--');
  const delay = normalizeDelayWithUnit(item.delayText);
  const delayColor = delay === 'OK' ? COLORS.green : COLORS.amber;
  const remaining = normalizeRemaining(item.remainingMinutes);
  const location = normalizeLocation(item.previousStops, item.locationText);
  const next = nextItem(config.route);

  drawText(frame, scheduledTime, 4, config.y + 9, COLORS.white, 2);
  if (!drawMixedText(frame, delay, 43, config.y + 9, delayColor, options)) {
    drawText(frame, fitText(delay, 5), 43, config.y + 10, delayColor);
  }
  drawText(frame, remaining, 48, config.y + 16, remainingColor(item.remainingMinutes));
  if (!drawMixedText(frame, location, 4, config.y + 22, COLORS.cyan, options)) {
    drawText(frame, location, 4, config.y + 22, COLORS.cyan);
  }
  if (next) {
    const nextText = '次 ' + shortTime(next.predictedDepartureText || next.scheduledDepartureText);
    if (!drawMixedText(frame, nextText, 31, config.y + 22, COLORS.white, options)) {
      drawText(frame, 'NXT ' + shortTime(next.predictedDepartureText || next.scheduledDepartureText), 30, config.y + 22, COLORS.white);
    }
  }
}

function drawStatusLine(frame, y, status, options) {
  if (status.mixedText && drawMixedText(frame, status.mixedText, 0, y, status.color || COLORS.white, options)) {
    return;
  }
  if (status.jpText && drawJapaneseText(frame, status.jpText, 0, y, status.color || COLORS.white, options)) {
    return;
  }
  drawText(frame, fitText(status.text, 16), 0, y, status.color || COLORS.white);
}

function drawRailAlertPage(frame, railStatus) {
  drawText(frame, 'JR ALERT', 0, 40, railStatus.color || COLORS.amber);
  drawText(frame, fitText(railStatus.line + ' ' + railStatus.code, 16), 0, 48, railStatus.color || COLORS.amber);
  drawText(frame, 'CHECK WEB', 0, 56, COLORS.white);
}

function buildWorkStatus(lifeData) {
  const calendar = lifeData && lifeData.calendar ? lifeData.calendar : null;
  const events = collectCalendarEvents(calendar);
  if (!events.length) {
    return null;
  }

  const now = new Date();
  const today = localDateKey(now);
  const yesterday = localDateKey(addDays(now, -1));
  const todayShift = findShiftForDate(events, today);
  const yesterdayShift = findShiftForDate(events, yesterday);
  const activeShift = activeShiftCode(now, todayShift, yesterdayShift);
  if (activeShift) {
    return { mixedText: activeShift + '勤中', color: COLORS.purple };
  }

  if (!todayShift) {
    return null;
  }
  if (todayShift === '/') {
    return { mixedText: '明け', color: COLORS.cyan };
  }
  if (todayShift === 'H') {
    return { mixedText: '休日', color: COLORS.green };
  }
  if (todayShift === 'AL' || todayShift === 'SV') {
    return { mixedText: '勤 有給', color: COLORS.green };
  }
  if (todayShift === '10H') {
    return { mixedText: '勤 10H', color: COLORS.purple };
  }
  return { mixedText: todayShift + '勤', color: COLORS.purple };
}

function collectCalendarEvents(calendar) {
  const sources = [];
  if (calendar && Array.isArray(calendar.headerEvents)) {
    sources.push(calendar.headerEvents);
  }
  if (calendar && Array.isArray(calendar.events)) {
    sources.push(calendar.events);
  }
  const seen = new Set();
  const events = [];
  sources.flat().forEach((event) => {
    const date = String(event && event.date || '');
    const title = String(event && event.title || '').trim();
    if (!date || !title) {
      return;
    }
    const key = date + '\n' + title;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    events.push({ date, title });
  });
  return events;
}

function findShiftForDate(events, dateKey) {
  const shifts = events
    .filter((event) => event.date === dateKey)
    .map((event) => normalizeWorkShiftTitle(event.title))
    .filter(Boolean);
  if (!shifts.length) {
    return '';
  }
  const priority = ['10H', 'AL', 'SV', 'N', 'S', 'D', '/', 'H'];
  return priority.find((shift) => shifts.includes(shift)) || shifts[0];
}

function normalizeWorkShiftTitle(title) {
  const text = String(title || '').trim().toUpperCase();
  if (!text) return '';
  if (/\bAL\b|有給|年休/.test(text)) return 'AL';
  if (/\bSV\b/.test(text)) return 'SV';
  if (/10H/.test(text)) return '10H';
  if (/^D\b|D勤/.test(text)) return 'D';
  if (/^S\b|S勤/.test(text)) return 'S';
  if (/^N\b|N勤|夜勤/.test(text)) return 'N';
  if (text === '/' || /明け|明/.test(text)) return '/';
  if (/^H\b|休日|休み|休/.test(text)) return 'H';
  return '';
}

function activeShiftCode(now, todayShift, yesterdayShift) {
  const minutes = (now.getHours() * 60) + now.getMinutes();
  if (todayShift === 'D' && minutes >= toMinutes(7, 45) && minutes < toMinutes(17, 48)) {
    return 'D';
  }
  if (todayShift === 'S' && minutes >= toMinutes(15, 0)) {
    return 'S';
  }
  if ((yesterdayShift === 'S' || (!yesterdayShift && todayShift === 'N')) && minutes < toMinutes(1, 0)) {
    return 'S';
  }
  if (todayShift === 'N' && minutes >= toMinutes(21, 30)) {
    return 'N';
  }
  if ((yesterdayShift === 'N' || (!yesterdayShift && todayShift === '/')) && minutes < toMinutes(8, 9)) {
    return 'N';
  }
  return '';
}

function toMinutes(hours, minutes) {
  return (hours * 60) + minutes;
}

function localDateKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
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
  const high = extractHighTemperature(location.highLowText);
  const temp = high === '' ? extractRoundedNumber(location.temperatureText) : high;
  const weather = normalizeWeatherGlyph(location);
  const tempText = temp === '' ? '--C' : String(temp) + 'C';
  return {
    text: 'WX ' + tempText + ' ' + weather.ascii,
    mixedText: temp === '' ? '' : 'WX ' + temp + 'C ' + weather.jpText,
    color: weather.color
  };
}

function normalizeWeatherGlyph(location) {
  const weatherClass = String(location && location.weatherClass || '').toLowerCase();
  const status = String(location && location.statusText || '');
  const nowcast = String(location && location.rainNowcast && location.rainNowcast.rainNowcastText || '');
  const umbrella = String(location && location.umbrellaText || '');
  const text = [weatherClass, status, nowcast, umbrella].join(' ');
  if (/snow|雪/.test(text)) {
    return { ascii: 'SNOW', jpText: '雪', color: COLORS.white };
  }
  if (/heavy|storm|thunder|強|大雨|激し|雷/.test(text)) {
    return { ascii: 'HEAVY', jpText: '強雨', color: COLORS.red };
  }
  if (/rain|storm|shower|雨|傘|折|雷/.test(text)) {
    return { ascii: 'RAIN', jpText: '雨', color: COLORS.amber };
  }
  if (/cloud|fog|雲|くもり|曇/.test(text)) {
    return { ascii: 'CLOUD', jpText: 'くもり', color: COLORS.muted };
  }
  if (/clear|晴|快晴/.test(text)) {
    return { ascii: 'SUN', jpText: '晴れ', color: COLORS.blue };
  }
  return { ascii: '?', jpText: '', color: COLORS.muted };
}

function buildGarbageStatus(lifeData) {
  const days = lifeData && lifeData.garbage && Array.isArray(lifeData.garbage.days) ? lifeData.garbage.days : [];
  if (!days.length) {
    return { text: 'GB ?', color: COLORS.muted };
  }
  const target = chooseGarbageDisplayDay(days);
  const summary = summarizeGarbageDay(target.day);
  if (summary.text) {
    return {
      text: 'GB ' + target.label + ' ' + summary.text,
      jpText: 'ゴミ' + target.jpLabel + summary.jpText,
      color: target.isTomorrow ? COLORS.cyan : COLORS.amber
    };
  }
  return {
    text: 'GB ' + target.label + ' NONE',
    jpText: 'ゴミ' + target.jpLabel + '無し',
    color: COLORS.green
  };
}

function chooseGarbageDisplayDay(days) {
  const now = new Date();
  const switchHour = 9;
  const today = days[0] || null;
  const tomorrow = days[1] || null;
  if (now.getHours() >= switchHour) {
    return { label: 'TMR', jpLabel: '明日', day: tomorrow, isTomorrow: true };
  }
  const todaySummary = summarizeGarbageDay(today);
  if (todaySummary.text || !tomorrow) {
    return { label: 'TDY', jpLabel: '今日', day: today, isTomorrow: false };
  }
  return { label: 'TMR', jpLabel: '明日', day: tomorrow, isTomorrow: true };
}

function summarizeGarbageDay(day) {
  const items = day && Array.isArray(day.items) ? day.items : [];
  const labels = [];
  items.forEach((item) => {
    const label = normalizeGarbageLabel(item && item.label);
    if (label && !labels.some((existing) => existing.text === label.text)) {
      labels.push(label);
    }
  });
  const limited = labels.slice(0, 2);
  return {
    text: limited.map((label) => label.text).join('+'),
    jpText: limited.map((label) => label.jpText).join('')
  };
}

function normalizeGarbageLabel(value) {
  const text = String(value || '');
  if (!text) return '';
  if (/プラ|plastic/i.test(text)) return { text: 'PLA', jpText: 'プラ' };
  if (/ペット|PET/i.test(text)) return { text: 'PET', jpText: 'ペット' };
  if (/資源|resource|recycl/i.test(text)) return { text: 'RES', jpText: '資源' };
  if (/古紙|紙|paper/i.test(text)) return { text: 'PAPER', jpText: '紙' };
  if (/びん|ビン|瓶|缶|can|bottle/i.test(text)) return { text: 'CAN', jpText: '缶' };
  if (/不燃|燃やさない|燃えない|non/i.test(text)) return { text: 'NON', jpText: '不燃' };
  if (/可燃|燃やす|燃える|burn|combust/i.test(text)) return { text: 'BURN', jpText: '可燃' };
  return { text: 'ITEM', jpText: '資源' };
}

function drawJapaneseText(frame, text, x, y, rgb, options) {
  const font = loadMisakiFont(options && options.fontPng);
  if (!font) {
    return false;
  }
  let cursor = x;
  for (const character of String(text || '')) {
    if (cursor + 8 > SIZE) {
      break;
    }
    const kuten = MISAKI_KUTEN[character];
    if (!kuten) {
      cursor += 8;
      continue;
    }
    drawMisakiGlyph(frame, font, kuten[0], kuten[1], cursor, y, rgb);
    cursor += 8;
  }
  return cursor > x;
}

function drawMixedText(frame, text, x, y, rgb, options) {
  const font = loadMisakiFont(options && options.fontPng);
  if (!font) {
    return false;
  }
  let cursor = x;
  for (const character of String(text || '')) {
    const kuten = MISAKI_KUTEN[character];
    if (kuten) {
      if (cursor + 8 > SIZE) {
        break;
      }
      drawMisakiGlyph(frame, font, kuten[0], kuten[1], cursor, y, rgb);
      cursor += 8;
      continue;
    }
    const glyph = FONT_3X5[String(character).toUpperCase()];
    if (glyph) {
      if (cursor + 3 > SIZE) {
        break;
      }
      drawText(frame, character, cursor, y + 1, rgb);
      cursor += 4;
      continue;
    }
    if (character === ' ') {
      cursor += 2;
    }
  }
  return cursor > x;
}

function drawMisakiGlyph(frame, font, ku, ten, x, y, rgb) {
  const sourceX = (ten - 1) * 8;
  const sourceY = (ku - 1) * 8;
  for (let yy = 0; yy < 8; yy += 1) {
    for (let xx = 0; xx < 8; xx += 1) {
      const pixel = getRgbaPixel(font, sourceX + xx, sourceY + yy);
      if (pixel && pixel[3] > 0 && ((pixel[0] + pixel[1] + pixel[2]) / 3) < 128) {
        setPixel(frame, x + xx, y + yy, rgb);
      }
    }
  }
}

function loadMisakiFont(fontPath) {
  if (!fontPath || !fs.existsSync(fontPath)) {
    return null;
  }
  if (misakiFontCache && misakiFontCache.path === fontPath) {
    return misakiFontCache;
  }
  misakiFontCache = Object.assign({ path: fontPath }, readPngImage(fontPath));
  return misakiFontCache;
}

function extractRoundedNumber(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return '';
  }
  return Math.round(Number(match[0]));
}

function extractHighTemperature(value) {
  const text = String(value || '');
  const numbers = text.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || !numbers.length) {
    return '';
  }
  return Math.round(Number(numbers[numbers.length - 1]));
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

function hasApproachingBus(snapshot) {
  const routes = Array.isArray(snapshot && snapshot.routes) ? snapshot.routes : [];
  const home = routes.find((route) => route.routeId === 'home_to_station') || routes[0] || null;
  const item = firstItem(home);
  if (!item) {
    return false;
  }
  if (item.previousStops !== '' && item.previousStops != null && !Number.isNaN(Number(item.previousStops))) {
    return true;
  }
  return /接近中|approach/i.test(String(item.locationText || ''));
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

function normalizeDelayWithUnit(value) {
  const normalized = normalizeDelay(value);
  return normalized === 'OK' ? 'OK' : normalized + '分';
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
    return Math.max(0, Number(previousStops)) + '駅前';
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

function nowText() {
  const date = new Date();
  return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
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

async function pushFrameToPixoo(ipAddress, frames, options) {
  const baseUrl = 'http://' + ipAddress.replace(/^https?:\/\//, '').replace(/\/.*$/, '') + '/post';
  const frameList = Array.isArray(frames) ? frames : [frames];
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

  const payload = {
    Command: 'Draw/SendHttpGif',
    PicNum: frameList.length,
    PicWidth: SIZE,
    PicOffset: 0,
    PicID: picId,
    PicSpeed: frameList.length > 1 ? 1200 : 1000,
    PicData: Buffer.concat(frameList).toString('base64')
  };
  try {
    await postPixoo(baseUrl, payload);
  } catch (error) {
    if (frameList.length <= 1) {
      throw error;
    }
    console.warn('Pixoo animation push failed; retrying as a static frame: ' + (error && error.message ? error.message : String(error)));
    await postPixoo(baseUrl, Object.assign({}, payload, {
      PicNum: 1,
      PicSpeed: 1000,
      PicData: frameList[0].toString('base64')
    }));
  }
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

function readPngImage(inputPath) {
  const buffer = fs.readFileSync(inputPath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.slice(0, 8).equals(signature)) {
    throw new Error('Invalid PNG signature: ' + inputPath);
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
    const data = buffer.slice(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        throw new Error('Unsupported PNG format: ' + inputPath);
      }
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      transparency = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 1 && bitDepth !== 8) {
    throw new Error('Unsupported PNG bit depth ' + bitDepth + ': ' + inputPath);
  }
  const bitsPerPixel = pngBitsPerPixel(colorType, bitDepth);
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const scanlineLength = Math.ceil(width * bitsPerPixel / 8);
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let sourceOffset = 0;
  let previous = Buffer.alloc(scanlineLength);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const raw = Buffer.from(inflated.slice(sourceOffset, sourceOffset + scanlineLength));
    sourceOffset += scanlineLength;
    const row = unfilterPngRow(raw, previous, filter, bytesPerPixel);
    for (let x = 0; x < width; x += 1) {
      const pixel = decodePngPixel(row, x, colorType, bitDepth, palette, transparency);
      const target = ((y * width) + x) * 4;
      rgba[target] = pixel[0];
      rgba[target + 1] = pixel[1];
      rgba[target + 2] = pixel[2];
      rgba[target + 3] = pixel[3];
    }
    previous = row;
  }
  return { width, height, rgba };
}

function pngBytesPerPixel(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error('Unsupported PNG color type: ' + colorType);
}

function pngBitsPerPixel(colorType, bitDepth) {
  if (colorType === 0) return bitDepth;
  if (colorType === 2) return bitDepth * 3;
  if (colorType === 3) return bitDepth;
  if (colorType === 4) return bitDepth * 2;
  if (colorType === 6) return bitDepth * 4;
  throw new Error('Unsupported PNG color type: ' + colorType);
}

function unfilterPngRow(raw, previous, filter, bytesPerPixel) {
  const row = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
    const up = previous[i] || 0;
    const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] || 0 : 0;
    let value;
    if (filter === 0) value = raw[i];
    else if (filter === 1) value = raw[i] + left;
    else if (filter === 2) value = raw[i] + up;
    else if (filter === 3) value = raw[i] + Math.floor((left + up) / 2);
    else if (filter === 4) value = raw[i] + paethPredictor(left, up, upLeft);
    else throw new Error('Unsupported PNG filter: ' + filter);
    row[i] = value & 0xff;
  }
  return row;
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodePngPixel(row, x, colorType, bitDepth, palette, transparency) {
  if (colorType === 0) {
    if (bitDepth === 1) {
      const byte = row[Math.floor(x / 8)];
      const bit = (byte >> (7 - (x % 8))) & 1;
      const value = bit ? 255 : 0;
      return [value, value, value, 255];
    }
    const value = row[x];
    return [value, value, value, 255];
  }
  if (bitDepth !== 8) {
    throw new Error('Unsupported PNG bit depth/color type combination: ' + bitDepth + '/' + colorType);
  }
  if (colorType === 2) {
    const offset = x * 3;
    return [row[offset], row[offset + 1], row[offset + 2], 255];
  }
  if (colorType === 3) {
    const index = row[x];
    const paletteOffset = index * 3;
    return [
      palette ? palette[paletteOffset] || 0 : 0,
      palette ? palette[paletteOffset + 1] || 0 : 0,
      palette ? palette[paletteOffset + 2] || 0 : 0,
      transparency && index < transparency.length ? transparency[index] : 255
    ];
  }
  if (colorType === 4) {
    const offset = x * 2;
    return [row[offset], row[offset], row[offset], row[offset + 1]];
  }
  const offset = x * 4;
  return [row[offset], row[offset + 1], row[offset + 2], row[offset + 3]];
}

function getRgbaPixel(image, x, y) {
  if (!image || x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return null;
  }
  const offset = ((y * image.width) + x) * 4;
  return [
    image.rgba[offset],
    image.rgba[offset + 1],
    image.rgba[offset + 2],
    image.rgba[offset + 3]
  ];
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
    animationFrames: options.animateBusBar && hasApproachingBus(snapshot) ? 2 : 1,
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
    '  PIXOO_IP, PIXOO_BRIGHTNESS, LIFEBOARD_IMPORT_URL, LIFEBOARD_PIXOO_INPUT, LIFEBOARD_PIXOO_LIFE_INPUT, LIFEBOARD_PIXOO_LIFE_URL, LIFEBOARD_PIXOO_PAGE_SECONDS, LIFEBOARD_PIXOO_ANIMATE_BUS_BAR, LIFEBOARD_PIXOO_PREVIEW, LIFEBOARD_PIXOO_PNG_PREVIEW'
  ].join('\n'));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
