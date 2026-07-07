const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED = {
  hubScriptId: '1zeYJdhMTa4odr3SXLFv6ns0LOg2zmAJeOPxYUjbnACDN8o5oeYtRmzaI',
  studyScriptId: '1qOkLEui2ZCfWIAEsW7AW7v4ZwZFl8K1i6UtWG1_LaayRR4eFf6DLM1K-',
  izakayaScriptId: '1Q_h7s1zPIiyC7vSq5o9_a_5H1giDsmLzGQTYYrD8QR4R7BkOaPWMw9NP',
  lifeboardScriptId: '12fxOr0gwH3OvEswNtvYToMpprE-VRHwRukyLwfQFOUDtPVcKD8ScXdMZ',
  pagesBase: '/hobby-hub/'
};

let failed = false;

assertJson('.clasp.json', 'scriptId', EXPECTED.hubScriptId);
assertJson('737_Study_Finder/.clasp.json', 'scriptId', EXPECTED.studyScriptId);
assertJson('IzakayaScout/gas/.clasp.json', 'scriptId', EXPECTED.izakayaScriptId);
assertJson('LifeBoard/gas/.clasp.json', 'scriptId', EXPECTED.lifeboardScriptId);

const build = read('tools/build-pages.js');
assert(build.includes("const PAGES_BASE = '/hobby-hub/';"), 'build-pages.js must use /hobby-hub/ Pages base');
assert(build.includes('AKfycbxXGa_ahv1ZvjJ9-kbSqTJbdtY1NgrqJQu85LYERrBEi5QQnl1uwDMCIZ25zzYNMGG1'), 'missing HUB endpoint');
assert(build.includes('AKfycbzPwkINDY--2PUYQg5xGoPDtkCLYvGoItobfEJocINxBFviRzcCrxb7Iu5lylirQ7tLOg'), 'missing 737 endpoint');
assert(build.includes('AKfycbwzeUjS7KakeQJbJNE83WupMhVT9Qid2gWHh-9jw0hepywdAE5Y5RIgPEUcCnEFEOE'), 'missing Izakaya endpoint');
assert(build.includes('AKfycbxgGdT-E3xm8XKNklnKwzPDxkE4kXHt-xh1n0eOlTST6APtbbZ4jOAJ_kw_BIGLbg_jxg'), 'missing LifeBoard endpoint');

const gitignore = read('.gitignore');
assert(/(^|\n)LOCAL_URLS\.md(\n|$)/.test(gitignore), 'LOCAL_URLS.md must stay ignored');
assert(!isTracked('LOCAL_URLS.md'), 'LOCAL_URLS.md must not be tracked');

if (failed) {
  process.exit(1);
}
console.log('check-project-identity ok');

function assertJson(relativePath, key, expected) {
  const json = JSON.parse(read(relativePath));
  assert(json[key] === expected, relativePath + ' expected ' + key + ' ' + expected + ', got ' + json[key]);
}

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
