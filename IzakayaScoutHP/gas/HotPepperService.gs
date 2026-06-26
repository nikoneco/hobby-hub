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
  const normalizedShops = shops.map(normalizeShop_);
  const filteredShops = filterShopsByWalkMinutes_(normalizedShops, payload);
  return {
    query: buildSearchSummary_(payload, params),
    resultsAvailable: Number(results.results_available || 0),
    resultsReturned: filteredShops.length,
    resultsFetched: normalizedShops.length,
    shops: filteredShops
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
    payload.genreName,
    formatWalkLimitSummary_(payload.walkMinutesLimit)
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
    walkMinutes: extractWalkMinutes_(shop.access || ''),
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

function filterShopsByWalkMinutes_(shops, payload) {
  const limit = parseWalkMinutesLimit_(payload.walkMinutesLimit);
  if (!limit) {
    return shops;
  }
  return shops.filter(function (shop) {
    return shop.walkMinutes != null && shop.walkMinutes <= limit;
  });
}

function parseWalkMinutesLimit_(value) {
  const minutes = Number(normalizeDigits_(String(value || '').trim()));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function formatWalkLimitSummary_(value) {
  const minutes = parseWalkMinutesLimit_(value);
  return minutes ? '徒歩' + minutes + '分以内' : '';
}

function extractWalkMinutes_(accessText) {
  const text = normalizeAccessText_(accessText);
  if (!text) {
    return null;
  }

  const minutes = [];
  if (/徒歩\s*(?:すぐ|直ぐ|すぐ近く|すぐそば|目の前|目前)/.test(text)) {
    minutes.push(0);
  }

  collectWalkMatches_(text, /徒歩\s*(?:[:：])?\s*(?:約|およそ|凡そ)?\s*(?:で)?\s*(\d+(?:\.\d+)?)\s*分/g, minutes, false);
  collectWalkMatches_(text, /徒歩\s*(?:[:：])?\s*(?:約|およそ|凡そ)?\s*(?:で)?\s*(\d+(?:\.\d+)?)\s*秒/g, minutes, true);

  if (!minutes.length) {
    return null;
  }
  return Math.min.apply(null, minutes);
}

function collectWalkMatches_(text, pattern, minutes, isSeconds) {
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      minutes.push(isSeconds ? 0 : value);
    }
  }
}

function normalizeAccessText_(value) {
  return normalizeDigits_(String(value || ''))
    .replace(/[　\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDigits_(value) {
  return String(value || '').replace(/[０-９]/g, function (char) {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
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
