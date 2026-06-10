const CONFIG = {
  APP_NAME: '趣味HUB',
  DRIVE: {
    APP_DEVELOPMENT_FOLDER_ID: '1BuqpoZrJ7Gs5IRNN6MYMi8FPbAdyC_Gl',
    HOBBY_HUB_FOLDER_ID: '1SwPwcWiMtferxSYN_22EXbescxpTOukQ'
  },
  SPREADSHEETS: {
    HOBBY_HUB_MASTER_TITLE: 'HobbyHub_Master'
  },
  PROPERTIES: {
    HOBBY_HUB_MASTER_ID: 'HOBBY_HUB_MASTER_ID',
    HOBBY_HUB_FOLDER_ID: 'HOBBY_HUB_FOLDER_ID'
  },
  APPS: {
    STUDY737: {
      MODULE_ID: 'study737',
      NAME: '737 Study Finder',
      DESCRIPTION: '737-800の学習ノートと問題検索',
      WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzPwkINDY--2PUYQg5xGoPDtkCLYvGoItobfEJocINxBFviRzcCrxb7Iu5lylirQ7tLOg/exec',
      FOLDER_ID: '1173fD2V7ftdfXSdo1HAeLIaiKQL5H4pX',
      SCRIPT_ID: '1qOkLEui2ZCfWIAEsW7AW7v4ZwZFl8K1i6UtWG1_LaayRR4eFf6DLM1K-',
      DB_SPREADSHEET_ID: '11YODNUHgln3dL_wADeR7va4EfAltIzY68lQxNGvBpto'
    },
    ROOM_LIBRARY: {
      MODULE_ID: 'room_library',
      NAME: '趣味部屋図書館',
      DESCRIPTION: '本と資料を眺める趣味部屋の図書館',
      WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbza7tfhqVYgNv_9N1WGj6hlE_8dBaMZCwuBuQKa4yfDrSeFODZTL63GE4R3g27eQAb_/exec',
      ICON: 'library',
      DISPLAY_ORDER: 2
    }
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
