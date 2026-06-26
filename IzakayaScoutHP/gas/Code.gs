function doGet() {
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
  return {
    appName: CONFIG.APP_NAME,
    setup: getSetupStatus_(),
    defaults: CONFIG.DEFAULTS
  };
}

function apiSearchShops(payload) {
  return safeRun_('apiSearchShops', function () {
    return searchHotPepperShops_(payload || {});
  });
}

function apiGetSetupStatus() {
  return safeRun_('apiGetSetupStatus', getSetupStatus_);
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
