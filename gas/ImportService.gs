function importTextbookPagesFromRows(rows) {
  const spreadsheet = openStudySpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'textbook_pages');
  rows.forEach(function (row) {
    appendObject_(sheet, STUDY_SCHEMA.textbook_pages, row);
  });
  return rows.length;
}

function importQuestionsFromRows(rows) {
  const spreadsheet = openStudySpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'question_bank');
  rows.forEach(function (row) {
    appendObject_(sheet, STUDY_SCHEMA.question_bank, row);
  });
  return rows.length;
}

function rebuildRelatedPageLinks() {
  return {
    status: 'not_implemented',
    note: 'CSV import後にD/F対応を再構築する予定'
  };
}

function rebuildKeywordIndex() {
  return {
    status: 'not_implemented',
    note: 'CSV import後に検索補助列を再生成する予定'
  };
}
