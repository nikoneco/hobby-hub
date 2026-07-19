const WEATHER_SNAPSHOT_HEADERS = [
  'imported_at',
  'source',
  'generated_at',
  'location_id',
  'snapshot_json'
];

function handleWeatherSnapshotImportPost_(e) {
  try {
    const payload = parseWeatherSnapshotImportPayload_(e);
    verifyCalendarImportToken_(payload.token);
    const result = importWeatherSnapshots_(payload);
    return jsonOutput_({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Weather snapshot import failed: ' + (error && error.stack ? error.stack : error));
    return jsonOutput_({
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error)
      }
    });
  }
}

function parseWeatherSnapshotImportPayload_(e) {
  const body = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!body) {
    throw new Error('Request body is empty');
  }
  return JSON.parse(body);
}

function importWeatherSnapshots_(payload) {
  const locations = Array.isArray(payload.locations) ? payload.locations : [];
  const spreadsheet = openLifeBoardSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, CONFIG.SHEETS.WEATHER_SNAPSHOTS);
  const importedAt = nowIso_();
  const rows = locations
    .filter(function (location) {
      return location && location.locationId;
    })
    .map(function (location) {
      return WEATHER_SNAPSHOT_HEADERS.map(function (header) {
        return weatherSnapshotValue_(header, location, payload, importedAt);
      });
    });

  sheet.clearContents();
  sheet.getRange(1, 1, Math.max(rows.length + 1, 2), WEATHER_SNAPSHOT_HEADERS.length).setNumberFormat('@');
  sheet.getRange(1, 1, 1, WEATHER_SNAPSHOT_HEADERS.length).setValues([WEATHER_SNAPSHOT_HEADERS]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, WEATHER_SNAPSHOT_HEADERS.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  autoResizeSafe_(sheet, WEATHER_SNAPSHOT_HEADERS.length);

  return {
    importedAt: importedAt,
    source: String(payload.source || ''),
    generatedAt: String(payload.generatedAt || ''),
    importedLocations: rows.length
  };
}

function weatherSnapshotValue_(header, location, payload, importedAt) {
  const map = {
    imported_at: importedAt,
    source: String(payload.source || ''),
    generated_at: String(payload.generatedAt || ''),
    location_id: String(location.locationId || ''),
    snapshot_json: JSON.stringify(location)
  };
  return map[header] == null ? '' : map[header];
}

function getWeatherLocations_() {
  try {
    const spreadsheet = openLifeBoardSpreadsheet_();
    const sheet = getSheetByName_(spreadsheet, CONFIG.SHEETS.WEATHER_LOCATIONS);
    const locations = readObjects_(sheet)
      .filter(function (location) {
        return location.enabled === true || location.enabled === 'TRUE' || location.enabled === 'true';
      })
      .sort(function (a, b) {
        return Number(a.display_order || 0) - Number(b.display_order || 0);
      });
    return locations.length ? locations : CONFIG.WEATHER.DEFAULT_LOCATIONS;
  } catch (error) {
    console.warn('Falling back to built-in weather locations: ' + error.message);
    return CONFIG.WEATHER.DEFAULT_LOCATIONS;
  }
}

function getWeatherSnapshot_() {
  const locations = getWeatherLocations_();
  return {
    fetchedAt: nowIso_(),
    sourceNote: CONFIG.WEATHER.SOURCE_NOTE,
    locations: locations.map(fetchWeatherLocationSnapshotSafely_)
  };
}

function fetchWeatherLocationSnapshotSafely_(location) {
  try {
    const stored = getStoredWeatherLocationSnapshot_(location);
    if (stored) {
      return stored;
    }
    return fetchWeatherLocationSnapshot_(location);
  } catch (error) {
    console.error('Weather location failed: ' + location.location_id + ': ' + (error && error.stack ? error.stack : error));
    const fallback = buildWeatherFallbackSnapshot_(location, error);
    CacheService.getScriptCache().put(
      buildWeatherCacheKey_(location),
      JSON.stringify(fallback),
      Number(CONFIG.WEATHER.FAILURE_CACHE_SECONDS || CONFIG.WEATHER.CACHE_SECONDS || 300)
    );
    return fallback;
  }
}

