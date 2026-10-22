/**
 * Checks the generated static item index pages.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

function report(p) {
  const h = fs.readFileSync(p, 'utf8');
  const count = (re) => (h.match(re) || []).length;
  console.log('=== ' + path.relative(ROOT, p).replace(/\\/g, '/') + ' ===');
  console.log('  bytes      :', h.length);
  console.log('  title      :', (h.match(/<title>([^<]*)/) || [])[1]);
  console.log('  h1         :', (h.match(/<h1>([^<]*)/) || [])[1]);
  console.log('  item links :', count(/class="card-item"/g));
  console.log('  images     :', count(/<img/g));
  console.log('  sections   :', count(/class="group"/g));
  console.log('  chips      :', count(/class="chip"/g));
  console.log('  change chip:', count(/class="chg/g));
  console.log('  search box :', /id="q"/.test(h));
  console.log('  script     :', /<script/.test(h));
  console.log('  json-ld    :', /application\/ld\+json/.test(h));
  console.log('  hreflang   :', count(/hreflang/g));
  console.log('  light theme:', /html\.light/.test(h));
  console.log('  alt links  :', count(/data-alt="/g));
  console.log('  gzip       :', zlib.gzipSync(h).length);
  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  console.log('  json-ld raw:', ld ? ld[1].length : 0);
  const css = h.match(/<style>([\s\S]*?)<\/style>/);
  console.log('  css raw    :', css ? css[1].length : 0);
  console.log('');
}

report(path.join(ROOT, 'dist', 'items', 'index.html'));
report(path.join(ROOT, 'dist', 'ru', 'items', 'index.html'));

// The links on the index must point at the item pages that were actually written.
const html = fs.readFileSync(path.join(ROOT, 'dist', 'items', 'index.html'), 'utf8');
const hrefs = [...html.matchAll(/class="card-item" href="([^"]+)"/g)].map((m) => m[1]);
const missing = hrefs.filter((href) => {
  const dir = path.join(ROOT, 'dist', href.replace(/^\//, ''), 'index.html');
  return !fs.existsSync(dir);
});
console.log('  total hrefs        :', hrefs.length);
console.log('  unique hrefs       :', new Set(hrefs).size);
console.log('  broken hrefs       :', missing.length, missing.slice(0, 5));

// The change shown on the index must match the API for the same item.
const apiItems = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'api', 'v1', 'items.json'), 'utf8'));
const apiBySlug = new Map(apiItems.map((i) => [i.slug, i]));
const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'items.json'), 'utf8'));
const runtimeBySlug = new Map(runtime.map((i) => [i.slug || i.id, i]));

let mismatch = 0;
for (const m of html.matchAll(/class="card-item" href="\/item\/([^/]+)\/"\s+data-name="([^"]*)"[\s\S]*?data-change="([^"]*)"/g)) {
  const [, slug, , change] = m;
  const api = apiBySlug.get(slug);
  if (!api) continue;
  const apiChange = api.change7d === null || api.change7d === undefined ? '' : String(Math.round(api.change7d * 10) / 10);
  const shown = change === '' ? '' : String(Math.round(Number(change) * 10) / 10);
  if (apiChange !== shown) {
    mismatch++;
    if (mismatch <= 5) console.log('  MISMATCH', slug, 'api=' + apiChange, 'page=' + shown);
  }
}
console.log('  api/page mismatches:', mismatch);
