function getModules() {
  const id = getScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_MASTER_ID);
  if (!id) {
    return [
      {
        module_id: 'study737',
        module_name: '737 Study Finder',
        description: '初期設定後に利用できます',
        enabled: true,
        display_order: 1,
        icon: 'book-open',
        route: 'study737',
        db_spreadsheet_id: ''
      }
    ];
  }
  const spreadsheet = openMasterSpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'hub_modules');
  return readObjects_(sheet)
    .filter(function (module) { return module.enabled === true || module.enabled === 'TRUE' || module.enabled === 'true'; })
    .sort(function (a, b) { return Number(a.display_order) - Number(b.display_order); });
}
