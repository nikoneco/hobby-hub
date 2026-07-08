#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_ICS_PATH = 'C:\\Users\\aqua_\\my_calendar.ics';
const DEFAULT_WEB_APP_URL = '';

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.exportIcs) {
    runTimeTreeExporter(options);
  }

  const icsPath = path.resolve(options.icsPath);
  const raw = fs.readFileSync(icsPath, 'utf8');
  const calendar = parseIcs(raw);
  const windowStart = startOfLocalDay(addDays(new Date(), -options.pastDays));
  const windowEnd = endOfLocalDay(addDays(new Date(), options.days));
  let events = buildWindowEvents(calendar.events, windowStart, windowEnd)
    .sort(compareEvents)
    .slice(0, options.maxEvents);
  if (!options.includeDescription) {
    events = events.map((event) => Object.assign({}, event, { description: '' }));
  }

  const payload = {
    source: 'timetree-exporter',
    generatedAt: new Date().toISOString(),
    icsPath: icsPath,
    window: {
      from: formatDate(windowStart),
      to: formatDate(windowEnd)
    },
    totalEventsInIcs: calendar.events.length,
    events: events
  };

  if (options.outPath) {
    const outPath = path.resolve(options.outPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  if (options.post) {
    postPayload(options, payload);
  }

  printSummary(payload, options);
}

function parseArgs(args) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const options = {
    icsPath: process.env.TIMETREE_ICS_PATH || DEFAULT_ICS_PATH,
    outPath: process.env.TIMETREE_JSON_OUT || path.join(repoRoot, 'LifeBoard', 'data', 'timetree_events.json'),
    webAppUrl: process.env.LIFEBOARD_IMPORT_URL || DEFAULT_WEB_APP_URL,
    token: process.env.LIFEBOARD_IMPORT_TOKEN || '',
    days: numberEnv('TIMETREE_SYNC_DAYS', 30),
    pastDays: numberEnv('TIMETREE_SYNC_PAST_DAYS', 0),
    maxEvents: numberEnv('TIMETREE_SYNC_MAX_EVENTS', 300),
    exportIcs: false,
    post: false,
    dryRun: false,
    exporterCommand: process.env.TIMETREE_EXPORTER_COMMAND || 'python -m timetree_exporter',
    calendarCode: process.env.TIMETREE_CALENDAR_CODE || '',
    calendarSelection: process.env.TIMETREE_CALENDAR_SELECTION || '',
    includeDescription: truthyEnv('TIMETREE_INCLUDE_DESCRIPTION'),
    help: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--ics') options.icsPath = args[++i];
    else if (arg === '--out') options.outPath = args[++i];
    else if (arg === '--days') options.days = Number(args[++i]);
    else if (arg === '--past-days') options.pastDays = Number(args[++i]);
    else if (arg === '--max-events') options.maxEvents = Number(args[++i]);
    else if (arg === '--export') options.exportIcs = true;
    else if (arg === '--post') options.post = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--web-app-url') options.webAppUrl = args[++i];
    else if (arg === '--token') options.token = args[++i];
    else if (arg === '--exporter-command') options.exporterCommand = args[++i];
    else if (arg === '--calendar-code') options.calendarCode = args[++i];
    else if (arg === '--calendar-selection') options.calendarSelection = args[++i];
    else if (arg === '--include-description') options.includeDescription = true;
    else throw new Error('Unknown argument: ' + arg);
  }

  if (!Number.isFinite(options.days) || options.days < 0) {
    throw new Error('--days must be a non-negative number');
  }
  if (!Number.isFinite(options.pastDays) || options.pastDays < 0) {
    throw new Error('--past-days must be a non-negative number');
  }
  if (!Number.isFinite(options.maxEvents) || options.maxEvents < 1) {
    throw new Error('--max-events must be a positive number');
  }
  if (options.dryRun) {
    options.post = false;
  }
  return options;
}

