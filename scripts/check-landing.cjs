/**
 * Checks the static landing pages (/ and /ru/).
 *
 * These are served to crawlers that do not run JavaScript, so they must carry
 * a heading, real links and structured data on their own.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let failed = 0;
function check(label, ok, detail = '') {
  console.log((ok ? '  OK    ' : '  FAIL  ') + label + (detail ? '   ' + detail : ''));
  if (!ok) failed++;
}

for (const [rel, isEn] of [
  ['dist/index.html', true],
  ['dist/ru/index.html', false],
]) {
  const file = path.join(ROOT, rel);
  console.log('=== ' + rel + ' ===');
  if (!fs.existsSync(file)) {
    check('file exists', false);
    continue;
  }
  const h = fs.readFileSync(file, 'utf8');

  const h1 = (h.match(/<h1[^>]*>([^<]*)/) || [])[1];
  check('has an h1', !!h1, h1 || '');
  check('h1 is not the app shell', /<div id="app"><\/div>/.test(h));

  const links = [...h.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const internal = links.filter((u) => u.startsWith('/'));
  check('has internal links', internal.length > 0, internal.length + ' internal');

  const itemLinks = links.filter((u) => /^\/(ru\/)?item\/[^/]+\/$/.test(u));
  check('links to item pages', itemLinks.length >= 20, itemLinks.length + ' item links');

  check('links to the item index', links.some((u) => u === '/items/' || u === '/ru/items/'));
  check('links to the API', links.some((u) => u === '/api/'));

  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  check('has JSON-LD', !!ld);
  if (ld) {
    let parsed = null;
    try {
      parsed = JSON.parse(ld[1]);
    } catch (e) {
      check('JSON-LD parses', false, e.message);
    }
    if (parsed) {
      check('JSON-LD parses', true);
      const types = (parsed['@graph'] || [parsed]).map((n) => n['@type']);
      check('JSON-LD has WebSite', types.includes('WebSite'), types.join(', '));
      check('JSON-LD has ItemList', types.includes('ItemList'));
    }
  }

  check('has canonical', /<link rel="canonical"/.test(h));
  check('has hreflang alternates', (h.match(/hreflang/g) || []).length >= 3);
  const appIdx = h.indexOf('<div id="app"></div>');
  const mainIdx = h.indexOf('<main class="wrap">');
  check(
    'static block sits outside #app',
    appIdx > -1 && mainIdx > -1 && mainIdx < appIdx,
    appIdx > -1 ? '#app at ' + appIdx + ', main at ' + mainIdx : 'no #app found'
  );
  check('theme boot script present', /bss_theme/.test(h));
  check('module script present', /<script type="module"/.test(h));
  console.log('');
}

console.log(failed ? failed + ' CHECKS FAILED' : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
