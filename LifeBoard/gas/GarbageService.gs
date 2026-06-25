function getGarbageRules_() {
  try {
    const spreadsheet = openLifeBoardSpreadsheet_();
    const sheet = getSheetByName_(spreadsheet, CONFIG.SHEETS.GARBAGE_RULES);
    const rules = readObjects_(sheet)
      .filter(function (rule) {
        return rule.enabled === true || rule.enabled === 'TRUE' || rule.enabled === 'true';
      })
      .sort(function (a, b) {
        return Number(a.display_order || 0) - Number(b.display_order || 0);
      });
    return rules.length ? rules : CONFIG.GARBAGE.DEFAULT_RULES;
  } catch (error) {
    console.warn('Falling back to built-in garbage rules: ' + error.message);
    return CONFIG.GARBAGE.DEFAULT_RULES;
  }
}

function getGarbageSnapshot_() {
  const rules = getGarbageRules_();
  const today = dateAtLocalMidnight_(new Date());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  return {
    fetchedAt: nowIso_(),
    sourceNote: CONFIG.GARBAGE.SOURCE_NOTE,
    days: [
      buildGarbageDay_('今日', today, rules),
      buildGarbageDay_('明日', tomorrow, rules),
      buildGarbageDay_('明後日', dayAfterTomorrow, rules)
    ]
  };
}

function buildGarbageDay_(label, date, rules) {
  const weekday = Number(Utilities.formatDate(date, CONFIG.TIMEZONE, 'u')) % 7;
  const items = rules.filter(function (rule) {
    return parseGarbageWeekday_(rule.collection_weekday) === weekday && matchesGarbageWeekPattern_(date, rule.week_pattern);
  }).map(function (rule) {
    return {
      label: String(rule.label || ''),
      note: String(rule.note || ''),
      colorKey: String(rule.color_key || 'green')
    };
  });
  return {
    label: label,
    dateText: formatJapaneseDateText_(date),
    items: items
  };
}

function parseGarbageWeekday_(value) {
  const text = String(value || '').trim().toLowerCase();
  const map = {
    '日': 0,
    sun: 0,
    sunday: 0,
    '月': 1,
    mon: 1,
    monday: 1,
    '火': 2,
    tue: 2,
    tuesday: 2,
    '水': 3,
    wed: 3,
    wednesday: 3,
    '木': 4,
    thu: 4,
    thursday: 4,
    '金': 5,
    fri: 5,
    friday: 5,
    '土': 6,
    sat: 6,
    saturday: 6
  };
  if (Object.prototype.hasOwnProperty.call(map, text)) {
    return map[text];
  }
  const number = Number(text);
  if (!Number.isNaN(number)) {
    return ((number % 7) + 7) % 7;
  }
  return -1;
}

function matchesGarbageWeekPattern_(date, value) {
  const text = String(value || '毎週').trim();
  if (!text || text === '毎週' || text.toLowerCase() === 'all') {
    return true;
  }
  const nth = Math.ceil(Number(Utilities.formatDate(date, CONFIG.TIMEZONE, 'd')) / 7);
  const normalized = text
    .replace(/第/g, '')
    .replace(/週/g, '')
    .replace(/[・、/／]/g, ',');
  return normalized.split(',').some(function (part) {
    return Number(part.trim()) === nth;
  });
}

function dateAtLocalMidnight_(date) {
  const text = Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy/MM/dd 00:00:00');
  return new Date(text);
}
