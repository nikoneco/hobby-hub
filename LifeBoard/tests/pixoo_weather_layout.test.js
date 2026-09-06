#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sourcePath = path.resolve(__dirname, '../pixoo_display/pixoo_lifeboard.js');
const context = vm.createContext({ require, module: { exports: {} }, __dirname: path.dirname(sourcePath), Buffer, process, console });
vm.runInContext(fs.readFileSync(sourcePath, 'utf8') + '\nthis.testColors = COLORS;', context);
const pixel = (frame, x, y) => Array.from(frame.subarray((y * 64 + x) * 3, (y * 64 + x) * 3 + 3));
const white = Array.from(context.testColors.white);
const kinds = ['clear', 'superclear', 'cloud', 'drizzle', 'rain', 'heavy', 'thunder', 'snow'];
let cases = 0;
for (const fromKind of kinds) {
  for (const toKind of kinds.filter((kind) => kind !== fromKind)) {
    for (let animationPhase = 0; animationPhase < 6; animationPhase += 1) {
      const frame = Buffer.alloc(64 * 64 * 3);
      context.drawWeatherStatusIcon(frame, 48, { mode: 'later', fromKind, toKind }, { weatherIconMoves: true, animationPhase });
      for (let y = 48; y < 56; y += 1) {
        for (const x of [51, 55]) assert.deepStrictEqual(pixel(frame, x, y), [0, 0, 0], `${fromKind}->${toKind} phase ${animationPhase}: gap`);
        for (let x = 52; x <= 54; x += 1) {
          const chevron = ['#..', '.#.', '..#', '.#.', '#..'];
          const isArrow = y >= 49 && y <= 53 && chevron[y - 49][x - 52] === '#';
          assert.deepStrictEqual(pixel(frame, x, y), isArrow ? white : [0, 0, 0], 'right arrow must stay visible and point right');
        }
      }
      cases += 1;
    }
  }
}

const options = { fontPng: path.resolve(__dirname, '../misaki_png_2021-05-05a/misaki_gothic.png'), weatherIconMoves: true, animationPhase: 0 };
for (const text of ['天気20/27C', '天気-1/10C', '天気-10/10C']) {
  const frame = Buffer.alloc(64 * 64 * 3);
  assert.ok(context.drawMixedText(frame, text, 0, 48, context.testColors.red, options), 'Japanese font required for width regression');
  const before = Buffer.from(frame);
  context.drawWeatherStatusIcon(frame, 48, { mode: 'later', fromKind: 'heavy', toKind: 'rain' }, options);
  for (let y = 48; y < 56; y += 1) {
    for (let x = 0; x < 43; x += 1) assert.deepStrictEqual(pixel(frame, x, y), pixel(before, x, y), 'temperature pixels must not be overwritten');
  }
  if (process.argv[2] && text === '天気20/27C') context.writePngPreview(frame, path.resolve(process.argv[2]));
}
console.log(`Pixoo weather layout: ${cases} animated transition cases and temperature checks OK`);
