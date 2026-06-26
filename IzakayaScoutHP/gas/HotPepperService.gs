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
    query: buildSearchSummary_(payload, params),
    resultsAvailable: Number(results.results_available || 0),
    resultsReturned: Number(results.results_returned || shops.length),
    shops: shops.map(normalizeShop_)
  };
}

function buildHotPepperParams_(apiKey, payload) {
  const terms = [
    payload.areaText
  ].concat(payload.foodTerms || [])
    .map(function (term) {
      return String(term || '').trim();
    })
    .filter(Boolean);

  const params = {
    key: apiKey,
    format: 'json',
    count: CONFIG.HOTPEPPER.RESULT_COUNT,
    type: 'credit_card',
    keyword: terms.join(' ')
  };

  params.genre = normalizeGenreCode_(payload);

  const features = payload.features || {};
  if (features.card) params.card = 1;
  if (features.privateRoom) params.private_room = 1;
  if (features.nonSmoking) params.non_smoking = 1;
  if (features.midnight) params.midnight = 1;
  if (features.sake) params.sake = 1;
  if (features.shochu) params.shochu = 1;
  if (features.wine) params.wine = 1;
  if (features.cocktail) params.cocktail = 1;

  return params;
}

function normalizeGenreCode_(payload) {
  const code = String(payload.genreCode || '').trim();
  if (code) {
    return code;
  }

  const legacyMap = {
    '居酒屋': 'G001',
    '大衆居酒屋': 'G001',
    'バー': 'G012',
    '立ち飲み': 'G001'
  };
  return legacyMap[payload.venueType] || CONFIG.DEFAULTS.GENRE_CODE || 'G001';
}

function buildSearchSummary_(payload, params) {
  return [
    payload.areaText,
    payload.genreName
  ].concat(payload.foodTerms || [])
    .map(function (term) {
      return String(term || '').trim();
    })
    .filter(Boolean)
    .join(' ');
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
    mapsUrl: buildMapsUrl_(shop),
    budget: shop.budget ? shop.budget.average || shop.budget.name || '' : '',
    card: shop.card || '',
    creditCards: normalizeCreditCards_(shop.credit_card),
    open: shop.open || '',
    close: shop.close || '',
    station: shop.station_name || '',
    urls: {
      pc: shop.urls && shop.urls.pc ? shop.urls.pc : '',
      mobile: shop.urls && shop.urls.mobile ? shop.urls.mobile : ''
    }
  };
}

function normalizeCreditCards_(creditCards) {
  if (!creditCards) {
    return [];
  }
  const cards = Array.isArray(creditCards) ? creditCards : [creditCards];
  return cards
    .map(function (card) {
      return card && card.name ? card.name : String(card || '').trim();
    })
    .filter(Boolean);
}

function buildMapsUrl_(shop) {
  const query = [shop.name, shop.address].filter(Boolean).join(' ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
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
