#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sourcePath = path.resolve(__dirname, '../pixoo_display/pixoo_lifeboard.js');
const context = vm.createContext({ require, module: { exports: {} }, __dirname: path.dirname(sourcePath), Buffer, process, console });
vm.runInContext(fs.readFileSync(sourcePath, 'utf8') + '\nthis.nightCatFur = NIGHT_CAT_COLORS.fur;', context);
const awakeCatLottery = context.isAwakeCatVisible;
// Test shift and transport priorities with a winning draw; test the real draw below.
context.isAwakeCatVisible = () => true;
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../pixoo_animation_test/fixture_life_data_sun.json'), 'utf8'));
fixture.rail = { routes: [{ severity: 'normal', statusText: '平常運転' }] };
const options = {
  animateBusBar: true, busTransition: 'none', busScene: 'normal',
  now: '2026-10-04T12:00:00+09:00',
  fontPng: path.resolve(__dirname, '../misaki_png_2021-05-05a/misaki_gothic.png')
};
const far = { routes: [{ routeId: 'home_to_station', items: [{ scheduledDepartureText: '12:12', remainingMinutes: 12, previousStops: 5 }] }] };
const ended = { routes: [{ routeId: 'home_to_station', items: [] }] };
const data = (title, extra = []) => ({ ...fixture, calendar: { events: [{ date: '2026-10-04', title, allDay: true }, ...extra] } });
const holiday = data('H');
const render = (snapshot, life, overrides = {}) => context.renderLifeBoardFrames(snapshot, life, { ...options, ...overrides });
const pixel = (frame, x, y) => Array.from(frame.subarray((y * 64 + x) * 3, (y * 64 + x) * 3 + 3));
const catScene = (snapshot, life, scene = 'normal', overrides = {}) => context.resolveCatScene(
  snapshot, context.buildWorkStatus(life, overrides.now || options.now), scene, { ...options, ...overrides }
);

for (const title of ['/', 'H', 'AL', '10H']) assert.strictEqual(catScene(far, data(title)), 'awake');
for (const title of ['D', 'N', 'S', 'SV']) assert.strictEqual(catScene(far, data(title)), 'none');
assert.strictEqual(context.buildWorkStatus(data('AL'), options.now).mixedText, context.buildWorkStatus(data('SV'), options.now).mixedText, 'AL and SV share a label but only AL may show the cat');
const afterNightShift = data('/', [{ date: '2026-10-03', title: 'N', allDay: true }]);
assert.strictEqual(catScene(far, afterNightShift, 'normal', { now: '2026-10-04T08:08:00+09:00' }), 'none', 'night shift still in progress must take priority over the slash day');
assert.strictEqual(catScene(far, afterNightShift, 'normal', { now: '2026-10-04T08:09:00+09:00' }), 'awake', 'cat must appear once the slash day becomes post-shift');
for (const previousTitle of ['AL', 'SV', '10H']) {
  assert.strictEqual(catScene(far, data('/', [{ date: '2026-10-03', title: previousTitle, allDay: true }])), 'awake', 'slash day must qualify even when displayed as holiday');
}
assert.strictEqual(catScene(far, {}), 'none', 'missing calendar must not invent a holiday');
assert.strictEqual(catScene(far, data('H', [{ date: '2026-10-04', title: '試験', category: '試験関係', allDay: true }])), 'none');
assert.strictEqual(catScene(ended, holiday, 'sunrise'), 'none');
for (const transition of ['first-bus', 'service-ended']) {
  assert.strictEqual(catScene(ended, holiday, 'night', { busTransition: transition }), 'none');
}
for (const remainingMinutes of [5, 1, 0]) {
  const urgent = { routes: [{ ...far.routes[0], items: [{ ...far.routes[0].items[0], remainingMinutes }] }] };
  assert.strictEqual(catScene(urgent, holiday), 'none', 'imminent buses must own the header');
  const withHoliday = render(urgent, holiday);
  const withoutHoliday = render(urgent, data('10H'));
  for (let i = 0; i < withHoliday.length; i += 1) {
    for (let y = 8; y < 15; y += 1) {
      assert.ok(withHoliday[i].subarray((y * 64) * 3, (y * 64 + 34) * 3).equals(withoutHoliday[i].subarray((y * 64) * 3, (y * 64 + 34) * 3)), 'urgent bus/headlight/door pixels must be unchanged');
    }
  }
}