function numberEnv(name, fallback) {
  const value = process.env[name];
  return value == null || value === '' ? fallback : Number(value);
}

function truthyEnv(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || ''));
}

function runTimeTreeExporter(options) {
  const args = ['-o', options.icsPath];
  if (options.calendarCode) {
    args.push('-c', options.calendarCode);
  }
  const scriptedInput = buildExporterInput(options);
  const commandLine = options.exporterCommand + ' ' + args.map(quoteShellArg).join(' ');
  const result = spawnSync(commandLine, {
    stdio: scriptedInput ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    shell: true,
    env: process.env,
    input: scriptedInput || undefined
  });
  if (result.status !== 0) {
    throw new Error('timetree-exporter failed with exit code ' + result.status);
  }
}

function quoteShellArg(value) {
  return '"' + String(value).replace(/"/g, '\\"') + '"';
}

function buildExporterInput(options) {
  const email = process.env.TIMETREE_EMAIL || '';
  const password = process.env.TIMETREE_PASSWORD || '';
  const calendarSelection = options.calendarSelection || options.calendarCode || '';
  if (!email && !password && !calendarSelection) return '';
  if (!email || !password || !calendarSelection) {
    throw new Error('For unattended --export, set TIMETREE_EMAIL, TIMETREE_PASSWORD, and TIMETREE_CALENDAR_SELECTION.');
  }
  return [calendarSelection, ''].join('\n');
}

function parseIcs(raw) {
  const lines = unfoldIcsLines(raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n'));
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { props: {} };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(normalizeEvent(current.props));
      current = null;
      continue;
    }
    if (!current) continue;
    const property = parseProperty(line);
    if (!property) continue;
    if (!current.props[property.name]) {
      current.props[property.name] = [];
    }
    current.props[property.name].push(property);
  }
  return { events };
}

function unfoldIcsLines(lines) {
  const unfolded = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function parseProperty(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const rawName = line.slice(0, colon);
  const value = decodeIcsText(line.slice(colon + 1));
  const parts = rawName.split(';');
  const name = parts.shift().toUpperCase();
  const params = {};
  parts.forEach((part) => {
    const eq = part.indexOf('=');
    if (eq > 0) {
      params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }
  });
  return { name, params, value };
}

function normalizeEvent(props) {
  const startProp = firstProp(props, 'DTSTART');
  const endProp = firstProp(props, 'DTEND');
  const start = parseIcsDate(startProp);
  const end = parseIcsDate(endProp);
  return {
    uid: firstValue(props, 'UID'),
    title: firstValue(props, 'SUMMARY') || '(無題)',
    category: firstValue(props, 'CATEGORIES'),
    color: firstValue(props, 'COLOR'),
    description: firstValue(props, 'DESCRIPTION'),
    location: firstValue(props, 'LOCATION'),
    createdAt: toIsoOrBlank(parseIcsDate(firstProp(props, 'CREATED'))),
    modifiedAt: toIsoOrBlank(parseIcsDate(firstProp(props, 'LAST-MODIFIED'))),
    start,
    end,
    allDay: start ? start.allDay : true,
    rrule: parseRRule(firstValue(props, 'RRULE'))
  };
}

function firstProp(props, name) {
  return props[name] && props[name][0] ? props[name][0] : null;
}

function firstValue(props, name) {
  const prop = firstProp(props, name);
  return prop ? prop.value : '';
}

function parseIcsDate(prop) {
  if (!prop || !prop.value) return null;
  const value = prop.value;
  const isDateOnly = prop.params.VALUE === 'DATE' || /^\d{8}$/.test(value);
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!match) return null;
  if (isDateOnly || !match[4]) {
    return {
      date: new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      allDay: true
    };
  }
  if (value.endsWith('Z')) {
    return {
      date: new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]))),
      allDay: false
    };
  }
  return {
    date: new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])),
    allDay: false
  };
}

