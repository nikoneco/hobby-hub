function doGet(e) {
  if (e && e.parameter && e.parameter.api) {
    return handleWebAppJsonpRequest_(e.parameter.api, e.parameter);
  }

  const template = HtmlService.createTemplateFromFile('index');
  template.bootstrapJson = JSON.stringify(getClientBootstrap_());
  return template
    .evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  const action = e && e.parameter ? String(e.parameter.action || '') : '';
  if (action === 'importBusSnapshot') {
    return handleBusSnapshotImportPost_(e);
  }
  if (action === 'importBusTimetable') {
    return handleBusTimetableImportPost_(e);
  }
  if (action === 'importWeatherSnapshot') {
    return handleWeatherSnapshotImportPost_(e);
  }
  return handleCalendarImportPost_(e);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getClientBootstrap_() {
  return safeRun_('getClientBootstrap_', function () {
    return {
      appName: CONFIG.APP_NAME,
      busRoutes: getBusRoutes_(),
      railRoutes: getRailRoutes_(),
      weatherLocations: getWeatherLocations_(),
      garbageRules: getGarbageRules_()
    };
  });
}

function apiGetLifeBoardData() {
  return safeRun_('apiGetLifeBoardData', function () {
    return {
      bus: getBusSnapshot_(),
      rail: getRailSnapshot_(),
      weather: getWeatherSnapshot_(),
      garbage: getGarbageSnapshot_(),
      calendar: getCalendarSnapshot_()
    };
  });
}

function safeRun_(label, callback) {
  try {
    return {
      ok: true,
      data: callback()
    };
  } catch (error) {
    console.error(label + ': ' + (error && error.stack ? error.stack : error));
    return {
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error)
      }
    };
  }
}

function formatJapaneseDateText_(date) {
  const dateText = Utilities.formatDate(date, CONFIG.TIMEZONE, 'M/d');
  const weekdayNumber = Number(Utilities.formatDate(date, CONFIG.TIMEZONE, 'u')) % 7;
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return dateText + '(' + weekdays[weekdayNumber] + ')';
}

function handleWebAppJsonpRequest_(apiName, params) {
  const callback = normalizeWebAppJsonpCallback_(params && params.callback);
  const args = decodeWebAppJsonpArgs_(params && params.argsB64);
  const response = dispatchWebAppJsonpApi_(apiName, args);
  const body = callback + '(' + JSON.stringify(response) + ');';
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function dispatchWebAppJsonpApi_(apiName, args) {
  const name = String(apiName || '').trim();
  switch (name) {
    case 'bootstrap':
      return getClientBootstrap_();
    case 'lifeBoardData':
    case 'apiGetLifeBoardData':
      return apiGetLifeBoardData();
    default:
      return {
        ok: false,
        error: {
          message: 'Unknown API: ' + name
        }
      };
  }
}

function normalizeWebAppJsonpCallback_(callback) {
  const value = String(callback || '').trim();
  if (/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(value)) {
    return value;
  }
  throw new Error('Invalid JSONP callback.');
}

function decodeWebAppJsonpArgs_(argsB64) {
  if (!argsB64) {
    return [];
  }
  const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(String(argsB64))).getDataAsString('UTF-8');
  const parsed = JSON.parse(json);
  return Array.isArray(parsed) ? parsed : [];
}
