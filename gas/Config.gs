const CONFIG = {
  APP_NAME: '趣味HUB',
  SPREADSHEETS: {
    HOBBY_HUB_MASTER_TITLE: 'HobbyHub_Master'
  },
  PROPERTIES: {
    HOBBY_HUB_MASTER_ID: 'HOBBY_HUB_MASTER_ID',
    HOBBY_HUB_FOLDER_ID: 'HOBBY_HUB_FOLDER_ID',
    STUDY737_FOLDER_ID: 'STUDY737_FOLDER_ID',
    STUDY737_SCRIPT_ID: 'STUDY737_SCRIPT_ID',
    STUDY737_DB_ID: 'STUDY737_DB_ID',
    IZAKAYA_SCOUT_FOLDER_ID: 'IZAKAYA_SCOUT_FOLDER_ID',
    IZAKAYA_SCOUT_SCRIPT_ID: 'IZAKAYA_SCOUT_SCRIPT_ID'
  },
  APPS: {
    STUDY737: {
      MODULE_ID: 'study737',
      NAME: '737 Study Finder',
      DESCRIPTION: '737-800の学習ノートと問題検索',
      WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzPwkINDY--2PUYQg5xGoPDtkCLYvGoItobfEJocINxBFviRzcCrxb7Iu5lylirQ7tLOg/exec'
    },
    ROOM_LIBRARY: {
      MODULE_ID: 'room_library',
      NAME: '趣味部屋図書館',
      DESCRIPTION: '本と資料を眺める趣味部屋の図書館',
      WEB_APP_URL: 'https://nikoneco.github.io/hobby-room-library-PWA/',
      ICON: 'library',
      DISPLAY_ORDER: 2
    },
    LIFEBOARD: {
      MODULE_ID: 'lifeboard',
      NAME: 'LifeBoard',
      DESCRIPTION: '朝のバス、天気、電車状況をまとめて確認',
      WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxgGdT-E3xm8XKNklnKwzPDxkE4kXHt-xh1n0eOlTST6APtbbZ4jOAJ_kw_BIGLbg_jxg/exec',
      ICON: 'morning',
      DISPLAY_ORDER: 3
    },
    IZAKAYA_SCOUT: {
      MODULE_ID: 'izakaya_scout',
      NAME: '居酒屋Scout',
      DESCRIPTION: '場所と気分から、今夜の居酒屋候補を3つに絞る',
      WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwzeUjS7KakeQJbJNE83WupMhVT9Qid2gWHh-9jw0hepywdAE5Y5RIgPEUcCnEFEOE/exec',
      ICON: 'map',
      DISPLAY_ORDER: 4
    },
    CELESTIFRAME: {
      MODULE_ID: 'celestiframe',
      NAME: 'CelestiFrame',
      DESCRIPTION: '月と星の位置を地図で確認する撮影支援アプリ',
      WEB_APP_URL: 'https://nikoneco.github.io/CelestiFrame/',
      ICON: 'celestial',
      DISPLAY_ORDER: 5
    }
  }
};

function getConfig() {
  return JSON.parse(JSON.stringify(CONFIG));
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getRequiredScriptProperty_(key) {
  const value = getScriptProperty_(key);
  if (!value) {
    throw new Error('Script Property is not configured: ' + key);
  }
  return value;
}

function setScriptProperty_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function assertPrivateMutationAllowed_() {
  const enabled = String(getScriptProperty_('ALLOW_PRIVATE_MUTATIONS') || '').toLowerCase();
  if (enabled !== 'true') {
    throw new Error('Private mutation APIs are disabled for the public web app.');
  }
}
