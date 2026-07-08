function openLifeBoardSpreadsheet_() {
  return SpreadsheetApp.openById(getRequiredScriptProperty_(CONFIG.PROPERTIES.SPREADSHEET_ID));
}

function getSheetByName_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }
  return sheet;
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }
  const headers = values[0].map(function (header) {
    return String(header || '').trim();
  });
  return values.slice(1).map(function (row) {
    return headers.reduce(function (record, header, index) {
      if (header) {
        record[header] = row[index];
      }
      return record;
    }, {});
  });
}
