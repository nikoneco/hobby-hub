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
  const walkFilteredShops = filterShopsByWalkMinutes_(normalizedShops, payload);
  const smokingFilteredShops = filterShopsBySmokingPreference_(walkFilteredShops, payload);
  const openTaggedShops = markOpenNowFiltered_(smokingFilteredShops, payload);
  const rankedShops = selectTopCandidates_(openTaggedShops, payload);
  return {
    query: buildSearchSummary_(payload, params),
    resultsAvailable: Number(results.results_available || 0),
    resultsReturned: rankedShops.length,
    resultsFetched: normalizedShops.length,
    resultsMatched: openTaggedShops.length,
    shops: rankedShops
  };
}

function buildHotPepperParams_(apiKey, payload) {
  const mood = getMoodConfig_(payload);
  const terms = [
    payload.areaText
  ].concat(mood.keywordTerms || [], payload.foodTerms || [])
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

  params.genre = mood.genreCode || normalizeGenreCode_(payload);

  const features = payload.features || {};
  if (features.card) params.card = 1;
  if (features.privateRoom) params.private_room = 1;
  if (features.nonSmoking || payload.smokingPreference === 'non_smoking') params.non_smoking = 1;
  if (features.midnight) params.midnight = 1;
  if (features.openNow) params.is_open_time = 'now';
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

function getMoodConfig_(payload) {
  const mood = String(payload.mood || CONFIG.DEFAULTS.MOOD || 'safe');
  const configs = {
    safe: {
      code: 'safe',
      label: '無難にうまい',
      genreCode: 'G001',
      keywordTerms: []
    },
    cheap: {
      code: 'cheap',
      label: '安く飲む',
      genreCode: 'G001',
      keywordTerms: ['安い']
    },
    second: {
      code: 'second',
      label: '二軒目',
      genreCode: 'G012',
      keywordTerms: ['二次会']
    },
    quiet: {
      code: 'quiet',
      label: '静かめ',
      genreCode: 'G001',
      keywordTerms: ['落ち着いた']
    },
    bar: {
      code: 'bar',
      label: 'バー寄り',
      genreCode: 'G012',
      keywordTerms: []
    }
  };
  return configs[mood] || configs.safe;
}

function selectTopCandidates_(shops, payload) {
  const mood = getMoodConfig_(payload);
  return shops
    .map(function (shop) {
      const scored = Object.assign({}, shop);
      const score = scoreShop_(shop, payload, mood);
      scored.score = score.value;
      scored.reasonTags = score.tags;
      return scored;
    })
    .sort(function (a, b) {
      return b.score - a.score;
    })
    .slice(0, CONFIG.HOTPEPPER.RETURN_COUNT)
    .map(function (shop, index) {
      const labels = ['本命', '対抗', '穴場'];
      return Object.assign({}, shop, {
        pickLabel: labels[index] || '候補',
        pickReason: buildPickReason_(shop, mood)
      });
    });
}

function scoreShop_(shop, payload, mood) {
  let score = 0;
  const tags = [];

  score += scoreAreaFit_(shop, payload);

  if (shop.walkMinutes != null) {
    const walkScore = Math.max(0, 14 - Number(shop.walkMinutes));
    score += walkScore;
    tags.push(Number(shop.walkMinutes) === 0 ? '徒歩1分未満' : '徒歩' + shop.walkMinutes + '分');
  }

  if (isCardUsable_(shop.card)) {
    score += payload.features && payload.features.card ? 14 : 4;
    tags.push('カード可');
  }
  if (hasPrivateRoom_(shop.privateRoom)) {
    score += payload.features && payload.features.privateRoom ? 14 : 3;
    tags.push('個室');
  }
  if (hasMidnight_(shop.midnight)) {
    score += payload.features && payload.features.midnight ? 12 : 2;
    tags.push('深夜');
  }
  if (shop.openNow) {
    score += payload.features && payload.features.openNow ? 10 : 0;
    tags.push('営業中');
  }
  if (shop.nonSmoking) {
    tags.push(shop.nonSmoking);
  }

  score += scoreMoodFit_(shop, mood, tags);
  if (shop.photo) score += 1;
  if (shop.catchText) score += 1;

  return {
    value: score,
    tags: tags.slice(0, 5)
  };
}

function scoreAreaFit_(shop, payload) {
  const anchor = extractAreaAnchor_(payload.areaText);
  if (!anchor) {
    return 0;
  }

  const station = normalizeAreaText_(shop.station).replace(/駅$/, '');
  const address = normalizeAreaText_(shop.address);
  const access = normalizeAreaText_(shop.access);
  const text = [station, address, access].join(' ');

  if (station === anchor) {
    return 18;
  }
  if (isDifferentPrefixedArea_(station, anchor) || isDifferentPrefixedArea_(text, anchor)) {
    return -18;
  }
  if (address.indexOf(anchor) !== -1 || access.indexOf(anchor + '駅') !== -1) {
    return 8;
  }
  if (station.indexOf(anchor) !== -1) {
    return 3;
  }
  return 0;
}

function extractAreaAnchor_(areaText) {
  const text = normalizeAreaText_(areaText).replace(/駅$/, '');
  if (!text || text.length < 2) {
    return '';
  }
  return text;
}

function normalizeAreaText_(value) {
  return normalizeDigits_(String(value || ''))
    .replace(/[　\s]+/g, '')
    .trim();
}

function isDifferentPrefixedArea_(text, anchor) {
  if (!text || !anchor || anchor.charAt(0) === '新') {
    return false;
  }
  return text.indexOf('新' + anchor) !== -1;
}

function scoreMoodFit_(shop, mood, tags) {
  const haystack = [
    shop.genre,
    shop.catchText,
    shop.budget,
    shop.name,
    shop.access
  ].join(' ');
  if (mood.code === 'cheap') {
    if (/安|リーズナブル|せんべろ|コスパ|お得|飲み放題/.test(haystack)) {
      tags.push('安め');
      return 8;
    }
    return 2;
  }
  if (mood.code === 'second') {
    if (/バー|カクテル|二次会|2次会|深夜|駅近/.test(haystack)) {
      tags.push('二軒目向き');
      return 8;
    }
    return 2;
  }
  if (mood.code === 'quiet') {
    if (/落ち着|隠れ家|個室|静|大人|ゆったり/.test(haystack)) {
      tags.push('落ち着き');
      return 8;
    }
    return 2;
  }
  if (mood.code === 'bar') {
    if (/バー|カクテル|ワイン|ダイニングバー/.test(haystack)) {
      tags.push('バー寄り');
      return 9;
    }
    return 2;
  }
  tags.push('無難');
  return 5;
}

function buildPickReason_(shop, mood) {
  const bits = [];
  if (shop.walkMinutes != null) {
    bits.push(Number(shop.walkMinutes) === 0 ? '駅すぐ' : '徒歩' + shop.walkMinutes + '分');
  }
  if (isCardUsable_(shop.card)) bits.push('カード可');
  if (mood.label) bits.push(mood.label);
  return bits.slice(0, 3).join(' / ');
}

function isCardUsable_(cardText) {
  return /利用可|可|VISA|JCB|マスター|Master|AMEX|アメックス|DINERS/i.test(String(cardText || ''));
}

function hasPrivateRoom_(text) {
  return /あり|有|個室/.test(String(text || '')) && !/なし|無し|無/.test(String(text || ''));
}

function hasMidnight_(text) {
  return /営業|可|あり|有/.test(String(text || '')) && !/なし|無し|無/.test(String(text || ''));
}

function buildSearchSummary_(payload, params) {
  return [
    payload.areaText,
    getMoodConfig_(payload).label,
    formatWalkLimitSummary_(payload.walkMinutesLimit),
    formatOpenNowSummary_(payload),
    formatSmokingSummary_(payload.smokingPreference)
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
    privateRoom: shop.private_room || '',
    midnight: shop.midnight || '',
    nonSmoking: shop.non_smoking || '',
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

function filterShopsBySmokingPreference_(shops, payload) {
  const preference = String(payload.smokingPreference || '').trim();
  if (!preference) {
    return shops;
  }

  return shops.filter(function (shop) {
    const text = normalizeSmokingText_(shop.nonSmoking || '');
    if (!text) {
      return false;
    }
    if (preference === 'non_smoking') {
      return hasNonSmokingSeats_(text);
    }
    if (preference === 'smoking_allowed') {
      return allowsSmoking_(text);
    }
    if (preference === 'all_smoking') {
      return isAllSmoking_(text);
    }
    if (preference === 'heated_tobacco') {
      return allowsHeatedTobacco_(text);
    }
    return true;
  });
}

function markOpenNowFiltered_(shops, payload) {
  const features = payload.features || {};
  if (!features.openNow) {
    return shops;
  }
  return shops.map(function (shop) {
    return Object.assign({}, shop, {
      openNow: true
    });
  });
}

function formatOpenNowSummary_(payload) {
  const features = payload.features || {};
  return features.openNow ? '営業中' : '';
}

function formatSmokingSummary_(preference) {
  const labels = {
    non_smoking: '禁煙席あり',
    smoking_allowed: '喫煙可',
    all_smoking: '全席喫煙可',
    heated_tobacco: '加熱式たばこ可'
  };
  return labels[preference] || '';
}

function normalizeSmokingText_(value) {
  return normalizeDigits_(String(value || ''))
    .replace(/[　\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasNonSmokingSeats_(text) {
  return /禁煙/.test(text) && !/禁煙席なし|禁煙なし/.test(text);
}

function allowsSmoking_(text) {
  return isAllSmoking_(text)
    || /喫煙可|喫煙可能|喫煙席あり|喫煙席有|喫煙専用室あり|一部禁煙|分煙/.test(text)
    || /禁煙席なし/.test(text);
}

function isAllSmoking_(text) {
  return /全席喫煙可|全面喫煙可|全席喫煙可能|全面喫煙可能/.test(text);
}

function allowsHeatedTobacco_(text) {
  return /加熱式|加熱式タバコ|電子たばこ|電子タバコ/.test(text);
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
