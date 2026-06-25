const CALENDAR_EVENT_HEADERS = [
  'imported_at',
  'source',
  'generated_at',
  'window_from',
  'window_to',
  'date',
  'start_datetime',
  'end_date',
  'end_datetime',
  'title',
  'category',
  'color',
  'location',
  'all_day',
  'recurring',
  'source_uid',
  'sort_key'
];

function handleCalendarImportPost_(e) {
  try {
    const action = e && e.parameter ? String(e.parameter.action || '') : '';
    if (action !== 'importCalendarEvents') {
      throw new Error('Unsupported action: ' + action);
    }
    const payload = parseCalendarImportPayload_(e);
    verifyCalendarImportToken_(payload.token);
    const result = importCalendarEvents_(payload);
    return jsonOutput_({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Calendar import failed: ' + (error && error.stack ? error.stack : error));
    return jsonOutput_({
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error)
      }
    });
  }
}

function handleCalendarTokenSetupGet_(e) {
  try {
    const token = e && e.parameter ? String(e.parameter.token || '') : '';
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new Error('Invalid setup token format');
    }
    const properties = PropertiesService.getScriptProperties();
    if (properties.getProperty(CONFIG.CALENDAR.IMPORT_TOKEN_PROPERTY)) {
      throw new Error('Calendar import token is already configured');
    }
    properties.setProperty(CONFIG.CALENDAR.IMPORT_TOKEN_PROPERTY, token);
    return jsonOutput_({
      ok: true,
      data: {
        configured: true,
        property: CONFIG.CALENDAR.IMPORT_TOKEN_PROPERTY
      }
    });
  } catch (error) {
    return jsonOutput_({
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error)
      }
    });
  }
}

function parseCalendarImportPayload_(e) {
  const body = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!body) {
    throw new Error('Request body is empty');
  }
  return JSON.parse(body);
}

function verifyCalendarImportToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty(CONFIG.CALENDAR.IMPORT_TOKEN_PROPERTY);
  if (!expected) {
    throw new Error('Calendar import token is not configured');
  }
  if (!token || String(token) !== expected) {
    throw new Error('Invalid calendar import token');
  }
}

function importCalendarEvents_(payload) {
  const events = Array.isArray(payload.events) ? payload.events : [];
  const spreadsheet = openLifeBoardSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, CONFIG.SHEETS.CALENDAR_EVENTS);
  const importedAt = nowIso_();
  const rows = events.map(function (event) {
    return CALENDAR_EVENT_HEADERS.map(function (header) {
      return calendarEventValue_(header, event, payload, importedAt);
    });
  });

  sheet.clearContents();
  sheet.getRange(1, 1, Math.max(rows.length + 1, 2), CALENDAR_EVENT_HEADERS.length).setNumberFormat('@');
  sheet.getRange(1, 1, 1, CALENDAR_EVENT_HEADERS.length).setValues([CALENDAR_EVENT_HEADERS]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, CALENDAR_EVENT_HEADERS.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  autoResizeSafe_(sheet, CALENDAR_EVENT_HEADERS.length);

  return {
    importedAt: importedAt,
    source: String(payload.source || ''),
    generatedAt: String(payload.generatedAt || ''),
    importedEvents: rows.length
  };
}

function calendarEventValue_(header, event, payload, importedAt) {
  const window = payload.window || {};
  const map = {
    imported_at: importedAt,
    source: String(payload.source || ''),
    generated_at: String(payload.generatedAt || ''),
    window_from: String(window.from || ''),
    window_to: String(window.to || ''),
    date: String(event.date || ''),
    start_datetime: String(event.startDateTime || ''),
    end_date: String(event.endDate || ''),
    end_datetime: String(event.endDateTime || ''),
    title: String(event.title || ''),
    category: String(event.category || ''),
    color: String(event.color || ''),
    location: String(event.location || ''),
    all_day: event.allDay === true || event.allDay === 'TRUE' || event.allDay === 'true',
    recurring: event.recurring === true || event.recurring === 'TRUE' || event.recurring === 'true',
    source_uid: String(event.sourceUid || ''),
    sort_key: String(event.sortKey || '')
  };
  return map[header] == null ? '' : map[header];
}

