/**
 * Builds a table of every URL the site exposes and checks that each one
 * actually responds.
 *
 * Usage: node scripts/link-table.mjs [origin]
 *   - prints a summary to the terminal
 *   - writes site-links.md with the full table (one row per URL)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ORIGIN = process.argv[2] || 'https://bss-index.vercel.app';

const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'bot', 'items.json'), 'utf8'));

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .split('')
    .map((c) => (c in TRANSLIT ? TRANSLIT[c] : c))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';

const fmt = (v) => (!v ? '—' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Number(v.toFixed(2))));

// --- build the URL list -------------------------------------------------
const urls = [
  { path: '/', kind: 'Главная / Home', label: 'Root', extra: '' },
  { path: '/ru/', kind: 'Главная / Home', label: 'RU root', extra: '' },
  { path: '/items/', kind: 'Указатель / Index', label: 'All items', extra: '' },
  { path: '/ru/items/', kind: 'Указатель / Index', label: 'RU items', extra: '' },
  { path: '/w/', kind: 'Виджеты / Widgets', label: 'Widget index', extra: '' },
  { path: '/api/index.json', kind: 'API', label: 'API index', extra: '' },
  { path: '/api/values.json', kind: 'API', label: 'All values', extra: '' },
  { path: '/sitemap.xml', kind: 'Служебные / Meta', label: 'Sitemap', extra: '' },
  { path: '/robots.txt', kind: 'Служебные / Meta', label: 'robots.txt', extra: '' },
  { path: '/404.html', kind: 'Служебные / Meta', label: '404 page', extra: '' },
  { path: '/data/items.json', kind: 'Служебные / Meta', label: 'Runtime data', extra: '' },
  { path: '/build-meta.json', kind: 'Служебные / Meta', label: 'Build info', extra: '' },
];

for (const item of items) {
  const slug = slugify(item.englishName || item.id || item.name);
  urls.push({
    path: `/item/${slug}/`,
    kind: 'Предмет / Item',
    label: item.englishName,
    extra: `${item.category} · ${fmt(item.value)}★`,
  });
  urls.push({
    path: `/ru/item/${slug}/`,
    kind: 'Предмет / Item',
    label: item.name,
    extra: `${item.category} · ${fmt(item.value)}★`,
  });
  urls.push({
    path: `/w/${slug}/`,
    kind: 'Виджет / Widget',
    label: item.englishName,
    extra: fmt(item.value) + '★',
  });
  urls.push({
    path: `/api/item/${slug}.json`,
    kind: 'API',
    label: item.englishName,
    extra: fmt(item.value) + '★',
  });
}

// --- check them ---------------------------------------------------------
async function check(u) {
  try {
    const res = await fetch(ORIGIN + u.path, { redirect: 'manual' });
    return res.status;
  } catch (e) {
    return 'ERR';
  }
}

const CONCURRENCY = 20;
const results = new Array(urls.length);
let cursor = 0;

async function worker() {
  while (cursor < urls.length) {
    const i = cursor++;
    results[i] = await check(urls[i]);
  }
}

console.log(`checking ${urls.length} URLs on ${ORIGIN} ...`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// --- report ------------------------------------------------------------
const byStatus = {};
for (const s of results) byStatus[s] = (byStatus[s] || 0) + 1;

console.log('\nstatus breakdown:');
for (const [s, n] of Object.entries(byStatus).sort()) {
  console.log(`  ${String(s).padStart(4)}  ${n}`);
}

const bad = urls.filter((_, i) => results[i] !== 200);
if (bad.length) {
  console.log('\nNOT 200:');
  for (const b of bad.slice(0, 20)) console.log(`  ${results[urls.indexOf(b)]}  ${b.path}`);
}

// --- markdown table ----------------------------------------------------
const lines = [];
lines.push('# BSS Index — карта ссылок');
lines.push('');
lines.push(`Домен: \`${ORIGIN}\` · Проверено: ${new Date().toISOString().slice(0, 10)} · Всего URL: ${urls.length}`);
lines.push('');
lines.push('| # | Тип | Название | URL | Статус |');
lines.push('|---|------|----------|-----|--------|');

const groups = new Map();
for (let i = 0; i < urls.length; i++) {
  const u = urls[i];
  if (!groups.has(u.kind)) groups.set(u.kind, []);
  groups.get(u.kind).push([u, results[i]]);
}

let n = 0;
for (const [kind, list] of groups) {
  lines.push('');
  lines.push(`## ${kind} (${list.length})`);
  lines.push('');
  lines.push('| # | Название | URL | Статус |');
  lines.push('|---|----------|-----|--------|');
  for (const [u, status] of list) {
    n++;
    lines.push(`| ${n} | ${u.label}${u.extra ? ' — ' + u.extra : ''} | \`${u.path}\` | ${status} |`);
  }
}

const out = path.join(ROOT, 'site-links.md');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log('\ntable written to site-links.md');

const allOk = bad.length === 0;
console.log(allOk ? 'ALL LINKS RETURN 200' : `${bad.length} LINKS NOT OK`);
process.exitCode = allOk ? 0 : 1;
