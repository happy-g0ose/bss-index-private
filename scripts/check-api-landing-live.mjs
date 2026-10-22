/**
 * Checks the live API entry points and the /api/ landing page.
 */
const ORIGIN = 'https://bss-index.vercel.app';

const PATHS = [
  '/api/',
  '/api/v1/',
  '/api/v1/index.json',
  '/api/v1/values.json',
  '/api/v1/items/bee-cub.json',
  '/api/v1/search?q=bee&limit=1',
  '/api/v1/categories.json',
  '/api/v1/changes.json',
  '/api/v1/stats.json',
  '/api/v1/openapi.json',
  '/api/v1/docs.html',
  '/api/v1/docs.ru.html',
  '/api/v0/values.json',
];

const results = [];
const ok = (name, cond, detail) => {
  results.push(cond);
  console.log('  ' + (cond ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(34) + (detail ?? ''));
};

async function main() {
  console.log('live endpoints:');
  for (const p of PATHS) {
    const res = await fetch(ORIGIN + p, { redirect: 'manual' });
    ok(p, res.status === 200, 'status ' + res.status);
  }

  const html = await (await fetch(ORIGIN + '/api/')).text();
  console.log('\n/api/ landing page:');
  const title = (html.match(/<title>([^<]*)/) || [])[1];
  const h1 = (html.match(/<h1>([^<]*)/) || [])[1];
  const links = (html.match(/class="(?:primary|ghost)"/g) || []).length;
  const cyr = (html.match(/[\u0400-\u04FF]/g) || []).length;

  ok('title is English', /BSS Index API/.test(title || ''), title);
  ok('heading is English', (h1 || '').trim() === 'BSS Index API', (h1 || '').trim());
  ok('action buttons present', links >= 4, links + ' buttons');
  ok('no leftover placeholders', !/undefined|NaN|\[object/.test(html));
  ok('links both docs', html.includes('/api/v1/docs.html') && html.includes('/api/v1/docs.ru.html'));
  ok('mentions the Russian field pairs', html.includes('nameRu') && html.includes('demandRu'));
  console.log('  (cyrillic chars: ' + cyr + ' - these are the intentional Russian examples)');

  console.log('\nsummary: ' + results.filter(Boolean).length + '/' + results.length + ' checks passed');
}

main();
