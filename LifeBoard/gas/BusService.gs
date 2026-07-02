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
