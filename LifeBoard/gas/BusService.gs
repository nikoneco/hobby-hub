const BUS_SNAPSHOT_HEADERS = [
  'imported_at',
  'source',
  'generated_at',
  'route_id',
  'snapshot_json'
];

function handleBusSnapshotImportPost_(e) {
  try {
    const payload = parseBusSnapshotImportPayload_(e);
    verifyCalendarImportToken_(payload.token);
    const result = importBusSnapshots_(payload);
    return jsonOutput_({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Bus snapshot import failed: ' + (error && error.stack ? error.stack : error));
    return jsonOutput_({
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error)
      }
    });
  }
}

function getBusRoutes_() {
  try {
    const spreadsheet = openLifeBoardSpreadsheet_();
    const sheet = getSheetByName_(spreadsheet, CONFIG.SHEETS.BUS_ROUTES);
    const routes = readObjects_(sheet)
      .filter(function (route) {
        return route.enabled === true || route.enabled === 'TRUE' || route.enabled === 'true';
      })
      .sort(function (a, b) {
        return Number(a.display_order || 0) - Number(b.display_order || 0);
      });
    return routes.length ? routes : CONFIG.FALLBACK_BUS_ROUTES;
  } catch (error) {
    console.warn('Falling back to built-in bus routes: ' + error.message);
    return CONFIG.FALLBACK_BUS_ROUTES;
  }
}

function getBusSnapshot_() {
  const routes = getBusRoutes_();
  return {
    fetchedAt: nowIso_(),
    routes: routes.map(fetchRouteSnapshotSafely_)
  };
}

function fetchRouteSnapshotSafely_(route) {
  try {
    return fetchRouteSnapshot_(route);
  } catch (error) {
    console.error('Bus route failed: ' + route.route_id + ': ' + (error && error.stack ? error.stack : error));
    const stored = getStoredBusRouteSnapshot_(route);
    if (stored) {
      stored.errorText = 'GAS direct fetch failed; using manual bus snapshot. ' + (error && error.message ? error.message : String(error));
      return stored;
    }
    return {
      routeId: String(route.route_id || ''),
      label: String(route.label || ''),
      departureName: String(route.departure_name || ''),
      arrivalName: String(route.arrival_name || ''),
      officialUrl: String(route.official_url || buildOfficialBusPageUrl_(route)),
      sourceUpdatedAt: '',
      sourceUpdatedAtText: '取得失敗',
      errorText: error && error.message ? error.message : String(error),
      items: []
    };
  }
}

function parseBusSnapshotImportPayload_(e) {
  const body = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!body) {
    throw new Error('Request body is empty');
  }
  return JSON.parse(body);
}

function importBusSnapshots_(payload) {
  const routes = Array.isArray(payload.routes) ? payload.routes : [];
  const spreadsheet = openLifeBoardSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, CONFIG.SHEETS.BUS_SNAPSHOTS);
  const importedAt = nowIso_();
  const rows = routes
    .filter(function (route) {
      return route && route.routeId;
    })
    .map(function (route) {
      return BUS_SNAPSHOT_HEADERS.map(function (header) {
        return busSnapshotValue_(header, route, payload, importedAt);
      });
    });

  sheet.clearContents();
  sheet.getRange(1, 1, Math.max(rows.length + 1, 2), BUS_SNAPSHOT_HEADERS.length).setNumberFormat('@');
  sheet.getRange(1, 1, 1, BUS_SNAPSHOT_HEADERS.length).setValues([BUS_SNAPSHOT_HEADERS]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, BUS_SNAPSHOT_HEADERS.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  autoResizeSafe_(sheet, BUS_SNAPSHOT_HEADERS.length);

  return {
    importedAt: importedAt,
    source: String(payload.source || ''),
    generatedAt: String(payload.generatedAt || ''),
    importedRoutes: rows.length
  };
}

function busSnapshotValue_(header, route, payload, importedAt) {
  const map = {
    imported_at: importedAt,
    source: String(payload.source || ''),
    generated_at: String(payload.generatedAt || ''),
    route_id: String(route.routeId || ''),
    snapshot_json: JSON.stringify(route)
  };
  return map[header] == null ? '' : map[header];
}

function getStoredBusRouteSnapshot_(route) {
  try {
    const spreadsheet = openLifeBoardSpreadsheet_();
    const sheet = getSheetByName_(spreadsheet, CONFIG.SHEETS.BUS_SNAPSHOTS);
    const rows = readObjects_(sheet);
    const routeId = String(route.route_id || '');
    const row = rows.filter(function (candidate) {
      return String(candidate.route_id || '') === routeId;
    })[0];
    if (!row) {
      return null;
    }
    const importedAt = String(row.imported_at || '');
    if (isStoredBusSnapshotStale_(importedAt)) {
      return null;
    }
    const snapshot = JSON.parse(String(row.snapshot_json || '{}'));
    snapshot.sourceUpdatedAtText = snapshot.sourceUpdatedAtText
      ? snapshot.sourceUpdatedAtText + ' / 手動同期'
      : '手動同期';
    snapshot.importedAt = importedAt;
    snapshot.source = String(row.source || 'manual-bus-fetcher');
    return snapshot;
  } catch (error) {
    console.warn('Stored bus snapshot fallback unavailable: ' + (error && error.message ? error.message : String(error)));
    return null;
  }
}

