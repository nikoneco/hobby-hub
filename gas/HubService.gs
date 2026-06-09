function getModules() {
  const id = getScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_MASTER_ID);
  if (!id) {
    return buildDefaultModules_();
  }

  const spreadsheet = openMasterSpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'hub_modules');
  return applyDefaultModuleConfig_(readObjects_(sheet))
    .filter(function (module) {
      return module.enabled === true || module.enabled === 'TRUE' || module.enabled === 'true';
    })
    .sort(function (a, b) {
      return Number(a.display_order || 0) - Number(b.display_order || 0);
    });
}

function applyDefaultModuleConfig_(modules) {
  const defaults = buildDefaultModules_();
  const defaultsById = defaults.reduce(function (map, module) {
    map[String(module.module_id)] = module;
    return map;
  }, {});
  const normalizedModules = modules.map(function (module) {
    const defaultModule = defaultsById[String(module.module_id)];
    if (!defaultModule) {
      return module;
    }
    return Object.assign({}, module, defaultModule, {
      enabled: module.enabled
    });
  });

  const existingIds = modules.reduce(function (map, module) {
    map[String(module.module_id)] = true;
    return map;
  }, {});
  defaults.forEach(function (module) {
    if (!existingIds[module.module_id]) {
      normalizedModules.push(module);
    }
  });
  return normalizedModules;
}

function buildDefaultModules_() {
  return [
    buildStudyModule_(),
    buildRoomLibraryModule_()
  ];
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

function buildRoomLibraryModule_() {
  const app = CONFIG.APPS.ROOM_LIBRARY;
  return {
    module_id: app.MODULE_ID,
    module_name: app.NAME,
    description: app.DESCRIPTION,
    enabled: true,
    display_order: app.DISPLAY_ORDER,
    icon: app.ICON,
    target_url: app.WEB_APP_URL,
    app_folder_id: '',
    script_id: '',
    db_spreadsheet_id: ''
  };
}
