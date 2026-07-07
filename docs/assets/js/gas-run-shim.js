(() => {
  const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxXGa_ahv1ZvjJ9-kbSqTJbdtY1NgrqJQu85LYERrBEi5QQnl1uwDMCIZ25zzYNMGG1/exec";
  let requestSeq = 0;

  function encodeArgs(args) {
    const json = JSON.stringify(args || []);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function callJsonp(method, args, successHandler, failureHandler) {
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