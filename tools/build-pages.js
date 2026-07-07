const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PAGES_BASE = '/hobby-hub/';

const APPS = [
  {
    id: 'hub',
    title: '趣味HUB',
    sourceDir: path.join(ROOT, 'gas'),
    outDir: DOCS,
    publicPath: PAGES_BASE,
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbxXGa_ahv1ZvjJ9-kbSqTJbdtY1NgrqJQu85LYERrBEi5QQnl1uwDMCIZ25zzYNMGG1/exec',
    bootstrap: {
      ok: true,
      data: {
        appName: '趣味HUB',
        setup: {},
        modules: []
      }
    },
    pwaMode: 'hub'
  },
  {
    id: 'study737',
    title: '737 Study Finder',
    sourceDir: path.join(ROOT, '737_Study_Finder', 'gas'),
    outDir: path.join(DOCS, '737-study-finder'),
    publicPath: PAGES_BASE + '737-study-finder/',
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbzPwkINDY--2PUYQg5xGoPDtkCLYvGoItobfEJocINxBFviRzcCrxb7Iu5lylirQ7tLOg/exec',
    bootstrap: {
      ok: true,
      data: {
        appName: '737 Study Finder',
        setup: {},
        preparedAtas: ['00', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '38', '47', '49', '5X', '7X']
      }
    },
    pwaMode: 'study'
  },
  {
    id: 'izakaya',
    title: '居酒屋Scout',
    sourceDir: path.join(ROOT, 'IzakayaScout', 'gas'),
    outDir: path.join(DOCS, 'izakaya-scout'),
    publicPath: PAGES_BASE + 'izakaya-scout/',
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbwzeUjS7KakeQJbJNE83WupMhVT9Qid2gWHh-9jw0hepywdAE5Y5RIgPEUcCnEFEOE/exec',
    bootstrap: {
      appName: '居酒屋Scout',
      setup: {},
      defaults: {
        GENRE_CODE: 'G001',
        MOOD: 'safe',
        WALK_MINUTES: '',
        SMOKING_PREFERENCE: '',
        AREA_TEXT: ''
      }
    },
    pwaMode: 'izakaya'
  },
  {
    id: 'lifeboard',
    title: 'LifeBoard',
    sourceDir: path.join(ROOT, 'LifeBoard', 'gas'),
    outDir: path.join(DOCS, 'lifeboard'),
    publicPath: PAGES_BASE + 'lifeboard/',
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbxgGdT-E3xm8XKNklnKwzPDxkE4kXHt-xh1n0eOlTST6APtbbZ4jOAJ_kw_BIGLbg_jxg/exec',
    bootstrap: {
      ok: true,
      data: {
        appName: 'LifeBoard',
        busRoutes: [],
        railRoutes: [],
        weatherLocations: [],
        garbageRules: []
      }
    },
    pwaMode: 'lifeboard'
  }
];

function main() {
  resetDir(DOCS);
  APPS.forEach(buildApp);
  writeSharedPwaFiles();
}

function buildApp(app) {
  ensureDir(app.outDir);
  const assetDir = path.join(app.outDir, 'assets');
  const cssDir = path.join(assetDir, 'css');
  const jsDir = path.join(assetDir, 'js');
  ensureDir(cssDir);
  ensureDir(jsDir);

  const css = stripWrapper(readSource(app, 'style.html'), 'style');
  const js = stripWrapper(readSource(app, 'script.html'), 'script');
  fs.writeFileSync(path.join(cssDir, 'app.css'), css, 'utf8');
  fs.writeFileSync(path.join(cssDir, 'pwa.css'), buildPwaCss(app), 'utf8');
  fs.writeFileSync(path.join(jsDir, 'gas-run-shim.js'), buildGasRunShim(app), 'utf8');
  fs.writeFileSync(path.join(jsDir, 'pwa-client.js'), buildPwaClient(app), 'utf8');
  fs.writeFileSync(path.join(jsDir, 'app.js'), js, 'utf8');

  let html = readSource(app, 'index.html');
  html = inlineIncludes(app, html);
  html = html.replace(/<base\s+target="_top">\s*/i, '');
  html = html.replace(/<\?!=\s*include\('style'\);\s*\?>/g, [
    '<link rel="stylesheet" href="./assets/css/app.css">',
    '<link rel="stylesheet" href="./assets/css/pwa.css">'
  ].join('\n    '));
  html = html.replace(/<\?!=\s*include\('script'\);\s*\?>/g, [
    '<script src="./assets/js/gas-run-shim.js"></script>',
    '<script src="./assets/js/app.js"></script>',
    '<script src="./assets/js/pwa-client.js"></script>'
  ].join('\n    '));
  html = html.replace(/data-bootstrap='\s*<\?=\s*bootstrapJson\s*;?\s*\?>'/g, "data-bootstrap='" + escapeAttr(JSON.stringify(app.bootstrap)) + "'");
  html = html.replace(/<\/head>/i, [
    '    <link rel="manifest" href="' + relativeToRoot(app, 'manifest.webmanifest') + '">',
    '    <meta name="theme-color" content="#15110e">',
    '    <meta name="apple-mobile-web-app-capable" content="yes">',
    '    <meta name="apple-mobile-web-app-title" content="' + escapeAttr(app.title) + '">',
    '  </head>'
  ].join('\n'));
  fs.writeFileSync(path.join(app.outDir, 'index.html'), html, 'utf8');
}

