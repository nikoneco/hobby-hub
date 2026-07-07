const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const CSS_FILES = [
  'assets/css/app.css',
  'assets/css/pwa.css',
  '737-study-finder/assets/css/app.css',
  '737-study-finder/assets/css/pwa.css',
  'izakaya-scout/assets/css/app.css',
  'izakaya-scout/assets/css/pwa.css',
  'lifeboard/assets/css/app.css',
  'lifeboard/assets/css/pwa.css'
];

let failed = false;

for (const relativePath of CSS_FILES) {
  const source = fs.readFileSync(path.join(DOCS, relativePath), 'utf8');
  assert(!/<\/?style/i.test(source), relativePath + ' still contains style wrapper');
  assert(!/<\?!=|<\?=/.test(source), relativePath + ' still contains GAS template tags');
  assert(source.trim().length > 0, relativePath + ' is empty');
}

if (failed) {
  process.exit(1);
}
console.log('check-client-css ok');

function assert(condition, message) {
  if (!condition) {
    failed = true;
    console.error(message);
  }
}
