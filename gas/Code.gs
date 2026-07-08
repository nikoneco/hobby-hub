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

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getClientBootstrap_() {
  return safeRun_('getClientBootstrap_', function () {
    return {
      appName: CONFIG.APP_NAME,
      setup: getSetupStatus(),
      modules: getModules()
    };
  });
}

function setupProject() {
  return safeRun_('setupProject', function () {
    assertPrivateMutationAllowed_();
    return setupProject_();
  });
}

function apiGetModules() {
  return safeRun_('apiGetModules', getModules);
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
  switch (String(apiName || '').trim()) {
    case 'bootstrap':
      return getClientBootstrap_();
    case 'modules':
    case 'apiGetModules':
      return apiGetModules();
    default:
      return {
        ok: false,
        error: {
          message: 'Unknown API: ' + apiName
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
