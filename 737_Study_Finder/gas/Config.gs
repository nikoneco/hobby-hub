const CONFIG = {
  APP_NAME: '737 Study Finder',
  DRIVE: {
    STUDY737_FOLDER_ID: '1173fD2V7ftdfXSdo1HAeLIaiKQL5H4pX'
  },
  SPREADSHEETS: {
    STUDY737_DB_TITLE: 'Study737_DB'
  },
  PROPERTIES: {
    STUDY737_DB_ID: 'STUDY737_DB_ID',
    STUDY737_FOLDER_ID: 'STUDY737_FOLDER_ID'
  },
  STATUS: {
    UNLINKED: 'unlinked',
    CANDIDATE_READY: 'candidate_ready',
    ANSWER_NOTE_READY: 'answer_note_ready',
    CONFIRMED: 'confirmed',
    HOLD: 'hold',
    NEEDS_REVIEW: 'needs_review'
  }
};

function getConfig() {
  return JSON.parse(JSON.stringify(CONFIG));
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setScriptProperty_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}
