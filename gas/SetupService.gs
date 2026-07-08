const MASTER_SCHEMA = {
  hub_modules: [
    'module_id',
    'module_name',
    'description',
    'enabled',
    'display_order',
    'icon',
    'target_url',
    'app_folder_id',
    'script_id',
    'db_spreadsheet_id',
    'created_at',
    'updated_at'
  ],
  hub_settings: ['key', 'value', 'note', 'updated_at']
};

function getSetupStatus() {
  return {
    hobbyHubMasterId: getScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_MASTER_ID) || '',
    hobbyHubFolderId: getScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_FOLDER_ID) || ''
  };
}

function setupProject_() {
  const folderId = getRequiredScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_FOLDER_ID);

  const master = ensureSpreadsheetInFolder_(
    folderId,
    CONFIG.SPREADSHEETS.HOBBY_HUB_MASTER_TITLE
  );
  setScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_MASTER_ID, master.getId());

  Object.keys(MASTER_SCHEMA).forEach(function (sheetName) {
    ensureSheet_(master, sheetName, MASTER_SCHEMA[sheetName]);
  });
  removeBlankDefaultSheet_(master);
  seedMaster_(master);

  return {
    hobbyHubMaster: {
      id: master.getId(),
      url: master.getUrl()
    }
  };
}

function ensureSpreadsheetInFolder_(folderId, title) {
  const folder = DriveApp.getFolderById(folderId);
  const existing = folder.getFilesByName(title);
  while (existing.hasNext()) {
    const file = existing.next();
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.openById(file.getId());
    }
  }

  const spreadsheet = SpreadsheetApp.create(title);
  const file = DriveApp.getFileById(spreadsheet.getId());
  file.moveTo(folder);
  return spreadsheet;
}

function removeBlankDefaultSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('シート1') || spreadsheet.getSheetByName('Sheet1');
  if (!sheet || spreadsheet.getSheets().length <= 1) {
    return;
  }
  const values = sheet.getDataRange().getValues();
  const isBlank = values.length === 1 && values[0].length === 1 && values[0][0] === '';
  if (isBlank) {
    spreadsheet.deleteSheet(sheet);
  }
}

function seedMaster_(spreadsheet) {
  const sheet = getSheet_(spreadsheet, 'hub_modules');
  buildDefaultModules_().forEach(function (module) {
    const patch = {
      module_name: module.module_name,
      description: module.description,
      enabled: module.enabled,
      display_order: module.display_order,
      icon: module.icon,
      target_url: module.target_url,
      app_folder_id: module.app_folder_id,
      script_id: module.script_id,
      db_spreadsheet_id: module.db_spreadsheet_id,
      updated_at: nowIso_()
    };

    if (updateObjectById_(sheet, 'module_id', module.module_id, patch)) {
      return;
    }

    appendObject_(sheet, MASTER_SCHEMA.hub_modules, Object.assign({}, module, {
      created_at: nowIso_(),
      updated_at: nowIso_()
    }));
  });
}
