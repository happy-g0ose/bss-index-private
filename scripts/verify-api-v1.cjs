/**
 * Verification for the generated dist/api/v1 tree.
 * Run: node scripts/verify-api-v1.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const V1 = path.join(ROOT, 'dist', 'api', 'v1');
const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'bot', 'items.json'), 'utf8'));

let failures = 0;
const ok = (cond, label, extra) => {
  if (cond) {
    console.log(`  PASS  ${label}${extra ? ' — ' + extra : ''}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${extra ? ' — ' + extra : ''}`);
  }
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

console.log('\n=== 1. every file parses as JSON ===');
const all = walk(V1);
const jsonFiles = all.filter((f) => f.endsWith('.json'));
let parseErrors = 0;
for (const f of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    parseErrors++;
    console.log('        parse error:', path.relative(V1, f), e.message);
  }
}
ok(parseErrors === 0, `${jsonFiles.length} .json files parse`, `${all.length - jsonFiles.length} non-json file(s)`);

console.log('\n=== 2. no BOM in any .json ===');
let boms = [];
for (const f of jsonFiles) {
  const fd = fs.openSync(f, 'r');
  const buf = Buffer.alloc(3);
  fs.readSync(fd, buf, 0, 3, 0);
  fs.closeSync(fd);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) boms.push(path.relative(V1, f));
}
ok(boms.length === 0, 'no byte-order marks', boms.length ? boms.join(', ') : 'first byte of every file checked');

console.log('\n=== 3. items.json ===');
const itemsDoc = JSON.parse(fs.readFileSync(path.join(V1, 'items.json'), 'utf8'));
ok(Array.isArray(itemsDoc), 'items.json is an array');
ok(itemsDoc.length === items.length, 'items.json has one entry per source item', `${itemsDoc.length} entries`);
const nonNumeric = itemsDoc.filter((i) => typeof i.value !== 'number' || typeof i.valueLow !== 'number' || typeof i.valueHigh !== 'number');
ok(nonNumeric.length === 0, 'every value/valueLow/valueHigh is typeof number', nonNumeric.length ? JSON.stringify(nonNumeric.slice(0, 3)) : 'value, valueLow, valueHigh');
const sortedDesc = itemsDoc.every((v, i, a) => i === 0 || a[i - 1].value >= v.value);
ok(sortedDesc, 'items.json is sorted by value descending');
const relImg = itemsDoc.filter((i) => i.image && !/^https?:\/\//i.test(i.image));
ok(relImg.length === 0, 'every image is an absolute URL', relImg.length ? JSON.stringify(relImg.slice(0, 3)) : 'all absolute');
const badUrl = itemsDoc.filter((i) => !/^https?:\/\/.+\/item\/[^/]+\/$/.test(i.url || ''));
ok(badUrl.length === 0, 'every url is <origin>/item/<slug>/', badUrl.length ? JSON.stringify(badUrl.slice(0, 3)) : 'shape ok');
const badChange = itemsDoc.filter((i) => !(i.change7d === null || (typeof i.change7d === 'number' && Math.round(i.change7d * 10) === i.change7d * 10)));
ok(badChange.length === 0, 'change7d/change30d are numbers rounded to 1 decimal or null');
const badDemand = itemsDoc.filter((i) => !['Low', 'Average', 'High', 'Hype'].includes(i.demandEn));
ok(badDemand.length === 0, 'every demandEn is a known level');
const badStab = itemsDoc.filter((i) => !['Rising', 'Stable', 'Falling'].includes(i.stabilityEn));
ok(badStab.length === 0, 'every stabilityEn is a known level');
const badCat = itemsDoc.filter((i) => !i.categorySlug || typeof i.categorySlug !== 'string');
ok(badCat.length === 0, 'every item has a categorySlug');
const noHistoryFlag = itemsDoc.filter((i) => typeof i.hasHistory !== 'boolean');
ok(noHistoryFlag.length === 0, 'every item has a boolean hasHistory');
ok(itemsDoc.every((i) => i.hasHistory === true), 'every source item carries a price history (hasHistory=true)');

console.log('\n=== 4. per-item documents ===');
let missing = [];
for (const entry of itemsDoc) {
  if (!fs.existsSync(path.join(V1, 'items', `${entry.slug}.json`))) missing.push(entry.slug);
}
ok(missing.length === 0, `every item has a matching items/<slug>.json`, missing.length ? missing.slice(0, 5).join(', ') : `${itemsDoc.length} documents`);
let missingHistory = [];
for (const entry of itemsDoc) {
  if (!fs.existsSync(path.join(V1, 'items', entry.slug, 'history.json'))) missingHistory.push(entry.slug);
}
ok(missingHistory.length === 0, 'every item has a matching items/<slug>/history.json', missingHistory.length ? missingHistory.slice(0, 5).join(', ') : `${itemsDoc.length} documents`);
const sample = JSON.parse(fs.readFileSync(path.join(V1, 'items', `${itemsDoc[0].slug}.json`), 'utf8'));
const detailKeys = ['slug', 'id', 'name', 'nameEn', 'category', 'categorySlug', 'value', 'valueLow', 'valueHigh', 'demand', 'demandEn', 'stability', 'stabilityEn', 'change7d', 'change30d', 'image', 'url', 'hasHistory', 'description', 'historicalDates', 'historicalPrices', 'rolls', 'related'];
const missingDetail = detailKeys.filter((k) => !(k in sample));
ok(missingDetail.length === 0, 'detail document has every required field', missingDetail.join(', '));
ok(Array.isArray(sample.rolls) && Array.isArray(sample.related), 'detail document has rolls[] and related[]');
ok(sample.related.length <= 10 && sample.related.every((r) => r.slug !== sample.slug), 'related[] holds up to 10 items, excluding itself');
const rollDoc = itemsDoc.map((i) => JSON.parse(fs.readFileSync(path.join(V1, 'items', `${i.slug}.json`), 'utf8'))).find((d) => d.rolls.length > 0);
ok(!!rollDoc && rollDoc.rolls.every((r) => 'group' in r && 'rollName' in r && 'value' in r && 'demand' in r && 'demandEn' in r), 'rolls are flattened as {group, rollName, value, valueLow, valueHigh, demand, demandEn}');
const histDoc = JSON.parse(fs.readFileSync(path.join(V1, 'items', itemsDoc[0].slug, 'history.json'), 'utf8'));
const histKeys = ['slug', 'name', 'nameEn', 'dates', 'prices', 'change7d', 'change30d', 'min', 'max', 'average'];
ok(histKeys.every((k) => k in histDoc), 'history.json has every required field');
ok(histDoc.dates.length === histDoc.prices.length, 'history dates[] and prices[] are the same length');

console.log('\n=== 5. categories ===');
const cats = JSON.parse(fs.readFileSync(path.join(V1, 'categories.json'), 'utf8'));
ok(Array.isArray(cats) && cats.length > 0, 'categories.json is a non-empty array', `${cats.length} categories`);
const catKeys = ['slug', 'name', 'nameEn', 'count', 'minValue', 'maxValue', 'averageValue', 'totalValue'];
ok(cats.every((c) => catKeys.every((k) => k in c)), 'every category has {slug, name, nameEn, count, minValue, maxValue, averageValue, totalValue}');
let missingCat = [];
for (const c of cats) {
  const f = path.join(V1, 'categories', c.slug, 'items.json');
  if (!fs.existsSync(f)) { missingCat.push(c.slug); continue; }
  const list = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (list.length !== c.count) missingCat.push(`${c.slug} (${list.length} != ${c.count})`);
  if (!list.every((v, i, a) => i === 0 || a[i - 1].value >= v.value)) missingCat.push(`${c.slug} not sorted`);
}
ok(missingCat.length === 0, 'every category has categories/<slug>/items.json with the right count, sorted', missingCat.join(', '));

console.log('\n=== 6. index.json ===');
const index = JSON.parse(fs.readFileSync(path.join(V1, 'index.json'), 'utf8'));
for (const key of ['name', 'version', 'description', 'origin', 'generated', 'itemCount', 'categoryCount', 'categories', 'endpoints', 'demandLevels', 'stabilityLevels']) {
  ok(key in index, `index.json has "${key}"`);
}
ok(index.origin === 'https://bss-index.vercel.app' && !index.origin.endsWith('/'), 'origin has no trailing slash', index.origin);
ok(index.itemCount === items.length, 'itemCount matches', String(index.itemCount));
ok(index.categoryCount === cats.length, 'categoryCount matches', String(index.categoryCount));
ok(index.version === fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(), 'version matches the VERSION file', index.version);
ok(!isNaN(Date.parse(index.generated)), 'generated is a valid ISO timestamp', index.generated);
ok(Array.isArray(index.demandLevels) && index.demandLevels.length === 4, 'demandLevels legend has 4 entries');
ok(Array.isArray(index.stabilityLevels) && index.stabilityLevels.length === 3, 'stabilityLevels legend has 3 entries');

console.log('\n=== 7. index.json lists every generated endpoint ===');
const listed = new Set(index.endpoints.map((e) => e.method + ' ' + e.path));
const expected = [
  'GET /api/v1/index.json',
  'GET /api/v1/items.json',
  'GET /api/v1/items/{slug}.json',
  'GET /api/v1/items/{slug}/history.json',
  'GET /api/v1/categories.json',
  'GET /api/v1/categories/{slug}/items.json',
  'GET /api/v1/changes.json',
  'GET /api/v1/stats.json',
  'GET /api/v1/search-index.json',
  'GET /api/v1/openapi.json',
  'GET /api/v1/docs.html',
];
const notListed = expected.filter((e) => !listed.has(e));
ok(notListed.length === 0, 'every endpoint is documented in index.json', notListed.join(', '));
ok(index.endpoints.every((e) => e.method && e.path && e.description), 'every endpoint entry has method/path/description');
const withParams = index.endpoints.filter((e) => e.params && e.params.length);
ok(withParams.length === 3, 'endpoints with path params document them', withParams.map((e) => e.path).join(', '));

console.log('\n=== 8. openapi.json ===');
const oa = JSON.parse(fs.readFileSync(path.join(V1, 'openapi.json'), 'utf8'));
ok(oa.openapi && oa.openapi.startsWith('3.1'), 'openapi version is 3.1.x', oa.openapi);
ok(!!oa.info && !!oa.info.title && !!oa.info.version, 'info.title and info.version are present');
ok(Object.keys(oa.paths).length > 0, 'paths is non-empty', `${Object.keys(oa.paths).length} paths`);
const oaPaths = Object.keys(oa.paths);
const expectedPaths = expected.map((e) => e.split(' ')[1].replace('/api/v1', '') || '/');
const missingPaths = expectedPaths.filter((p) => !oaPaths.includes(p));
ok(missingPaths.length === 0, 'openapi describes every endpoint', missingPaths.join(', '));
ok(oaPaths.every((p) => p.startsWith('/')), 'every path key starts with "/"');
ok(oaPaths.every((p) => oa.paths[p].get && oa.paths[p].get.responses && oa.paths[p].get.responses['200']), 'every path has a GET with a 200 response');
const templated = oaPaths.filter((p) => p.includes('{'));
ok(templated.every((p) => (oa.paths[p].get.parameters || []).some((pr) => pr.name === 'slug' && pr.in === 'path')), 'templated paths declare a path parameter', templated.join(', '));

console.log('\n=== 9. changes.json ===');
const changes = JSON.parse(fs.readFileSync(path.join(V1, 'changes.json'), 'utf8'));
ok(Array.isArray(changes.gainers) && Array.isArray(changes.losers), 'gainers[] and losers[] exist');
ok(changes.gainers.length === 10 && changes.losers.length === 10, 'ten gainers and ten losers', `${changes.gainers.length}/${changes.losers.length}`);
ok(changes.gainers.every((m) => m.change7d !== null && m.change7d !== undefined), 'no gainer without a change');
ok(changes.losers.every((m) => m.change7d !== null && m.change7d !== undefined), 'no loser without a change');
const gainerDesc = changes.gainers.every((v, i, a) => i === 0 || a[i - 1].change7d >= v.change7d);
ok(gainerDesc, 'gainers are sorted by change7d descending', changes.gainers.map((g) => g.change7d).join(', '));
const loserAsc = changes.losers.every((v, i, a) => i === 0 || a[i - 1].change7d <= v.change7d);
ok(loserAsc, 'losers are sorted by change7d ascending (biggest drop first)', changes.losers.map((g) => g.change7d).join(', '));
ok(changes.gainers.every((m) => m.change7d > 0) && changes.losers.every((m) => m.change7d < 0), 'gainers rose and losers fell');
const moverKeys = ['slug', 'name', 'nameEn', 'value', 'change7d', 'change30d'];
ok(changes.gainers.every((m) => moverKeys.every((k) => k in m)), 'movers carry {slug, name, nameEn, value, change7d, change30d}');
ok(!isNaN(Date.parse(changes.updated)), 'updated is a valid ISO timestamp', changes.updated);

console.log('\n=== 10. stats.json ===');
const stats = JSON.parse(fs.readFileSync(path.join(V1, 'stats.json'), 'utf8'));
for (const key of ['itemCount', 'totalValue', 'averageValue', 'medianValue', 'minValue', 'maxValue', 'itemsWithHistory', 'lastUpdated']) {
  ok(key in stats, `stats.json has "${key}"`);
}
ok(stats.itemCount === items.length, 'stats.itemCount matches', String(stats.itemCount));
ok(stats.minValue === Math.min(...itemsDoc.map((i) => i.value)), 'stats.minValue is the cheapest item', String(stats.minValue));
ok(stats.maxValue === Math.max(...itemsDoc.map((i) => i.value)), 'stats.maxValue is the priciest item', String(stats.maxValue));
ok(stats.itemsWithHistory === itemsDoc.filter((i) => i.hasHistory).length, 'stats.itemsWithHistory matches the hasHistory flags', String(stats.itemsWithHistory));

console.log('\n=== 11. search-index.json ===');
const si = JSON.parse(fs.readFileSync(path.join(V1, 'search-index.json'), 'utf8'));
const siSize = fs.statSync(path.join(V1, 'search-index.json')).size;
ok(Array.isArray(si) && si.length === items.length, 'search-index has one entry per item', `${si.length} entries`);
const siKeys = ['slug', 'name', 'nameEn', 'category', 'categorySlug', 'value'];
ok(si.every((e) => siKeys.every((k) => k in e)), 'every search entry has {slug, name, nameEn, category, categorySlug, value}');
ok(si.every((e) => !('historicalPrices' in e) && !('glowColor' in e) && !('image' in e)), 'search index carries no history / colours / images');
ok(siSize < 60 * 1024, 'search-index.json is under 60 KB', `${(siSize / 1024).toFixed(1)} KB`);

console.log('\n=== 12. docs.html ===');
const html = fs.readFileSync(path.join(V1, 'docs.html'), 'utf8');
ok(html.startsWith('<!doctype html>'), 'docs.html is a full HTML document');
ok(html.includes('/api/v1/openapi.json'), 'docs.html links to openapi.json');
ok((html.match(/curl &quot;|curl "/g) || []).length >= 2, 'docs.html contains copy-paste curl examples', `${(html.match(/curl /g) || []).length} curl snippets`);
ok(/method--get/.test(html) && /#f59e0b/i.test(html), 'docs.html uses the dark/amber site styling');
ok(!/<script/i.test(html), 'docs.html contains no scripts');
ok(!/https?:\/\/(fonts|cdn|unpkg|jsdelivr)/i.test(html), 'docs.html loads no external assets');

console.log('\n=== 13. legacy API untouched ===');
const legacy = ['index.json', 'values.json', 'item', 'history', 'category'].map((n) => path.join(ROOT, 'dist', 'api', n));
ok(legacy.every((f) => fs.existsSync(f)), 'legacy dist/api/* still in place');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exitCode = failures === 0 ? 0 : 1;