function getStoredWeatherLocationSnapshot_(location) {
  try {
    const spreadsheet = openLifeBoardSpreadsheet_();
    const sheet = getSheetByName_(spreadsheet, CONFIG.SHEETS.WEATHER_SNAPSHOTS);
    const rows = readObjects_(sheet);
    const locationId = String(location.location_id || '');
    const row = rows.filter(function (candidate) {
      return String(candidate.location_id || '') === locationId;
    })[0];
    if (!row) {
      return null;
    }
    const importedAt = String(row.imported_at || '');
    if (isStoredWeatherSnapshotStale_(importedAt)) {
      return null;
    }
    const snapshot = JSON.parse(String(row.snapshot_json || '{}'));
    snapshot.locationId = String(snapshot.locationId || location.location_id || '');
    snapshot.displayName = String(snapshot.displayName || location.display_name || '');
    snapshot.importedAt = importedAt;
    snapshot.source = String(row.source || snapshot.source || 'weathernews-scraper');
    snapshot.fetchedAt = String(snapshot.fetchedAt || row.generated_at || importedAt || nowIso_());
    snapshot.sourceUpdatedAtText = snapshot.sourceUpdatedAtText
      ? String(snapshot.sourceUpdatedAtText) + ' / 手動同期'
      : '手動同期';
    return snapshot;
  } catch (error) {
    console.warn('Stored weather snapshot unavailable: ' + (error && error.message ? error.message : String(error)));
    return null;
  }
}

function isStoredWeatherSnapshotStale_(importedAt) {
  const importedMs = Date.parse(importedAt);
  if (!Number.isFinite(importedMs)) {
    return true;
  }
  const maxAgeMs = Number(CONFIG.WEATHER.STORED_MAX_AGE_MINUTES || 90) * 60 * 1000;
  return Date.now() - importedMs > maxAgeMs;
}

function buildWeatherFallbackSnapshot_(location, originalError) {
  try {
    return buildJmaWeatherFallbackSnapshot_(location, originalError);
  } catch (fallbackError) {
    console.warn('JMA weather fallback failed: ' + (fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError)));
    return {
      locationId: String(location.location_id || ''),
      displayName: String(location.display_name || ''),
      statusText: '確認できず',
      weatherClass: 'unknown',
      temperatureText: '-',
      apparentText: '-',
      humidityText: '-',
      precipitationText: '-',
      windText: '-',
      highLowText: '-',
      rainChanceText: '-',
      umbrellaText: '-',
      hourly: [],
      detailText: originalError && originalError.message ? originalError.message : String(originalError),
      sourceUrl: 'https://open-meteo.com/',
      fetchedAt: nowIso_()
    };
  }
}

