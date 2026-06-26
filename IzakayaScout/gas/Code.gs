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
    mapsSearchBaseUrl: CONFIG.MAPS.SEARCH_BASE_URL,
    defaults: CONFIG.DEFAULTS
  };
}
