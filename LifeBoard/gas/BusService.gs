const BUS_SNAPSHOT_HEADERS = [
  'imported_at',
  'source',
  'generated_at',
  'route_id',
  'snapshot_json'
];

const BUS_TIMETABLE_HEADERS = [
  'route_id',
  'service_date',
  'service_type',
  'departure_time',
  'course_name',
  'destination',
  'via',
  'enabled',
  'note'
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

function handleBusTimetableImportPost_(e) {
  try {
    const payload = parseBusSnapshotImportPayload_(e);
    verifyCalendarImportToken_(payload.token);
    const result = importBusTimetable_(payload);
    return jsonOutput_({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Bus timetable import failed: ' + (error && error.stack ? error.stack : error));
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
    const stored = getStoredBusRouteSnapshot_(route, { allowStale: true });
    if (stored) {
      if (stored.isStale) {
        return buildBusTimetableFallbackSnapshot_(route, stored.snapshot, stored.importedAt, error);
      }
      stored.snapshot.errorText = 'GAS direct fetch failed; using manual bus snapshot. ' + (error && error.message ? error.message : String(error));
      return stored.snapshot;
    }
    return buildBusUnavailableSnapshot_(route, error);
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

function importBusTimetable_(payload) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const spreadsheet = openLifeBoardSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, CONFIG.SHEETS.BUS_TIMETABLE);
  const values = rows
    .filter(function (row) {
      return row && row.routeId && row.departureTime;
    })
    .map(function (row) {
      return BUS_TIMETABLE_HEADERS.map(function (header) {
        return busTimetableValue_(header, row, payload);
      });
    });

  sheet.clearContents();
  sheet.getRange(1, 1, Math.max(values.length + 1, 2), BUS_TIMETABLE_HEADERS.length).setNumberFormat('@');
  sheet.getRange(1, 1, 1, BUS_TIMETABLE_HEADERS.length).setValues([BUS_TIMETABLE_HEADERS]);
  if (values.length) {
    sheet.getRange(2, 1, values.length, BUS_TIMETABLE_HEADERS.length).setValues(values);
  }
  sheet.setFrozenRows(1);
  autoResizeSafe_(sheet, BUS_TIMETABLE_HEADERS.length);

  return {
    importedAt: nowIso_(),
    source: String(payload.source || ''),
    generatedAt: String(payload.generatedAt || ''),
    importedRows: values.length
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

function busTimetableValue_(header, row, payload) {
  const map = {
    route_id: String(row.routeId || ''),
    service_date: String(row.serviceDate || ''),
    service_type: String(row.serviceType || ''),
    departure_time: String(row.departureTime || ''),
    course_name: String(row.courseName || ''),
    destination: String(row.destination || ''),
    via: String(row.via || ''),
    enabled: row.enabled === false ? 'FALSE' : 'TRUE',
    note: String(row.note || payload.note || '')
  };
  return map[header] == null ? '' : map[header];
}

function getStoredBusRouteSnapshot_(route, options) {
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
    const generatedAt = String(row.generated_at || '');
    const isStale = isStoredBusSnapshotStale_(importedAt);
    if (isStale && !(options && options.allowStale)) {
      return null;
    }
    const snapshot = JSON.parse(String(row.snapshot_json || '{}'));
    if (!isStale) {
      snapshot.sourceUpdatedAtText = snapshot.sourceUpdatedAtText
        ? snapshot.sourceUpdatedAtText + ' / 手動同期'
        : '手動同期';
    }
    snapshot.countdownBaseAt = String(snapshot.countdownBaseAt || snapshot.sourceUpdatedAt || generatedAt || importedAt);
    snapshot.importedAt = importedAt;
    snapshot.source = String(row.source || 'manual-bus-fetcher');
    return {
      importedAt: importedAt,
      isStale: isStale,
      snapshot: snapshot
    };
  } catch (error) {
    console.warn('Stored bus snapshot fallback unavailable: ' + (error && error.message ? error.message : String(error)));
    return null;
  }
}

function buildBusTimetableFallbackSnapshot_(route, storedSnapshot, importedAt, error) {
  const timetableItems = getStaticBusTimetableItems_(route);
  const fallbackItems = timetableItems.length ? timetableItems : buildTimetableItemsFromSnapshot_(storedSnapshot);
  const statusText = timetableItems.length
    ? '15分以上リアルタイム未取得。スプシ定刻のみ表示'
    : fallbackItems.length
      ? '15分以上リアルタイム未取得。前回取得分の定刻のみ表示'
      : '15分以上リアルタイム未取得。最新の定刻候補なし';
  return {
    routeId: String(route.route_id || ''),
    label: String(route.label || ''),
    departureName: String(route.departure_name || ''),
    arrivalName: String(route.arrival_name || ''),
    officialUrl: String(route.official_url || buildOfficialBusPageUrl_(route)),
    sourceUpdatedAt: storedSnapshot && storedSnapshot.sourceUpdatedAt || '',
    sourceUpdatedAtText: '接近情報未更新（最終手動同期 ' + formatDateTime_(importedAt) + '）',
    statusText: statusText,
    errorText: error && error.message ? error.message : String(error),
    items: [],
    timetableItems: fallbackItems
  };
}

function buildBusUnavailableSnapshot_(route, error) {
  const timetableItems = getStaticBusTimetableItems_(route);
  const statusText = timetableItems.length
    ? 'リアルタイム未取得。スプシ定刻のみ表示'
    : 'リアルタイム未取得。情報元で時刻表を確認';
  return {
    routeId: String(route.route_id || ''),
    label: String(route.label || ''),
    departureName: String(route.departure_name || ''),
    arrivalName: String(route.arrival_name || ''),
    officialUrl: String(route.official_url || buildOfficialBusPageUrl_(route)),
    sourceUpdatedAt: '',
    sourceUpdatedAtText: timetableItems.length ? '接近情報未取得 / スプシ定刻' : '接近情報未取得',
    statusText: statusText,
    errorText: error && error.message ? error.message : String(error),
    items: [],
    timetableItems: timetableItems
  };
}

function buildTimetableItemsFromSnapshot_(snapshot) {
  const nowMs = Date.now();
  return ((snapshot && snapshot.items) || [])
    .filter(function (item) {
      const scheduledMs = Date.parse(item.scheduledDepartureTime || '');
      return Number.isFinite(scheduledMs) ? scheduledMs >= nowMs - (2 * 60 * 1000) : true;
    })
    .slice(0, CONFIG.BUS.MAX_ITEMS_PER_ROUTE)
    .map(function (item) {
      return {
        scheduledDepartureText: String(item.scheduledDepartureText || ''),
        courseName: String(item.courseName || ''),
        destination: String(item.destination || ''),
        via: String(item.via || '')
      };
    });
}

function isStoredBusSnapshotStale_(importedAt) {
  const importedMs = Date.parse(importedAt);
  if (!Number.isFinite(importedMs)) {
    return true;
  }
  const maxAgeMs = Number(CONFIG.BUS.STORED_MAX_AGE_MINUTES || 15) * 60 * 1000;
  return Date.now() - importedMs > maxAgeMs;
}

function getStaticBusTimetableItems_(route) {
  try {
    const spreadsheet = openLifeBoardSpreadsheet_();
    const sheet = getSheetByName_(spreadsheet, CONFIG.SHEETS.BUS_TIMETABLE);
    const rows = readObjects_(sheet);
    const routeId = String(route.route_id || '');
    const todayText = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd');
    const serviceTypes = getTodayBusServiceTypes_();
    const items = rows
      .filter(function (row) {
        if (String(row.route_id || '') !== routeId) {
          return false;
        }
        if (row.enabled === false || row.enabled === 'FALSE' || row.enabled === 'false') {
          return false;
        }
        const serviceDate = normalizeBusServiceDate_(row.service_date);
        if (serviceDate) {
          return serviceDate === todayText;
        }
        const serviceType = normalizeBusServiceType_(row.service_type);
        return serviceTypes.indexOf(serviceType) !== -1;
      })
      .map(function (row) {
        const time = parseBusTimetableTime_(row.departure_time);
        if (!time) {
          return null;
        }
        return {
          scheduledMs: time.scheduledMs,
          scheduledDepartureText: time.text,
          courseName: String(row.course_name || ''),
          destination: String(row.destination || ''),
          via: String(row.via || '')
        };
      })
      .filter(function (item) {
        return item && item.scheduledMs >= Date.now() - (2 * 60 * 1000);
      })
      .sort(function (a, b) {
        return a.scheduledMs - b.scheduledMs;
      })
      .slice(0, CONFIG.BUS.MAX_ITEMS_PER_ROUTE)
      .map(function (item) {
        return {
          scheduledDepartureText: item.scheduledDepartureText,
          courseName: item.courseName,
          destination: item.destination,
          via: item.via
        };
      });
    return items;
  } catch (error) {
    console.warn('Static bus timetable unavailable: ' + (error && error.message ? error.message : String(error)));
    return [];
  }
}

function getTodayBusServiceTypes_() {
  const weekday = Number(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'u'));
  if (weekday === 6) {
    return ['everyday', 'saturday', 'holiday'];
  }
  if (weekday === 7) {
    return ['everyday', 'holiday'];
  }
  return ['everyday', 'weekday'];
}

function normalizeBusServiceType_(value) {
  const text = String(value || '').trim().toLowerCase();
  const map = {
    '': 'everyday',
    all: 'everyday',
    everyday: 'everyday',
    daily: 'everyday',
    '毎日': 'everyday',
    weekday: 'weekday',
    weekdays: 'weekday',
    '平日': 'weekday',
    saturday: 'saturday',
    sat: 'saturday',
    '土曜': 'saturday',
    '土曜日': 'saturday',
    weekend: 'holiday',
    '土休日': 'holiday',
    holiday: 'holiday',
    holidays: 'holiday',
    sunday: 'holiday',
    sun: 'holiday',
    '休日': 'holiday',
    '日曜': 'holiday',
    '日祝': 'holiday'
  };
  return map[text] || text;
}

function normalizeBusServiceDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'yyyyMMdd');
  }
  return String(value || '').replace(/[^\d]/g, '').slice(0, 8);
}

