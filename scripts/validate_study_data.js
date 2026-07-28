const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, '737_Study_Finder', 'data');
const ATAS = ['00', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '38', '47', '49', '5X', '7X'];

const CAUSALITY_EXPECTATIONS = {
  q_00_6352bd22fdd7: ['PROGRAM SWITCH', 'PROGRAM SWITCH'],
  q_00_0bef0d5f1f3c: ['LOADABLE SOFTWARE', 'DATA LOADER'],
  q_24_a59763ae0357: ['EXTERNAL POWER', 'BPCU'],
  q_24_97d3f71cc615: ['GENERATOR DRIVE', 'IDG'],
  q_24_780205016b20: ['AC GENERATION', 'GCU'],
  q_24_22f6e9cfbbd0: ['DC GENERATION', 'SPCU'],
  q_27_8692f2d3a1ae: ['FLIGHT SPOILER', 'FLIGHT SPOILER'],
  q_27_c512035ae123: ['SPEEDBRAKE', 'SPEEDBRAKE'],
  q_27_10f46d677d3a: ['RUDDER', 'RUDDER'],
  q_27_820d4eaacce9: ['ELEVATOR', 'ELEVATOR'],
  q_27_63f9cabda2b2: ['HORIZONTAL STABILIZER', 'HORIZONTAL STABILIZER'],
  q_27_e56f1b638293: ['TRAILING EDGE FLAP', 'TE FLAP'],
  q_27_76394140d1c1: ['LEADING EDGE FLAP', 'LE FLAP'],
  q_27_6b8fd0160525: ['STALL WARNING', 'STALL WARNING'],
  q_29_919b56e99980: ['MAIN HYDRAULIC', 'MAIN HYDRAULIC'],
  q_29_abddb4a59fe0: ['STANDBY HYDRAULIC', 'STANDBY HYDRAULIC'],
  q_33_fd7f9c395616: ['EMERGENCY LIGHT', 'EMERGENCY'],
  q_35_859772b4109f: ['PASSENGER OXYGEN', 'PASSENGER OXYGEN'],
  q_38_9d1fcc63d100: ['POTABLE WATER', 'WATER SERVICE PANEL'],
  q_34_e579f9a28714: ['ADIRU', 'ADIRU'],
  q_34_ed317e422748: ['OVERSPEED WARNING', 'OVERSPEED WARNING'],
  q_34_8fee352f5bf2: ['WEATHER RADAR', 'WXR'],
  q_34_96ec25fb4c1a: ['ADF MODE SELECTOR', 'ADF MODE SELECTOR'],
  q_7X_fefc40bbc708: ['ENGINE FUEL & CONTROL', 'FUEL NOZZLE'],
  q_7X_b4cf96f37399: ['ENGINE LUBRICATION', 'OIL TANK']
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift();
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] || ''])
  ));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(DATA_DIR, name), 'utf8').replace(/^\uFEFF/, ''));
}

function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertUnique(rows, key, label) {
  const seen = new Set();
  rows.forEach((row) => {
    assert(row[key], `${label} has an empty ${key}`);
    assert(!seen.has(row[key]), `${label} has duplicate ${key}: ${row[key]}`);
    seen.add(row[key]);
  });
}

function main() {
  const questions = [];
  const preparedQuestions = [];
  const answers = [];
  const candidates = [];
  const pages = [];

  ATAS.forEach((ata) => {
    const raw = readCsv(`question_bank_ata${ata}.csv`);
    const prepared = readCsv(`question_bank_ata${ata}_prepared.csv`);
    assert(raw.length === prepared.length, `ATA${ata} raw/prepared question count differs`);
    raw.forEach((question, index) => {
      assert(question.question_id === prepared[index].question_id, `ATA${ata} question order/ID changed at row ${index + 2}`);
      assert(question.question_text === prepared[index].question_text, `ATA${ata} raw/prepared question text differs: ${question.question_id}`);
    });
    questions.push(...raw);
    preparedQuestions.push(...prepared);
    answers.push(...readCsv(`answer_notes_ata${ata}.csv`));
    candidates.push(...readCsv(`candidate_links_ata${ata}.csv`));
    pages.push(...readCsv(`textbook_pages_ata${ata}.csv`));
  });

  assert(questions.length === 718, `Expected 718 questions, got ${questions.length}`);
  assert(preparedQuestions.length === 718, `Expected 718 prepared questions, got ${preparedQuestions.length}`);
  assert(answers.length === 718, `Expected 718 answers, got ${answers.length}`);
  assertUnique(questions, 'question_id', 'question bank');
  assertUnique(answers, 'note_id', 'answer notes');
  assertUnique(candidates, 'candidate_id', 'candidate links');
  pages.forEach((page) => assert(page.page_id, 'textbook pages has an empty page_id'));

  const questionById = new Map(questions.map((question) => [question.question_id, question]));
  const answerByQuestionId = new Map();
  answers.forEach((answer) => {
    assert(questionById.has(answer.question_id), `Orphan answer: ${answer.note_id}`);
    assert(!answerByQuestionId.has(answer.question_id), `Multiple canonical answers: ${answer.question_id}`);
    assert(String(answer.answer_text || '').trim(), `Empty answer: ${answer.question_id}`);
    assert(!/(?:DRAFT|ドラフト|下書き|回答候補|最終表現)/i.test(answer.answer_text), `Draft wording remains: ${answer.question_id}`);
    answerByQuestionId.set(answer.question_id, answer);
  });
  questions.forEach((question) => assert(answerByQuestionId.has(question.question_id), `Missing answer: ${question.question_id}`));

  const pageIds = new Set(pages.map((page) => page.page_id));
  candidates.forEach((candidate) => {
    const question = questionById.get(candidate.question_id);
    assert(question, `Orphan candidate: ${candidate.candidate_id}`);
    assert(String(question.ata) === String(candidate.ata), `Candidate ATA mismatch: ${candidate.candidate_id}`);
    assert(pageIds.has(candidate.page_id), `Candidate page missing: ${candidate.candidate_id} -> ${candidate.page_id}`);
  });
  answers.forEach((answer) => {
    String(answer.evidence_page_ids || '').split(',').map((value) => value.trim()).filter(Boolean).forEach((pageId) => {
      assert(pageIds.has(pageId), `Answer evidence page missing: ${answer.question_id} -> ${pageId}`);
    });
  });

  Object.entries(CAUSALITY_EXPECTATIONS).forEach(([questionId, [questionTerm, answerTerm]]) => {
    const question = questionById.get(questionId);
    const answer = answerByQuestionId.get(questionId);
    assert(question, `Causality question missing: ${questionId}`);
    assert(answer, `Causality answer missing: ${questionId}`);
    assert(normalize(question.question_text).includes(normalize(questionTerm)), `Question context missing for ${questionId}: ${questionTerm}`);
    assert(normalize(answer.answer_text).includes(normalize(answerTerm)), `Answer causality mismatch for ${questionId}: ${answerTerm}`);
  });

  console.log(JSON.stringify({
    questions: questions.length,
    answers: answers.length,
    candidates: candidates.length,
    textbook_pages: pages.length,
    causality_checks: Object.keys(CAUSALITY_EXPECTATIONS).length,
    status: 'ok'
  }));
}

main();
