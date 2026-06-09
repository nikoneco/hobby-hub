function importPreparedAta24Data() {
  return safeRun_('importPreparedAta24Data', function () {
    return importPreparedAta24Data_();
  });
}

function importPreparedAta24Data_() {
  setupProject_();

  const csvMap = getPreparedAta24CsvMap_();
  const order = [
    'source_files',
    'textbook_pages',
    'textbook_sections',
    'question_bank',
    'candidate_links',
    'answer_notes'
  ];

  const results = order.map(function (sheetName) {
    if (!csvMap[sheetName]) {
      throw new Error('Prepared CSV not found: ' + sheetName);
    }
    return importCsvText({
      sheet_name: sheetName,
      csv_text: csvMap[sheetName],
      mode: 'replace'
    });
  });

  return {
    ata: '24',
    imported: results,
    imported_at: nowIso_()
  };
}
