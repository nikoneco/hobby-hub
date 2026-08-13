(() => {
  const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxgGdT-E3xm8XKNklnKwzPDxkE4kXHt-xh1n0eOlTST6APtbbZ4jOAJ_kw_BIGLbg_jxg/exec";
  const STATIC_RESPONSES = {};
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