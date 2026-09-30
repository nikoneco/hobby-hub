const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const unwrap = (source) => source.replace(/^\s*<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
const data = unwrap(fs.readFileSync(path.join(root, 'gas/flavor_messages.html'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'gas/script.html'), 'utf8');
const behavior = app.slice(app.indexOf('  const FLAVOR_STORAGE_KEY'), app.indexOf('  function openModuleUrl'));
assert(behavior.includes('function setFlavorText()'), 'Flavor selection block missing');

function session(hour, storage = new Map(), options = {}) {
  const label = { textContent: '今日はどこに行く？' };
  class Clock extends Date { getHours() { return hour; } }
  const context = vm.createContext({
    window: { localStorage: {
      getItem(key) { if (options.denyRead) throw Error('denied'); return storage.get(key) || null; },
      setItem(key, value) { if (options.denyWrite) throw Error('full'); storage.set(key, value); }
    } },
    document: { getElementById() { return label; } },
    Date: Clock,
    Math: Object.assign(Object.create(Math), { random: () => 0 })
  });
  if (!options.missingData) vm.runInContext(data, context);
  vm.runInContext(behavior, context);
  return { context, label, storage, select() { vm.runInContext('setFlavorText()', context); return label.textContent; } };
}

const initial = session(6);
const periods = initial.context.window.HOBBY_HUB_FLAVOR_PERIODS;
assert.equal(periods.length, 4);
assert(periods.every((period) => period.messages.length === 20));
const allMessages = periods.flatMap((period) => period.messages);
assert.equal(new Set(allMessages.map((message) => message.id)).size, 80);
assert(allMessages.every((message) => message.id && typeof message.text === 'string' && message.text.length));
const key = 'hobbyHub.flavorHistory.v1';
for (const [hour, periodId] of [[0, 'late'], [4, 'late'], [5, 'morning'], [10, 'morning'], [11, 'day'], [16, 'day'], [17, 'night'], [23, 'night']]) {
  const s = session(hour);
  s.select();
  assert(JSON.parse(s.storage.get(key))[0].startsWith(periodId + '-'), 'Wrong period at hour ' + hour);
}
for (const hour of [2, 6, 12, 20]) {
  const storage = new Map([['hobbyHub.recentApps.v1', 'untouched']]);
  const prior = [];
  for (let i = 0; i < 30; i++) {
    const s = session(hour, storage); // Fresh page load with persisted history.
    s.select();
    const history = JSON.parse(storage.get(key));
    assert(!prior.slice(-5).includes(history[0]), 'A recent line repeated');
    assert(history.length <= 5);
    assert.equal(new Set(history).size, history.length);
    prior.push(history[0]);
  }
  assert.equal(storage.get('hobbyHub.recentApps.v1'), 'untouched');
}
for (const raw of ['broken JSON', '{}', 'null', '["gone",1,null,"morning-01","morning-01"]']) {
  const s = session(6, new Map([[key, raw]]));
  assert.doesNotThrow(() => s.select());
  const history = JSON.parse(s.storage.get(key));
  assert(history.every((id) => allMessages.some((message) => message.id === id)));
  assert.equal(new Set(history).size, history.length);
}
for (const options of [{ denyRead: true }, { denyWrite: true }, { denyRead: true, denyWrite: true }]) {
  const s = session(6, new Map(), options);
  const lines = Array.from({ length: 6 }, () => s.select());
  assert.equal(new Set(lines).size, 6, 'Storage failure should retain in-page avoidance');
}
const small = session(6);
small.context.window.HOBBY_HUB_FLAVOR_PERIODS[0].messages = [periods[0].messages[0]];
assert.equal(small.select(), small.select(), 'Exhausted future small sets must still display a line');
assert.equal(session(6, new Map(), { missingData: true }).select(), '今日はどこに行く？');
assert.equal(fs.readFileSync(path.join(root, 'docs/assets/js/flavor-messages.js'), 'utf8').trim(), data.trim());
const html = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
assert(html.indexOf('flavor-messages.js') < html.indexOf('/app.js'), 'Data must load before selection');
assert(!html.includes('morning-20'), 'Pages should keep flavor data outside HTML');
assert(fs.readFileSync(path.join(root, 'docs/sw.js'), 'utf8').includes('assets/js/flavor-messages.js'));
console.log('check-flavor-messages ok: 80 lines, boundaries, last-5 exclusion, storage fallback, Pages data/cache');
