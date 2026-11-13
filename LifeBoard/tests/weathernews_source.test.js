#!/usr/bin/env node
'use strict';
const assert = require('assert');
const weather = require('../weather_fetcher/sync_weathernews_snapshot.js');
const options = { locationId: 'test', displayName: 'Test', url: 'https://example.com/weather' };
const hourly = Array.from({ length: 24 }, (_, index) => ({
  year: '2026', mon: '12', day: index < 6 ? '31' : '1',
  // Keep explicit source years/months across the year boundary.
  ...(index < 6 ? {} : { year: '2027', mon: '1' }),
  hour: String((18 + index) % 24), wx: '100',
  temp: String(index), prec: '0.0', wspd: '0'
}));
const data = { current: { temp: '14', rhum: '72' }, hourly };
const snapshot = weather.buildWeatherSnapshot(JSON.stringify(data), options);
assert.strictEqual(snapshot.temperatureText, '14℃');
assert.strictEqual(snapshot.humidityText, '72%');
assert.strictEqual(snapshot.high24hText, '23℃');
assert.strictEqual(snapshot.highLowText, '0℃ / 23℃');
assert.strictEqual(snapshot.windText, '0m/s');
assert.strictEqual(snapshot.weatherKind, 'clear');
assert.strictEqual(snapshot.hourly.length, 24);
assert.strictEqual(snapshot.hourly[5].time, '2026-12-31T23:00:00+09:00');
assert.strictEqual(snapshot.hourly[6].time, '2027-01-01T00:00:00+09:00');
assert.strictEqual(snapshot.hourly[0].precipitationText, '0mm');

const missingCurrent = weather.buildWeatherSnapshot({ hourly }, options);
assert.strictEqual(missingCurrent.temperatureText, '0℃', 'Missing observation must use the first forecast temperature.');
assert.strictEqual(missingCurrent.humidityText, '-');
const zeroValues = weather.buildWeatherSnapshot({ current: { temp: 0, rhum: 0 }, hourly: [{ ...hourly[0], temp: 0, prec: 0, wspd: 0 }] }, options);
assert.strictEqual(zeroValues.temperatureText, '0℃');
assert.strictEqual(zeroValues.humidityText, '0%');
assert.strictEqual(zeroValues.windText, '0m/s');
const invalid = weather.buildWeatherSnapshot({ current: { temp: -999, rhum: -999 }, hourly: [{ ...hourly[0], temp: -999 }, ...hourly] }, options);
assert.strictEqual(invalid.hourly.length, 24, 'Invalid forecast rows must be ignored.');
assert.strictEqual(invalid.temperatureText, '0℃');
assert.strictEqual(invalid.humidityText, '-');
assert.throws(() => weather.buildWeatherSnapshot('{}', options), /no hourly forecast/);
assert.throws(() => weather.buildWeatherSnapshot('{"hourly":[]}', options), /hourly table was not found/);
assert.throws(() => weather.buildWeatherSnapshot('<html>redirect only</html>', options), /hourly table was not found/);

const oldHtml = '<section><div class="wTable__group"><div class="wTable__day"><p class="wTable__item">13日</p></div>' +
  '<div class="wTable__row"><p class="wTable__item time">18</p><p class="wTable__item r">1</p>' +
  '<p class="wTable__item t">12</p><p class="wTable__item w"><i></i>3</p><img src="wxicon/300.png"></div></section>';
const legacy = weather.buildWeatherSnapshot(oldHtml, options);
assert.strictEqual(legacy.hourly.length, 1, 'Saved legacy HTML must remain usable.');
assert.strictEqual(legacy.weatherKind, 'rain');
assert.strictEqual(legacy.temperatureText, '12℃');

const resolved = new URL(weather.resolveWeathernewsUrl('https://weathernews.jp/v/wl/35.5/139.8/temp=c&lang=ja&type=hour'));
assert.strictEqual(resolved.hostname, 'www.jp-weathernews.com');
assert.strictEqual(resolved.searchParams.get('lat'), '35.5');
assert.strictEqual(resolved.searchParams.get('lon'), '139.8');
const modern = new URL(weather.resolveWeathernewsUrl('https://www.jp-weathernews.com/mv4/html/hourly.html?loc=JP_TEST&language=en'));
assert.strictEqual(modern.searchParams.get('loc'), 'JP_TEST');
assert.strictEqual(modern.searchParams.get('language'), 'ja');
assert.strictEqual(weather.resolveWeathernewsUrl(options.url), options.url, 'Explicit unrelated sources must not be rewritten.');
console.log('Weathernews source tests: OK');
