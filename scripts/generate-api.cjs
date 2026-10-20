/**
 * Public read-only JSON API generator.
 *
 * Reads `bot/items.json` and writes a browsable, static JSON API into
 * `dist/api/`, which Vercel serves straight from the site root:
 *
 *   https://bss-index.vercel.app/api/index.json
 *   https://bss-index.vercel.app/api/values.json
 *   https://bss-index.vercel.app/api/item/bee-cub.json
 *   https://bss-index.vercel.app/api/history/bee-cub.json
 *   https://bss-index.vercel.app/api/category/stikery-pchel.json
 *
 * Runs AFTER `vite build` (the build copies `dist/` verbatim to the CDN), so
 * `dist/` may not exist yet when this script is called — we create what we
 * need ourselves.
 *
 * The `slug` values MUST stay identical to the ones the site generates
 * (src/itemSlug.ts + scripts/prerender.cjs), because `/item/<slug>` routes
 * resolve back to these items. The slugify() table below is copied verbatim
 * from scripts/prerender.cjs — do not retype it.
 *
 * Safe to delete: the site works exactly the same without it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const API_DIR = path.join(DIST, 'api');
const ITEMS_SRC = path.join(ROOT, 'bot', 'items.json');
const VERSION_SRC = path.join(ROOT, 'VERSION');

// Canonical origin. Override with SITE_ORIGIN env var at build time.
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://bss-index.vercel.app').replace(/\/+$/, '');

/** Russian demand -> English. */
const DEMAND_EN = {
  'Хайп': 'Hype',
  'Высокий': 'High',
  'Средний': 'Average',
  'Низкий': 'Low',
};

/** Russian stability -> English. */
const STABILITY_EN = {
  'Растет': 'Rising',
  'Падает': 'Falling',
  'Стабильно': 'Stable',
};

