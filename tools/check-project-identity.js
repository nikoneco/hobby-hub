const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED = {
  pagesBase: '/hobby-hub/'
};

let failed = false;

const build = read('tools/build-pages.js');
assert(build.includes("const PAGES_BASE = '/hobby-hub/';"), 'build-pages.js must use /hobby-hub/ Pages base');
['hub', 'study737', 'izakaya', 'lifeboard'].forEach((name) => {
  assert(build.includes(`id: '${name}'`), 'build-pages.js missing app ' + name);
});
assert((build.match(/gasEndpoint: 'https:\/\/script\.google\.com\/macros\/s\//g) || []).length === 4, 'build-pages.js must define four GAS Web App endpoints');

const gitignore = read('.gitignore');
assert(/(^|\n)LOCAL_URLS\.md(\n|$)/.test(gitignore), 'LOCAL_URLS.md must stay ignored');
assert(/(^|\n)\.clasp\.json(\n|$)/.test(gitignore), '.clasp.json must stay ignored');
assert(!isTracked('LOCAL_URLS.md'), 'LOCAL_URLS.md must not be tracked');
[
  '.clasp.json',
  '737_Study_Finder/.clasp.json',
  'IzakayaScout/gas/.clasp.json',
  'LifeBoard/gas/.clasp.json'
].forEach((file) => assert(!isTracked(file), file + ' must not be tracked'));

if (failed) {
  process.exit(1);
}
console.log('check-project-identity ok');

function isTracked(relativePath) {
  const gitIndex = path.join(ROOT, '.git', 'index');
  if (!fs.existsSync(gitIndex)) return false;
  return require('child_process').execFileSync('git', ['ls-files', relativePath], { cwd: ROOT, encoding: 'utf8' }).trim() !== '';
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    failed = true;
    console.error(message);
  }
}
