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

  '737-study-finder/assets/answer-figures/ata00-design-range.webp',
  '737-study-finder/assets/answer-figures/ata24-external-power-locations.webp',
  '737-study-finder/assets/answer-figures/ata27-aileron-numbered-diagram.webp',
  '737-study-finder/assets/answer-figures/ata38-potable-water-system.webp',
  '737-study-finder/assets/answer-figures/ata47-ngs-diagram.webp',
  'celestiframe/index.html',
  'jack-load/index.html',
  'sudoku/index.html',
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

const studyHtml = readGenerated('737-study-finder/index.html');
assert(!studyHtml.includes('<iframe'), 'Study Finder legacy entry must not embed an iframe');
assert(studyHtml.includes('window.location.replace("https://nikoneco.github.io/Study_Finder/")'), 'Study Finder legacy entry must redirect to the standalone PWA');
assert(studyHtml.includes('737 Study Finderを開いています。'), 'Study Finder redirect must name the correct app');
assert(readGenerated('assets/js/pwa-client.js').includes("study737: 'https://nikoneco.github.io/Study_Finder/'"), 'Study Finder launcher must open the standalone PWA directly');
assert(!studyHtml.includes('<button'), 'Study Finder bridge must not add a back button');
assert(!studyHtml.includes('gas-run-shim.js'), 'Study Finder must not be generated from HUB source');

for (const [moduleId, slug, target, title] of [
  ['room_library', 'room-library', 'https://nikoneco.github.io/hobby-room-library-PWA/', '趣味部屋図書館'],
  ['celestiframe', 'celestiframe', 'https://nikoneco.github.io/CelestiFrame/', 'CelestiFrame'],
  ['sudoku', 'sudoku', 'https://nikoneco.github.io/Sudoku/', '数独']
]) {
  const legacyHtml = readGenerated(slug + '/index.html');
  assert(!legacyHtml.includes('<iframe'), title + ' must not embed an iframe');
  assert(legacyHtml.includes('window.location.replace(' + JSON.stringify(target) + ')'), title + ' legacy entry must redirect');
  assert(legacyHtml.includes(title + 'を開いています。'), title + ' redirect must name the correct app');
  assert(readGenerated('assets/js/pwa-client.js').includes(moduleId + ": '" + target + "'"), title + ' launcher must open the standalone PWA directly');
}

for (const relativePath of ['index.html', 'izakaya-scout/index.html', 'lifeboard/index.html']) {
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
assert(sw.includes('celestiframe/index.html'), 'Service Worker must cache CelestiFrame shell');
assert(sw.includes('jack-load/index.html'), 'Service Worker must cache JACK LOAD shell');
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
