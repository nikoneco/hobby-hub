const CONFIG = {
  APP_NAME: '趣味HUB',
  DRIVE: {
    APP_DEVELOPMENT_FOLDER_ID: '1BuqpoZrJ7Gs5IRNN6MYMi8FPbAdyC_Gl',
    HOBBY_HUB_FOLDER_ID: '1SwPwcWiMtferxSYN_22EXbescxpTOukQ',
    STUDY737_FOLDER_ID: '1173fD2V7ftdfXSdo1HAeLIaiKQL5H4pX'
  },
  SPREADSHEETS: {
    HOBBY_HUB_MASTER_TITLE: 'HobbyHub_Master',
    STUDY737_DB_TITLE: 'Study737_DB'
  },
  PROPERTIES: {
    HOBBY_HUB_MASTER_ID: 'HOBBY_HUB_MASTER_ID',
    STUDY737_DB_ID: 'STUDY737_DB_ID',
    HOBBY_HUB_FOLDER_ID: 'HOBBY_HUB_FOLDER_ID',
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
