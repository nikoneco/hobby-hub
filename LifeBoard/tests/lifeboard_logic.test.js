#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const weather = require('../weather_fetcher/sync_weathernews_snapshot.js');
const pixoo = require('../pixoo_display/pixoo_lifeboard.js');

function weatherRows(kinds) {
  return kinds.map((kind, index) => ({
    kind,
    rain: ['drizzle', 'rain', 'heavy', 'thunder', 'snow'].includes(kind) ? 1 : 0,
    temp: 25 + index
  }));
}

function railData(routes) {
  return { rail: { routes } };
}

assert.strictEqual(weather.classifyHourlyKind('500', 2), 'thunder', 'thunder must outrank rain quantity');
assert.strictEqual(weather.classifyHourlyKind('400', 0.5), 'snow', 'snow must outrank rain quantity');
assert.strictEqual(weather.classifyHourlyKind('100', 5), 'heavy', 'rain quantity must refine non-thunder weather');

const superClear = weather.analyzeWeatherWindow(weatherRows(['clear', 'clear', 'clear']), 35);
assert.strictEqual(superClear.kind, 'superclear', 'superclear must use the next-24-hour high');

const later = weather.analyzeWeatherWindow(weatherRows(['clear', 'clear', 'rain', 'rain']), 30);
assert.deepStrictEqual(
  { mode: later.mode, fromKind: later.fromKind, toKind: later.toKind },
  { mode: 'later', fromKind: 'clear', toKind: 'rain' },
  'one stable transition must be later'
);

const sometimes = weather.analyzeWeatherWindow(weatherRows(['clear', 'rain', 'clear', 'rain']), 30);
assert.strictEqual(sometimes.mode, 'sometimes', 'repeated transitions must be sometimes');

const normalRail = pixoo.buildRailStatus(railData([
  { displayName: '総武線(快速)', severity: 'normal', statusText: '平常運転' }
]));
assert.strictEqual(normalRail.text, 'JR OK');

const unknownRail = pixoo.buildRailStatus(railData([
  { displayName: '総武線(快速)', severity: 'unknown', statusText: '取得不可' }
]));
assert.strictEqual(unknownRail.text, 'JR ERROR');
assert.strictEqual(unknownRail.issue, null, 'fetch failures must not take over the lower three rows');
assert.strictEqual(pixoo.buildRailStatus({}).text, 'JR ERROR');
assert.strictEqual(pixoo.buildRailStatus(railData([])).issue, null);

const planRoute = { displayName: '総武線(快速)', severity: 'notice', statusText: '情報あり', detailText: '総武線(快速) 運転計画 明日は本数を減らして運転します。' };
const planRail = pixoo.buildRailStatus(railData([planRoute]));
assert.strictEqual(planRail.text, 'JR PLAN');
assert.strictEqual(planRail.messageJp, '運転計画あり');
assert.strictEqual(pixoo.normalizeRailIssueCode({ severity: 'notice', statusText: '運転計画' }), 'PLAN');
const unavailableRoute = { displayName: '山手線', severity: 'unknown', statusText: '確認できず' };
const liveDelayRoute = { displayName: '総武線(各駅停車)', severity: 'delay', statusText: '列車遅延' };
assert.strictEqual(pixoo.buildRailStatus(railData([unavailableRoute, { severity: 'normal' }])).text, 'JR ERROR');
for (let phase = 0; phase < 6; phase += 1) {
  const mixedRail = pixoo.buildRailStatus(railData([unavailableRoute, liveDelayRoute]), phase);
  assert.strictEqual(mixedRail.text, 'JR DELAY');
  assert.strictEqual(mixedRail.issueCount, 1, 'unavailable routes must not enter the notice carousel');
}
assert.strictEqual(pixoo.buildRailStatus(railData([unavailableRoute, planRoute])).text, 'JR PLAN');
assert.strictEqual(pixoo.buildRailStatus(railData([planRoute, liveDelayRoute])).text, 'JR DELAY');

const displayFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../pixoo_animation_test/fixture_life_data_heavy_rain.json'), 'utf8'));
const renderOptions = { animateBusBar: false, fontPng: path.resolve(__dirname, '../misaki_png_2021-05-05a/misaki_gothic.png') };
const normalFrame = pixoo.renderLifeBoardFrames({ routes: [] }, displayFixture, renderOptions)[0];
displayFixture.rail = { routes: [unavailableRoute] };
const errorFrame = pixoo.renderLifeBoardFrames({ routes: [] }, displayFixture, renderOptions)[0];
assert.ok(normalFrame.subarray(48 * 64 * 3).equals(errorFrame.subarray(48 * 64 * 3)), 'weather and garbage pixels must remain identical for JR ERROR');

const noticeRail = pixoo.buildRailStatus(railData([
  { displayName: '総武線(快速)', severity: 'notice', statusText: '一部運休' }
]));
assert.strictEqual(noticeRail.text, 'JR CHECK');

const delayedRail = pixoo.buildRailStatus(railData([
  { displayName: '中央総武線(各停)', severity: 'delay', statusText: '列車遅延' }
]));
assert.strictEqual(delayedRail.text, 'JR DELAY');

const stopBeforeDelay = pixoo.buildRailStatus(railData([
  { displayName: '中央総武線(各停)', severity: 'delay', statusText: '列車遅延' },
  { displayName: '山手線', severity: 'suspended', statusText: '運転見合わせ' }
]), 0);
assert.strictEqual(stopBeforeDelay.text, 'JR STOP');
assert.strictEqual(stopBeforeDelay.lineJp, '山手線');

function calendarData(events) {
  return { calendar: { events } };
}

const examOverShift = pixoo.buildWorkStatus(calendarData([
  { date: '2026-08-26', title: 'N', category: 'たかおみ仕事', allDay: true },
  { date: '2026-08-26', title: 'ひっき', category: '試験関係', allDay: true }
]), new Date('2026-08-26T08:00:00+09:00'));
assert.strictEqual(examOverShift.mixedText, 'ひっき', 'exam category must outrank the work shift');
assert.strictEqual(examOverShift.source, 'calendar-category');

const beforeAllDayExamWindow = pixoo.buildWorkStatus(calendarData([
  { date: '2026-08-26', title: 'D', category: 'たかおみ仕事', allDay: true },
  { date: '2026-08-26', title: '長い試験タイトル', category: '試験関係', allDay: true }
]), new Date('2026-08-26T07:59:00+09:00'));
assert.strictEqual(beforeAllDayExamWindow.mixedText, 'D勤中', 'all-day exam must start displaying at 08:00');

const afterAllDayExamWindow = pixoo.buildWorkStatus(calendarData([
  { date: '2026-08-26', title: 'H', category: 'たかおみ休み', allDay: true },
  { date: '2026-08-26', title: '長い試験タイトル', category: '試験関係', allDay: true }
]), new Date('2026-08-26T17:00:00+09:00'));
assert.strictEqual(afterAllDayExamWindow.mixedText, '休日', 'all-day exam must stop displaying at 17:00');

const timedExam = pixoo.buildWorkStatus(calendarData([
  {
    date: '2026-08-26',
    title: '実技試験タイトル',
    category: '試験関係',
    startDateTime: '2026-08-26T01:00:00.000Z',
    endDateTime: '2026-08-26T03:00:00.000Z',
    allDay: false
  }
]), new Date('2026-08-26T11:00:00+09:00'));
assert.strictEqual(timedExam.mixedText, '実技試験タイトル', 'timed exam must use its actual event interval');
assert.strictEqual(timedExam.scroll, undefined, 'exam titles must not enable scrolling');
assert.strictEqual(
  pixoo.fitMixedTextToWidth('Hコース(オンライン)', 30),
  'Hコース',
  'the fixed 30-pixel work area must keep the readable title prefix'
);

