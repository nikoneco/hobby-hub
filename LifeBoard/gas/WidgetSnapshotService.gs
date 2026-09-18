// Widget reads only these precomputed, independently updated snapshots.
// No Sheets / UrlFetch / general LifeBoard snapshot calls on the GET path.
const WIDGET_SNAPSHOT_PREFIX = 'WIDGET_SNAPSHOT_V1_';
const WIDGET_SNAPSHOT_MAX_ENCODED = 8000;

function apiGetWidgetData_() {
  return safeRun_('apiGetWidgetData_', function () {
    const properties = PropertiesService.getScriptProperties();
    const calendar = readWidgetPart_(properties, 'calendar');
    const bus = readWidgetPart_(properties, 'bus');
    return {
      calendar: calendar || { importedAt: '', events: [], previousDayEvents: [], errorText: 'Widget snapshot unavailable' },
      bus: bus || { routes: [] }
    };
  });
}

function readWidgetPart_(properties, part) {
  try {
    const raw = properties.getProperty(WIDGET_SNAPSHOT_PREFIX + part);
    if (!raw) return null;
    const envelope = decodeWidgetSnapshot_(raw);
    const failedAt = properties.getProperty(WIDGET_SNAPSHOT_PREFIX + part + '_FAILED');
    if (failedAt && Date.parse(failedAt) >= Date.parse(envelope.updatedAt)) return null;
    return envelope.data;
  } catch (error) {
    return null; // Never repair a cache miss by fetching live services during a widget read.
  }
}

function decodeWidgetSnapshot_(raw) {
  const blob = Utilities.newBlob(Utilities.base64Decode(raw), 'application/gzip');
  const envelope = JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8'));
  if (envelope.version !== 1 || !envelope.data || !Number.isFinite(Date.parse(envelope.updatedAt))) {
    throw new Error('Invalid widget snapshot');
  }
  return envelope;
}

function saveWidgetPartSafely_(part, importedAt, build) {
  // Derived snapshot failure must not turn a successful existing import into an error.
  let lock;
  let locked = false;
  if (!['bus', 'calendar'].includes(part) || !Number.isFinite(Date.parse(importedAt))) return false;
  try {
    lock = LockService.getScriptLock();
    locked = lock.tryLock(1000);
    if (!locked) throw new Error('Widget snapshot busy');
    const properties = PropertiesService.getScriptProperties();
    const key = WIDGET_SNAPSHOT_PREFIX + part;
    const old = properties.getProperty(key);
    if (old) {
      try { if (Date.parse(decodeWidgetSnapshot_(old).updatedAt) > Date.parse(importedAt)) return false; }
      catch (error) { /* A successful import may replace a corrupt derived snapshot. */ }
    }
    const envelope = { version: 1, updatedAt: importedAt, data: build() };
    const encoded = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(envelope), 'application/json')).getBytes());
    if (encoded.length > WIDGET_SNAPSHOT_MAX_ENCODED) throw new Error('Widget snapshot exceeds size limit');
    properties.setProperty(key, encoded);
    const failedAt = properties.getProperty(key + '_FAILED');
    if (!failedAt || Date.parse(failedAt) <= Date.parse(importedAt)) properties.deleteProperty(key + '_FAILED');
    return true;
  } catch (error) {
    // Mark invalidation without logging payloads/tokens or pretending the old data is current.
    try {
      if (locked) {
        const properties = PropertiesService.getScriptProperties();
        const key = WIDGET_SNAPSHOT_PREFIX + part + '_FAILED';
        const previous = properties.getProperty(key);
        if (!previous || Date.parse(previous) < Date.parse(importedAt)) properties.setProperty(key, importedAt);
      }
    } catch (ignored) { /* Quota failure may also prevent the diagnostic marker. */ }
    console.warn('Widget ' + part + ' snapshot refresh failed');
    return false;
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (ignored) { /* Derived refresh must never fail the source import. */ }
    }
  }
}

function widgetText_(value, limit) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').slice(0, limit);
}

