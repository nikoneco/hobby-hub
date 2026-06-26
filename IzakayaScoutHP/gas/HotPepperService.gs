function getSetupStatus_() {
  return {
    hasApiKey: Boolean(getHotPepperApiKey_()),
    apiKeyProperty: CONFIG.HOTPEPPER.API_KEY_PROPERTY
  };
}

function searchHotPepperShops_(payload) {
  const apiKey = getHotPepperApiKey_();
  if (!apiKey) {
    throw new Error('Script Propertiesに HOTPEPPER_API_KEY を設定してね。');
  }

  const areaText = String(payload.areaText || '').trim();
  if (!areaText) {
    throw new Error('ホットペッパー版では駅名・地名を入力してね。');
  }

  const params = buildHotPepperParams_(apiKey, payload);
  const url = CONFIG.HOTPEPPER.API_URL + '?' + toQueryString_(params);
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText('UTF-8');
  if (status < 200 || status >= 300) {
    throw new Error('Hot Pepper API error: HTTP ' + status);
  }

  const json = JSON.parse(text);
  if (json.results && json.results.error && json.results.error.length) {
    throw new Error(json.results.error[0].message || 'Hot Pepper API error');
  }

  const results = json.results || {};
  const shops = Array.isArray(results.shop) ? results.shop : [];
  return {
    query: params.keyword,
    resultsAvailable: Number(results.results_available || 0),
    resultsReturned: Number(results.results_returned || shops.length),
    shops: shops.map(normalizeShop_)
  };
}

function buildHotPepperParams_(apiKey, payload) {
  const terms = [
    payload.areaText,
    payload.venueType,
    payload.scene
  ].concat(payload.foodTerms || [], payload.keywordTerms || [])
    .map(function (term) {
      return String(term || '').trim();
    })
    .filter(Boolean);

  const params = {
    key: apiKey,
    format: 'json',
    count: CONFIG.HOTPEPPER.RESULT_COUNT,
    keyword: terms.join(' ')
  };

  const features = payload.features || {};
  if (features.privateRoom) params.private_room = 1;
  if (features.midnight) params.midnight = 1;
  if (features.sake) params.sake = 1;
  if (features.shochu) params.shochu = 1;
  if (features.wine) params.wine = 1;
  if (features.cocktail) params.cocktail = 1;

  return params;
}

function normalizeShop_(shop) {
  return {
    id: shop.id || '',
    name: shop.name || '',
    logoImage: shop.logo_image || '',
    photo: shop.photo && shop.photo.pc ? shop.photo.pc.l : '',
    genre: shop.genre ? shop.genre.name || '' : '',
    catchText: shop.catch || '',
    access: shop.access || '',
    address: shop.address || '',
    budget: shop.budget ? shop.budget.average || shop.budget.name || '' : '',
    open: shop.open || '',
    close: shop.close || '',
    station: shop.station_name || '',
    urls: {
      pc: shop.urls && shop.urls.pc ? shop.urls.pc : '',
      mobile: shop.urls && shop.urls.mobile ? shop.urls.mobile : ''
    }
  };
}

function getHotPepperApiKey_() {
  return PropertiesService
    .getScriptProperties()
    .getProperty(CONFIG.HOTPEPPER.API_KEY_PROPERTY);
}

function toQueryString_(params) {
  return Object.keys(params)
    .filter(function (key) {
      return params[key] !== '' && params[key] != null;
    })
    .map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');
}
