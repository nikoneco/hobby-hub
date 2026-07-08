const SWITCHBOT_PROPERTY_NAMES_ = {
  TOKEN: 'SWITCHBOT_TOKEN',
  SECRET: 'SWITCHBOT_SECRET',
  DAILY_STATION_DEVICE_ID: 'DAILY_STATION_DEVICE_ID'
};

const SWITCHBOT_API_BASE_URL_ = 'https://api.switch-bot.com/v1.1';
const DAILY_STATION_TEXT_MAX_BYTES_ = 300;

function checkSwitchBotSetup() {
  const result = safeRun_('checkSwitchBotSetup', function () {
    assertPrivateMutationAllowed_();
    const properties = PropertiesService.getScriptProperties();
    return {
      tokenConfigured: !!properties.getProperty(SWITCHBOT_PROPERTY_NAMES_.TOKEN),
      secretConfigured: !!properties.getProperty(SWITCHBOT_PROPERTY_NAMES_.SECRET),
      dailyStationDeviceIdConfigured: !!properties.getProperty(SWITCHBOT_PROPERTY_NAMES_.DAILY_STATION_DEVICE_ID),
      propertyNames: SWITCHBOT_PROPERTY_NAMES_,
      defaultProbeText: buildDailyStationProbeText_()
    };
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function listSwitchBotDevices() {
  const result = safeRun_('listSwitchBotDevices', function () {
    assertPrivateMutationAllowed_();
    const response = switchBotRequest_('/devices', 'get');
    const body = response.body || {};
    const devices = (body.deviceList || []).map(formatSwitchBotDevice_);
    const infraredRemotes = (body.infraredRemoteList || []).map(formatSwitchBotDevice_);
    return {
      devices: devices,
      infraredRemotes: infraredRemotes,
      note: 'Daily Station / Weather Station の deviceId を DAILY_STATION_DEVICE_ID に設定してください'
    };
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function setDailyStationDeviceId(deviceId) {
  const result = safeRun_('setDailyStationDeviceId', function () {
    assertPrivateMutationAllowed_();
    const normalized = String(deviceId || '').trim();
    if (!normalized) {
      throw new Error('deviceId is required');
    }
    PropertiesService
      .getScriptProperties()
      .setProperty(SWITCHBOT_PROPERTY_NAMES_.DAILY_STATION_DEVICE_ID, normalized);
    return {
      property: SWITCHBOT_PROPERTY_NAMES_.DAILY_STATION_DEVICE_ID,
      configured: true
    };
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testDailyStationText(text) {
  const result = safeRun_('testDailyStationText', function () {
    assertPrivateMutationAllowed_();
    return sendDailyStationText_(text || buildDailyStationProbeText_());
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testDailyStationTextWithTime() {
  const result = safeRun_('testDailyStationTextWithTime', function () {
    assertPrivateMutationAllowed_();
    const timeText = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'M/d H:mm:ss');
    return sendDailyStationText_('LifeBoardテスト ' + timeText + ' | 自動折り返し確認');
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testDailyStationTransitSample() {
  const result = safeRun_('testDailyStationTransitSample', function () {
    assertPrivateMutationAllowed_();
    const timeText = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'H:mm:ss');
    return sendDailyStationText_('JR山手線 朝ラッシュ:通常運行 通勤予想42分 | バス 始発6:00 終発22:30 現在:3駅先 | 更新' + timeText);
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testDailyStationQuote(text) {
  const result = safeRun_('testDailyStationQuote', function () {
    assertPrivateMutationAllowed_();
    return sendDailyStationCommand_('customQuote', text || buildDailyStationProbeText_());
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function cancelDailyStationCustomText() {
  const result = safeRun_('cancelDailyStationCustomText', function () {
    assertPrivateMutationAllowed_();
    return sendDailyStationCommand_('cancelCustom', 'default');
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function clearDailyStationPage() {
  const result = safeRun_('clearDailyStationPage', function () {
    assertPrivateMutationAllowed_();
    return sendDailyStationCommand_('customPage', '', { allowEmpty: true });
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function getDailyStationStatus() {
  const result = safeRun_('getDailyStationStatus', function () {
    assertPrivateMutationAllowed_();
    const deviceId = getSwitchBotScriptProperty_(SWITCHBOT_PROPERTY_NAMES_.DAILY_STATION_DEVICE_ID);
    return switchBotRequest_('/devices/' + encodeURIComponent(deviceId) + '/status', 'get');
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function sendDailyStationText_(text) {
  return sendDailyStationCommand_('customPage', text);
}

function sendDailyStationCommand_(command, text, options) {
  const deviceId = getSwitchBotScriptProperty_(SWITCHBOT_PROPERTY_NAMES_.DAILY_STATION_DEVICE_ID);
  const normalizedText = normalizeDailyStationText_(text, options);
  const response = switchBotRequest_('/devices/' + encodeURIComponent(deviceId) + '/commands', 'post', {
    command: command,
    parameter: normalizedText,
    commandType: 'command'
  });
  return {
    command: command,
    sentText: normalizedText,
    length: normalizedText.length,
    bytes: getUtf8ByteLength_(normalizedText),
    response: response
  };
}

function switchBotRequest_(path, method, payload) {
  const token = getSwitchBotScriptProperty_(SWITCHBOT_PROPERTY_NAMES_.TOKEN);
  const secret = getSwitchBotScriptProperty_(SWITCHBOT_PROPERTY_NAMES_.SECRET);
  const timestamp = String(Date.now());
  const nonce = Utilities.getUuid();
  const sign = buildSwitchBotSign_(token, secret, timestamp, nonce);
  const options = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: token,
      sign: sign,
      nonce: nonce,
      t: timestamp,
      charset: 'utf8'
    }
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(SWITCHBOT_API_BASE_URL_ + path, options);
  const status = response.getResponseCode();
  const text = response.getContentText();
  const parsed = parseSwitchBotJson_(text);
  if (status < 200 || status >= 300) {
    throw new Error('SwitchBot API HTTP ' + status + ': ' + text);
  }
  if (parsed && parsed.statusCode && parsed.statusCode !== 100) {
    throw new Error('SwitchBot API statusCode ' + parsed.statusCode + ': ' + text);
  }
  return parsed || {
    statusCode: status,
    body: text
  };
}

function buildSwitchBotSign_(token, secret, timestamp, nonce) {
  const data = token + timestamp + nonce;
  const signature = Utilities.computeHmacSha256Signature(data, secret, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(signature);
}

function getSwitchBotScriptProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw new Error('Script Property is not configured: ' + name);
  }
  return value;
}

function normalizeDailyStationText_(text, options) {
  const allowEmpty = options && options.allowEmpty;
  let normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(function (line) {
      return line.replace(/\s+/g, ' ').trim();
    })
    .filter(function (line) {
      return line;
    })
    .join(' | ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    if (allowEmpty) {
      return '';
    }
    throw new Error('Daily Station text is empty');
  }
  return truncateUtf8Text_(normalized, DAILY_STATION_TEXT_MAX_BYTES_);
}

function truncateUtf8Text_(text, maxBytes) {
  if (getUtf8ByteLength_(text) <= maxBytes) {
    return text;
  }
  const suffix = '...';
  const suffixBytes = getUtf8ByteLength_(suffix);
  let output = '';
  for (let index = 0; index < text.length; index++) {
    const candidate = output + text.charAt(index);
    if (getUtf8ByteLength_(candidate) + suffixBytes > maxBytes) {
      break;
    }
    output = candidate;
  }
  return output.trimEnd() + suffix;
}

function getUtf8ByteLength_(text) {
  return Utilities.newBlob(String(text || '')).getBytes().length;
}

function parseSwitchBotJson_(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('SwitchBot API returned non-JSON response: ' + text);
  }
}

function formatSwitchBotDevice_(device) {
  return {
    deviceId: device.deviceId || '',
    deviceName: device.deviceName || device.remoteName || '',
    deviceType: device.deviceType || device.remoteType || '',
    hubDeviceId: device.hubDeviceId || '',
    enableCloudService: device.enableCloudService
  };
}

function buildDailyStationProbeText_() {
  return 'テスト 日本語OK | 記号 ℃ + / | : | 自動折り返し確認';
}