function compactWidgetCalendar_(snapshot) {
  if (!snapshot || snapshot.errorText || !Number.isFinite(Date.parse(snapshot.importedAt))) throw new Error('Calendar snapshot unavailable');
  const all = (snapshot.events || []).concat(snapshot.previousDayEvents || []);
  // Retain the imported window; the widget filters the current date at display time.
  const events = all.map(function (event) {
    return {
      date: widgetText_(event.date, 10), dateText: widgetText_(event.dateText, 18),
      timeText: widgetText_(event.timeText, 24), title: widgetText_(event.title, 96),
      allDay: event.allDay === true, sortKey: widgetText_(event.sortKey || event.date, 64)
    };
  }).filter(function (event) { return /^\d{4}-\d{2}-\d{2}$/.test(event.date); });
  return { importedAt: snapshot.importedAt, events: events, previousDayEvents: events };
}

function saveWidgetCalendarImport_(payload, importedAt) {
  return saveWidgetPartSafely_('calendar', importedAt, function () {
    const events = (Array.isArray(payload.events) ? payload.events : []).map(function (event) {
      const row = {};
      CALENDAR_EVENT_HEADERS.forEach(function (header) { row[header] = calendarEventValue_(header, event, payload, importedAt); });
      return normalizeCalendarRow_(row);
    });
    return compactWidgetCalendar_({ importedAt: importedAt, events: events });
  });
}

function compactWidgetBus_(routes, importedAt, generatedAt) {
  function items(values) {
    return (Array.isArray(values) ? values : []).map(function (item) {
      return {
        scheduledDepartureTime: widgetText_(item.scheduledDepartureTime, 40),
        predictedDepartureTime: widgetText_(item.predictedDepartureTime, 40),
        scheduledDepartureText: widgetText_(item.scheduledDepartureText, 8),
        predictedDepartureText: widgetText_(item.predictedDepartureText, 8),
        previousStops: item.previousStops == null || item.previousStops === '' ? null :
          (Number.isInteger(Number(item.previousStops)) && Number(item.previousStops) >= 0 ? Number(item.previousStops) : null)
      };
    });
  }
  return { routes: (Array.isArray(routes) ? routes : []).filter(function (route) { return route && route.routeId; }).map(function (route) {
    const originalTime = route.sourceUpdatedAt || route.countdownBaseAt || generatedAt || '';
    return {
      routeId: widgetText_(route.routeId, 80), officialUrl: widgetText_(route.officialUrl, 500),
      sourceUpdatedAt: widgetText_(originalTime, 40), countdownBaseAt: widgetText_(originalTime, 40),
      importedAt: importedAt, errorText: route.errorText ? 'Source reported an error' : '',
      items: items(route.items), timetableItems: items(route.timetableItems)
    };
  }) };
}

function saveWidgetBusImport_(payload, importedAt) {
  return saveWidgetPartSafely_('bus', importedAt, function () {
    return compactWidgetBus_(payload.routes, importedAt, payload.generatedAt);
  });
}

// Admin-only manual first seed from existing stored sheets. Not in the public API allowlist.
// Import hooks maintain snapshots afterwards; no new recurring trigger is required.
function seedWidgetSnapshotsFromStoredData_() {
  const calendar = getCalendarSnapshot_();
  const calendarOk = saveWidgetPartSafely_('calendar', calendar.importedAt, function () { return compactWidgetCalendar_(calendar); });
  const rows = getStoredBusSnapshotRows_();
  const importedAt = rows.reduce(function (latest, row) {
    return Date.parse(row.imported_at) > Date.parse(latest || '1970-01-01') ? String(row.imported_at) : latest;
  }, '');
  const busOk = saveWidgetPartSafely_('bus', importedAt, function () {
    const routes = rows.map(function (row) {
      const route = JSON.parse(String(row.snapshot_json || '{}'));
      const compact = compactWidgetBus_([route], String(row.imported_at || ''), row.generated_at);
      return compact.routes[0];
    }).filter(Boolean);
    return { routes: routes };
  });
  return { calendarSaved: calendarOk, busSaved: busOk };
}
