(() => {
  const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxXGa_ahv1ZvjJ9-kbSqTJbdtY1NgrqJQu85LYERrBEi5QQnl1uwDMCIZ25zzYNMGG1/exec";
  const STATIC_RESPONSES = {
  "modules": {
    "ok": true,
    "data": [
      {
        "module_id": "study737",
        "module_name": "737 Study Finder",
        "description": "737-800の学習ノートと問題検索",
        "enabled": true,
        "display_order": 1,
        "icon": "book-open",
        "target_url": "./737-study-finder/"
      },
      {
        "module_id": "room_library",
        "module_name": "趣味部屋図書館",
        "description": "本と資料を眺める趣味部屋の図書館",
        "enabled": true,
        "display_order": 2,
        "icon": "library",
        "target_url": "https://nikoneco.github.io/hobby-room-library-PWA/"
      },
      {
        "module_id": "lifeboard",
        "module_name": "LifeBoard",
        "description": "朝のバス、天気、電車状況をまとめて確認",
        "enabled": true,
        "display_order": 3,
        "icon": "morning",
        "target_url": "./lifeboard/"
      },
      {
        "module_id": "izakaya_scout",
        "module_name": "居酒屋Scout",
        "description": "場所と気分から、今夜の居酒屋候補を3つに絞る",
        "enabled": true,
        "display_order": 4,
        "icon": "map",
        "target_url": "./izakaya-scout/"
      }
    ]
  },
  "apiGetModules": {
    "ok": true,
    "data": [
      {
        "module_id": "study737",
        "module_name": "737 Study Finder",
        "description": "737-800の学習ノートと問題検索",
        "enabled": true,
        "display_order": 1,
        "icon": "book-open",
        "target_url": "./737-study-finder/"
      },
      {
        "module_id": "room_library",
        "module_name": "趣味部屋図書館",
        "description": "本と資料を眺める趣味部屋の図書館",
        "enabled": true,
        "display_order": 2,
        "icon": "library",
        "target_url": "https://nikoneco.github.io/hobby-room-library-PWA/"
      },
      {
        "module_id": "lifeboard",
        "module_name": "LifeBoard",
        "description": "朝のバス、天気、電車状況をまとめて確認",
        "enabled": true,
        "display_order": 3,
        "icon": "morning",
        "target_url": "./lifeboard/"
      },
      {
        "module_id": "izakaya_scout",
        "module_name": "居酒屋Scout",
        "description": "場所と気分から、今夜の居酒屋候補を3つに絞る",
        "enabled": true,
        "display_order": 4,
        "icon": "map",
        "target_url": "./izakaya-scout/"
      }
    ]
  }
};
  let requestSeq = 0;

  function encodeArgs(args) {
    const json = JSON.stringify(args || []);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function callJsonp(method, args, successHandler, failureHandler) {
    if (Object.prototype.hasOwnProperty.call(STATIC_RESPONSES, method)) {
      window.setTimeout(() => {
        if (successHandler) successHandler(STATIC_RESPONSES[method]);
      }, 0);
      return;
    }

    const callbackName = '__gasJsonp_' + Date.now() + '_' + (++requestSeq);
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      cleanup();
      if (failureHandler) failureHandler(new Error('GAS API timeout: ' + method));
    }, 30000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (response) => {
      cleanup();
      if (successHandler) successHandler(response);
    };

    const url = new URL(GAS_ENDPOINT);
    url.searchParams.set('api', method);
    url.searchParams.set('callback', callbackName);
    url.searchParams.set('argsB64', encodeArgs(args));
    script.onerror = () => {
      cleanup();
      if (failureHandler) failureHandler(new Error('GAS API load failed: ' + method));
    };
    script.src = url.toString();
    document.head.appendChild(script);
  }

  function makeRunner(state) {
    return new Proxy({}, {
      get(_target, property) {
        if (property === 'withSuccessHandler') {
          return (handler) => makeRunner(Object.assign({}, state, { successHandler: handler }));
        }
        if (property === 'withFailureHandler') {
          return (handler) => makeRunner(Object.assign({}, state, { failureHandler: handler }));
        }
        return (...args) => callJsonp(String(property), args, state.successHandler, state.failureHandler);
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner({});
})();