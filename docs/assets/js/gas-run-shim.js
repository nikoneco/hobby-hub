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
      },
      {
        "module_id": "celestiframe",
        "module_name": "CelestiFrame",
        "description": "月と星の位置を地図で確認する撮影支援アプリ",
        "enabled": true,
        "display_order": 5,
        "icon": "celestial",
        "target_url": "https://nikoneco.github.io/CelestiFrame/"
      },
      {
        "module_id": "jack_load",
        "module_name": "JACK LOAD",
        "description": "航空機JACK UP時の各JACK荷重とLimit判定を計算",
        "enabled": true,
        "display_order": 6,
        "icon": "jack",
        "target_url": "https://script.google.com/macros/s/AKfycbzO_TsuxIRSqSn5a-YOGyOPDRgaJNHZRDr_8GZpGCOMhYkzLg5QIa3kcli8ETOx1fmEKQ/exec"
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
      },
      {
        "module_id": "celestiframe",
        "module_name": "CelestiFrame",
        "description": "月と星の位置を地図で確認する撮影支援アプリ",
        "enabled": true,
        "display_order": 5,
        "icon": "celestial",
        "target_url": "https://nikoneco.github.io/CelestiFrame/"
      },
      {
        "module_id": "jack_load",
        "module_name": "JACK LOAD",
        "description": "航空機JACK UP時の各JACK荷重とLimit判定を計算",
        "enabled": true,
        "display_order": 6,
        "icon": "jack",
        "target_url": "https://script.google.com/macros/s/AKfycbzO_TsuxIRSqSn5a-YOGyOPDRgaJNHZRDr_8GZpGCOMhYkzLg5QIa3kcli8ETOx1fmEKQ/exec"
      }
    ]
  }
};
  const JSONP_RETRY_DELAYS = [0];
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
    let activeScript = null;
    let attemptTimeout = 0;
    let retryTimer = 0;
    let attempt = 0;
    let settled = false;

    function clearAttempt() {
      window.clearTimeout(attemptTimeout);
      attemptTimeout = 0;
      if (activeScript && activeScript.parentNode) activeScript.parentNode.removeChild(activeScript);
      activeScript = null;
    }

    function cleanup(keepLateCallback) {
      clearAttempt();
      window.clearTimeout(retryTimer);
      if (keepLateCallback) {
        window[callbackName] = () => {};
        window.setTimeout(() => { delete window[callbackName]; }, 5 * 60 * 1000);
      } else {
        delete window[callbackName];
      }
    }

    window[callbackName] = (response) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (successHandler) successHandler(response);
    };

    function failAttempt(errorType) {
      if (settled) return;
      clearAttempt();
      if (attempt < JSONP_RETRY_DELAYS.length) {
        retryTimer = window.setTimeout(loadAttempt, JSONP_RETRY_DELAYS[attempt]);
        return;
      }
      settled = true;
      cleanup(errorType === 'timeout');
      if (failureHandler) failureHandler(new Error('GAS API ' + errorType + ': ' + method));
    }

    function loadAttempt() {
      if (settled) return;
      const attemptNumber = ++attempt;
      const script = document.createElement('script');
      activeScript = script;
      const url = new URL(GAS_ENDPOINT);
      url.searchParams.set('api', method);
      url.searchParams.set('callback', callbackName);
      url.searchParams.set('argsB64', encodeArgs(args));
      url.searchParams.set('_attempt', String(attemptNumber));
      url.searchParams.set('_ts', String(Date.now()));
      script.onerror = () => {
        if (activeScript !== script) return;
        failAttempt('load failed');
      };
      script.src = url.toString();
      document.head.appendChild(script);
      attemptTimeout = window.setTimeout(() => {
        if (activeScript !== script) return;
        failAttempt('timeout');
      }, 30000);
    }

    loadAttempt();
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