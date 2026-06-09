function getModules() {
  const id = getScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_MASTER_ID);
  if (!id) {
    return [buildStudyModule_()];
  }

  const spreadsheet = openMasterSpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'hub_modules');
  return readObjects_(sheet)
    .filter(function (module) {
      return module.enabled === true || module.enabled === 'TRUE' || module.enabled === 'true';
    })
    .sort(function (a, b) {
      return Number(a.display_order || 0) - Number(b.display_order || 0);
    });
}

function buildStudyModule_() {
  const app = CONFIG.APPS.STUDY737;
  return {
    module_id: app.MODULE_ID,
    module_name: app.NAME,
    description: app.DESCRIPTION,
    enabled: true,
    display_order: 1,
    icon: 'book-open',
    target_url: app.WEB_APP_URL,
    app_folder_id: app.FOLDER_ID,
    script_id: app.SCRIPT_ID,
    db_spreadsheet_id: app.DB_SPREADSHEET_ID
  };
}
