const app = document.getElementById('app');
  const bootstrap = JSON.parse(app.dataset.bootstrap || '{}');
  const CATEGORIES = [
    { id: 'all', label: 'すべて' },
    { id: 'hobby', label: '趣味' },
    { id: 'daily', label: '日常' },
    { id: 'aviation', label: '航空' },
    { id: 'game', label: 'ゲーム' }
  ];
  // Existing GAS module rows need no schema migration. New rows can provide
  // category and short_description directly; this metadata fills older rows.
  const MODULE_METADATA = {
    study737: { category: 'aviation', shortDescription: '737-800の学習ノート' },
    room_library: { category: 'hobby', shortDescription: '本と資料のコレクション' },
    lifeboard: { category: 'daily', shortDescription: '今日の暮らしをひと目で' },
    izakaya_scout: { category: 'daily', shortDescription: '今夜のお店を探す' },
    celestiframe: { category: 'hobby', shortDescription: '月と星を見に行く' },
    jack_load: { category: 'aviation', shortDescription: 'JACK荷重とLimit判定' },
    sudoku: { category: 'game', shortDescription: '数字で遊ぶひと休み' }
  };
  const RECENT_STORAGE_KEY = 'hobbyHub.recentApps.v1';
  let currentModules = [];
  let selectedCategory = 'all';
  let recentHistory = readRecentHistory();

  function unwrap(response) {
    if (!response || !response.ok) {
      const message = response && response.error ? response.error.message : 'Unknown error';
      throw new Error(message);
    }
    return response.data;
  }

  function renderModules(modules) {
    currentModules = (Array.isArray(modules) ? modules : [])
      .filter((module) => module && typeof module === 'object' &&
        (module.enabled == null || module.enabled === true ||
         module.enabled === 'TRUE' || module.enabled === 'true'))
      .slice()
      .sort((a, b) => moduleOrder(a) - moduleOrder(b));
    renderFilteredModules();
    renderRecentModules();
  }

  function moduleOrder(module) {
    const order = Number(module.display_order || 0);
    return Number.isFinite(order) ? order : 0;
  }

  function getModuleCategory(module) {
    const metadata = MODULE_METADATA[String(module.module_id || '')] || {};
    return String(module.category || metadata.category || '');
  }

  function categoryLabel(category) {
    const definition = CATEGORIES.find((item) => item.id === category);
    return definition ? definition.label : '';
  }

  function renderCategoryFilters() {
    const root = document.getElementById('categoryFilters');
    CATEGORIES.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-button';
      button.dataset.category = category.id;
      button.textContent = category.label;
      button.setAttribute('aria-pressed', String(category.id === selectedCategory));
      button.setAttribute('aria-controls', 'modules');
      button.addEventListener('click', () => {
        selectedCategory = category.id;
        root.querySelectorAll('button').forEach((item) => {
          item.setAttribute('aria-pressed', String(item.dataset.category === selectedCategory));
        });
        renderFilteredModules();
      });
      root.appendChild(button);
    });
  }

  function renderFilteredModules() {
    const root = document.getElementById('modules');
    root.innerHTML = '';
    root.className = 'module-grid';
    const modules = currentModules.filter((module) =>
      selectedCategory === 'all' || getModuleCategory(module) === selectedCategory);
    document.getElementById('moduleCount').textContent = modules.length + '件';
    if (!modules.length) {
      root.textContent = currentModules.length
        ? 'このカテゴリには、まだアプリがありません。'
        : '登録済みのアプリがありません。初期設定を実行してね。';
      root.className = 'muted';
      return;
    }
    modules.forEach((module) => root.appendChild(createModuleButton(module, false)));
  }

  function createModuleButton(module, recent) {
    const button = document.createElement('button');
    const hasUrl = Boolean(module.target_url);
    const name = String(module.module_name || 'アプリ');
    const description = String(module.description || '');
    const metadata = MODULE_METADATA[String(module.module_id || '')] || {};
    const shortDescription = module.short_description || metadata.shortDescription || description;
    button.className = recent ? 'recent-card' : 'module-card';
    button.disabled = !hasUrl;
    button.type = 'button';
    button.dataset.moduleId = String(module.module_id || '');
    button.setAttribute('aria-label', name + (hasUrl ? 'を開く' : '（WebアプリURL未設定）') + (description ? '。' + description : ''));
    button.title = name + (description ? '\n' + description : '');
    const icon = '<span class="module-icon" aria-hidden="true">' + escapeHtml(getIconLabel(module)) + '</span>';
    button.innerHTML = recent
      ? icon + '<span class="recent-name">' + escapeHtml(name) + '</span>'
      : [
        '<span class="card-topline">', icon,
        '<span class="card-category" aria-hidden="true">' + escapeHtml(categoryLabel(getModuleCategory(module))) + '</span></span>',
        '<span class="module-body"><strong>' + escapeHtml(name) + '</strong>',
        '<span class="module-description">' + escapeHtml(shortDescription) + '</span>',
        hasUrl ? '' : '<em>WebアプリURL未設定</em>',
        '</span>'
      ].join('');
    if (hasUrl) {
      button.addEventListener('click', () => {
        rememberModule(module);
        openModuleUrl(module.target_url);
      });
    }
    return button;
  }

  function normalizeRecentHistory(value) {
    if (!Array.isArray(value)) return [];
    const entries = new Map();
    value.forEach((item) => {
      if (!item || typeof item.moduleId !== 'string' || !item.moduleId ||
          !Number.isFinite(item.lastOpened) || item.lastOpened <= 0) return;
      const existing = entries.get(item.moduleId);
      if (!existing || item.lastOpened > existing.lastOpened) {
        entries.set(item.moduleId, { moduleId: item.moduleId, lastOpened: item.lastOpened });
      }
    });
    return Array.from(entries.values()).sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 3);
  }

  function readRecentHistory() {
    try {
      return normalizeRecentHistory(JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) || '[]'));
    } catch (_error) {
      return [];
    }
  }

  function rememberModule(module) {
    const moduleId = String(module.module_id || '');
    if (!moduleId) return;
    recentHistory = normalizeRecentHistory([
      { moduleId, lastOpened: Date.now() },
      ...recentHistory.filter((item) => item.moduleId !== moduleId)
    ]);
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentHistory));
    } catch (_error) {
      // Browser storage may be denied or full; launching still works.
    }
    renderRecentModules();
  }

  function renderRecentModules() {
    const root = document.getElementById('recentModules');
    root.innerHTML = '';
    const byId = new Map(currentModules.filter((module) => module.target_url)
      .map((module) => [String(module.module_id || ''), module]));
    recentHistory = recentHistory.filter((item) => byId.has(item.moduleId));
    const modules = recentHistory.map((item) => byId.get(item.moduleId)).slice(0, 3);
    document.getElementById('recentSection').hidden = modules.length === 0;
    modules.forEach((module) => root.appendChild(createModuleButton(module, true)));
  }

  const FLAVOR_STORAGE_KEY = 'hobbyHub.flavorHistory.v1';
  const FLAVOR_HISTORY_LIMIT = 5;
  let flavorHistory = readFlavorHistory();

  function normalizeFlavorHistory(value) {
    if (!Array.isArray(value)) return [];
    const knownIds = new Set((window.HOBBY_HUB_FLAVOR_PERIODS || [])
      .flatMap((period) => period.messages.map((message) => message.id)));
    return value.filter((id, index) => typeof id === 'string' &&
      knownIds.has(id) && value.indexOf(id) === index).slice(0, FLAVOR_HISTORY_LIMIT);
  }

  function readFlavorHistory() {
    try {
      return normalizeFlavorHistory(JSON.parse(window.localStorage.getItem(FLAVOR_STORAGE_KEY) || '[]'));
    } catch (_error) {
      return [];
    }
  }

  function setFlavorText() {
    const hour = new Date().getHours();
    const period = (window.HOBBY_HUB_FLAVOR_PERIODS || [])
      .find((item) => hour >= item.startHour && hour < item.endHour);
    if (!period || !period.messages.length) return;
    const available = period.messages.filter((message) => !flavorHistory.includes(message.id));
    // A future smaller set must still speak even if every line was recent.
    const candidates = available.length ? available : period.messages;
    const message = candidates[Math.floor(Math.random() * candidates.length)];
    document.getElementById('flavorText').textContent = message.text;
    flavorHistory = [message.id, ...flavorHistory.filter((id) => id !== message.id)]
      .slice(0, FLAVOR_HISTORY_LIMIT);
    try {
      window.localStorage.setItem(FLAVOR_STORAGE_KEY, JSON.stringify(flavorHistory));
    } catch (_error) {
      // Storage denial/full capacity must not prevent the launcher from loading.
    }
  }

  function openModuleUrl(url) {
    if (typeof window.hobbyHubOpenModuleUrl === 'function') {
      window.hobbyHubOpenModuleUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  function getIconLabel(module) {
    const id = String(module.module_id || '');
    if (id === 'study737') {
      return '737';
    }
    if (id === 'room_library') {
      return 'LIB';
    }
    if (id === 'lifeboard') {
      return 'LIF';
    }
    if (id === 'izakaya_scout') {
      return '居酒';
    }
    if (id === 'celestiframe') {
      return '月星';
    }
    if (id === 'jack_load') {
      return 'JCK';
    }
    if (id === 'sudoku') {
      return '数独';
    }
    return String(module.icon || 'APP').slice(0, 3).toUpperCase();
  }

  function loadModules() {
    google.script.run
      .withSuccessHandler((response) => renderModules(unwrap(response)))
      .withFailureHandler(showError)
      .apiGetModules();
  }

  function runSetup() {
    google.script.run
      .withSuccessHandler((response) => {
        const data = unwrap(response);
        alert('初期設定が完了しました: ' + data.hobbyHubMaster.url);
        loadModules();
      })
      .withFailureHandler(showError)
      .setupProject();
  }

  function showError(error) {
    alert(error.message || String(error));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderCategoryFilters();
  setFlavorText();
  renderModules((bootstrap.data && bootstrap.data.modules) || []);
  document.getElementById('setupButton').addEventListener('click', runSetup);
  document.getElementById('librarianButton').addEventListener('click', setFlavorText);