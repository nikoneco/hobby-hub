(() => {
  document.documentElement.classList.add('is-pages-pwa', 'pwa-hub');
  const staticModules = [
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
  }
];
  window.hobbyHubOpenModuleUrl = (url) => {
    window.location.assign(url);
  };
  const pageTargets = {
    study737: './737-study-finder/',
    room_library: './room-library/',
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
    window.renderModules(staticModules);
  }
  document.querySelectorAll('#setupButton, .admin-tools').forEach((element) => {
    element.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  window.addEventListener('offline', () => document.body.classList.add('is-offline'));
  window.addEventListener('online', () => document.body.classList.remove('is-offline'));
})();