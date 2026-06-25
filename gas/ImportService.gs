const IMPORTABLE_STUDY_SHEETS = [
  'source_files',
  'textbook_pages',
  'textbook_sections',
  'question_bank',
  'candidate_links',
  'answer_notes',
  'confirmed_answers',
  'review_queue',
  'term_dictionary',
  'search_log'
];

function importCsvText(payload) {
  const sheetName = payload.sheet_name || payload.sheetName;
  const csvText = normalizeCsvText_(payload.csv_text || payload.csvText || '');
  const mode = payload.mode || 'replace';
  if (IMPORTABLE_STUDY_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Unsupported import sheet: ' + sheetName);
  }
  if (!csvText) {
    throw new Error('CSV text is empty.');
  }

  const schema = STUDY_SCHEMA[sheetName];
  if (!schema) {
    throw new Error('Schema not found for sheet: ' + sheetName);
  }

  const values = Utilities.parseCsv(csvText);
  if (!values.length) {
    throw new Error('CSV has no rows.');
  }
  const headers = values[0].map(function (header) {
    return String(header || '').replace(/^\uFEFF/, '').trim();
  });
  validateCsvHeaders_(sheetName, schema, headers);

  const rows = values.slice(1).filter(function (row) {
    return row.some(function (cell) { return cell !== ''; });
  });
  const spreadsheet = openStudySpreadsheet_();
  const sheet = ensureSheet_(spreadsheet, sheetName, schema);
  writeImportedRows_(sheet, schema, headers, rows, mode);

  return {
    sheet_name: sheetName,
    mode: mode,
    imported_rows: rows.length,
    imported_columns: schema.length
  };
}

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

function normalizeCsvText_(csvText) {
  return String(csvText || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function validateCsvHeaders_(sheetName, schema, headers) {
  const missing = schema.filter(function (header) {
    return headers.indexOf(header) === -1;
  });
  if (missing.length) {
    throw new Error(sheetName + ' CSV missing columns: ' + missing.join(', '));
  }
}

function writeImportedRows_(sheet, schema, headers, csvRows, mode) {
  ensureHeaders_(sheet, schema);
  if (mode === 'replace') {
    clearDataRows_(sheet);
  }
  if (!csvRows.length) {
    return;
  }

  const mappedRows = csvRows.map(function (csvRow) {
    return schema.map(function (header) {
      const sourceIndex = headers.indexOf(header);
      return sourceIndex === -1 ? '' : csvRow[sourceIndex];
    });
  });

  const startRow = mode === 'append' ? sheet.getLastRow() + 1 : 2;
  ensureGridSize_(sheet, startRow + mappedRows.length - 1, schema.length);
  const chunkSize = 100;
  for (let index = 0; index < mappedRows.length; index += chunkSize) {
    const chunk = mappedRows.slice(index, index + chunkSize);
    sheet.getRange(startRow + index, 1, chunk.length, schema.length).setValues(chunk);
  }
}

function clearDataRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();
  }
}

function ensureGridSize_(sheet, requiredRows, requiredColumns) {
  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }
}
