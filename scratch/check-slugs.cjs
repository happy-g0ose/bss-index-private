const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const V1 = path.join(ROOT, 'dist', 'api', 'v1');

const siteSlugs = new Set(
  fs.readdirSync(path.join(ROOT, 'dist', 'item')).filter((d) => fs.statSync(path.join(ROOT, 'dist', 'item', d)).isDirectory())
);
const apiSlugs = fs
  .readdirSync(path.join(V1, 'items'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -'.json'.length));

const missing = apiSlugs.filter((s) => !siteSlugs.has(s));
const extra = [...siteSlugs].filter((s) => !apiSlugs.includes(s));

console.log('site item pages:', siteSlugs.size, '| api item docs:', apiSlugs.length);
console.log('api slugs WITHOUT a site page:', missing.length, missing.slice(0, 5));
console.log('site pages WITHOUT an api doc:', extra.length, extra.slice(0, 5));

// The url field of every item must point at the site page that exists.
const items = JSON.parse(fs.readFileSync(path.join(V1, 'items.json'), 'utf8'));
const bad = items.filter((i) => !siteSlugs.has(i.slug));
console.log('items whose url target does not exist on the site:', bad.length, bad.slice(0, 5).map((b) => b.slug));

// Category slugs must match the legacy API category slugs (same slugify rules).
const legacyCats = fs.readdirSync(path.join(ROOT, 'dist', 'api', 'category')).map((f) => f.replace(/\.json$/, ''));
const apiCats = JSON.parse(fs.readFileSync(path.join(V1, 'categories.json'), 'utf8')).map((c) => c.slug);
console.log('legacy category slugs:', legacyCats.length, '| v1 category slugs:', apiCats.length);
console.log('category slug mismatch:', apiCats.filter((c) => !legacyCats.includes(c)), '/', legacyCats.filter((c) => !apiCats.includes(c)));
