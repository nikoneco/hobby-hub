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
  const areaFilteredShops = filterShopsByAreaAnchor_(normalizedShops, payload);
  const walkFilteredShops = filterShopsByWalkMinutes_(areaFilteredShops, payload);
  const smokingFilteredShops = filterShopsBySmokingPreference_(walkFilteredShops, payload);
  const openTaggedShops = markOpenNowFiltered_(smokingFilteredShops, payload);
  const mood = getMoodConfig_(payload);
  const budgetMatchedShops = findMoodBudgetMatchedShops_(openTaggedShops, mood);
  const budgetFilteredShops = chooseMoodBudgetPool_(openTaggedShops, budgetMatchedShops);
  const rankedShops = selectTopCandidates_(budgetFilteredShops, payload, CONFIG.HOTPEPPER.POOL_COUNT);
  const visibleShops = rankedShops.slice(0, CONFIG.HOTPEPPER.RETURN_COUNT);
  const backupShops = rankedShops.slice(CONFIG.HOTPEPPER.RETURN_COUNT);
  return {
    query: buildSearchSummary_(payload, params),
    resultsAvailable: Number(results.results_available || 0),
    resultsReturned: visibleShops.length,
    resultsPool: rankedShops.length,
    resultsFetched: normalizedShops.length,
    resultsAreaMatched: areaFilteredShops.length,
    resultsWalkMatched: walkFilteredShops.length,
    resultsSmokingMatched: smokingFilteredShops.length,
    resultsBudgetMatched: budgetMatchedShops.length,
    resultsBudgetFilterApplied: budgetFilteredShops.length === budgetMatchedShops.length,
    resultsMatched: budgetFilteredShops.length,
    shops: visibleShops,
    backupShops: backupShops
  };
}

function buildHotPepperParams_(apiKey, payload) {
  const mood = getMoodConfig_(payload);
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
      genreCode: 'G001'
    },
    cheap: {
      code: 'cheap',
      label: '安く飲む',
      genreCode: 'G001',
      budgetMaxYen: 3500
    },
    second: {
      code: 'second',
      label: '二軒目',
      genreCode: 'G012'
    },
    quiet: {
      code: 'quiet',
      label: '静かめ',
      genreCode: 'G001'
    },
    bar: {
      code: 'bar',
      label: 'バー寄り',
      genreCode: 'G012'
    }
  };
  return configs[mood] || configs.safe;
}