function loadGasService(fileName, globals) {
  const context = vm.createContext(Object.assign({ console }, globals));
  const source = fs.readFileSync(path.join(__dirname, '..', 'gas', fileName), 'utf8');
  vm.runInContext(source, context, { filename: fileName });
  return context;
}

let railFetchAllCalls = 0;
const railCacheValues = new Map();
const railContext = loadGasService('RailService.gs', {
  console: { error: () => {}, warn: () => {}, log: () => {} },
  CONFIG: { RAIL: { CACHE_SECONDS: 60, FAILURE_CACHE_SECONDS: 120 } },
  CacheService: {
    getScriptCache: () => ({
      getAll: (keys) => Object.fromEntries(keys.filter((key) => railCacheValues.has(key)).map((key) => [key, railCacheValues.get(key)])),
      put: (key, value) => railCacheValues.set(key, value),
      remove: (key) => railCacheValues.delete(key)
    })
  },
  UrlFetchApp: {
    fetchAll: (requests) => {
      railFetchAllCalls += 1;
      assert.strictEqual(requests.length, 4);
      return requests.map(() => ({
        getResponseCode: () => 503,
        getContentText: () => ''
      }));
    }
  },
  nowIso_: () => '2026-08-10T00:00:00.000Z'
});
const batchedRail = railContext.fetchRailRouteSnapshots_([
  { route_id: 'a', display_name: 'A', source_url: 'https://example.com/a' },
  { route_id: 'b', display_name: 'B', source_url: 'https://example.com/b' },
  { route_id: 'c', display_name: 'C', source_url: 'https://example.com/c' },
  { route_id: 'd', display_name: 'D', source_url: 'https://example.com/d' }
]);
assert.strictEqual(railFetchAllCalls, 1, 'uncached rail routes must use one fetchAll call');
assert.strictEqual(batchedRail.length, 4);
assert.ok(batchedRail.every((route) => route.severity === 'unknown'));
const cachedFailedRail = railContext.fetchRailRouteSnapshots_([
  { route_id: 'a', display_name: 'A', source_url: 'https://example.com/a' },
  { route_id: 'b', display_name: 'B', source_url: 'https://example.com/b' },
  { route_id: 'c', display_name: 'C', source_url: 'https://example.com/c' },
  { route_id: 'd', display_name: 'D', source_url: 'https://example.com/d' }
]);
assert.strictEqual(railFetchAllCalls, 1, 'rail failures must be cached briefly to prevent repeated external stalls');
assert.ok(cachedFailedRail.every((route) => route.severity === 'unknown'));

const busCacheValues = new Map();
let busFetchCalls = 0;
const busContext = loadGasService('BusService.gs', {
  console: { error: () => {}, warn: () => {}, log: () => {} },
  CONFIG: {
    BUS: {
      API_BASE_URL: 'https://example.com/apiv1/',
      CUSTOMER: 'example',
      PAGE_BASE_URL: 'https://example.com/approachings',
      CACHE_SECONDS: 25,
      DIRECT_FAILURE_BACKOFF_SECONDS: 600,
      MAX_ITEMS_PER_ROUTE: 3
    }
  },
  CacheService: {
    getScriptCache: () => ({
      get: (key) => busCacheValues.get(key) || null,
      put: (key, value) => busCacheValues.set(key, value),
      remove: (key) => busCacheValues.delete(key)
    })
  },
  UrlFetchApp: {
    fetch: () => {
      busFetchCalls += 1;
      return { getResponseCode: () => 403 };
    }
  }
});
const busRoute = {
  route_id: 'home_to_station',
  departure_busstop_id: '1',
  arrival_busstop_id: '2'
};
assert.throws(() => busContext.fetchRouteSnapshot_(busRoute), /HTTP 403/);
assert.throws(() => busContext.fetchRouteSnapshot_(Object.assign({}, busRoute, { route_id: 'station_to_home' })), /backoff/);
assert.strictEqual(busFetchCalls, 1, 'bus failure backoff must prevent repeated blocked requests');

console.log('LifeBoard logic tests: OK');