function getCalendarSnapshot_() {
  try {
    const spreadsheet = openLifeBoardSpreadsheet_();
    const sheet = getSheetByName_(spreadsheet, CONFIG.SHEETS.CALENDAR_EVENTS);
    const rows = readObjects_(sheet);
    const today = dateAtLocalMidnight_(new Date());
    const headerThrough = new Date(today.getTime() + CONFIG.CALENDAR.HEADER_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const detailThrough = new Date(today.getTime() + CONFIG.CALENDAR.DETAIL_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const allEvents = rows
      .map(normalizeCalendarRow_)
      .filter(function (event) {
        return event.dateObject && event.dateObject >= today && event.dateObject <= detailThrough;
      })
      .sort(function (a, b) {
        return a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title);
      });
    const headerEvents = allEvents
      .filter(function (event) {
        return event.dateObject <= headerThrough;
      })
      .slice(0, CONFIG.CALENDAR.HEADER_MAX_EVENTS);
    const detailEvents = allEvents.slice(0, CONFIG.CALENDAR.DETAIL_MAX_EVENTS);

    return {
      fetchedAt: nowIso_(),
      sourceNote: CONFIG.CALENDAR.SOURCE_NOTE,
      importedAt: rows.length ? String(rows[0].imported_at || '') : '',
      headerEvents: headerEvents.map(stripCalendarDateObject_),
      events: detailEvents.map(stripCalendarDateObject_)
    };
  } catch (error) {
    console.warn('Calendar snapshot fallback: ' + error.message);
    return {
      fetchedAt: nowIso_(),
      sourceNote: CONFIG.CALENDAR.SOURCE_NOTE,
      importedAt: '',
      headerEvents: [],
      events: [],
      errorText: error && error.message ? error.message : String(error)
    };
  }
}

function normalizeCalendarRow_(row) {
  const dateObject = parseCalendarLocalDate_(row.date);
  const allDay = row.all_day === true || row.all_day === 'TRUE' || row.all_day === 'true';
  return {
    date: String(row.date || ''),
    dateText: dateObject ? formatJapaneseDateText_(dateObject) : String(row.date || ''),
    timeText: allDay ? '終日' : formatCalendarTimeText_(row.start_datetime, row.end_datetime),
    title: String(row.title || ''),
    category: String(row.category || ''),
    color: String(row.color || ''),
    location: String(row.location || ''),
    allDay: allDay,
    recurring: row.recurring === true || row.recurring === 'TRUE' || row.recurring === 'true',
    sourceUid: String(row.source_uid || ''),
    sortKey: String(row.sort_key || row.date || ''),
    dateObject: dateObject
  };
}

function stripCalendarDateObject_(event) {
  const copy = {};
  Object.keys(event).forEach(function (key) {
    if (key !== 'dateObject') {
      copy[key] = event[key];
    }
  });
  return copy;
}

function parseCalendarLocalDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
    return dateAtLocalMidnight_(value);
  }
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatCalendarTimeText_(startIso, endIso) {
  const start = startIso ? Utilities.formatDate(new Date(startIso), CONFIG.TIMEZONE, 'H:mm') : '';
  const end = endIso ? Utilities.formatDate(new Date(endIso), CONFIG.TIMEZONE, 'H:mm') : '';
  return end ? start + '-' + end : start;
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function autoResizeSafe_(sheet, columns) {
  try {
    sheet.autoResizeColumns(1, columns);
  } catch (error) {
    console.warn('autoResizeColumns skipped: ' + error.message);
  }
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function setCalendarImportToken(token) {
  if (!token) {
    throw new Error('token is required');
  }
  PropertiesService.getScriptProperties().setProperty(CONFIG.CALENDAR.IMPORT_TOKEN_PROPERTY, String(token));
  return {
    ok: true,
    property: CONFIG.CALENDAR.IMPORT_TOKEN_PROPERTY
  };
}
