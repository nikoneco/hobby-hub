function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'setup') {
    return ContentService
      .createTextOutput(JSON.stringify(setupProject()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.action === 'importAta24') {
    return ContentService
      .createTextOutput(JSON.stringify(importPreparedAta24Data()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.action === 'importAta') {
    return ContentService
      .createTextOutput(JSON.stringify(importPreparedAtaData(e.parameter.ata || '24')))
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
      preparedAtas: typeof getPreparedAtaList_ === 'function' ? getPreparedAtaList_() : ['24']
    };
  });
}

function setupProject() {
  return safeRun_('setupProject', function () {
    return setupProject_();
  });
}

function apiGetQuestions(filters) {
  return safeRun_('apiGetQuestions', function () {
    return getQuestions(filters || {});
  });
}

function apiGetQuestionsBundle(filters) {
  return safeRun_('apiGetQuestionsBundle', function () {
    return getQuestionsBundle(filters || {});
  });
}

function apiGetQuestionDetail(questionId) {
  return safeRun_('apiGetQuestionDetail', function () {
    return getQuestionDetail(questionId);
  });
}

function apiGetRandomQuestionDetail(filters) {
  return safeRun_('apiGetRandomQuestionDetail', function () {
    return getRandomQuestionDetail(filters || {});
  });
}

function apiBuildReviewPrompt(questionId) {
  return safeRun_('apiBuildReviewPrompt', function () {
    return buildReviewPrompt(questionId);
  });
}

function apiSaveAnswerNote(payload) {
  return safeRun_('apiSaveAnswerNote', function () {
    return saveAnswerNote(payload || {});
  });
}

function apiUpdateAnswerNote(noteId, payload) {
  return safeRun_('apiUpdateAnswerNote', function () {
    return updateAnswerNote(noteId, payload || {});
  });
}

function apiSaveConfirmedAnswer(payload) {
  return safeRun_('apiSaveConfirmedAnswer', function () {
    return saveConfirmedAnswer(payload || {});
  });
}

function apiImportCsv(payload) {
  return safeRun_('apiImportCsv', function () {
    return importCsvText(payload || {});
  });
}

function apiImportPreparedAta24Data() {
  return importPreparedAta24Data();
}

function apiImportPreparedAtaData(ata) {
  return importPreparedAtaData(ata || '24');
}