const awake = render(far, holiday);
assert.strictEqual(awake.length, 6);
assert.ok(!awake[0].equals(awake[3]), 'tail must move');
const withoutCat = render(far, data('N'));
for (let i = 0; i < awake.length; i += 1) {
  assert.ok(awake[i].subarray(16 * 64 * 3).equals(withoutCat[i].subarray(16 * 64 * 3)), 'bus times, remaining, weather, garbage and rail must remain identical');
}
const nightOptions = { busScene: 'auto', now: '2026-10-04T23:00:00+09:00' };
const night = render(ended, holiday, nightOptions);
assert.strictEqual(night.length, 36);
assert.strictEqual(catScene(ended, holiday, 'night'), 'sleeping');
assert.strictEqual(context.resolveBusScene(ended, { ...options, ...nightOptions }), 'night');
assert.strictEqual(context.resolveBusScene(far, { ...options, ...nightOptions }), 'normal', 'active bus must not become a night scene');
assert.strictEqual(render(ended, holiday, { busScene: 'auto', now: '2026-10-04T06:00:00+09:00' }).length, 6);
for (const transition of ['first-bus', 'service-ended']) {
  assert.strictEqual(render(ended, holiday, { ...nightOptions, busTransition: transition }).length, 6);
}
const railAlert = { ...holiday, rail: { routes: [{ severity: 'delay', statusText: '列車遅延' }] } };
assert.strictEqual(render(ended, railAlert, nightOptions).length, 6, 'rail alerts must keep their regular loop');
const staticNight = render(ended, holiday, { ...nightOptions, animateBusBar: false });
assert.strictEqual(staticNight.length, 1);
assert.ok(staticNight[0].equals(night[0]), 'static mode must keep the quiet sleeping scene');
assert.ok(!night[0].equals(night[2]), 'sleeping cat and stars must move');
const actualMeteor = context.drawShootingStar;
context.drawShootingStar = () => {};
const nightWithoutMeteor = render(ended, holiday, nightOptions);
context.drawShootingStar = actualMeteor;
const normalEndedFrames = render(ended, holiday);
const catPositions = new Set();
const nightCatFur = Array.from(context.nightCatFur).join();
const actualSleepingNightCat = context.drawSleepingNightCat;
const actualWalkingCat = context.drawWalkingCat;
context.drawSleepingNightCat = () => {};
context.drawWalkingCat = () => {};
const nightWithoutCat = render(ended, holiday, nightOptions);
context.drawSleepingNightCat = actualSleepingNightCat;
context.drawWalkingCat = actualWalkingCat;
for (let i = 0; i < night.length; i += 1) {
  const quiet = nightWithoutMeteor[i];
  let differences = 0;
  const furXs = [];
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      if (pixel(night[i], x, y).join() !== pixel(nightWithoutCat[i], x, y).join()) {
        assert.ok(x >= 6 && x <= 53 && y >= 23 && y <= 38, 'all cat colours must remain inside the freed bus panel');
      }
      if (pixel(night[i], x, y).join() === nightCatFur) {
        assert.ok(x >= 6 && x <= 53 && y >= 23 && y <= 38, 'cat must remain inside the freed bus panel');
        furXs.push(x);
      }
      if (pixel(night[i], x, y).join() === pixel(quiet, x, y).join()) continue;
      differences += 1;
      assert.ok(i >= 31 && i <= 34, 'only four frames per cycle may contain a meteor');
      assert.ok(x >= 18 && x <= 45 && y >= 16 && y <= 20, 'meteor must stay above cat, below work marker and clear of information rows');
    }
  }
  assert.ok(furXs.length > 80, 'a large cat must remain visible in every frame');
  catPositions.add(Math.min(...furXs));
  const normal = normalEndedFrames[i % normalEndedFrames.length];
  assert.ok(night[i].subarray(0, 8 * 64 * 3).equals(normal.subarray(0, 8 * 64 * 3)), 'clock/date pixels must be unchanged');
  assert.ok(night[i].subarray(40 * 64 * 3).equals(normal.subarray(40 * 64 * 3)), 'JR/weather/garbage pixels must be unchanged');
  for (let y = 8; y < 15; y += 1) {
    assert.ok(night[i].subarray((y * 64 + 34) * 3, (y * 64 + 64) * 3).equals(normal.subarray((y * 64 + 34) * 3, (y * 64 + 64) * 3)), 'work marker pixels must be preserved');
  }
  assert.strictEqual(differences > 0, i >= 31 && i <= 34);
}
assert.ok(catPositions.size >= 6, 'cat must walk to multiple positions');
assert.ok(!night[0].equals(night[12]), 'cat must alternate between sleeping and walking');
assert.ok(night[0].equals(night[24]), 'cat must return home and resume sleeping');
const actualEndedMessage = context.drawBusEndedMessage;
let endedMessageCalls = 0;
context.drawBusEndedMessage = (...args) => { endedMessageCalls += 1; actualEndedMessage(...args); };
render(ended, holiday, nightOptions);
render({ routes: [] }, holiday, nightOptions);
assert.strictEqual(endedMessageCalls, 0, 'night scene must not draw waiting or ended text');
render(ended, holiday, { busScene: 'sunrise' });
assert.ok(endedMessageCalls > 0, 'sunrise must retain the first-bus message');
context.drawBusEndedMessage = actualEndedMessage;
assert.ok(render({ routes: [] }, holiday, nightOptions)[0].equals(night[0]), 'night without bus data must not add NO DATA over the scene');