function fetchWeatherLocationSnapshot_(location) {
  const cache = CacheService.getScriptCache();
  const cacheKey = buildWeatherCacheKey_(location);
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const response = UrlFetchApp.fetch(buildWeatherApiUrl_(location), {
    muteHttpExceptions: true,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Weather API request failed: HTTP ' + status);
  }

  const payload = JSON.parse(response.getContentText());
  const current = payload.current || {};
  const daily = payload.daily || {};
  const weatherCode = current.weather_code == null ? dailyValue_(daily.weather_code) : current.weather_code;
  const rainNowcast = getYahooRainNowcastSafely_(location) || getJmaRainNowcastSafely_(location);
  const rainOutlook = getJmaLongRainOutlookSafely_();
  const umbrellaText = buildCombinedUmbrellaAdvice_(rainNowcast, rainOutlook);
  const precipitationText = rainNowcast && rainNowcast.precipitationText ? rainNowcast.precipitationText : '-';
  const snapshot = {
    locationId: String(location.location_id || ''),
    displayName: String(location.display_name || ''),
    statusText: describeWeatherCode_(weatherCode),
    weatherClass: classifyWeatherCode_(weatherCode),
    temperatureText: formatWeatherNumber_(current.temperature_2m, '℃'),
    apparentText: formatWeatherNumber_(current.apparent_temperature, '℃'),
    humidityText: formatWeatherNumber_(current.relative_humidity_2m, '%'),
    precipitationText: precipitationText,
    windText: formatWeatherNumber_(current.wind_speed_10m, 'km/h'),
    highLowText: formatHighLow_(dailyValue_(daily.temperature_2m_max), dailyValue_(daily.temperature_2m_min)),
    rainChanceText: '-',
    umbrellaText: umbrellaText,
    rainNowcast: rainNowcast,
    rainOutlook: rainOutlook,
    clothingText: buildClothingAdvice_(current.apparent_temperature, dailyValue_(daily.temperature_2m_min), dailyValue_(daily.temperature_2m_max)),
    astronomy: buildAstronomyInfo_(payload, location),
    hourly: buildHourlyWeather_(payload),
    sourceUpdatedAtText: formatWeatherTime_(current.time),
    sourceUrl: 'https://open-meteo.com/',
    fetchedAt: nowIso_()
  };

  cache.put(cacheKey, JSON.stringify(snapshot), CONFIG.WEATHER.CACHE_SECONDS);
  return snapshot;
}

function buildWeatherCacheKey_(location) {
  return 'weather:v6:' + location.location_id;
}

function buildWeatherApiUrl_(location) {
  const params = {
    latitude: location.latitude,
    longitude: location.longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,apparent_temperature,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
    timezone: location.timezone || CONFIG.TIMEZONE,
    forecast_days: 2
  };
  return CONFIG.WEATHER.API_BASE_URL + '?' + toQueryString_(params);
}

function dailyValue_(values) {
  return values && values.length ? values[0] : '';
}

function formatWeatherNumber_(value, unit) {
  if (value === '' || value == null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Math.round(Number(value) * 10) / 10 + unit;
}

function formatHighLow_(high, low) {
  if (high === '' || low === '' || high == null || low == null) {
    return '-';
  }
  return Math.round(Number(low) * 10) / 10 + '℃ / ' + Math.round(Number(high) * 10) / 10 + '℃';
}

function formatWeatherTime_(isoText) {
  if (!isoText) {
    return '';
  }
  return Utilities.formatDate(new Date(isoText), CONFIG.TIMEZONE, 'MM/dd HH:mm');
}

function buildJmaWeatherFallbackSnapshot_(location, originalError) {
  const report = fetchJmaForecastReport_();
  const weatherSeries = report.timeSeries && report.timeSeries[0];
  const tempSeries = report.timeSeries && report.timeSeries[2];
  const weatherArea = findJmaArea_(weatherSeries, CONFIG.WEATHER.JMA_FORECAST_AREA_CODE);
  const tempArea = findJmaArea_(tempSeries, CONFIG.WEATHER.JMA_TEMPERATURE_AREA_CODE)
    || findJmaAreaByName_(tempSeries, '東京')
    || firstArrayItem_(tempSeries && tempSeries.areas);
  const weatherText = selectJmaTimedValue_(weatherSeries && weatherSeries.timeDefines, weatherArea && weatherArea.weathers);
  const temps = asArray_(tempArea && tempArea.temps).map(function (value) {
    return Number(value);
  }).filter(function (value) {
    return !Number.isNaN(value);
  });
  const currentTemp = selectJmaTimedValue_(tempSeries && tempSeries.timeDefines, tempArea && tempArea.temps);
  const low = temps.length ? Math.min.apply(null, temps) : '';
  const high = temps.length ? Math.max.apply(null, temps) : '';
  const rainOutlook = buildJmaLongRainOutlookFromReport_(report);

  return {
    locationId: String(location.location_id || ''),
    displayName: String(location.display_name || ''),
    statusText: normalizeJmaWeatherText_(weatherText) || '天気情報',
    weatherClass: classifyJmaWeatherText_(weatherText),
    temperatureText: formatWeatherNumber_(currentTemp, '℃'),
    apparentText: '-',
    humidityText: '-',
    precipitationText: '-',
    windText: '-',
    highLowText: formatHighLow_(high, low),
    rainChanceText: '-',
    umbrellaText: buildCombinedUmbrellaAdvice_(null, rainOutlook),
    rainNowcast: null,
    rainOutlook: rainOutlook,
    clothingText: buildClothingAdvice_(currentTemp, low, high),
    astronomy: {},
    hourly: [],
    sourceUpdatedAtText: formatWeatherTime_(report.reportDatetime),
    sourceUrl: CONFIG.WEATHER.JMA_FORECAST_URL,
    detailText: 'Open-Meteo fallback: ' + (originalError && originalError.message ? originalError.message : String(originalError)),
    fetchedAt: nowIso_()
  };
}

function getJmaLongRainOutlookSafely_() {
  try {
    return getJmaLongRainOutlook_();
  } catch (error) {
    console.warn('JMA long rain outlook fallback: ' + (error && error.message ? error.message : String(error)));
    return null;
  }
}

function getJmaLongRainOutlook_() {
  return buildJmaLongRainOutlookFromReport_(fetchJmaForecastReport_());
}

function fetchJmaForecastReport_() {
  const response = UrlFetchApp.fetch(CONFIG.WEATHER.JMA_FORECAST_URL, {
    muteHttpExceptions: true,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('JMA forecast request failed: HTTP ' + status);
  }

  const reports = JSON.parse(response.getContentText());
  const report = firstArrayItem_(reports);
  if (!report) {
    throw new Error('JMA forecast report not found');
  }
  return report;
}

function buildJmaLongRainOutlookFromReport_(report) {
  const weatherArea = findJmaArea_(report.timeSeries && report.timeSeries[0], CONFIG.WEATHER.JMA_FORECAST_AREA_CODE);
  const popSeries = report.timeSeries && report.timeSeries[1];
  const popArea = findJmaArea_(popSeries, CONFIG.WEATHER.JMA_FORECAST_AREA_CODE);
  const weatherText = weatherArea && weatherArea.weathers ? String(weatherArea.weathers[0] || '') : '';
  const periods = buildJmaRainPeriods_(popSeries && popSeries.timeDefines, popArea && popArea.pops, weatherText);
  const afternoon = periods.filter(function (period) {
    return period.label === '午後';
  })[0];
  const night = periods.filter(function (period) {
    return period.label === '夜';
  })[0];
  const labels = [];
  if (afternoon && afternoon.hasRain) labels.push('午後雨');
  if (night && night.hasRain) labels.push('夜雨');
  const hasHeavyRain = weatherText.indexOf('激しく') >= 0 || weatherText.indexOf('非常に激しく') >= 0 || weatherText.indexOf('大雨') >= 0;

  return {
    source: 'JMA_FORECAST',
    sourceUpdatedAtText: formatWeatherTime_(report.reportDatetime),
    weatherText: weatherText,
    afternoonPop: afternoon ? afternoon.pop : '',
    nightPop: night ? night.pop : '',
    hasAfternoonRain: Boolean(afternoon && afternoon.hasRain),
    hasNightRain: Boolean(night && night.hasRain),
    hasLaterRain: labels.length > 0,
    hasHeavyRain: hasHeavyRain,
    outlookText: labels.length ? labels.join('・') : '雨予報なし'
  };
}

function findJmaArea_(timeSeries, areaCode) {
  const areas = timeSeries && timeSeries.areas ? timeSeries.areas : [];
  return areas.filter(function (area) {
    return area && area.area && String(area.area.code) === String(areaCode);
  })[0] || null;
}

function findJmaAreaByName_(timeSeries, areaName) {
  const areas = timeSeries && timeSeries.areas ? timeSeries.areas : [];
  return areas.filter(function (area) {
    return area && area.area && String(area.area.name || '') === String(areaName);
  })[0] || null;
}

function selectJmaTimedValue_(timeDefines, values) {
  const times = asArray_(timeDefines);
  const items = asArray_(values);
  if (!items.length) {
    return '';
  }
  const now = new Date();
  let selected = items[0];
  for (let i = 0; i < items.length; i += 1) {
    const time = times[i] ? new Date(times[i]) : null;
    if (!time || Number.isNaN(time.getTime())) {
      continue;
    }
    if (time <= now) {
      selected = items[i];
    }
  }
  return selected;
}

function normalizeJmaWeatherText_(text) {
  const normalized = String(text || '').replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  const main = normalized.split(/ 所により| 時々| 一時| のち/)[0].trim();
  return main || normalized;
}

function classifyJmaWeatherText_(text) {
  const value = normalizeJmaWeatherText_(text);
  if (/雪/.test(value)) {
    return 'snow';
  }
  if (/雷|大雨|激しい雨|強い雨/.test(value)) {
    return 'storm';
  }
  if (/雨|しゅう雨/.test(value)) {
    return 'rain';
  }
  if (/くもり|曇/.test(value)) {
    return 'cloud';
  }
  if (/晴/.test(value)) {
    return 'clear';
  }
  return 'unknown';
}

function buildJmaRainPeriods_(timeDefines, pops, weatherText) {
  const times = timeDefines || [];
  const probabilities = pops || [];
  const threshold = Number(CONFIG.WEATHER.LONG_RAIN_POP_THRESHOLD || 40);
  const text = String(weatherText || '');
  return times.map(function (timeText, index) {
    const date = new Date(timeText);
    const hour = date.getHours();
    const pop = Number(probabilities[index]);
    const label = hour >= 12 && hour < 18 ? '午後' : hour >= 18 ? '夜' : '';
    const textSuggestsRain = label === '午後'
      ? hasJmaRainWordForPeriod_(text, ['午後', '昼過ぎ', '夕方'])
      : label === '夜'
        ? hasJmaRainWordForPeriod_(text, ['夜', '夜遅く', '夜のはじめ頃'])
        : false;
    return {
      label: label,
      pop: Number.isNaN(pop) ? '' : pop,
      hasRain: Boolean(label) && ((!Number.isNaN(pop) && pop >= threshold) || textSuggestsRain)
    };
  }).filter(function (period) {
    return Boolean(period.label);
  });
}

function hasJmaRainWordForPeriod_(text, periodWords) {
  if (text.indexOf('雨') < 0) {
    return false;
  }
  return periodWords.some(function (word) {
    const index = text.indexOf(word);
    if (index < 0) {
      return false;
    }
    return text.indexOf('雨', index) >= 0;
  });
}

function buildCombinedUmbrellaAdvice_(rainNowcast, rainOutlook) {
  if (!rainNowcast && !rainOutlook) {
    return '雨確認不可';
  }
  const current = Number(rainNowcast && rainNowcast.observedRainfall);
  const maxForecast = Number(rainNowcast && rainNowcast.maxForecastRainfall);
  const currentRain = Number.isNaN(current) ? 0 : current;
  const nextHourRain = Number.isNaN(maxForecast) ? 0 : maxForecast;
  const hasLongRain = Boolean(rainOutlook && rainOutlook.hasLaterRain);
  const hasHeavyRain = Boolean(rainOutlook && rainOutlook.hasHeavyRain);
  if ((currentRain >= 0.1 && hasLongRain) || currentRain >= 1 || nextHourRain >= 1 || hasHeavyRain) {
    return '傘推奨';
  }
  if (currentRain >= 0.1 || nextHourRain >= 0.1 || hasLongRain) {
    return '折りたたみ推奨';
  }
  return '雨具不要';
}

function getYahooRainNowcastSafely_(location) {
  try {
    return getYahooRainNowcast_(location);
  } catch (error) {
    console.warn('Yahoo rain nowcast fallback: ' + (error && error.message ? error.message : String(error)));
    return null;
  }
}

function getYahooRainNowcast_(location) {
  const lat = Number(location.latitude);
  const lon = Number(location.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  const clientId = PropertiesService.getScriptProperties().getProperty(CONFIG.WEATHER.YAHOO_CLIENT_ID_PROPERTY);
  if (!clientId) {
    return null;
  }

  const params = {
    coordinates: lon + ',' + lat,
    output: 'json',
    interval: 5,
    appid: clientId
  };
  const response = UrlFetchApp.fetch(CONFIG.WEATHER.YAHOO_API_BASE_URL + '?' + toQueryString_(params), {
    muteHttpExceptions: true,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Yahoo rain request failed: HTTP ' + status);
  }

  const payload = JSON.parse(response.getContentText());
  const feature = firstArrayItem_(payload.Feature);
  const weatherList = feature && feature.Property && feature.Property.WeatherList;
  const rows = asArray_(weatherList && weatherList.Weather).map(function (row) {
    return {
      type: String(row.Type || ''),
      date: String(row.Date || ''),
      rainfall: Number(row.Rainfall)
    };
  }).filter(function (row) {
    return !Number.isNaN(row.rainfall);
  });
  if (!rows.length) {
    throw new Error('Yahoo rain data not found');
  }

  const observation = rows.filter(function (row) {
    return row.type === 'observation';
  }).sort(function (a, b) {
    return String(b.date).localeCompare(String(a.date));
  })[0] || rows[0];
  const forecasts = rows.filter(function (row) {
    return row.type === 'forecast';
  });
  const maxForecast = forecasts.reduce(function (max, row) {
    return Math.max(max, row.rainfall);
  }, 0);
  const maxRainfall = Math.max(observation.rainfall, maxForecast);
  const isRaining = observation.rainfall >= 0.1;
  const hasUpcomingRain = maxForecast >= 0.1;
  return {
    source: 'YAHOO_WEATHER',
    sourceUpdatedAtText: formatYahooWeatherTime_(observation.date),
    observedRainfall: observation.rainfall,
    maxForecastRainfall: maxForecast,
    rainNowcastText: buildYahooRainNowcastText_(isRaining, hasUpcomingRain, maxRainfall),
    precipitationText: formatYahooPrecipitationText_(observation.rainfall, maxForecast),
    umbrellaText: buildYahooUmbrellaAdvice_(observation.rainfall, maxForecast)
  };
}

function asArray_(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function firstArrayItem_(value) {
  const items = asArray_(value);
  return items.length ? items[0] : null;
}

function formatYahooWeatherTime_(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) {
    return '';
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'MM/dd HH:mm');
}

function formatYahooPrecipitationText_(current, maxForecast) {
  return '現在 ' + formatRainfall_(current) + ' / 60分最大 ' + formatRainfall_(maxForecast);
}

function formatRainfall_(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return '-';
  }
  return (Math.round(number * 10) / 10).toFixed(number >= 10 ? 0 : 1).replace(/\.0$/, '') + 'mm/h';
}

function buildYahooRainNowcastText_(isRaining, hasUpcomingRain, maxRainfall) {
  if (isRaining) {
    return maxRainfall >= 5 ? '強い雨' : '雨あり';
  }
  if (hasUpcomingRain) {
    return '雨予測あり';
  }
  return '雨なし';
}

function buildYahooUmbrellaAdvice_(current, maxForecast) {
  const maxRainfall = Math.max(Number(current) || 0, Number(maxForecast) || 0);
  if (maxRainfall >= 1) {
    return '雨具推奨';
  }
  if (maxRainfall >= 0.1) {
    return '折りたたみ推奨';
  }
  return '雨具不要';
}

function getJmaRainNowcastSafely_(location) {
  try {
    return getJmaRainNowcast_(location);
  } catch (error) {
    console.warn('JMA rain nowcast fallback: ' + (error && error.message ? error.message : String(error)));
    return null;
  }
}

function getJmaRainNowcast_(location) {
  const lat = Number(location.latitude);
  const lon = Number(location.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  const timesResponse = UrlFetchApp.fetch('https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json', {
    muteHttpExceptions: true,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  if (timesResponse.getResponseCode() < 200 || timesResponse.getResponseCode() >= 300) {
    throw new Error('JMA nowcast time request failed: HTTP ' + timesResponse.getResponseCode());
  }

  const times = JSON.parse(timesResponse.getContentText());
  const target = (times || []).filter(function (item) {
    return item && item.basetime && item.validtime && item.elements && item.elements.indexOf('hrpns') >= 0;
  })[0];
  if (!target) {
    throw new Error('JMA nowcast target time not found');
  }

  const tile = latLonToTile_(lat, lon, 14);
  const url = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/'
    + target.basetime + '/none/' + target.validtime + '/surf/hrpns/'
    + tile.z + '/' + tile.x + '/' + tile.y + '.png';
  const tileResponse = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: {
      Accept: 'image/png',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  if (tileResponse.getResponseCode() < 200 || tileResponse.getResponseCode() >= 300) {
    throw new Error('JMA nowcast tile request failed: HTTP ' + tileResponse.getResponseCode());
  }

  const bytes = tileResponse.getBlob().getBytes();
  const hasRainPixels = bytes.length > 400;
  return {
    source: 'JMA_NOWCAST',
    sourceUpdatedAtText: formatJmaNowcastTime_(target.validtime),
    tileBytes: bytes.length,
    rainNowcastText: hasRainPixels ? '雨雲あり' : '雨雲なし',
    precipitationText: hasRainPixels ? '雨雲あり' : '0mm/h',
    umbrellaText: hasRainPixels ? '折りたたみ推奨' : '雨具不要'
  };
}

function latLonToTile_(lat, lon, z) {
  const latRad = lat * Math.PI / 180;
  const scale = Math.pow(2, z);
  return {
    z: z,
    x: Math.floor((lon + 180) / 360 * scale),
    y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale)
  };
}

function formatJmaNowcastTime_(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) {
    return '';
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])));
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'MM/dd HH:mm');
}

function buildClothingAdvice_(apparent, low, high) {
  const feel = Number(apparent);
  const min = Number(low);
  const max = Number(high);
  if (feel <= 10 || min <= 8) {
    return '厚手の上着';
  }
  if (feel <= 16 || min <= 14) {
    return '上着が安心';
  }
  if (max >= 30 || feel >= 28) {
    return '暑さ対策';
  }
  if (max >= 25) {
    return '軽めでOK';
  }
  return '過ごしやすい';
}

function buildHourlyWeather_(payload) {
  const hourly = payload.hourly || {};
  const now = new Date();
  const rows = [];
  const times = hourly.time || [];
  for (let i = 0; i < times.length; i += 1) {
    const time = new Date(times[i]);
    if (time < now) {
      continue;
    }
    rows.push({
      timeText: Utilities.formatDate(time, CONFIG.TIMEZONE, 'HH:mm'),
      temperature: roundOne_(hourlyValue_(hourly.temperature_2m, i)),
      apparent: roundOne_(hourlyValue_(hourly.apparent_temperature, i)),
      weatherText: describeWeatherCode_(hourlyValue_(hourly.weather_code, i))
    });
    if (rows.length >= 24) {
      break;
    }
  }
  return rows;
}

function roundOne_(value) {
  if (value === '' || value == null || Number.isNaN(Number(value))) {
    return '';
  }
  return Math.round(Number(value) * 10) / 10;
}

function hourlyValue_(values, index) {
  return values && values[index] != null ? values[index] : '';
}

function buildAstronomyInfo_(payload, location) {
  const daily = payload.daily || {};
  const dateText = dailyValue_(daily.time) || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const date = parseLocalDateOnly_(dateText);
  const sunrise = dailyValue_(daily.sunrise);
  const sunset = dailyValue_(daily.sunset);
  const moonTimes = calculateMoonTimes_(date, Number(location.latitude), Number(location.longitude));
  return {
    sunText: formatOpenMeteoTime_(sunrise) && formatOpenMeteoTime_(sunset)
      ? formatOpenMeteoTime_(sunrise) + '-' + formatOpenMeteoTime_(sunset)
      : '',
    moonAgeText: '月齢' + calculateMoonAge_(date).toFixed(1),
    moonText: moonTimes.riseText && moonTimes.setText ? moonTimes.riseText + '-' + moonTimes.setText : ''
  };
}

function parseLocalDateOnly_(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return dateAtLocalMidnight_(new Date());
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatOpenMeteoTime_(value) {
  const match = String(value || '').match(/T(\d{1,2}):(\d{2})/);
  if (match) {
    return Number(match[1]) + ':' + match[2];
  }
  return '';
}

function calculateMoonAge_(date) {
  const synodicMonth = 29.530588853;
  const knownNewMoonUtc = Date.UTC(2000, 0, 6, 18, 14);
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const days = (localNoon.getTime() - knownNewMoonUtc) / 86400000;
  return ((days % synodicMonth) + synodicMonth) % synodicMonth;
}

function calculateMoonTimes_(date, latitude, longitude) {
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { riseText: '', setText: '' };
  }
  const hc = 0.133 * Math.PI / 180;
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  let h0 = getMoonAltitude_(t, latitude, longitude) - hc;
  let rise = null;
  let set = null;
  let ye = 0;

  for (let hour = 1; hour <= 24; hour += 2) {
    const h1 = getMoonAltitude_(new Date(t.getTime() + hour * 3600000), latitude, longitude) - hc;
    const h2 = getMoonAltitude_(new Date(t.getTime() + (hour + 1) * 3600000), latitude, longitude) - hc;
    const a = (h0 + h2) / 2 - h1;
    const b = (h2 - h0) / 2;
    const xe = a === 0 ? 0 : -b / (2 * a);
    ye = (a * xe + b) * xe + h1;
    const discriminant = b * b - 4 * a * h1;
    let roots = 0;
    let x1 = 0;
    let x2 = 0;

    if (discriminant >= 0 && a !== 0) {
      const dx = Math.sqrt(discriminant) / (Math.abs(a) * 2);
      x1 = xe - dx;
      x2 = xe + dx;
      if (Math.abs(x1) <= 1) roots += 1;
      if (Math.abs(x2) <= 1) roots += 1;
      if (x1 < -1) x1 = x2;
    }

    if (roots === 1) {
      if (h0 < 0) {
        rise = hour + x1;
      } else {
        set = hour + x1;
      }
    } else if (roots === 2) {
      rise = hour + (ye < 0 ? x2 : x1);
      set = hour + (ye < 0 ? x1 : x2);
    }

    if (rise !== null && set !== null) {
      break;
    }
    h0 = h2;
  }

  return {
    riseText: rise === null ? '' : formatHourOffset_(t, rise),
    setText: set === null ? '' : formatHourOffset_(t, set),
    alwaysUp: rise === null && set === null && ye > 0,
    alwaysDown: rise === null && set === null && ye <= 0
  };
}

function getMoonAltitude_(date, latitude, longitude) {
  const rad = Math.PI / 180;
  const lw = -longitude * rad;
  const phi = latitude * rad;
  const days = toAstronomyDays_(date);
  const coords = getMoonCoords_(days);
  const hourAngle = getSiderealTime_(days, lw) - coords.rightAscension;
  const height = Math.asin(
    Math.sin(phi) * Math.sin(coords.declination) +
    Math.cos(phi) * Math.cos(coords.declination) * Math.cos(hourAngle)
  );
  return height + getAstronomyRefraction_(height);
}

function getMoonCoords_(days) {
  const rad = Math.PI / 180;
  const eclipticObliquity = 23.4397 * rad;
  const meanLongitude = (218.316 + 13.176396 * days) * rad;
  const meanAnomaly = (134.963 + 13.064993 * days) * rad;
  const meanDistance = (93.272 + 13.229350 * days) * rad;
  const longitude = meanLongitude + 6.289 * rad * Math.sin(meanAnomaly);
  const latitude = 5.128 * rad * Math.sin(meanDistance);
  return {
    rightAscension: Math.atan2(
      Math.sin(longitude) * Math.cos(eclipticObliquity) - Math.tan(latitude) * Math.sin(eclipticObliquity),
      Math.cos(longitude)
    ),
    declination: Math.asin(
      Math.sin(latitude) * Math.cos(eclipticObliquity) +
      Math.cos(latitude) * Math.sin(eclipticObliquity) * Math.sin(longitude)
    )
  };
}

function toAstronomyDays_(date) {
  return date.getTime() / 86400000 - 10957.5;
}

function getSiderealTime_(days, longitudeWest) {
  return (280.16 + 360.9856235 * days) * Math.PI / 180 - longitudeWest;
}

function getAstronomyRefraction_(height) {
  const safeHeight = height < 0 ? 0 : height;
  return 0.0002967 / Math.tan(safeHeight + 0.00312536 / (safeHeight + 0.08901179));
}

function formatHourOffset_(date, hourOffset) {
  const time = new Date(date.getTime() + hourOffset * 3600000);
  return Utilities.formatDate(time, CONFIG.TIMEZONE, 'H:mm');
}

function describeWeatherCode_(code) {
  const value = Number(code);
  const labels = {
    0: '快晴',
    1: '晴れ',
    2: '一部くもり',
    3: 'くもり',
    45: '霧',
    48: '霧氷',
    51: '弱い霧雨',
    53: '霧雨',
    55: '強い霧雨',
    61: '弱い雨',
    63: '雨',
    65: '強い雨',
    80: 'にわか雨',
    81: 'にわか雨',
    82: '強いにわか雨',
    95: '雷雨'
  };
  return labels[value] || '天気情報';
}

function classifyWeatherCode_(code) {
  const value = Number(code);
  if (value === 0 || value === 1) {
    return 'clear';
  }
  if (value === 2 || value === 3 || value === 45 || value === 48) {
    return 'cloud';
  }
  if ((value >= 51 && value <= 67) || (value >= 80 && value <= 82)) {
    return 'rain';
  }
  if (value >= 95) {
    return 'storm';
  }
  return 'unknown';
}
