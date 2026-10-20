const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'w');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(OUT);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const widgetFiles = htmlFiles.filter((f) => path.basename(path.dirname(f)) !== 'w');
const indexFiles = htmlFiles.filter((f) => path.basename(path.dirname(f)) === 'w');

const problems = [];
let maxSize = 0;
let maxPath = '';

for (const f of htmlFiles) {
  const buf = fs.readFileSync(f);
  const html = buf.toString('utf-8');
  const rel = path.relative(ROOT, f);

  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) problems.push(`${rel}: has a BOM`);
  if (!html.startsWith('<!doctype html>')) problems.push(`${rel}: does not start with <!doctype html>`);
  if (/<script[^>]+src=/i.test(html)) problems.push(`${rel}: contains <script src=`);
  if (/X-Frame-Options/i.test(html)) problems.push(`${rel}: mentions X-Frame-Options`);
  if (!/frame-ancestors/.test(html)) problems.push(`${rel}: missing frame-ancestors`);
  if (!/<script/i.test(html)) problems.push(`${rel}: missing inline script`);
  if (!/rel="canonical"/.test(html)) problems.push(`${rel}: missing canonical`);
  if (!/og:title/.test(html) || !/og:image/.test(html) || !/og:url/.test(html)) problems.push(`${rel}: missing og tags`);
  if (!/name="twitter:card"/.test(html)) problems.push(`${rel}: missing twitter:card`);
  if (!/bss_theme/.test(html)) problems.push(`${rel}: missing theme bootstrap`);
  if (!/embed=1/.test(html)) problems.push(`${rel}: missing embed toggle`);
  const isIndex = path.basename(path.dirname(f)) === 'w';
  if (!isIndex && !/Full price list/.test(html)) problems.push(`${rel}: missing "Full price list" link`);
  if (buf.length > maxSize && !isIndex) {
    maxSize = buf.length;
    maxPath = rel;
  }
}

console.log('files under dist/w          :', htmlFiles.length);
console.log('widget pages (in a subdir)  :', widgetFiles.length);
console.log('index pages (directly in w/):', indexFiles.length);
console.log('largest widget              :', maxPath, maxSize, 'bytes', `(${(maxSize / 1024).toFixed(2)} KB)`);
console.log('under 14 KB                 :', maxSize < 14 * 1024 ? 'PASS' : 'FAIL');
console.log('index page size             :', fs.statSync(path.join(OUT, 'index.html')).size, 'bytes');
console.log('problems                    :', problems.length);
for (const p of problems.slice(0, 25)) console.log('   -', p);

// --- slug parity check against the site algorithm -------------------------
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
function slugify(str) {
  return String(str)
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'bot', 'items.json'), 'utf-8'));
const slugs = items.map((i) => slugify(i.englishName || i.id || i.name));
console.log('unique slugs                :', new Set(slugs).size === slugs.length ? 'PASS' : 'FAIL');

let mismatch = 0;
for (const slug of slugs) {
  if (!fs.existsSync(path.join(OUT, slug, 'index.html'))) {
    mismatch++;
    console.log('   missing widget for slug:', slug);
  }
}
console.log('every item has a widget     :', mismatch === 0 ? 'PASS' : 'FAIL');

const siteSlugs = fs.existsSync(path.join(ROOT, 'dist', 'item'))
  ? fs.readdirSync(path.join(ROOT, 'dist', 'item')).filter((d) => d !== 'index.html')
  : [];
let diff = 0;
for (const s of siteSlugs) if (!slugs.includes(s)) diff++;
console.log(`site /item/ dirs: ${siteSlugs.length}, not covered by widgets: ${diff}`);

// spot check
const probe = path.join(OUT, 'bee-cub', 'index.html');
console.log('\nbee-cub exists              :', fs.existsSync(probe));
if (fs.existsSync(probe)) {
  const b = fs.readFileSync(probe);
  console.log('bee-cub size                 :', b.length, 'bytes');
}
