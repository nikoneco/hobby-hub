function getDeliverySnapshot_() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('delivery:snapshot:v2');
    if (cached) {
      return JSON.parse(cached);
    }

    const snapshot = buildDeliverySnapshot_();
    cache.put('delivery:snapshot:v2', JSON.stringify(snapshot), CONFIG.DELIVERY.CACHE_SECONDS);
    return snapshot;
  } catch (error) {
    console.warn('Delivery snapshot failed: ' + (error && error.stack ? error.stack : error));
    return {
      fetchedAt: nowIso_(),
      sourceNote: CONFIG.DELIVERY.SOURCE_NOTE,
      items: [],
      errorText: formatDeliveryError_(error)
    };
  }
}

function formatDeliveryError_(error) {
  const message = error && error.message ? error.message : String(error);
  if (/permission|permissions|authorization|authorize|mail\.google\.com|gmail/i.test(message)) {
    return 'Gmail承認待ち';
  }
  return '配達情報を確認できません';
}

function buildDeliverySnapshot_() {
  const messages = searchDeliveryMessages_();
  const items = messages
    .map(buildDeliveryItemFromMessage_)
    .filter(function (item) {
      return item && item.relevanceScore > 0;
    })
    .sort(function (a, b) {
      return b.sortTime - a.sortTime || b.relevanceScore - a.relevanceScore;
    });
  const uniqueItems = dedupeDeliveryItems_(items).slice(0, CONFIG.DELIVERY.MAX_DISPLAY_ITEMS);
  return {
    fetchedAt: nowIso_(),
    sourceNote: CONFIG.DELIVERY.SOURCE_NOTE,
    items: uniqueItems.map(stripDeliveryInternalFields_)
  };
}

function searchDeliveryMessages_() {
  const seen = {};
  const output = [];
  CONFIG.DELIVERY.SEARCH_QUERIES.forEach(function (query) {
    GmailApp.search(query, 0, CONFIG.DELIVERY.MAX_THREADS).forEach(function (thread) {
      thread.getMessages().forEach(function (message) {
        const id = message.getId();
        if (!seen[id]) {
          seen[id] = true;
          output.push(message);
        }
      });
    });
  });
  return output;
}

function buildDeliveryItemFromMessage_(message) {
  const subject = String(message.getSubject() || '').trim();
  const from = String(message.getFrom() || '');
  const date = message.getDate();
  const bodySample = getDeliveryBodySample_(message);
  const classification = classifyDeliverySubject_(subject + ' ' + bodySample, from);
  return {
    provider: 'Amazon',
    orderId: extractAmazonOrderId_(subject + '\n' + bodySample),
    statusText: classification.statusText,
    severity: classification.severity,
    title: compactDeliveryTitle_(subject),
    subject: subject,
    from: from,
    dateText: Utilities.formatDate(date, CONFIG.TIMEZONE, 'M/d H:mm'),
    sortTime: date.getTime(),
    relevanceScore: classification.score
  };
}

function classifyDeliverySubject_(subject, from) {
  const text = normalizeDeliveryText_(subject + ' ' + from);
  const isAmazon = /amazon|アマゾン/i.test(text);
  let score = isAmazon ? 1 : 0;
  let statusText = '';
  let severity = 'normal';

  if (/配達完了|配送完了|お届け済み|配達されました|delivered/i.test(text)) {
    statusText = '配達完了';
    severity = 'done';
    score += 6;
  } else if (/配達中|配送中|配達に向かっています|out for delivery/i.test(text)) {
    statusText = '配達中';
    severity = 'active';
    score += 7;
  } else if (/本日.*(到着|お届け|配達)|本日中|今日.*(到着|お届け|配達)|arriving today/i.test(text)) {
    statusText = '本日予定';
    severity = 'active';
    score += 6;
  } else if (/発送|出荷|shipped|dispatched/i.test(text)) {
    statusText = '発送済み';
    severity = 'notice';
    score += 4;
  } else if (/お届け予定|配達予定|到着予定|配送予定|arriving|delivery/i.test(text)) {
    statusText = 'お届け予定';
    severity = 'notice';
    score += 3;
  }

  if (!statusText) {
    statusText = isAmazon ? 'Amazon通知' : '';
  }
  return {
    statusText: statusText,
    severity: severity,
    score: score
  };
}

function normalizeDeliveryText_(text) {
  return String(text || '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[‐‑‒–—−－]/g, '-')
    .replace(/\s+/g, ' ');
}

function compactDeliveryTitle_(subject) {
  return String(subject || '')
    .replace(/^\[?Amazon(?:\.co\.jp)?\]?\s*/i, '')
    .replace(/^Amazon\.co\.jp[:：]\s*/i, '')
    .trim();
}

function getDeliveryBodySample_(message) {
  const chunks = [];
  try {
    chunks.push(String(message.getPlainBody() || ''));
  } catch (error) {
  }
  try {
    chunks.push(String(message.getBody() || '').replace(/<[^>]+>/g, ' '));
  } catch (error) {
  }
  return chunks.join('\n').slice(0, 20000);
}

function extractAmazonOrderId_(text) {
  const normalized = normalizeDeliveryText_(text);
  const labeled = normalized.match(/注文番号\D{0,40}(\d{3})\D{0,8}(\d{7})\D{0,8}(\d{7})/);
  const match = labeled || normalized.match(/\b(\d{3})\D{0,3}(\d{7})\D{0,3}(\d{7})\b/);
  return match ? match[1] + '-' + match[2] + '-' + match[3] : '';
}

function dedupeDeliveryItems_(items) {
  const seen = {};
  return items.filter(function (item) {
    const key = item.orderId ? 'order:' + item.orderId : 'fallback:' + item.statusText + '|' + item.title;
    if (seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  });
}

function stripDeliveryInternalFields_(item) {
  return {
    provider: item.provider,
    orderId: item.orderId,
    statusText: item.statusText,
    severity: item.severity,
    title: item.title,
    dateText: item.dateText,
    subject: item.subject
  };
}

function authorizeDeliveryAccess() {
  GmailApp.search('newer_than:1d', 0, 1);
  return {
    ok: true,
    message: 'Gmail access authorized'
  };
}