function parseBusTimetableTime_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return buildBusTimetableTime_(Number(Utilities.formatDate(value, CONFIG.TIMEZONE, 'H')), Number(Utilities.formatDate(value, CONFIG.TIMEZONE, 'm')));
  }
  if (typeof value === 'number' && isFinite(value)) {
    const totalMinutes = Math.round(value * 24 * 60);
    return buildBusTimetableTime_(Math.floor(totalMinutes / 60), totalMinutes % 60);
  }
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  return buildBusTimetableTime_(Number(match[1]), Number(match[2]));
}

function buildBusTimetableTime_(hour, minute) {
  if (!isFinite(hour) || !isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }
  const normalizedHour = ((hour % 24) + 24) % 24;
  const todayText = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy/MM/dd');
  const date = new Date(todayText + ' ' + pad2_(normalizedHour) + ':' + pad2_(minute) + ':00 GMT+0900');
  if (hour >= 24) {
    date.setDate(date.getDate() + Math.floor(hour / 24));
  }
  return {
    scheduledMs: date.getTime(),
    text: pad2_(normalizedHour) + ':' + pad2_(minute)
  };
}

function pad2_(value) {
  return ('0' + Number(value)).slice(-2);
}

function setupBusTimetableSheet() {
  const spreadsheet = openLifeBoardSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, CONFIG.SHEETS.BUS_TIMETABLE);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, BUS_TIMETABLE_HEADERS.length).setValues([BUS_TIMETABLE_HEADERS]);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), BUS_TIMETABLE_HEADERS.length)).getValues()[0];
    const missingHeaders = BUS_TIMETABLE_HEADERS.filter(function (header) {
      return existingHeaders.indexOf(header) === -1;
    });
    if (missingHeaders.length) {
      sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  }
  sheet.setFrozenRows(1);
  autoResizeSafe_(sheet, BUS_TIMETABLE_HEADERS.length);
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
    headers: buildBusFetchHeaders_(route)
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
    countdownBaseAt: payload.updatedAt || nowIso_(),
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

function buildBusFetchHeaders_(route) {
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    Referer: String(route.official_url || buildOfficialBusPageUrl_(route)),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
  };
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
