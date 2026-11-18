const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const REQUIRED_FILES = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'offline.html',
  'assets/css/app.css',
  'assets/css/pwa.css',
  'assets/js/app.js',
  'assets/js/flavor-messages.js',
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
assert(!studyHtml.includes('<button'), 'Study Finder bridge must not add a back button');
assert(!studyHtml.includes('gas-run-shim.js'), 'Study Finder must not be generated from HUB source');

for (const [slug, target, title] of [
  ['room-library', 'https://nikoneco.github.io/hobby-room-library-PWA/', '趣味部屋図書館'],
  ['celestiframe', 'https://nikoneco.github.io/CelestiFrame/', 'CelestiFrame'],
  ['sudoku', 'https://nikoneco.github.io/Sudoku/', '数独']
]) {
  const legacyHtml = readGenerated(slug + '/index.html');
  assert(!legacyHtml.includes('<iframe'), title + ' must not embed an iframe');
  assert(legacyHtml.includes('window.location.replace(' + JSON.stringify(target) + ')'), title + ' legacy entry must redirect');
  assert(legacyHtml.includes(title + 'を開いています。'), title + ' redirect must name the correct app');
}

const hubHtml = readGenerated('index.html');
const hubCatalogJson = hubHtml.match(/<script\b[^>]*\bid="hub-catalog"[^>]*>([\s\S]*?)<\/script>/);
assert(hubCatalogJson, 'HUB must expose its generated catalog');
const hubCatalog = JSON.parse(hubCatalogJson?.[1] || '[]');
const jackLoadShell = readGenerated('jack-load/index.html');
const jackLoadTarget = JSON.parse(jackLoadShell.match(/window\.location\.replace\(("[^"]+")\)/)?.[1] || 'null');
assert(typeof jackLoadTarget === 'string' && jackLoadTarget.startsWith('https://script.google.com/macros/s/'),
  'JACK LOAD legacy entry must redirect to its Apps Script app');
assert(hubCatalog.length === 9 && new Set(hubCatalog.map((module) => module.module_id)).size === 9,
  'HUB catalog must contain nine unique modules');
for (const [id, category, target] of [
  ['room_library', 'hobby', 'https://nikoneco.github.io/hobby-room-library-PWA/'],
  ['celestiframe', 'hobby', 'https://nikoneco.github.io/CelestiFrame/'],
  ['study737', 'aviation', 'https://nikoneco.github.io/Study_Finder/'],
  ['jack_load', 'aviation', jackLoadTarget],
  ['lifeboard', 'daily', './lifeboard/'],
  ['izakaya_scout', 'daily', './izakaya-scout/'],
  ['household_account_book', 'daily', 'https://nikoneco.github.io/household-account-book/'],
  ['sudoku', 'game', 'https://nikoneco.github.io/Sudoku/'],
  ['arrow_journey', 'game', 'https://nikoneco.github.io/Arrow-Journey/']
]) {
  const module = hubCatalog.find((entry) => entry.module_id === id);
  assert(module?.enabled === true && module.category === category && module.target_url === target,
    'Wrong category or destination for HUB module ' + id);
}

for (const relativePath of ['index.html', 'izakaya-scout/index.html', 'lifeboard/index.html']) {
  const html = readGenerated(relativePath);
  assert(!/<\?!=|<\?=/.test(html), relativePath + ' still contains GAS template tags');
  assert(html.includes('manifest.webmanifest'), relativePath + ' does not load manifest');
  if (relativePath !== 'index.html') {
    assert(html.includes('gas-run-shim.js'), relativePath + ' does not load GAS shim');
  }
  assert(html.includes('pwa-client.js'), relativePath + ' does not load PWA client');
}

const manifest = JSON.parse(readGenerated('manifest.webmanifest'));
assert(manifest.start_url === '/hobby-hub/', 'manifest start_url must be /hobby-hub/');
assert(manifest.scope === '/hobby-hub/', 'manifest scope must be /hobby-hub/');
assert(manifest.display === 'standalone', 'manifest display must be standalone');
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest must include install icons');

const sw = readGenerated('sw.js');
const appShell = vm.runInNewContext(sw + '\nAPP_SHELL;', { self: { addEventListener() {} } });
for (const [, url] of hubHtml.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\?v=[^"]+)"/g)) {
  if (!url.startsWith('assets/icons/')) {
    assert(appShell.includes('/hobby-hub/' + url), 'Service Worker must cache root resource ' + url);
  }
}
for (const art of fs.readdirSync(path.join(ROOT, 'pages', 'hub', 'art'))) {
  const file = 'assets/night-study/' + art;
  assert(fs.existsSync(path.join(DOCS, file)) && appShell.includes('/hobby-hub/' + file),
    'The room artwork must be published and cached: ' + art);
}
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
