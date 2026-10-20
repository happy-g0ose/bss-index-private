/**
 * Local test for the /api/search Vercel function.
 * Calls the handler directly with a mock req/res, so no server is needed.
 */
import handler from '../api/v1/search.js';

function call(query) {
  let status = 0;
  let headers = {};
  let body = '';

  const res = {
    writeHead(s, h) {
      status = s;
      headers = h || {};
      return res;
    },
    end(chunk) {
      body = chunk || '';
      return res;
    },
  };

  handler({ method: 'GET', query }, res);
  return { status, headers, body };
}

const cases = [
  [{ q: 'bee' }, 'search "bee"'],
  [{ q: 'star cub' }, 'two-word search'],
  [{ q: 'куб' }, 'cyrillic category alias'],
  [{ q: 'каб' }, 'cyrillic alias 2'],
  [{ q: 'панама' }, 'cyrillic item name'],
  [{ q: 'пчела' }, 'cyrillic bee alias'],
  [{ q: 'voucher' }, 'english category alias'],
  [{ q: 'zzzznotanitem' }, 'no match'],
  [{ category: 'vouchers' }, 'category filter'],
  [{ q: 'bee', limit: '3' }, 'limit'],
  [{ sort: 'change' }, 'sort by change'],
  [{ sort: 'value-asc' }, 'sort ascending'],
  [{ q: 'bee', offset: '2' }, 'offset'],
];

console.log('tests:');
let failed = 0;
for (const [query, name] of cases) {
  const r = call(query);
  let parsed = null;
  try {
    parsed = JSON.parse(r.body);
  } catch (e) {
    failed++;
    console.log('  FAIL', name, '- body is not JSON');
    continue;
  }
  const ok = r.status === 200 && Array.isArray(parsed.items);
  if (!ok) failed++;
  console.log(
    '  ' + (ok ? 'PASS' : 'FAIL'),
    name.padEnd(22),
    'status=' + r.status,
    'total=' + (parsed.total ?? '-'),
    'count=' + (parsed.count ?? '-'),
    parsed.items?.length ? '| first: ' + parsed.items[0].name + ' (' + parsed.items[0].value + '★)' : ''
  );
}

// The new shape: English-first names.
const shape = call({ q: 'bee' });
const sample = JSON.parse(shape.body).items[0];
const shapeOk =
  sample && typeof sample.name === 'string' && !('nameEn' in sample) &&
  'nameRu' in sample && 'categoryRu' in sample && !('categoryEn' in sample);
console.log('  ' + (shapeOk ? 'PASS' : 'FAIL'), 'english-first shape      ',
  shapeOk ? `name="${sample.name}" nameRu=${JSON.stringify(sample.nameRu)} category="${sample.category}"` : 'wrong fields');

// A Russian item must still be findable by its Russian name.
const ru = call({ q: 'панама' });
const ruHit = JSON.parse(ru.body).items[0];
console.log('  ' + (ruHit ? 'PASS' : 'FAIL'), 'russian name lookup     ',
  ruHit ? `name="${ruHit.name}" nameRu=${JSON.stringify(ruHit.nameRu)}` : 'not found');

// error shape
const bad = call({});
console.log('\nempty query returns the full list:', JSON.parse(bad.body).total, 'items');

// CORS
const c = call({ q: 'bee' });
console.log('CORS header:', c.headers['Access-Control-Allow-Origin']);
console.log('cache header:', c.headers['Cache-Control']);
console.log('api version header:', c.headers['X-API-Version']);

// method guard
let mStatus = 0;
const res2 = { writeHead(s) { mStatus = s; return res2; }, end() { return res2; } };
handler({ method: 'POST', query: {} }, res2);
console.log('POST rejected with', mStatus, mStatus === 405 ? 'OK' : 'WRONG');

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
