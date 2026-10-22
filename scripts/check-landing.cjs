/**
 * Checks the landing pages (/ and /ru/).
 *
 * The Russian landing page is a real page: a heading, links and structured
 * data of its own. The English home page is the app and nothing else — it
 * only carries the metadata in its head, because a visible block there would
 * just repeat what the app already shows.
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

  // --- what both pages must have ---
  check('has a title', /<title>[^<]+<\/title>/.test(h));
  check('has a description', /name="description" content="[^"]+"/.test(h));
  check('has canonical', /<link rel="canonical"/.test(h));
  check('has hreflang alternates', (h.match(/hreflang/g) || []).length >= 3);
  check('has Open Graph tags', (h.match(/property="og:/g) || []).length >= 4);
  check('has the app mount point', /<div id="app"><\/div>/.test(h));
  check('theme boot script present', /bss_theme/.test(h));
  check('module script present', /<script type="module"/.test(h));
  check('stylesheet present', /<link rel="stylesheet"[^>]*assets\/[^"]*\.css"/.test(h));

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

  if (isEn) {
    // The home page is the app — nothing else in the body.
    check('no static block in the body', !/<!--bss-static-->/.test(h));
    check('no duplicate heading in the body', !/<main class="wrap">/.test(h));
  } else {
    // The Russian landing page is a page of its own.
    const h1 = (h.match(/<h1[^>]*>([^<]*)/) || [])[1];
    check('has an h1', !!h1, h1 || '');
    const links = [...h.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    check('has internal links', links.filter((u) => u.startsWith('/')).length > 0);
    check('links to the item index', links.some((u) => u === '/ru/items/'));
    check('links to the API', links.some((u) => u === '/api/'));
    check('links to item pages', links.filter((u) => /^\/ru\/item\/[^/]+\/$/.test(u)).length >= 20);
    check('static block sits outside #app', h.indexOf('<main class="wrap">') < h.indexOf('<div id="app">'));
    check('totals leave beequips out', /excluding beequips|без биквипов/.test(h));
  }
  console.log('');
}

console.log(failed ? failed + ' CHECKS FAILED' : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
