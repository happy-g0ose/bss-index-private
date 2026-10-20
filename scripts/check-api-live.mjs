/**
 * Checks the live v1 API: every endpoint, the search function, and that the
 * slugs line up with the site's own item pages.
 */
const ORIGIN = 'https://bss-index.vercel.app';

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log('  ' + (ok ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(38) + (detail ?? ''));
};

async function json(path) {
  const res = await fetch(ORIGIN + path);
  const body = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, body };
}

async function main() {
  console.log('static endpoints:');
  for (const p of [
    '/api/v1/index.json',
    '/api/v1/items.json',
    '/api/v1/search-index.json',
    '/api/v1/categories.json',
    '/api/v1/changes.json',
    '/api/v1/stats.json',
    '/api/v1/openapi.json',
    '/api/v1/docs.html',
    '/api/v1/items/star-cub.json',
    '/api/v1/items/star-cub/history.json',
    '/api/v1/categories/vouchers/items.json',
    '/api/v1/categories/cub-skins/items.json',
  ]) {
    const r = await fetch(ORIGIN + p);
    check(p, r.status === 200, 'status ' + r.status);
  }

  console.log('\ncontent:');
  const items = (await json('/api/v1/items.json')).body;
  check('items count', Array.isArray(items) && items.length === 330, items.length + ' items');
  check('values are numbers', typeof items[0].value === 'number', typeof items[0].value);
  check('sorted by value desc', items[0].value >= items[items.length - 1].value,
    items[0].value + ' -> ' + items[items.length - 1].value);

  const idx = (await json('/api/v1/index.json')).body;
  check('index has version', !!idx.version, 'v' + idx.version);
  check('index documents endpoints', (idx.endpoints || []).length >= 10, (idx.endpoints || []).length + ' endpoints');

  const oa = (await json('/api/v1/openapi.json')).body;
  check('openapi paths', Object.keys(oa.paths || {}).length >= 10, Object.keys(oa.paths || {}).length + ' paths');

  console.log('\nsearch function (Vercel):');
  for (const [q, note] of [['q=bee', 'search bee'], ['q=куб', 'russian alias'], ['category=vouchers', 'category filter'], ['sort=change&limit=5', 'sort + limit']]) {
    const r = await json('/api/v1/search?' + q);
    const ok = r.status === 200 && Array.isArray(r.body?.items);
    check('search ' + note, ok, ok ? r.body.total + ' hits, first: ' + (r.body.items[0]?.nameEn ?? '-') : 'status ' + r.status);
  }

  const searchHeaders = (await fetch(ORIGIN + '/api/v1/search?q=bee')).headers;
  check('search CORS', searchHeaders.get('access-control-allow-origin') === '*',
    searchHeaders.get('access-control-allow-origin'));

  console.log('\nslug parity with the site:');
  const sample = items.slice(0, 25);
  let mismatched = 0;
  for (const it of sample) {
    const r = await fetch(`${ORIGIN}/item/${it.slug}/`);
    if (r.status !== 200) mismatched++;
  }
  check('api slugs resolve on the site', mismatched === 0, sample.length + ' sampled, ' + mismatched + ' broken');

  console.log('\nsummary: ' + results.filter(Boolean).length + '/' + results.length + ' checks passed');
}

main();