function isStoredBusSnapshotStale_(importedAt) {
  const importedMs = Date.parse(importedAt);
  if (!Number.isFinite(importedMs)) {
    return true;
  }
  const maxAgeMs = Number(CONFIG.BUS.STORED_MAX_AGE_MINUTES || 15) * 60 * 1000;
  return Date.now() - importedMs > maxAgeMs;
}

function fetchRouteSnapshot_(route) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'bus:' + route.route_id;
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const url = buildBusApiUrl_(route);
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Bus API request failed: HTTP ' + status);
  }

  const payload = JSON.parse(response.getContentText());
  const snapshot = {
    routeId: String(route.route_id || ''),
    label: String(route.label || ''),
    departureName: String(route.departure_name || payload.departureName || ''),
    arrivalName: String(route.arrival_name || payload.arrivalName || ''),
    officialUrl: String(route.official_url || buildOfficialBusPageUrl_(route)),
    sourceUpdatedAt: payload.updatedAt || '',
    sourceUpdatedAtText: formatDateTime_(payload.updatedAt),
    items: (payload.approachings || [])
      .slice(0, CONFIG.BUS.MAX_ITEMS_PER_ROUTE)
      .map(normalizeApproaching_)
  };

  cache.put(cacheKey, JSON.stringify(snapshot), CONFIG.BUS.CACHE_SECONDS);
  return snapshot;
}

function normalizeApproaching_(item) {
  const departure = item.departure || {};
  const previousStops = item.numberOfPreviousBusstopsDeparted;
  return {
    courseName: item.courseName || '',
    destination: item.destination || '',
    via: item.via || '',
    vehicleNumber: item.vehicleNumber || '',
    scheduledDepartureTime: departure.scheduledDepartureTime || '',
    scheduledDepartureText: formatTime_(departure.scheduledDepartureTime),
    predictedDepartureTime: departure.predictedDepartureTime || '',
    predictedDepartureText: formatTime_(departure.predictedDepartureTime),
    delayText: formatDelay_(departure.delayOfDeparture),
    remainingMinutes: parseIsoDurationMinutes_(departure.remainingTimeUntilDeparture),
    remainingText: formatRemaining_(departure.remainingTimeUntilDeparture),
    previousStops: previousStops == null ? '' : previousStops,
    locationText: formatLocationText_(previousStops, departure.poleName)
  };
}

function buildBusApiUrl_(route) {
  const params = {
    'busstop-id': route.departure_busstop_id,
    'arrival-busstop-id': route.arrival_busstop_id,
    'with-other-buses': 'false',
    order: 'numberOfPreviousBusstopsDeparted',
    language: 'ja'
  };
  return CONFIG.BUS.API_BASE_URL + CONFIG.BUS.CUSTOMER + '/busstops/approachings?' + toQueryString_(params);
}

function buildOfficialBusPageUrl_(route) {
  return CONFIG.BUS.PAGE_BASE_URL + '?' + toQueryString_({
    'departure-busstop': route.departure_busstop_id,
    'arrival-busstop': route.arrival_busstop_id
  });
}

function toQueryString_(params) {
  return Object.keys(params).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
}

function parseIsoDurationMinutes_(value) {
  if (!value) {
    return '';
  }
  const match = String(value).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return '';
  }
  const total = (Number(match[1] || 0) * 60) + Number(match[2] || 0) + (Number(match[3] || 0) / 60);
  return Math.max(0, Math.round(total));
}

function formatRemaining_(value) {
  const minutes = parseIsoDurationMinutes_(value);
  if (minutes === '') {
    return '出発前';
  }
  return 'あと約' + minutes + '分';
}

function formatDelay_(value) {
  const minutes = parseIsoDurationMinutes_(value);
  if (minutes === '' || minutes === 0) {
    return '遅れなし';
  }
  return '+' + minutes + '分';
}

function formatLocationText_(previousStops, poleName) {
  if (previousStops == null || previousStops === '') {
    return poleName ? poleName + '番のりば / 出発前' : '出発前/始発付近';
  }
  return previousStops + '個前から接近中';
}

function formatTime_(isoText) {
  if (!isoText) {
    return '';
  }
  return Utilities.formatDate(new Date(isoText), CONFIG.TIMEZONE, 'HH:mm');
}

function formatDateTime_(isoText) {
  if (!isoText) {
    return '';
  }
  return Utilities.formatDate(new Date(isoText), CONFIG.TIMEZONE, 'MM/dd HH:mm:ss');
}

function nowIso_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
