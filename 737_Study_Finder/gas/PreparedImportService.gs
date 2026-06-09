function importPreparedAtaData(ata) {
  return safeRun_('importPreparedAtaData', function () {
    return importPreparedAtaData_(ata || '24');
  });
}

function importPreparedAta24Data() {
  return importPreparedAtaData('24');
}

function importPreparedAtaData_(ata) {
  const ataValue = normalizeAtaKey_(ata);
  if (!ataValue) {
    throw new Error('ATA is required.');
  }

  setupProject_();

  const csvMap = getPreparedAtaCsvMap_(ataValue);
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
      mode: 'replace_ata',
      ata: ataValue
    });
  });

  return {
    ata: ataValue,
    imported: results,
    imported_at: nowIso_()
  };
}
