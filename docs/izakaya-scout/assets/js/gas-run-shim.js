(() => {
  const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwzeUjS7KakeQJbJNE83WupMhVT9Qid2gWHh-9jw0hepywdAE5Y5RIgPEUcCnEFEOE/exec";
  const STATIC_RESPONSES = {};
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
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup(true);
      if (failureHandler) failureHandler(new Error('GAS API timeout: ' + method));
    }, 30000);

    function cleanup(keepLateCallback) {
      window.clearTimeout(timeout);
      if (keepLateCallback) {
        window[callbackName] = () => {};
        window.setTimeout(() => { delete window[callbackName]; }, 5 * 60 * 1000);
      } else {
        delete window[callbackName];
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (response) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (successHandler) successHandler(response);
    };

    const url = new URL(GAS_ENDPOINT);
    url.searchParams.set('api', method);
    url.searchParams.set('callback', callbackName);
    url.searchParams.set('argsB64', encodeArgs(args));
    script.onerror = () => {
      if (settled) return;
      settled = true;
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