/** Russian category -> English. */
const CATEGORY_EN = {
  'Все': 'All',
  'Скины на куба': 'Cub Skins',
  'Скины на каба': 'Cub Skins',
  'Скины на улей': 'Hive Skins',
  'Ваучеры': 'Vouchers',
  'Стикеры пчел': 'Bee Stickers',
  'Стикеры медведей': 'Bear Stickers',
  'Стикеры мобов': 'Mob Stickers',
  'Искусство': 'Art',
  'Драгоценности': 'Gems',
  'Иконки нектара': 'Nectar Icons',
  'Цветы': 'Flowers',
  'Грибы': 'Mushrooms',
  'Листья': 'Leaves',
  'Инструменты': 'Tools',
  'Марки': 'Stamps',
  'Стикеры Пчелождества': 'Beesmas Stickers',
  'Разное': 'Misc',
  'Звездные знаки': 'Star Signs',
  'Стикеры полей': 'Field Stickers',
  'Биквипы': 'Beequips',
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Transliterate a Cyrillic item name into a stable URL slug.
 * COPIED VERBATIM from scripts/prerender.cjs — keep both in sync.
 */
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

/** Escape text for safe interpolation into HTML (kept for parity with prerender.cjs). */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Read + parse the item catalogue. Returns null when it is missing. */
function loadItems(file) {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  return Array.isArray(parsed) ? parsed : null;
}

/** Read the repo VERSION file (falls back to "0.0.0"). */
function loadVersion(file) {
  try {
    if (!fs.existsSync(file)) return '0.0.0';
    const v = fs.readFileSync(file, 'utf8').trim();
    return v || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Write JSON without a BOM. A BOM breaks JSON.parse on the server side,
 * so we always pass the raw string (never a Buffer with a BOM prefix).
 */
function writeJson(file, data, pretty) {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json, 'utf-8');
}

/** Coerce to a finite number, with a fallback for missing values. */
function num(v, fallback) {
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isFinite(n)) return n;
  return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0;
}

/** Remove stale *.json files from a directory we are about to regenerate. */
function cleanJsonDir(dir) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    fs.rmSync(path.join(dir, name), { force: true });
    removed++;
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Item shaping
// ---------------------------------------------------------------------------

/** The compact entry used by values.json and the per-category files. */
function compactItem(item, slug) {
  return {
    slug,
    id: item.id,
    name: item.name,
    englishName: item.englishName,
    category: item.category,
    value: num(item.value, 0),
    valueLow: num(item.valueLow, num(item.value, 0)),
    valueHigh: num(item.valueHigh, num(item.value, 0)),
    demand: item.demand,
    demandEn: DEMAND_EN[item.demand] || item.demand || null,
    stability: item.stability,
    stabilityEn: STABILITY_EN[item.stability] || item.stability || null,
    image: item.image || null,
    url: `${SITE_ORIGIN}/item/${slug}/`,
  };
}

/** Price history of an item, or null when it has none. */
function historyOf(item) {
  const prices = Array.isArray(item.historicalPrices) ? item.historicalPrices : null;
  const dates = Array.isArray(item.historicalDates) ? item.historicalDates : null;
  if (!prices || prices.length === 0) return null;
  return {
    dates: dates && dates.length === prices.length ? dates.slice() : prices.map((_, i) => `week-${i + 1}`),
    prices: prices.slice(),
  };
}

/** Flat list of every roll of a beequip. */
function rollsOf(item) {
  if (!Array.isArray(item.beequipData) || item.beequipData.length === 0) return null;
  const rolls = [];
  for (const group of item.beequipData) {
    const groupName = group && group.groupName ? group.groupName : '';
    const list = Array.isArray(group && group.rolls) ? group.rolls : [];
    for (const roll of list) {
      if (!roll) continue;
      rolls.push({
        group: groupName,
        rollName: roll.rollName,
        value: num(roll.value, 0),
        valueLow: num(roll.valueLow, num(roll.value, 0)),
        valueHigh: num(roll.valueHigh, num(roll.value, 0)),
        demand: roll.demand || null,
        demandEn: DEMAND_EN[roll.demand] || roll.demand || null,
      });
    }
  }
  return rolls.length ? rolls : null;
}

/** The full per-item document. */
function fullItem(item, slug) {
  const history = historyOf(item);
  const rolls = rollsOf(item);

  const known = new Set([
    'id', 'name', 'englishName', 'category', 'value', 'valueLow', 'valueHigh',
    'demand', 'stability', 'image', 'description', 'historicalPrices', 'historicalDates',
  ]);

  const extra = {};
  for (const key of Object.keys(item)) {
    if (known.has(key)) continue;
    extra[key] = item[key];
  }

  const doc = {
    slug,
    id: item.id,
    name: item.name,
    englishName: item.englishName,
    category: item.category,
    categoryEn: CATEGORY_EN[item.category] || item.category,
    value: num(item.value, 0),
    valueLow: num(item.valueLow, num(item.value, 0)),
    valueHigh: num(item.valueHigh, num(item.value, 0)),
    demand: item.demand || null,
    demandEn: DEMAND_EN[item.demand] || item.demand || null,
    stability: item.stability || null,
    stabilityEn: STABILITY_EN[item.stability] || item.stability || null,
    image: item.image || null,
    url: `${SITE_ORIGIN}/item/${slug}/`,
    description: item.description || '',
    ...extra,
  };

  if (history) doc.history = history;
  if (rolls) doc.rolls = rolls;

  return doc;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const items = loadItems(ITEMS_SRC);
  if (!items) {
    console.warn(`[generate-api] ${ITEMS_SRC} not found or not a JSON array. Skipping.`);
    process.exitCode = 0;
    return;
  }

  // Slugs must be unique — the site routes /item/<slug> back to a single item.
  const slugByItem = new Map();
  const seen = new Map();
  for (const item of items) {
    const slug = slugify(item.englishName || item.id || item.name);
    if (seen.has(slug)) {
      const prev = seen.get(slug);
      throw new Error(
        `Slug collision: "${slug}" is produced by both ` +
          `"${prev.name}" (${prev.englishName || prev.id}) and ` +
          `"${item.name}" (${item.englishName || item.id}). Fix the names or the slug table.`
      );
    }
    seen.set(slug, item);
    slugByItem.set(item, slug);
  }

  // Fresh output folders (no stale files from a previous run).
  fs.mkdirSync(API_DIR, { recursive: true });
  cleanJsonDir(path.join(API_DIR, 'item'));
  cleanJsonDir(path.join(API_DIR, 'history'));
  cleanJsonDir(path.join(API_DIR, 'category'));

  let files = 0;

  // -- values.json ---------------------------------------------------------
  const entries = items
    .map((item) => compactItem(item, slugByItem.get(item)))
    .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));
  writeJson(path.join(API_DIR, 'values.json'), entries, false);
  files++;

  // -- item/<slug>.json and history/<slug>.json -----------------------------
  for (const item of items) {
    const slug = slugByItem.get(item);

    writeJson(path.join(API_DIR, 'item', `${slug}.json`), fullItem(item, slug), true);
    files++;

    const history = historyOf(item);
    if (history) {
      writeJson(
        path.join(API_DIR, 'history', `${slug}.json`),
        { slug, dates: history.dates, prices: history.prices },
        true
      );
      files++;
    }
  }

  // -- category/<categorySlug>.json ----------------------------------------
  const byCategory = new Map();
  for (const item of items) {
    const name = item.category;
    if (!byCategory.has(name)) byCategory.set(name, []);
    byCategory.get(name).push(item);
  }

  const categories = [];
  for (const [name, list] of byCategory) {
    const slug = slugify(name);
    if (categories.some((c) => c.slug === slug)) {
      throw new Error(`Category slug collision: "${slug}" (${name})`);
    }
    const sorted = list
      .map((item) => compactItem(item, slugByItem.get(item)))
      .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));
    writeJson(path.join(API_DIR, 'category', `${slug}.json`), sorted, false);
    files++;
    categories.push({ name, slug, count: sorted.length });
  }

  categories.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));

  // -- index.json -----------------------------------------------------------
  const version = loadVersion(VERSION_SRC);
  const index = {
    name: 'BSS Index API',
    description: 'Read-only JSON API with every item value, price history and beequip roll in Bee Swarm Simulator.',
    version,
    generated: new Date().toISOString(),
    itemCount: items.length,
    categoryCount: categories.length,
    categories,
    endpoints: [
      {
        path: '/api/index.json',
        description: 'This document: API metadata, category list and endpoint documentation.',
        example: `${SITE_ORIGIN}/api/index.json`,
      },
      {
        path: '/api/values.json',
        description: 'Every item in a compact form, sorted by value descending.',
        example: `${SITE_ORIGIN}/api/values.json`,
      },
      {
        path: '/api/item/{slug}.json',
        description: 'Full record for one item, including price history and (for beequips) every roll.',
        example: `${SITE_ORIGIN}/api/item/bee-cub.json`,
      },
      {
        path: '/api/history/{slug}.json',
        description: 'Price history of one item: { slug, dates[], prices[] }.',
        example: `${SITE_ORIGIN}/api/history/bee-cub.json`,
      },
      {
        path: '/api/category/{category}.json',
        description: 'All items of one category in the same compact shape as values.json, sorted by value descending.',
        example: `${SITE_ORIGIN}/api/category/stikery-pchel.json`,
      },
    ],
  };
  writeJson(path.join(API_DIR, 'index.json'), index, true);
  files++;

  console.log(
    `[generate-api] ${items.length} items, ${categories.length} categories, ${files} files written to dist/api/`
  );
}

try {
  main();
} catch (err) {
  console.error(`[generate-api] ${err && err.message ? err.message : err}`);
  process.exit(1);
}