function parseRRule(value) {
  if (!value) return null;
  return value.split(';').reduce((rule, part) => {
    const eq = part.indexOf('=');
    if (eq > 0) {
      rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }
    return rule;
  }, {});
}

function buildWindowEvents(events, windowStart, windowEnd) {
  const output = [];
  for (const event of events) {
    if (!event.start) continue;
    if (event.rrule) {
      output.push(...expandRecurringEvent(event, windowStart, windowEnd));
    } else if (isInWindow(event.start.date, windowStart, windowEnd)) {
      output.push(buildOutputEvent(event, event.start.date));
    }
  }
  return output;
}

function expandRecurringEvent(event, windowStart, windowEnd) {
  const output = [];
  const rule = event.rrule;
  const freq = String(rule.FREQ || '').toUpperCase();
  const interval = Number(rule.INTERVAL || 1);
  const until = parseIcsDate({ value: rule.UNTIL || '', params: {} });
  const count = rule.COUNT ? Number(rule.COUNT) : null;
  const limitEnd = until ? minDate(windowEnd, until.date) : windowEnd;
  const cursor = new Date(windowStart);
  const safetyEnd = addDays(windowEnd, 1);
  let generated = 0;

  while (cursor <= limitEnd && cursor <= safetyEnd) {
    if (cursor >= event.start.date && recurringMatchesDate(event.start.date, cursor, freq, interval, rule)) {
      generated += 1;
      if (!count || generated <= count) {
        output.push(buildOutputEvent(event, cursor, true));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return output;
}

function recurringMatchesDate(start, date, freq, interval, rule) {
  if (freq === 'DAILY') {
    return diffDays(start, date) % interval === 0;
  }
  if (freq === 'WEEKLY') {
    const byDays = parseByDay(rule.BYDAY);
    const dayMatches = byDays.length ? byDays.includes(date.getDay()) : date.getDay() === start.getDay();
    return dayMatches && diffWeeks(start, date) % interval === 0;
  }
  if (freq === 'MONTHLY') {
    const byMonthDays = parseNumberList(rule.BYMONTHDAY);
    const dayMatches = byMonthDays.length ? byMonthDays.includes(date.getDate()) : date.getDate() === start.getDate();
    return dayMatches && diffMonths(start, date) % interval === 0;
  }
  if (freq === 'YEARLY') {
    const byMonths = parseNumberList(rule.BYMONTH);
    const byMonthDays = parseNumberList(rule.BYMONTHDAY);
    const monthMatches = byMonths.length ? byMonths.includes(date.getMonth() + 1) : date.getMonth() === start.getMonth();
    const dayMatches = byMonthDays.length ? byMonthDays.includes(date.getDate()) : date.getDate() === start.getDate();
    return monthMatches && dayMatches && diffYears(start, date) % interval === 0;
  }
  return false;
}

function buildOutputEvent(event, occurrenceDate, recurring) {
  const endDate = event.end ? event.end.date : event.start.date;
  const spanDays = event.allDay ? Math.max(1, diffDays(event.start.date, endDate)) : 0;
  return {
    date: formatDate(occurrenceDate),
    startDateTime: event.allDay ? '' : event.start.date.toISOString(),
    endDate: event.allDay && spanDays > 1 ? formatDate(addDays(occurrenceDate, spanDays)) : '',
    endDateTime: event.allDay || !event.end ? '' : event.end.date.toISOString(),
    title: event.title,
    category: event.category,
    color: event.color,
    description: event.description,
    location: event.location,
    allDay: event.allDay,
    recurring: Boolean(recurring || event.rrule),
    sourceUid: event.uid,
    sortKey: formatDate(occurrenceDate) + ' ' + (event.allDay ? '00:00' : formatTime(event.start.date))
  };
}

function postPayload(options, payload) {
  if (!options.token) {
    throw new Error('LIFEBOARD_IMPORT_TOKEN or --token is required when using --post');
  }
  const url = options.webAppUrl + (options.webAppUrl.includes('?') ? '&' : '?') + 'action=importCalendarEvents';
  const body = JSON.stringify(Object.assign({}, payload, { token: options.token }));
  const result = spawnSync(process.execPath, ['-e', `
    const url = ${JSON.stringify(url)};
    const body = ${JSON.stringify(body)};
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          console.error(text);
          process.exit(1);
        }
        const payload = JSON.parse(text);
        if (!payload.ok) {
          console.error(payload.error && payload.error.message ? payload.error.message : text);
          process.exit(1);
        }
        console.log(JSON.stringify(payload.data || payload, null, 2));
      })
      .catch((error) => { console.error(error); process.exit(1); });
  `], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('POST failed: ' + (result.stderr || result.stdout));
  }
  if (result.stdout) {
    console.log(result.stdout.trim());
  }
}

function printSummary(payload, options) {
  const top = payload.events.slice(0, 8).map((event) => ({
    date: event.date,
    title: event.title,
    category: event.category,
    allDay: event.allDay,
    recurring: event.recurring
  }));
  console.log(JSON.stringify({
    mode: options.post ? 'posted' : 'dry-run',
    output: options.outPath,
    totalEventsInIcs: payload.totalEventsInIcs,
    exportedEvents: payload.events.length,
    window: payload.window,
    sample: top
  }, null, 2));
}

function printHelp() {
  console.log([
    'Usage:',
    '  node LifeBoard/tools/sync_timetree_calendar.js [options]',
    '',
    'Options:',
    '  --ics <path>              ICS path. Default: C:\\Users\\aqua_\\my_calendar.ics',
    '  --out <path>              JSON output path.',
    '  --days <n>                Future days to export. Default: 30',
    '  --past-days <n>           Past days to include. Default: 0',
    '  --max-events <n>          Max events in payload. Default: 300',
    '  --export                  Run timetree-exporter before parsing.',
    '  --post                    POST payload to LifeBoard GAS.',
    '  --dry-run                 Do not POST, only write JSON and summary.',
    '  --token <token>           Import token for GAS endpoint.',
    '  --web-app-url <url>       LifeBoard web app URL.',
    '  --exporter-command <cmd>  Command used for export. Default: python -m timetree_exporter',
    '  --calendar-code <code>    TimeTree calendar code for exporter, if supported.',
    '  --calendar-selection <n>  Calendar selection number for interactive exporter.',
    '  --include-description     Include event descriptions in JSON/POST. Default: off',
    '',
    'Environment:',
    '  TIMETREE_EMAIL / TIMETREE_PASSWORD / TIMETREE_CALENDAR_SELECTION automate exporter prompts.',
    '  TIMETREE_EXPORTER_COMMAND can override the exporter command.',
    '  TIMETREE_INCLUDE_DESCRIPTION=1 includes event descriptions by default.',
    '  LIFEBOARD_IMPORT_TOKEN is used by --post.'
  ].join('\n'));
}

function decodeIcsText(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function compareEvents(a, b) {
  return a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title);
}

function isInWindow(date, start, end) {
  return date >= start && date <= end;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function formatTime(date) {
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

function toIsoOrBlank(value) {
  return value ? value.date.toISOString() : '';
}

function minDate(a, b) {
  return a < b ? a : b;
}

function diffDays(a, b) {
  return Math.floor((startOfLocalDay(b) - startOfLocalDay(a)) / 86400000);
}

function diffWeeks(a, b) {
  return Math.floor(diffDays(a, b) / 7);
}

function diffMonths(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function diffYears(a, b) {
  return b.getFullYear() - a.getFullYear();
}

function parseByDay(value) {
  if (!value) return [];
  const map = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return value.split(',').map((item) => map[item.replace(/^[+-]?\d+/, '')]).filter((item) => item != null);
}

function parseNumberList(value) {
  if (!value) return [];
  return value.split(',').map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