if (process.argv[2]) {
  const directory = path.resolve(process.argv[2]);
  fs.mkdirSync(directory, { recursive: true });
  for (const [label, frames] of [['holiday', awake], ['night', night]]) {
    frames.forEach((frame, index) => context.writePngPreview(frame, path.join(directory, `${label}_${String(index).padStart(2, '0')}.png`)));
  }
}

context.isAwakeCatVisible = awakeCatLottery;
const lotteryResults = new Set();
const lotteryTimes = new Map();
for (let windowIndex = 0; windowIndex < 24; windowIndex += 1) {
  const start = Date.parse(options.now) + windowIndex * 10 * 60 * 1000;
  const winner = awakeCatLottery(start);
  lotteryResults.add(winner);
  lotteryTimes.set(winner, new Date(start).toISOString());
  for (const offset of [0, 60000, 300000, 599999]) {
    const now = new Date(start + offset).toISOString();
    assert.strictEqual(awakeCatLottery(now), winner, 'one draw must be stable for the entire ten-minute window');
    for (const title of ['/', 'H', 'AL', '10H']) {
      assert.strictEqual(catScene(far, data(title), 'normal', { now }), winner ? 'awake' : 'none');
    }
    assert.strictEqual(catScene(ended, holiday, 'night', { now }), 'sleeping', 'sleeping cat must ignore the lottery');
    assert.strictEqual(catScene(far, data('SV'), 'normal', { now }), 'none', 'a winning draw must not admit an excluded shift');
  }
}
assert.strictEqual(lotteryResults.size, 2, 'draws must include both visible and absent cats');
for (const winner of [false, true]) {
  const now = lotteryTimes.get(winner);
  const nightFrames = render(ended, holiday, { busScene: 'night', now });
  assert.strictEqual(nightFrames.length, 36, 'both lottery outcomes must retain the night loop');
  assert.strictEqual(render(ended, holiday, { busScene: 'night', now, animateBusBar: false }).length, 1);
  for (const transition of ['first-bus', 'service-ended']) {
    assert.strictEqual(catScene(ended, holiday, 'night', { now, busTransition: transition }), 'none');
  }
  const urgent = { routes: [{ ...far.routes[0], items: [{ ...far.routes[0].items[0], remainingMinutes: 5 }] }] };
  assert.strictEqual(catScene(urgent, holiday, 'normal', { now }), 'none');
}
const rebootedContext = vm.createContext({ require, module: { exports: {} }, __dirname: path.dirname(sourcePath), Buffer, process, console });
vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), rebootedContext);
for (const [winner, now] of lotteryTimes) {
  assert.strictEqual(rebootedContext.isAwakeCatVisible(now), winner, 'process restart must preserve the same draw');
}

