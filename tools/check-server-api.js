const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECKS = [
  {
    file: 'gas/Code.gs',
    required: ['handleWebAppJsonpRequest_', 'dispatchWebAppJsonpApi_', "case 'apiGetModules'"],
    forbidden: ["case 'setupProject'"]
  },
  {
    file: '737_Study_Finder/gas/Code.gs',
    required: ['handleWebAppJsonpRequest_', "case 'apiGetQuestionsBundle'", "case 'apiGetQuestionDetail'", "case 'apiGetRandomQuestionDetail'", "case 'apiBuildReviewPrompt'"],
    forbidden: ["case 'apiImportCsv'", "case 'apiImportPreparedAtaData'", "case 'apiSaveAnswerNote'", "case 'apiSaveConfirmedAnswer'", "case 'setupProject'"]
  },
  {
    file: 'IzakayaScout/gas/Code.gs',
    required: ['handleWebAppJsonpRequest_', "case 'apiSearchShops'", "case 'apiGetSetupStatus'"],
    forbidden: []
  },
  {
    file: 'LifeBoard/gas/Code.gs',
    required: ['handleWebAppJsonpRequest_', "case 'apiGetLifeBoardData'"],
    forbidden: ['handleBusSnapshotImportPost_', 'handleBusTimetableImportPost_']
  }
];

let failed = false;

for (const check of CHECKS) {
  const source = fs.readFileSync(path.join(ROOT, check.file), 'utf8');
  for (const needle of check.required) {
    assert(source.includes(needle), check.file + ' missing ' + needle);
  }
  assert(source.includes('normalizeWebAppJsonpCallback_'), check.file + ' missing callback validation');
  assert(source.includes('decodeWebAppJsonpArgs_'), check.file + ' missing args decoder');
  const dispatcher = extractDispatcher(source);
  for (const needle of check.forbidden) {
    assert(!dispatcher.includes(needle), check.file + ' exposes forbidden API ' + needle);
  }
}

if (failed) {
  process.exit(1);
}
console.log('check-server-api ok');

function extractDispatcher(source) {
  const start = source.indexOf('function dispatchWebAppJsonpApi_');
  if (start === -1) return '';
  const nextFunction = source.indexOf('\nfunction ', start + 10);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

function assert(condition, message) {
  if (!condition) {
    failed = true;
    console.error(message);
  }
}
