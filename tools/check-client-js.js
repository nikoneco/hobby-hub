const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const JS_FILES = [
  'assets/js/gas-run-shim.js',
  'assets/js/app.js',
  'assets/js/pwa-client.js',
  '737-study-finder/assets/js/gas-run-shim.js',
  '737-study-finder/assets/js/app.js',
  '737-study-finder/assets/js/pwa-client.js',
  'izakaya-scout/assets/js/gas-run-shim.js',
  'izakaya-scout/assets/js/app.js',
  'izakaya-scout/assets/js/pwa-client.js',
  'lifeboard/assets/js/gas-run-shim.js',
  'lifeboard/assets/js/app.js',
  'lifeboard/assets/js/pwa-client.js',
  'sw.js'
];

let failed = false;

for (const relativePath of JS_FILES) {
  const source = fs.readFileSync(path.join(DOCS, relativePath), 'utf8');
  try {
    new vm.Script(source, { filename: relativePath });
  } catch (error) {
    failed = true;
    console.error(relativePath + ': ' + error.message);
  }
}

if (failed) {
  process.exit(1);
}
console.log('check-client-js ok');
