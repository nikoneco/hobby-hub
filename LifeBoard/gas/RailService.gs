function getRailRoutes_() {
  try {
    const spreadsheet = openLifeBoardSpreadsheet_();
    const sheet = getSheetByName_(spreadsheet, CONFIG.SHEETS.RAIL_ROUTES);
    const routes = readObjects_(sheet)
      .filter(function (route) {
        return route.enabled === true || route.enabled === 'TRUE' || route.enabled === 'true';
      })
      .sort(function (a, b) {
        return Number(a.display_order || 0) - Number(b.display_order || 0);
      });
    return routes.length ? routes : CONFIG.RAIL.DEFAULT_ROUTES;
  } catch (error) {
    console.warn('Falling back to built-in rail routes: ' + error.message);
    return CONFIG.RAIL.DEFAULT_ROUTES;
  }
}

function getRailSnapshot_() {
  const routes = getRailRoutes_();
  return {
    fetchedAt: nowIso_(),
    sourceNote: CONFIG.RAIL.SOURCE_NOTE,
    routes: routes.map(fetchRailRouteSnapshotSafely_)
  };
}

function fetchRailRouteSnapshotSafely_(route) {
  try {
    return fetchRailRouteSnapshot_(route);
  } catch (error) {
    console.error('Rail route failed: ' + route.route_id + ': ' + (error && error.stack ? error.stack : error));
    return {
      routeId: String(route.route_id || ''),
      displayName: String(route.display_name || route.label || ''),
      lineId: String(route.yahoo_line_id || route.line_id || ''),
      officialUrl: buildRailSourceUrl_(route),
      statusText: '確認できず',
      severity: 'unknown',
      detailText: formatRailFetchError_(error),
      directionText: '',
      sourceUpdatedAtText: '',
      fetchedAt: nowIso_()
    };
  }
}

function formatRailFetchError_(error) {
  const message = error && error.message ? error.message : String(error);
  if (message.indexOf('HTTP 403') >= 0) {
    return 'GASから情報元ページへのアクセスが拒否されました。遅延なしではないため、リンク先で確認してください。';
  }
  return message;
}

function fetchRailRouteSnapshot_(route) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'rail:v2:' + route.route_id + ':' + String(route.display_name || route.label || '');
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const response = UrlFetchApp.fetch(buildRailSourceUrl_(route), {
    muteHttpExceptions: true,
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Rail page request failed: HTTP ' + status);
  }

  const text = normalizeRailText_(response.getContentText('UTF-8'));
  const operationText = extractYahooRailSection_(text, route);
  const statusText = extractYahooRailStatus_(operationText);
  const detailText = extractYahooRailDetail_(operationText, statusText);
  const directionText = detailText ? extractRailDirection_(route, detailText) : '';
  const snapshot = {
    routeId: String(route.route_id || ''),
    displayName: String(route.display_name || route.label || ''),
    lineId: String(route.yahoo_line_id || route.line_id || ''),
    officialUrl: buildRailSourceUrl_(route),
    statusText: statusText,
    severity: classifyRailSeverity_(statusText),
    detailText: detailText,
    directionText: directionText,
    sourceUpdatedAtText: extractYahooRailUpdatedAt_(operationText) || extractYahooRailUpdatedAt_(text),
    fetchedAt: nowIso_()
  };

  cache.put(cacheKey, JSON.stringify(snapshot), CONFIG.RAIL.CACHE_SECONDS);
  return snapshot;
}

function buildRailSourceUrl_(route) {
  if (route.source_url) {
    return String(route.source_url);
  }
  if (route.official_url) {
    return String(route.official_url);
  }
  return 'https://transit.yahoo.co.jp/diainfo/' + encodeURIComponent(route.yahoo_line_id || route.line_id) + '/0';
}

function normalizeRailText_(html) {
  return decodeRailEntities_(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeRailEntities_(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/&#(\d+);/g, function (_, code) {
      return String.fromCharCode(parseInt(code, 10));
    });
}

function extractYahooRailUpdatedAt_(text) {
  const match = text.match(/(\d{1,2}月\d{1,2}日\s+\d{1,2}時\d{1,2}分)\s+更新/);
  return match ? match[1] + ' 更新' : '';
}

function extractYahooRailSection_(text, route) {
  const routeName = String(route.display_name || route.label || '').trim();
  const routeIndex = findYahooRailMainIndex_(text, routeName);
  const startIndex = routeIndex >= 0 ? routeIndex : 0;
  const endLabels = [
    '迂回ルート検索',
    '路線を登録すると',
    'に関するつぶやき',
    'ツイート',
    routeName + 'に関するつぶやき'
  ];
  let endIndex = text.length;
  endLabels.forEach(function (label) {
    if (!label) {
      return;
    }
    const index = text.indexOf(label, startIndex + routeName.length);
    if (index > startIndex && index < endIndex) {
      endIndex = index;
    }
  });
  return text.slice(startIndex, endIndex).trim();
}

function findYahooRailMainIndex_(text, routeName) {
  if (!routeName) {
    return -1;
  }
  const statusPattern = /(平常運転|運転見合わせ|列車遅延|一部運休|運休|運転状況|その他)/;
  let searchIndex = 0;
  while (true) {
    const index = text.indexOf(routeName, searchIndex);
    if (index < 0) {
      return -1;
    }
    const probe = text.slice(index, index + 360);
    if (/\d{1,2}月\d{1,2}日\s+\d{1,2}時\d{1,2}分\s+更新/.test(probe) && statusPattern.test(probe)) {
      return index;
    }
    searchIndex = index + routeName.length;
  }
}

function extractRailSection_(text, startLabel, endLabels) {
  const startIndex = text.lastIndexOf(startLabel);
  if (startIndex < 0) {
    return text;
  }
  let endIndex = text.length;
  endLabels.forEach(function (label) {
    const index = text.indexOf(label, startIndex + startLabel.length);
    if (index > startIndex && index < endIndex) {
      endIndex = index;
    }
  });
  return text.slice(startIndex + startLabel.length, endIndex).trim();
}

function extractYahooRailStatus_(operationText) {
  const candidates = ['運転見合わせ', '列車遅延', '一部運休', '運休', '運転状況', 'その他', '平常運転'];
  for (let i = 0; i < candidates.length; i += 1) {
    if (operationText.indexOf(candidates[i]) >= 0) {
      return candidates[i];
    }
  }
  return operationText ? '情報あり' : '取得不可';
}

function extractYahooRailDetail_(operationText, statusText) {
  if (!operationText || statusText === '平常運転') {
    return '';
  }
  const index = operationText.indexOf(statusText);
  const detail = (index >= 0 ? operationText.slice(index + statusText.length) : operationText)
    .replace(/^\s*[:：-]?\s*/, '')
    .trim();
  return detail.slice(0, 180);
}

function extractRailDirection_(route, text) {
  const keywords = String(route.direction_keywords || '')
    .split(',')
    .map(function (keyword) {
      return keyword.trim();
    })
    .filter(Boolean);
  const found = keywords.filter(function (keyword) {
    return text.indexOf(keyword) >= 0;
  });
  return found.length ? found.join(' / ') : '';
}

function classifyRailSeverity_(statusText) {
  if (statusText === '平常運転') {
    return 'normal';
  }
  if (statusText === '運転見合わせ') {
    return 'suspended';
  }
  if (statusText === '遅延' || statusText === '列車遅延') {
    return 'delay';
  }
  if (statusText === '取得不可' || statusText === '確認できず') {
    return 'unknown';
  }
  return 'notice';
}
