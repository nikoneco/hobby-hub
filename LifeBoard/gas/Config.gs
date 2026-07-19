const CONFIG = {
  APP_NAME: 'LifeBoard',
  TIMEZONE: 'Asia/Tokyo',
  PROPERTIES: {
    SPREADSHEET_ID: 'LIFEBOARD_SPREADSHEET_ID'
  },
  SHEETS: {
    BUS_ROUTES: 'bus_routes',
    BUS_SNAPSHOTS: 'bus_snapshots',
    BUS_TIMETABLE: 'bus_timetable',
    RAIL_ROUTES: 'rail_routes',
    WEATHER_LOCATIONS: 'weather_locations',
    WEATHER_SNAPSHOTS: 'weather_snapshots',
    GARBAGE_RULES: 'garbage_rules',
    CALENDAR_EVENTS: 'calendar_events'
  },
  BUS: {
    CUSTOMER: 'keiseibus-group',
    API_BASE_URL: 'https://transfer-cloud.navitime.biz/apiv1/',
    PAGE_BASE_URL: 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings',
    CACHE_SECONDS: 25,
    STORED_MAX_AGE_MINUTES: 15,
    MAX_ITEMS_PER_ROUTE: 3
  },
  FALLBACK_BUS_ROUTES: [
    {
      route_id: 'home_to_station',
      label: '松本橋東詰 → 小岩駅',
      departure_busstop_id: '00020186',
      departure_name: '松本橋東詰',
      arrival_busstop_id: '00020002',
      arrival_name: '小岩駅',
      official_url: 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings?departure-busstop=00020186&arrival-busstop=00020002',
      enabled: true,
      display_order: 1
    },
    {
      route_id: 'station_to_home',
      label: '小岩駅 → 松本橋東詰',
      departure_busstop_id: '00020002',
      departure_name: '小岩駅',
      arrival_busstop_id: '00020186',
      arrival_name: '松本橋東詰',
      official_url: 'https://transfer-cloud.navitime.biz/keiseibus-group/approachings?departure-busstop=00020002&arrival-busstop=00020186',
      enabled: true,
      display_order: 2
    }
  ],
  RAIL: {
    CACHE_SECONDS: 60,
    SOURCE_NOTE: 'Yahoo!路線情報（レスキューナウ）から取得',
    DEFAULT_ROUTES: [
      {
        route_id: 'yamanote',
        display_name: '山手線',
        yahoo_line_id: '21',
        source_url: 'https://transit.yahoo.co.jp/diainfo/21/0',
        enabled: true,
        display_order: 1,
        direction_keywords: '内回り,外回り'
      },
      {
        route_id: 'chuo_sobu_local',
        display_name: '中央総武線(各停)',
        yahoo_line_id: '40',
        source_url: 'https://transit.yahoo.co.jp/diainfo/40/0',
        enabled: true,
        display_order: 2,
        direction_keywords: '上り線,下り線,上下線,三鷹,千葉'
      },
      {
        route_id: 'sobu_rapid',
        display_name: '総武線(快速)',
        yahoo_line_id: '61',
        source_url: 'https://transit.yahoo.co.jp/diainfo/61/0',
        enabled: true,
        display_order: 3,
        direction_keywords: '上り線,下り線,上下線,東京,千葉'
      },
      {
        route_id: 'tokyo_monorail',
        display_name: '東京モノレール線',
        yahoo_line_id: '154',
        source_url: 'https://transit.yahoo.co.jp/diainfo/154/0',
        enabled: true,
        display_order: 4,
        direction_keywords: '上り線,下り線,上下線,羽田空港,浜松町'
      }
    ]
  },
  WEATHER: {
    CACHE_SECONDS: 300,
    FAILURE_CACHE_SECONDS: 600,
    STORED_MAX_AGE_MINUTES: 90,
    SOURCE_NOTE: '天気はWeathernews、Open-Meteo、Yahoo!/JMAから取得',
    API_BASE_URL: 'https://api.open-meteo.com/v1/forecast',
    YAHOO_API_BASE_URL: 'https://map.yahooapis.jp/weather/V1/place',
    YAHOO_CLIENT_ID_PROPERTY: 'YAHOO_CLIENT_ID',
    JMA_FORECAST_URL: 'https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json',
    JMA_FORECAST_AREA_CODE: '130010',
    JMA_TEMPERATURE_AREA_CODE: '44132',
    LONG_RAIN_POP_THRESHOLD: 40,
    DEFAULT_LOCATIONS: [
      {
        location_id: 'edogawa',
        display_name: '江戸川区',
        latitude: 35.7066,
        longitude: 139.8683,
        timezone: 'Asia/Tokyo',
        enabled: true,
        display_order: 1,
        source: 'Open-Meteo'
      }
    ]
  },
  GARBAGE: {
    SOURCE_NOTE: 'スプレッドシートのgarbage_rulesから取得',
    DEFAULT_RULES: []
  },
  CALENDAR: {
    SOURCE_NOTE: 'TimeTree Exporter',
    IMPORT_TOKEN_PROPERTY: 'LIFEBOARD_IMPORT_TOKEN',
    HEADER_LOOKAHEAD_DAYS: 2,
    DETAIL_LOOKAHEAD_DAYS: 14,
    HEADER_MAX_EVENTS: 60,
    DETAIL_MAX_EVENTS: 80
  },
  DELIVERY: {
    SOURCE_NOTE: 'GmailのAmazon通知メールから取得',
    CACHE_SECONDS: 900,
    SEARCH_DAYS: 10,
    MAX_THREADS: 20,
    MAX_DISPLAY_ITEMS: 4,
    SEARCH_QUERIES: [
      'newer_than:10d (from:amazon.co.jp OR from:amazon.com OR subject:Amazon)',
      'newer_than:10d (subject:配達 OR subject:配送 OR subject:発送 OR subject:お届け OR subject:到着)'
    ]
  }
};

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getRequiredScriptProperty_(key) {
  const value = getScriptProperty_(key);
  if (!value) {
    throw new Error('Script Property is not configured: ' + key);
  }
  return value;
}

function setScriptProperty_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function assertPrivateMutationAllowed_() {
  const enabled = String(getScriptProperty_('ALLOW_PRIVATE_MUTATIONS') || '').toLowerCase();
  if (enabled !== 'true') {
    throw new Error('Private mutation APIs are disabled for the public web app.');
  }
}
