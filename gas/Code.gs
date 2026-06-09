function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'setup') {
    return ContentService
      .createTextOutput(JSON.stringify(setupProject()))
      .setMimeType(ContentService.MimeType.JSON);
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
    return setupProject_();
  });
}

function apiGetModules() {
  return safeRun_('apiGetModules', getModules);
}

function apiGetQuestions(filters) {
  return safeRun_('apiGetQuestions', function () {
    return getQuestions(filters || {});
  });
}

function apiGetQuestionDetail(questionId) {
  return safeRun_('apiGetQuestionDetail', function () {
    return getQuestionDetail(questionId);
  });
}

function apiBuildReviewPrompt(questionId) {
  return safeRun_('apiBuildReviewPrompt', function () {
    return buildReviewPrompt(questionId);
  });
}
