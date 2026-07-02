function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'setupCalendarImportToken') {
    return handleCalendarTokenSetupGet_(e);
  }
  const template = HtmlService.createTemplateFromFile('index');
  template.bootstrapJson = JSON.stringify(getClientBootstrap_());
  return template
    .evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
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