function selectTopCandidates_(shops, payload, limit) {
  const mood = getMoodConfig_(payload);
  return shops
    .map(function (shop) {
      const scored = Object.assign({}, shop);
      const score = scoreShop_(shop, payload, mood);
      scored.score = score.value;
      scored.reasonTags = score.tags;
      scored.conditionTags = buildConditionTags_(shop, payload);
      return scored;
    })
    .sort(function (a, b) {
      return b.score - a.score;
    })
    .slice(0, limit || CONFIG.HOTPEPPER.RETURN_COUNT)
    .map(function (shop, index) {
      const labels = ['本命', '対抗', '穴場'];
      return Object.assign({}, shop, {
        pickLabel: labels[index] || '候補',
        pickReason: buildPickReason_(shop, mood, payload)
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

  score += scoreFoodFit_(shop, payload, tags);
  score += scoreDrinkFit_(shop, payload, tags);
  score += scoreMoodFit_(shop, mood, tags);
  if (shop.photo) score += 1;
  if (shop.catchText) score += 1;

  return {
    value: score,
    tags: tags.slice(0, 5)
  };
}

function findMoodBudgetMatchedShops_(shops, mood) {
  if (!mood || !mood.budgetMaxYen) {
    return shops.slice();
  }
  return shops.filter(function (shop) {
    return isWithinMoodBudget_(shop, mood);
  });
}

function chooseMoodBudgetPool_(shops, budgetMatchedShops) {
  const matched = Array.isArray(budgetMatchedShops) ? budgetMatchedShops : [];
  return matched.length >= CONFIG.HOTPEPPER.RETURN_COUNT ? matched : shops;
}

function isWithinMoodBudget_(shop, mood) {
  const estimated = Number(shop.budgetEstimatedYen || 0);
  return Boolean(mood && mood.budgetMaxYen && estimated && estimated <= mood.budgetMaxYen);
}

function formatBudgetFitTag_(mood) {
  return mood && mood.budgetMaxYen ? mood.budgetMaxYen + '円目安' : '安め';
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

function scoreFoodFit_(shop, payload, tags) {
  const matches = findFoodMatches_(shop, payload.foodTerms || []);
  if (!matches.length) {
    return 0;
  }
  matches.slice(0, 3).forEach(function (term) {
    tags.push(term);
  });
  return Math.min(18, matches.length * 7);
}

function findFoodMatches_(shop, foodTerms) {
  const terms = Array.isArray(foodTerms) ? foodTerms.filter(Boolean) : [];
  if (!terms.length) {
    return [];
  }
  const haystack = normalizeFoodText_([
    shop.name,
    shop.genre,
    shop.catchText,
    shop.access
  ].join(' '));
  return terms.filter(function (term) {
    const pattern = getFoodPattern_(term);
    return pattern ? pattern.test(haystack) : haystack.indexOf(normalizeFoodText_(term)) !== -1;
  });
}

function getFoodPattern_(term) {
  const patterns = {
    '焼き鳥': /焼き鳥|やきとり|焼鳥|串焼/,
    '海鮮': /海鮮|魚|刺身|寿司|鮮魚/,
    '肉': /肉|焼肉|ステーキ|ホルモン|牛|豚|鶏/,
    '串揚げ': /串揚|串かつ|串カツ/,
    'おでん': /おでん/
  };
  return patterns[String(term || '').trim()] || null;
}

function normalizeFoodText_(value) {
  return normalizeDigits_(String(value || ''))
    .replace(/[ァ-ン]/g, function (char) {
      return String.fromCharCode(char.charCodeAt(0) - 0x60);
    })
    .toLowerCase();
}

function scoreMoodFit_(shop, mood, tags) {
  const haystack = [
    shop.genre,
    shop.catchText,
    shop.budget,
    shop.name,
    shop.access,
    shop.midnight,
    shop.freeDrink,
    shop.cocktail,
    shop.wine,
    shop.sake,
    shop.shochu
  ].join(' ');
  if (mood.code === 'cheap') {
    if (isWithinMoodBudget_(shop, mood)) {
      tags.push(formatBudgetFitTag_(mood));
      return 14;
    }
    if (/安|リーズナブル|せんべろ|コスパ|お得|飲み放題/.test(haystack)) {
      tags.push('安め');
      return 8;
    }
    return 2;
  }
  if (mood.code === 'second') {
    let secondScore = 2;
    if (/バー|カクテル|二次会|2次会|深夜|駅近/.test(haystack)) {
      pushUniqueTag_(tags, '二軒目向き');
      secondScore += 8;
    }
    if (hasMidnight_(shop.midnight)) {
      pushUniqueTag_(tags, '深夜');
      secondScore += 5;
    }
    if (hasPositiveFeature_(shop.cocktail) || hasPositiveFeature_(shop.wine)) {
      pushUniqueTag_(tags, '一杯向き');
      secondScore += 4;
    }
    if (hasPositiveFeature_(shop.freeDrink)) {
      pushUniqueTag_(tags, '飲み放題');
      secondScore += 2;
    }
    return Math.max(1, secondScore);
  }
  if (mood.code === 'quiet') {
    let quietScore = 2;
    if (/落ち着|隠れ家|個室|静|大人|ゆったり/.test(haystack)) {
      tags.push('落ち着き');
      quietScore += 8;
    }
    if (hasPrivateRoom_(shop.privateRoom)) {
      quietScore += 5;
    }
    if (hasPositiveFeature_(shop.horigotatsu) || hasPositiveFeature_(shop.tatami)) {
      tags.push('ゆったり席');
      quietScore += 4;
    }
    if (hasEntertainmentFeature_(shop)) {
      quietScore -= 4;
    }
    return Math.max(1, quietScore);
  }
  if (mood.code === 'bar') {
    let barScore = 2;
    if (/バー|カクテル|ワイン|ダイニングバー/.test(haystack)) {
      pushUniqueTag_(tags, 'バー寄り');
      barScore += 9;
    }
    if (hasPositiveFeature_(shop.cocktail)) {
      pushUniqueTag_(tags, 'カクテル');
      barScore += 5;
    }
    if (hasPositiveFeature_(shop.wine)) {
      pushUniqueTag_(tags, 'ワイン');
      barScore += 4;
    }
    if (/バー|ダイニングバー/.test(String(shop.genre || ''))) {
      barScore += 4;
    }
    return Math.max(1, barScore);
  }
  tags.push('無難');
  return 5;
}

function buildPickReason_(shop, mood, payload) {
  const bits = [];
  if (shop.walkMinutes != null) {
    bits.push(Number(shop.walkMinutes) === 0 ? '駅すぐ' : '徒歩' + shop.walkMinutes + '分');
  }
  const foodMatches = findFoodMatches_(shop, payload.foodTerms || []);
  if (foodMatches.length) bits.push(foodMatches.slice(0, 2).join('・'));
  const drinkLabels = formatDrinkSummaryTerms_(payload);
  if (drinkLabels.length) bits.push(drinkLabels.slice(0, 2).join('・'));
  if (isCardUsable_(shop.card)) bits.push('カード可');
  if (mood.label) bits.push(mood.label);
  return bits.slice(0, 3).join(' / ');
}

function buildConditionTags_(shop, payload) {
  const features = payload.features || {};
  const tags = [];
  const walkLimit = parseWalkMinutesLimit_(payload.walkMinutesLimit);
  if (walkLimit && shop.walkMinutes != null && shop.walkMinutes <= walkLimit) {
    tags.push('徒歩' + walkLimit + '分以内');
  }
  if (features.card && isCardUsable_(shop.card)) {
    tags.push('カード可');
  }
  if (features.privateRoom && hasPrivateRoom_(shop.privateRoom)) {
    tags.push('個室');
  }
  if (features.midnight && hasMidnight_(shop.midnight)) {
    tags.push('深夜');
  }
  if (features.openNow && shop.openNow) {
    tags.push('営業中');
  }
  const smokingLabel = formatMatchedSmokingCondition_(shop, payload.smokingPreference);
  if (smokingLabel) {
    tags.push(smokingLabel);
  }
  formatMatchedDrinkConditionLabels_(shop, payload).forEach(function (label) {
    tags.push(label);
  });
  return tags;
}

function scoreDrinkFit_(shop, payload, tags) {
  const labels = formatMatchedDrinkConditionLabels_(shop, payload);
  if (!labels.length) {
    return 0;
  }
  labels.slice(0, 3).forEach(function (label) {
    tags.push(label);
  });
  return Math.min(12, labels.length * 5);
}

function formatMatchedSmokingCondition_(shop, preference) {
  const value = String(preference || '').trim();
  if (!value) {
    return '';
  }
  const text = normalizeSmokingText_(shop.nonSmoking || '');
  if (!text) {
    return '';
  }
  if (value === 'non_smoking' && hasNonSmokingSeats_(text)) {
    return '禁煙席あり';
  }
  if (value === 'smoking_allowed' && allowsSmoking_(text)) {
    return '喫煙可';
  }
  if (value === 'all_smoking' && isAllSmoking_(text)) {
    return '全席喫煙可';
  }
  if (value === 'heated_tobacco' && allowsHeatedTobacco_(text)) {
    return '加熱式たばこ可';
  }
  return '';
}

function isCardUsable_(cardText) {
  return /利用可|可|VISA|JCB|マスター|Master|AMEX|アメックス|DINERS/i.test(String(cardText || ''));
}

function hasPrivateRoom_(text) {
  return /あり|有|個室/.test(String(text || '')) && !/なし|無し|無/.test(String(text || ''));
}

function hasPositiveFeature_(text) {
  return /あり|有|可|利用可|対応|歓迎|いる|充実|豊富/.test(String(text || '')) && !/なし|無し|無|不可|未確認/.test(String(text || ''));
}

function hasEntertainmentFeature_(shop) {
  return hasPositiveFeature_(shop.karaoke)
    || hasPositiveFeature_(shop.show)
    || hasPositiveFeature_(shop.equipment)
    || hasPositiveFeature_(shop.band)
    || hasPositiveFeature_(shop.tv);
}

function hasMidnight_(text) {
  return /営業|可|あり|有/.test(String(text || '')) && !/なし|無し|無/.test(String(text || ''));
}

function pushUniqueTag_(tags, label) {
  if (tags.indexOf(label) === -1) {
    tags.push(label);
  }
}

function buildSearchSummary_(payload, params) {
  return [
    payload.areaText,
    getMoodConfig_(payload).label,
    formatWalkLimitSummary_(payload.walkMinutesLimit),
    formatOpenNowSummary_(payload),
    formatSmokingSummary_(payload.smokingPreference)
  ].concat(payload.foodTerms || [], formatDrinkSummaryTerms_(payload))
    .map(function (term) {
      return String(term || '').trim();
    })
    .filter(Boolean)
    .join(' ');
}

function formatDrinkSummaryTerms_(payload) {
  const labels = getDrinkFeatureLabels_();
  const values = Array.isArray(payload.drinkValues) ? payload.drinkValues : [];
  return values.map(function (value) {
    return labels[value] || '';
  }).filter(Boolean);
}

function formatMatchedDrinkConditionLabels_(shop, payload) {
  const labels = getDrinkFeatureLabels_();
  const values = Array.isArray(payload.drinkValues) ? payload.drinkValues : [];
  return values.map(function (value) {
    if (!hasPositiveFeature_(getShopDrinkFeatureText_(shop, value))) {
      return '';
    }
    return labels[value] || '';
  }).filter(Boolean);
}

function getDrinkFeatureLabels_() {
  return {
    sake: '日本酒',
    shochu: '焼酎',
    wine: 'ワイン',
    cocktail: 'カクテル'
  };
}

function getShopDrinkFeatureText_(shop, value) {
  const fields = {
    sake: shop.sake,
    shochu: shop.shochu,
    wine: shop.wine,
    cocktail: shop.cocktail
  };
  return fields[value] || '';
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
    mapsDirectionsUrl: buildMapsDirectionsUrl_(shop),
    budget: shop.budget ? shop.budget.average || shop.budget.name || '' : '',
    budgetEstimatedYen: extractBudgetEstimatedYen_(shop.budget),
    privateRoom: shop.private_room || '',
    horigotatsu: shop.horigotatsu || '',
    tatami: shop.tatami || '',
    midnight: shop.midnight || '',
    freeDrink: shop.free_drink || '',
    cocktail: shop.cocktail || '',
    wine: shop.wine || '',
    sake: shop.sake || '',
    shochu: shop.shochu || '',
    nonSmoking: shop.non_smoking || '',
    card: shop.card || '',
    creditCards: normalizeCreditCards_(shop.credit_card),
    tel: shop.tel || '',
    open: shop.open || '',
    close: shop.close || '',
    show: shop.show || '',
    equipment: shop.equipment || '',
    karaoke: shop.karaoke || '',
    band: shop.band || '',
    tv: shop.tv || '',
    station: shop.station_name || '',
    urls: {
      pc: shop.urls && shop.urls.pc ? shop.urls.pc : '',
      mobile: shop.urls && shop.urls.mobile ? shop.urls.mobile : ''
    }
  };
}

function filterShopsByAreaAnchor_(shops, payload) {
  const anchor = extractAreaAnchor_(payload.areaText);
  if (!anchor) {
    return shops;
  }
  const filtered = shops.filter(function (shop) {
    return !isClearlyDifferentPrefixedAreaShop_(shop, anchor);
  });
  return filtered.length >= CONFIG.HOTPEPPER.RETURN_COUNT ? filtered : shops;
}

function isClearlyDifferentPrefixedAreaShop_(shop, anchor) {
  if (!anchor || anchor.charAt(0) === '新') {
    return false;
  }
  const station = normalizeAreaText_(shop.station).replace(/駅$/, '');
  if (station === anchor) {
    return false;
  }
  const access = normalizeAreaText_(shop.access);
  if (access.indexOf(anchor + '駅') !== -1 && access.indexOf('新' + anchor + '駅') === -1) {
    return false;
  }
  return station === '新' + anchor || access.indexOf('新' + anchor + '駅') !== -1;
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

function extractBudgetEstimatedYen_(budget) {
  if (!budget) {
    return null;
  }
  const text = normalizeDigits_([
    budget.average || '',
    budget.name || ''
  ].join(' ')).replace(/,/g, '');
  if (!text.trim()) {
    return null;
  }

  const range = text.match(/(\d+)\s*[～〜~-]\s*(\d+)\s*円?/);
  if (range) {
    const lower = Number(range[1]);
    const upper = Number(range[2]);
    if (Number.isFinite(lower) && Number.isFinite(upper)) {
      return Math.floor((lower + upper) / 2);
    }
  }

  const upperOnly = text.match(/[～〜~-]\s*(\d+)\s*円/);
  if (upperOnly) {
    const upper = Number(upperOnly[1]);
    return Number.isFinite(upper) ? upper : null;
  }

  const lowerOnly = text.match(/(\d+)\s*円\s*(?:以下|以内|まで)/);
  if (lowerOnly) {
    const upper = Number(lowerOnly[1]);
    return Number.isFinite(upper) ? upper : null;
  }

  const single = text.match(/(\d+)\s*円/);
  if (single) {
    const value = Number(single[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

function buildMapsUrl_(shop) {
  const query = [shop.name, shop.address].filter(Boolean).join(' ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

function buildMapsDirectionsUrl_(shop) {
  const destination = [shop.name, shop.address].filter(Boolean).join(' ');
  return 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + encodeURIComponent(destination);
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
