const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const REQUIRED_FILES = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'offline.html',
  'assets/css/app.css',
  'assets/css/pwa.css',
  'assets/js/gas-run-shim.js',
  'assets/js/app.js',
  'assets/js/pwa-client.js',
  '737-study-finder/index.html',
  '737-study-finder/assets/js/gas-run-shim.js',
  'izakaya-scout/index.html',
  'izakaya-scout/assets/js/gas-run-shim.js',
  'lifeboard/index.html',
  'lifeboard/assets/js/gas-run-shim.js'
];

let failed = false;

for (const relativePath of REQUIRED_FILES) {
  const filePath = path.join(DOCS, relativePath);
  if (!fs.existsSync(filePath)) {
    fail('Missing generated file: ' + relativePath);
  }
}

for (const relativePath of ['index.html', '737-study-finder/index.html', 'izakaya-scout/index.html', 'lifeboard/index.html']) {
  const html = readGenerated(relativePath);
  assert(!/<\?!=|<\?=/.test(html), relativePath + ' still contains GAS template tags');
  assert(html.includes('manifest.webmanifest'), relativePath + ' does not load manifest');
  assert(html.includes('gas-run-shim.js'), relativePath + ' does not load GAS shim');
  assert(html.includes('pwa-client.js'), relativePath + ' does not load PWA client');
}

const manifest = JSON.parse(readGenerated('manifest.webmanifest'));
assert(manifest.start_url === '/hobby-hub/', 'manifest start_url must be /hobby-hub/');
assert(manifest.display === 'standalone', 'manifest display must be standalone');
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest must include install icons');

const sw = readGenerated('sw.js');
assert(sw.includes('offline.html'), 'Service Worker must include offline fallback');
assert(sw.includes('737-study-finder/index.html'), 'Service Worker must cache 737 page');
assert(sw.includes('izakaya-scout/index.html'), 'Service Worker must cache Izakaya page');
assert(sw.includes('lifeboard/index.html'), 'Service Worker must cache LifeBoard page');

if (failed) {
  process.exit(1);
}
console.log('check-pages ok');

function readGenerated(relativePath) {
  return fs.readFileSync(path.join(DOCS, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  failed = true;
  console.error(message);
}