async function verifyUploadRecovery() {
  const sender = vm.createContext({
    require, module: { exports: {} }, __dirname: path.dirname(sourcePath), Buffer, process,
    console: { log() {}, warn() {} }, setTimeout: (callback) => callback()
  });
  vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), sender);
  let state = { initialized: true, overlayBaseHash: 'old-base' };
  let failOnce = true;
  let requests = [];
  let recordedSummary;
  sender.fetch = async (_url, request) => {
    const payload = JSON.parse(request.body);
    requests.push(payload);
    if (payload.Command === 'Draw/SendHttpGif' && payload.PicNum === 36 && payload.PicOffset === 32 && failOnce) {
      failOnce = false;
      return { ok: true, status: 200, text: async () => JSON.stringify({ error_code: 1 }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ error_code: 0, PicId: 1 }) };
  };
  sender.parseArgs = () => ({ ...options, busScene: 'night', push: true, pixooIp: 'test-device', itemOverlay: true, stateFile: 'in-memory', animationSpeedMs: 650, brightness: '' });
  sender.readSnapshot = () => ended;
  sender.readLifeBoardData = async () => holiday;
  sender.readRuntimeState = () => state;
  sender.writeRuntimeState = (_path, next) => { state = next; };
  sender.printSummary = (_snapshot, _life, summary) => { recordedSummary = summary; };

  await sender.main();
  assert.ok(requests.some((request) => request.Command === 'Draw/SendHttpGif' && request.PicNum === 1), 'failed animation must fall back to a static frame');
  assert.ok(!state.overlayBaseHash, 'fallback must not cache the intended animation hash');
  assert.strictEqual(recordedSummary.animationFrameCount, 1, 'summary must report actual static fallback');
  assert.ok(requests.some((request) => request.Command === 'Draw/SendHttpItemList'), 'fallback must retain the running clock');

  requests = [];
  await sender.main();
  const uploaded = requests.filter((request) => request.Command === 'Draw/SendHttpGif');
  assert.strictEqual(uploaded.length, 36, 'next unchanged run must retry the full sequence');
  assert.ok(uploaded.every((request, index) => request.PicNum === 36 && request.PicOffset === index && request.PicSpeed === 650));
  assert.strictEqual(new Set(uploaded.map((request) => request.PicID)).size, 1);
  assert.ok(state.overlayBaseHash, 'complete animation may be cached');
  assert.strictEqual(recordedSummary.animationFrameCount, 36);

  requests = [];
  await sender.main();
  assert.ok(!requests.some((request) => request.Command === 'Draw/SendHttpGif'), 'successful animation must be reused');
  assert.ok(requests.some((request) => request.Command === 'Draw/SendHttpItemList'), 'cached run must still update clock items');
}

verifyUploadRecovery().then(() => {
  console.log('Pixoo playful scenes: stable random awake cat, night cat sleeping/walking, scene priorities, 36-frame pixel isolation, upload recovery and overlay cache OK');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