function inlineIncludes(app, html) {
  return html.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (match, name) => {
    if (name === 'style' || name === 'script') {
      return match;
    }
    return readSource(app, name + '.html').trim();
  });
}

function writeSharedPwaFiles() {
  fs.writeFileSync(path.join(DOCS, 'manifest.webmanifest'), JSON.stringify({
    name: '趣味HUB',
    short_name: '趣味HUB',
    start_url: PAGES_BASE,
    scope: PAGES_BASE,
    display: 'standalone',
    background_color: '#15110e',
    theme_color: '#15110e',
    icons: [
      { src: 'assets/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(DOCS, 'offline.html'), buildOfflineHtml(), 'utf8');
  fs.writeFileSync(path.join(DOCS, 'sw.js'), buildServiceWorker(), 'utf8');
  writePngPlaceholder(path.join(DOCS, 'assets', 'icons', 'icon-192.png'), 192);
  writePngPlaceholder(path.join(DOCS, 'assets', 'icons', 'icon-512.png'), 512);
}

function buildGasRunShim(app) {
  return `(() => {
  const GAS_ENDPOINT = ${JSON.stringify(app.gasEndpoint)};
  let requestSeq = 0;

  function encodeArgs(args) {
    const json = JSON.stringify(args || []);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
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
})();`;
}

function buildPwaClient(app) {
  return `(() => {
  document.documentElement.classList.add('is-pages-pwa', 'pwa-${app.pwaMode}');
  ${buildModeScript(app)}

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(${JSON.stringify(relativeToRoot(app, 'sw.js'))}).catch(() => {});
    });
  }

  window.addEventListener('offline', () => document.body.classList.add('is-offline'));
  window.addEventListener('online', () => document.body.classList.remove('is-offline'));
})();`;
}

function buildModeScript(app) {
  if (app.pwaMode === 'hub') {
    return `const pageTargets = {
    study737: './737-study-finder/',
    izakaya_scout: './izakaya-scout/',
    lifeboard: './lifeboard/'
  };
  if (typeof window.renderModules === 'function') {
    const originalRenderModules = window.renderModules;
    window.renderModules = (modules) => {
      originalRenderModules((modules || []).map((module) => {
        const target = pageTargets[String(module.module_id || '')];
        return target ? Object.assign({}, module, { target_url: target }) : module;
      }));
    };
    if (typeof window.loadModules === 'function') {
      window.loadModules();
    }
  }
  document.querySelectorAll('#setupButton, .admin-tools').forEach((element) => {
    element.hidden = true;
  });`;
  }
  if (app.pwaMode === 'study') {
    return `const promptPanel = document.querySelector('.prompt-panel');
  const adminTools = document.querySelector('.admin-tools');
  const studyShell = document.querySelector('.study-shell');
  if (promptPanel && studyShell) {
    const promptShell = document.createElement('section');
    promptShell.className = 'pwa-prompt-shell';
    promptShell.appendChild(promptPanel);
    studyShell.appendChild(promptShell);
  }
  document.querySelectorAll('#setupButton, .admin-tools, .answer-editor, .import-panel').forEach((element) => {
    element.hidden = true;
  });`;
  }
  return `document.querySelectorAll('#setupButton, .admin-tools').forEach((element) => {
    element.hidden = true;
  });`;
}

function buildPwaCss(app) {
  return `html.is-pages-pwa #setupButton,
html.is-pages-pwa .admin-tools,
[hidden] {
  display: none !important;
}

.pwa-prompt-shell {
  margin-top: 14px;
}

body.is-offline::after {
  content: "オフラインです。表示中の画面は開けますが、最新データの取得には通信が必要です。";
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 9999;
  padding: 10px 12px;
  border: 1px solid rgba(234, 211, 162, 0.6);
  border-radius: 6px;
  background: rgba(21, 17, 14, 0.96);
  color: #f8efe0;
  font: 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
}`;
}

function buildOfflineHtml() {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>趣味HUB Offline</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#15110e;color:#f8efe0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:520px;padding:28px}
      h1{margin:0 0 12px;font-size:28px}
      p{margin:0;color:#c3b39d;line-height:1.7}
      a{color:#ead3a2}
    </style>
  </head>
  <body>
    <main>
      <h1>通信が切れています</h1>
      <p>趣味HUBの入口は開けますが、GASから最新データを読むには通信が必要です。接続が戻ったら再読み込みしてね。</p>
      <p><a href="./">趣味HUBへ戻る</a></p>
    </main>
  </body>
</html>`;
}

function buildServiceWorker() {
  const cacheName = 'hobby-hub-pwa-' + Date.now();
  const urls = [
    PAGES_BASE,
    PAGES_BASE + 'index.html',
    PAGES_BASE + 'offline.html',
    PAGES_BASE + 'manifest.webmanifest',
    PAGES_BASE + 'assets/css/app.css',
    PAGES_BASE + 'assets/css/pwa.css',
    PAGES_BASE + 'assets/js/gas-run-shim.js',
    PAGES_BASE + 'assets/js/app.js',
    PAGES_BASE + 'assets/js/pwa-client.js',
    PAGES_BASE + '737-study-finder/index.html',
    PAGES_BASE + '737-study-finder/assets/css/app.css',
    PAGES_BASE + '737-study-finder/assets/css/pwa.css',
    PAGES_BASE + '737-study-finder/assets/js/gas-run-shim.js',
    PAGES_BASE + '737-study-finder/assets/js/app.js',
    PAGES_BASE + '737-study-finder/assets/js/pwa-client.js',
    PAGES_BASE + 'izakaya-scout/index.html',
    PAGES_BASE + 'izakaya-scout/assets/css/app.css',
    PAGES_BASE + 'izakaya-scout/assets/css/pwa.css',
    PAGES_BASE + 'izakaya-scout/assets/js/gas-run-shim.js',
    PAGES_BASE + 'izakaya-scout/assets/js/app.js',
    PAGES_BASE + 'izakaya-scout/assets/js/pwa-client.js',
    PAGES_BASE + 'lifeboard/index.html',
    PAGES_BASE + 'lifeboard/assets/css/app.css',
    PAGES_BASE + 'lifeboard/assets/css/pwa.css',
    PAGES_BASE + 'lifeboard/assets/js/gas-run-shim.js',
    PAGES_BASE + 'lifeboard/assets/js/app.js',
    PAGES_BASE + 'lifeboard/assets/js/pwa-client.js'
  ];
  return `const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_SHELL = ${JSON.stringify(urls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match(${JSON.stringify(PAGES_BASE + 'offline.html')});
      }
      return cached;
    }))
  );
});`;
}

function relativeToRoot(app, file) {
  return app.id === 'hub' ? './' + file : '../' + file;
}

function readSource(app, name) {
  return fs.readFileSync(path.join(app.sourceDir, name), 'utf8');
}

function stripWrapper(content, tagName) {
  return content
    .replace(new RegExp('^\\s*<' + tagName + '[^>]*>\\s*', 'i'), '')
    .replace(new RegExp('\\s*</' + tagName + '>\\s*$', 'i'), '');
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#039;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function writePngPlaceholder(filePath, size) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, createPng(size, size));
}

function createPng(width, height) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    const row = y * rowLength;
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const offset = row + 1 + x * 4;
      const inset = Math.min(x, y, width - x - 1, height - y - 1);
      const isBorder = inset < Math.max(4, Math.round(width * 0.04));
      raw[offset] = isBorder ? 234 : 21;
      raw[offset + 1] = isBorder ? 211 : 17;
      raw[offset + 2] = isBorder ? 162 : 14;
      raw[offset + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  return Buffer.concat([
    uint32(data.length),
    name,
    data,
    uint32(crc32(Buffer.concat([name, data])))
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

main();
