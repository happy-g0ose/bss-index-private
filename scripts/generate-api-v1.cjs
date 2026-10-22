/**
 * Public JSON API v1 generator.
 *
 * Reads `bot/items.json` and writes a documented, versioned, per-resource JSON
 * API into `dist/api/v1/`, which Vercel serves straight from the site root:
 *
 *   https://bss-index.vercel.app/api/v1/index.json
 *   https://bss-index.vercel.app/api/v1/items.json
 *   https://bss-index.vercel.app/api/v1/items/bee-cub.json
 *   https://bss-index.vercel.app/api/v1/items/bee-cub/history.json
 *   https://bss-index.vercel.app/api/v1/categories.json
 *   https://bss-index.vercel.app/api/v1/categories/stikery-pchel/items.json
 *   https://bss-index.vercel.app/api/v1/changes.json
 *   https://bss-index.vercel.app/api/v1/stats.json
 *   https://bss-index.vercel.app/api/v1/search-index.json
 *   https://bss-index.vercel.app/api/v1/openapi.json
 *   https://bss-index.vercel.app/api/v1/docs.html
 *
 * Why v1 and not the legacy `dist/api/` tree: the legacy API is one flat
 * monolith per resource with no CORS story, stringly-typed values and no
 * documentation. v1 is resource-oriented (one file per item), every value is a
 * real JSON number, every document is self-describing, and the whole surface
 * is documented in `index.json`, `openapi.json` and `docs.html`.
 *
 * The legacy API in `dist/api/` is untouched — v1 lives in its own subfolder.
 *
 * The `slug` values MUST stay identical to the ones the site generates
 * (src/itemSlug.ts + scripts/prerender.cjs), because `/item/<slug>` routes
 * resolve back to these items. The slugify() table below is copied verbatim
 * from scripts/prerender.cjs — do not retype it.
 *
 * Runs AFTER `vite build` (the build copies `dist/` verbatim to the CDN), so
 * `dist/` may not exist yet when this script is called — we create what we
 * need ourselves.
 *
 * Safe to delete: the site works exactly the same without it.
 */
const fs = require('fs');
const path = require('path');
const { buildDocsHtml } = require('./lib/docs.cjs');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const API_DIR = path.join(DIST, 'api');
const API_V1 = path.join(API_DIR, 'v1');
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

/** Escape text for safe interpolation into HTML. */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Coerce to a finite number, with a fallback for missing values. */
function num(v, fallback) {
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isFinite(n)) return n;
  return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0;
}

/** Round to one decimal, normalising -0 to 0. */
function round1(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

/** Round to two decimals, normalising -0 to 0. */
function round2(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
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
 * Write JSON without a BOM. A BOM breaks JSON.parse on the server side, so we
 * always pass a raw string (never a Buffer with a BOM prefix).
 */
function writeJson(file, data, pretty) {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json, 'utf-8');
  return Buffer.byteLength(json, 'utf8');
}

/** Write a plain text file (the HTML docs page). */
function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf-8');
  return Buffer.byteLength(text, 'utf8');
}

// ---------------------------------------------------------------------------
// Price history
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build a chronologically sorted list of { t, p, d } points from the dated
 * price series. Points without a parsable date are dropped (a price we cannot
 * place on the timeline is useless for a change calculation) — and because
 * every history document is built from this series, `dates` and `prices`
 * always stay aligned.
 */
function buildSeries(item) {
  const prices = Array.isArray(item.historicalPrices) ? item.historicalPrices : [];
  const dates = Array.isArray(item.historicalDates) ? item.historicalDates : [];
  const points = [];
  for (let i = 0; i < prices.length; i++) {
    const raw = dates[i] || '';
    const t = Date.parse(raw);
    if (!Number.isFinite(t)) continue;
    const p = num(prices[i], 0);
    points.push({ t, p, d: raw });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

/**
 * Linear interpolation of the price at a given timestamp.
 * Returns null when the timestamp falls outside the recorded range.
 */
function priceAt(points, t) {
  if (!points.length) return null;
  if (t < points[0].t || t > points[points.length - 1].t) return null;
  for (let i = 1; i < points.length; i++) {
    if (points[i].t >= t) {
      const a = points[i - 1];
      const b = points[i];
      if (b.t === a.t) return b.p;
      const f = (t - a.t) / (b.t - a.t);
      return a.p + (b.p - a.p) * f;
    }
  }
  return points[points.length - 1].p;
}

/**
 * Percentage change over the last `days` days of the recorded series.
 *
 * The series is irregular (snapshots are taken when the market moves, not on
 * a fixed schedule), so the baseline is the price *interpolated* at
 * `lastSnapshot - days`. When the series does not reach that far back, the
 * item simply has "not enough history" and the change is null.
 *
 * The change is computed from the recorded series only — the live `value` can
 * be fresher than the last snapshot and would otherwise produce nonsense
 * percentages on stale series.
 */
function changeOver(points, days) {
  if (points.length < 2) return null;
  const end = points[points.length - 1].t;
  const base = priceAt(points, end - days * DAY_MS);
  if (base === null || !Number.isFinite(base) || base === 0) return null;
  const last = points[points.length - 1].p;
  return round1(((last - base) / base) * 100);
}

// ---------------------------------------------------------------------------
// Item shaping
// ---------------------------------------------------------------------------

/** Absolute image URL — the source data is already absolute, but be safe. */
function absoluteImage(image) {
  if (!image) return null;
  const url = String(image);
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${SITE_ORIGIN}${url}`;
  return `${SITE_ORIGIN}/${url}`;
}

// ---------------------------------------------------------------------------
// English-first naming
//
// The API is English-first: `name` and `category` always hold the English
// value, the Russian one lives in `nameRu` / `categoryRu`. The old
// English-suffixed fields are gone — they would only repeat `name` /
// `category`.
// ---------------------------------------------------------------------------

/** Any Cyrillic letter — the test for "this value is a Russian name". */
const CYRILLIC_RE = /[\u0400-\u04FF]/;

/** The English name of an item (`englishName`, display name as fallback). */
function englishName(item) {
  const en = typeof item.englishName === 'string' ? item.englishName.trim() : '';
  if (en) return en;
  return typeof item.name === 'string' ? item.name.trim() : '';
}

/**
 * The Russian name of an item, or null when the item has no separate Russian
 * name.
 *
 * `bot/items.json` carries the display name in `name` and the English one in
 * `englishName`. The two differ for the beequips — a real translation, e.g.
 * "Осенняя панама" / "Autumn Sunhat" — and for a couple of dozen items that
 * only append a Latin abbreviation ("Doodle Cub (DDC)"). Only the first kind
 * is a Russian name, so `nameRu` stays null for everything else: the payload
 * keeps its size and no field ever mixes two languages.
 */
function russianName(item) {
  const display = typeof item.name === 'string' ? item.name.trim() : '';
  if (!display || !CYRILLIC_RE.test(display)) return null;
  if (display === englishName(item)) return null;
  return display;
}

/** The English category name of an item (raw category as fallback). */
function englishCategory(item) {
  return CATEGORY_EN[item.category] || item.category;
}

/** The compact entry used by items.json and the per-category files. */
function compactItem(item, slug, categorySlug, series) {
  return {
    slug,
    id: item.id,
    name: englishName(item),
    nameRu: russianName(item),
    category: englishCategory(item),
    categoryRu: item.category,
    categorySlug,
    value: num(item.value, 0),
    valueLow: num(item.valueLow, num(item.value, 0)),
    valueHigh: num(item.valueHigh, num(item.value, 0)),
    demand: (item.demand && DEMAND_EN[item.demand]) || item.demand || null,
    demandRu: item.demand || null,
    stability: (item.stability && STABILITY_EN[item.stability]) || item.stability || null,
    stabilityRu: item.stability || null,
    change7d: changeOver(series, 7),
    change30d: changeOver(series, 30),
    image: absoluteImage(item.image),
    url: `${SITE_ORIGIN}/item/${slug}/`,
    hasHistory: series.length > 0,
  };
}

/** Flat list of every roll of a beequip. */
function rollsOf(item) {
  if (!Array.isArray(item.beequipData) || item.beequipData.length === 0) return [];
  const rolls = [];
  for (const group of item.beequipData) {
    if (!group) continue;
    const groupName = group.groupName || '';
    const list = Array.isArray(group.rolls) ? group.rolls : [];
    for (const roll of list) {
      if (!roll) continue;
      rolls.push({
        group: groupName,
        rollName: roll.rollName || null,
        value: num(roll.value, 0),
        valueLow: num(roll.valueLow, num(roll.value, 0)),
        valueHigh: num(roll.valueHigh, num(roll.value, 0)),
        // The source expresses some roll prices as a floor (">=100") or in
        // terms of another item (">={Bee Cub}"). The updater resolves those into
        // numbers; these fields keep the original expression and flag it.
        valueText: roll.valueText || null,
        isFloor: roll.isFloor === true,
        demand: (roll.demand && DEMAND_EN[roll.demand]) || roll.demand || null,
        demandRu: roll.demand || null,
      });
    }
  }
  return rolls;
}

/**
 * Related items: the most valuable items of the same category first, then the
 * most valuable items of the whole catalogue. The item itself is excluded.
 */
function relatedItems(item, all, byCategory) {
  const sameCategory = (byCategory.get(item.category) || [])
    .filter((other) => other.id !== item.id)
    .sort((a, b) => num(b.value, 0) - num(a.value, 0));
  const others = all
    .filter((other) => other.id !== item.id && other.category !== item.category && num(other.value, 0) > 0)
    .sort((a, b) => num(b.value, 0) - num(a.value, 0));

  const pool = [...sameCategory, ...others].slice(0, 10);
  return pool.map((other) => ({
    slug: other.__slug,
    name: englishName(other),
    nameRu: russianName(other),
    value: num(other.value, 0),
    url: `${SITE_ORIGIN}/item/${other.__slug}/`,
  }));
}

/**
 * The full per-item document.
 *
 * The source descriptions are written in Russian, so `description` is a factual
 * English summary built from the structured data and the original text is kept
 * in `descriptionRu`.
 */
function detailItem(item, compact, series, related) {
  const rolls = rollsOf(item);
  const original = item.description || '';
  const categoryEn = CATEGORY_EN[item.category] || item.category;

  const parts = [];
  if (categoryEn) parts.push(`${categoryEn} in Bee Swarm Simulator.`);
  if (rolls.length) {
    parts.push(`${rolls.length} roll${rolls.length === 1 ? '' : 's'} with individual prices.`);
  } else {
    const low = num(item.valueLow, num(item.value, 0));
    const high = num(item.valueHigh, num(item.value, 0));
    parts.push(
      low === high
        ? `Current value ${low}★.`
        : `Current value ${low}–${high}★.`
    );
  }
  if (compact.demand) parts.push(`Demand: ${String(compact.demand).toLowerCase()}.`);
  if (compact.stability) parts.push(`Trend: ${String(compact.stability).toLowerCase()}.`);

  return {
    ...compact,
    description: parts.join(' '),
    descriptionRu: original,
    historicalDates: series.map((point) => point.d),
    historicalPrices: series.map((point) => point.p),
    rolls,
    related,
  };
}

/** The per-item price history document. */
function historyDoc(compact, series) {
  const prices = series.map((point) => point.p);
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    slug: compact.slug,
    name: compact.name,
    nameRu: compact.nameRu,
    dates: series.map((point) => point.d),
    prices,
    change7d: compact.change7d,
    change30d: compact.change30d,
    min: prices.length ? round2(Math.min(...prices)) : null,
    max: prices.length ? round2(Math.max(...prices)) : null,
    average: prices.length ? round2(sum / prices.length) : null,
  };
}

// ---------------------------------------------------------------------------
// Endpoint catalogue (shared by index.json, openapi.json and docs.html)
// ---------------------------------------------------------------------------

function buildEndpoints() {
  return [
    {
      method: 'GET',
      path: '/api/v1/index.json',
      key: 'index',
      summary: 'API discovery document',
      description:
        'Discovery document. Lists the API version, the origin, the item and category counts, every category, the demand/stability legends and the full endpoint catalogue. Start here.',
      params: [],
      example: `${SITE_ORIGIN}/api/v1/index.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/items.json',
      key: 'items',
      summary: 'All items',
      description:
        'Every item of the catalogue in the compact shape, sorted by value descending. One array, no pagination needed.',
      params: [],
      example: `${SITE_ORIGIN}/api/v1/items.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/items/{slug}.json',
      key: 'item',
      summary: 'One item, full detail',
      description:
        'Full record for a single item: the compact fields plus description, the dated price history, the beequip rolls and up to 10 related items.',
      params: [
        { name: 'slug', type: 'string', required: true, description: 'Item slug, e.g. "star-cub". See /api/v1/search-index.json for the full list.' },
      ],
      example: `${SITE_ORIGIN}/api/v1/items/star-cub.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/items/{slug}/history.json',
      key: 'history',
      summary: 'Price history of one item',
      description:
        'Price history of a single item as two parallel arrays (dates + prices) plus min/max/average and the 7d/30d changes. Only items with a recorded history have this file.',
      params: [
        { name: 'slug', type: 'string', required: true, description: 'Item slug, e.g. "star-cub".' },
      ],
      example: `${SITE_ORIGIN}/api/v1/items/star-cub/history.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/categories.json',
      key: 'categories',
      summary: 'All categories',
      description:
        'Every category with its slug, English name, Russian name, item count and value statistics (min, max, average, total).',
      params: [],
      example: `${SITE_ORIGIN}/api/v1/categories.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/categories/{slug}/items.json',
      key: 'categoryItems',
      summary: 'Items of one category',
      description:
        'All items of one category in the same compact shape as /api/v1/items.json, sorted by value descending.',
      params: [
        { name: 'slug', type: 'string', required: true, description: 'Category slug, e.g. "bee-stickers". See /api/v1/categories.json for the full list.' },
      ],
      example: `${SITE_ORIGIN}/api/v1/categories/bee-stickers/items.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/search',
      key: 'search',
      summary: 'Search items',
      description:
        'Server-side search. Matches the name in either language, the slug, and the community slang for each category (so a Russian query finds the right group too). Returns items ranked by relevance, then by value.',
      params: [
        { name: 'q', type: 'string', description: 'Search term, e.g. "bee", "star cub", "kub".' },
        { name: 'category', type: 'string', description: 'Filter by category slug, e.g. "vouchers", "cub-skins".' },
        { name: 'sort', type: 'string', description: 'relevance (default), value, value-asc, name, change.' },
        { name: 'limit', type: 'integer', description: 'Items per page, 1-100, default 25.' },
        { name: 'offset', type: 'integer', description: 'Offset for pagination, default 0.' },
      ],
      example: `${SITE_ORIGIN}/api/v1/search?q=bee&limit=10`,
    },
    {
      method: 'GET',
      path: '/api/v1/changes.json',
      key: 'changes',
      summary: 'Market movers',
      description:
        'Market movers: the 10 biggest gainers and the 10 biggest losers over the last 7 days, with their 30 day change. Items without enough history are skipped.',
      params: [],
      example: `${SITE_ORIGIN}/api/v1/changes.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/stats.json',
      key: 'stats',
      summary: 'Market statistics',
      description:
        'Market summary: item count, total/average/median/min/max value and how many items carry a price history.',
      params: [],
      example: `${SITE_ORIGIN}/api/v1/stats.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/search-index.json',
      key: 'searchIndex',
      summary: 'Lean search index',
      description:
        'Small, lean index (slug, English and Russian names, English category, value) meant to be downloaded once and filtered client-side for instant search. No history, no colours.',
      params: [],
      example: `${SITE_ORIGIN}/api/v1/search-index.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/openapi.json',
      key: 'openapi',
      summary: 'OpenAPI 3.1 description',
      description:
        'OpenAPI 3.1 description of this API. Point your API client, Swagger UI or Redoc at it.',
      params: [],
      example: `${SITE_ORIGIN}/api/v1/openapi.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/docs.html',
      key: 'docs',
      summary: 'Human readable reference',
      description: 'Human readable API reference (this page).',
      params: [],
      example: `${SITE_ORIGIN}/api/v1/docs.html`,
    },
  ];
}

// ---------------------------------------------------------------------------
// OpenAPI 3.1
// ---------------------------------------------------------------------------

function buildOpenApi(version, endpoints, categories, itemCount) {
  const server = `${SITE_ORIGIN}/api/v1`;

  const schemas = {
    Item: {
      type: 'object',
      description: 'The compact item shape used by /items.json and the category files.',
      required: ['slug', 'id', 'name', 'nameRu', 'category', 'categoryRu', 'categorySlug', 'value', 'valueLow', 'valueHigh', 'demand', 'demandEn', 'stability', 'stabilityEn', 'change7d', 'change30d', 'image', 'url', 'hasHistory'],
      properties: {
        slug: { type: 'string', description: 'URL-safe identifier, identical to the /item/<slug>/ page.' },
        id: { type: 'string', description: 'Stable internal id of the item.' },
        name: { type: 'string', description: 'English name of the item, e.g. "Autumn Sunhat".' },
        nameRu: { type: ['string', 'null'], description: 'Russian name of the item, e.g. "Осенняя панама". Null when the item has no separate Russian name.' },
        category: { type: 'string', description: 'English category name, e.g. "Cub Skins".' },
        categoryRu: { type: 'string', description: 'Russian category name, e.g. "Скины на каба".' },
        categorySlug: { type: 'string', description: 'Slugified English category name, e.g. "cub-skins".' },
        value: { type: 'number', description: 'Current value in honey/beeswax units.' },
        valueLow: { type: 'number', description: 'Lower bound of the accepted price range.' },
        valueHigh: { type: 'number', description: 'Upper bound of the accepted price range.' },
        demand: { type: ['string', 'null'], enum: ['Low', 'Average', 'High', 'Hype', null], description: 'Demand, English label.' },
        demandRu: { type: ['string', 'null'], enum: ['Низкий', 'Средний', 'Высокий', 'Хайп', null], description: 'Demand, Russian label.' },
        stability: { type: ['string', 'null'], enum: ['Rising', 'Stable', 'Falling', null], description: 'Price stability, English label.' },
        stabilityRu: { type: ['string', 'null'], enum: ['Растет', 'Стабильно', 'Падает', null], description: 'Price stability, Russian label.' },
        change7d: { type: ['number', 'null'], description: 'Price change over the last 7 days in percent, null when there is not enough history.' },
        change30d: { type: ['number', 'null'], description: 'Price change over the last 30 days in percent, null when there is not enough history.' },
        image: { type: ['string', 'null'], description: 'Absolute image URL.' },
        url: { type: 'string', format: 'uri', description: 'Absolute URL of the item page on the site.' },
        hasHistory: { type: 'boolean', description: 'True when the item has a recorded price history.' },
      },
    },
    ItemDetail: {
      allOf: [
        { $ref: '#/components/schemas/Item' },
        {
          type: 'object',
          required: ['description', 'historicalDates', 'historicalPrices', 'rolls', 'related'],
          properties: {
            description: { type: 'string', description: 'Factual English summary of the item and its market state.' },
            descriptionRu: { type: 'string', description: 'The original Russian market description from the source.' },
            historicalDates: { type: 'array', items: { type: 'string', format: 'date' }, description: 'Dates of the recorded price points, aligned with historicalPrices.' },
            historicalPrices: { type: 'array', items: { type: 'number' }, description: 'Recorded prices, aligned with historicalDates.' },
            rolls: {
              type: 'array',
              description: 'Beequip rolls (empty for non-beequip items).',
              items: {
                type: 'object',
                properties: {
                  group: { type: 'string' },
                  rollName: { type: ['string', 'null'] },
                  value: { type: 'number' },
                  valueLow: { type: 'number' },
                  valueHigh: { type: 'number' },
                  valueText: { type: ['string', 'null'], description: 'Original price expression, e.g. ">=100".' },
                  isFloor: { type: 'boolean', description: 'True when the price is a lower bound rather than an exact value.' },
                  demand: { type: ['string', 'null'], enum: ['Low', 'Average', 'High', 'Hype', null] },
                  demandRu: { type: ['string', 'null'] },
                },
              },
            },
            related: {
              type: 'array',
              description: 'Up to 10 related items: same category first, then the most valuable overall.',
              items: {
                type: 'object',
                properties: {
                  slug: { type: 'string' },
                  name: { type: 'string' },
                  nameRu: { type: ['string', 'null'] },
                  value: { type: 'number' },
                  url: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
      ],
    },
    History: {
      type: 'object',
      required: ['slug', 'name', 'nameRu', 'dates', 'prices', 'change7d', 'change30d', 'min', 'max', 'average'],
      properties: {
        slug: { type: 'string' },
        name: { type: 'string', description: 'English name of the item.' },
        nameRu: { type: ['string', 'null'], description: 'Russian name of the item, null when there is none.' },
        dates: { type: 'array', items: { type: 'string', format: 'date' } },
        prices: { type: 'array', items: { type: 'number' } },
        change7d: { type: ['number', 'null'] },
        change30d: { type: ['number', 'null'] },
        min: { type: ['number', 'null'] },
        max: { type: ['number', 'null'] },
        average: { type: ['number', 'null'] },
      },
    },
    Category: {
      type: 'object',
      required: ['slug', 'name', 'nameRu', 'categoryRu', 'count', 'minValue', 'maxValue', 'averageValue', 'totalValue'],
      properties: {
        slug: { type: 'string' },
        name: { type: 'string', description: 'English category name, e.g. "Cub Skins".' },
        nameRu: { type: 'string', description: 'Russian category name, e.g. "Скины на каба".' },
        categoryRu: { type: 'string', description: 'Russian category name — same value as nameRu, kept so the key is the same on items and on categories.' },
        count: { type: 'integer' },
        minValue: { type: 'number' },
        maxValue: { type: 'number' },
        averageValue: { type: 'number' },
        totalValue: { type: 'number' },
      },
    },
    Mover: {
      type: 'object',
      required: ['slug', 'name', 'nameRu', 'value', 'change7d', 'change30d'],
      properties: {
        slug: { type: 'string' },
        name: { type: 'string', description: 'English name of the item.' },
        nameRu: { type: ['string', 'null'], description: 'Russian name of the item, null when there is none.' },
        value: { type: 'number' },
        change7d: { type: ['number', 'null'] },
        change30d: { type: ['number', 'null'] },
      },
    },
    Stats: {
      type: 'object',
      required: ['itemCount', 'totalValue', 'averageValue', 'medianValue', 'minValue', 'maxValue', 'itemsWithHistory', 'lastUpdated'],
      properties: {
        itemCount: { type: 'integer' },
        totalValue: { type: 'number' },
        averageValue: { type: 'number' },
        medianValue: { type: 'number' },
        minValue: { type: 'number' },
        maxValue: { type: 'number' },
        itemsWithHistory: { type: 'integer' },
        lastUpdated: { type: 'string', format: 'date-time' },
      },
    },
    SearchEntry: {
      type: 'object',
      required: ['slug', 'name', 'nameRu', 'category', 'categorySlug', 'value'],
      properties: {
        slug: { type: 'string' },
        name: { type: 'string', description: 'English name of the item.' },
        nameRu: { type: ['string', 'null'], description: 'Russian name of the item, null when there is none.' },
        category: { type: 'string', description: 'English category name, e.g. "Cub Skins".' },
        categorySlug: { type: 'string', description: 'Slugified English category name, e.g. "cub-skins".' },
        value: { type: 'number' },
      },
    },
    Index: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
        origin: { type: 'string' },
        generated: { type: 'string', format: 'date-time' },
        itemCount: { type: 'integer' },
        categoryCount: { type: 'integer' },
        categories: { type: 'array', items: { type: 'object' } },
        endpoints: { type: 'array', items: { type: 'object' } },
        demandLevels: { type: 'array', items: { type: 'object' } },
        stabilityLevels: { type: 'array', items: { type: 'object' } },
      },
    },
  };

  const responsesFor = (schemaRef, description, exampleUrl, isHtml, hasSlugParam) => ({
    200: {
      description: `${description}\n\nExample: ${exampleUrl}`,
      headers: {
        'Access-Control-Allow-Origin': { schema: { type: 'string' }, description: 'Always "*" — the API is readable from any origin.' },
      },
      content: isHtml
        ? { 'text/html': { schema: { type: 'string' } } }
        : { 'application/json': { schema: schemaRef } },
    },
    ...(hasSlugParam ? { 404: { description: 'Unknown slug — check /api/v1/search-index.json for the valid slugs.' } } : {}),
  });

  const paths = {};

  for (const endpoint of endpoints) {
    const rel = endpoint.path.replace(/^\/api\/v1/, '');
    // Path parameters (the slug) are required; query parameters are optional.
    const params = (endpoint.params || []).map((p) => {
      const isPath = p.name === 'slug' || p.name === 'category';
      return {
        name: p.name,
        in: isPath && endpoint.path.includes('{' + p.name + '}') ? 'path' : 'query',
        required: isPath && endpoint.path.includes('{' + p.name + '}'),
        description: p.description,
        schema: { type: p.type },
        example: p.name === 'slug' ? 'star-cub' : undefined,
      };
    });

    let schema;
    let description = endpoint.description;
    switch (endpoint.key) {
      case 'index':
        schema = { $ref: '#/components/schemas/Index' };
        break;
      case 'items':
        schema = { type: 'array', items: { $ref: '#/components/schemas/Item' } };
        break;
      case 'item':
        schema = { $ref: '#/components/schemas/ItemDetail' };
        break;
      case 'history':
        schema = { $ref: '#/components/schemas/History' };
        break;
      case 'categories':
        schema = { type: 'array', items: { $ref: '#/components/schemas/Category' } };
        break;
      case 'categoryItems':
        schema = { type: 'array', items: { $ref: '#/components/schemas/Item' } };
        break;
      case 'changes':
        schema = {
          type: 'object',
          properties: {
            gainers: { type: 'array', items: { $ref: '#/components/schemas/Mover' } },
            losers: { type: 'array', items: { $ref: '#/components/schemas/Mover' } },
            updated: { type: 'string', format: 'date-time' },
          },
        };
        break;
      case 'stats':
        schema = { $ref: '#/components/schemas/Stats' };
        break;
      case 'searchIndex':
        schema = { type: 'array', items: { $ref: '#/components/schemas/SearchEntry' } };
        break;
      case 'search':
        schema = {
          type: 'object',
          properties: {
            query: { type: 'string', nullable: true },
            category: { type: 'string', nullable: true },
            sort: { type: 'string' },
            total: { type: 'integer' },
            count: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
          },
        };
        break;
      case 'openapi':
        schema = { type: 'object', description: 'This OpenAPI 3.1 document.' };
        break;
      default:
        schema = { type: 'string', description: 'HTML documentation page.' };
    }

    paths[rel] = {
      get: {
        operationId: `get${endpoint.key.charAt(0).toUpperCase()}${endpoint.key.slice(1)}`,
        summary: endpoint.summary,
        description,
        tags: [endpoint.key === 'index' || endpoint.key === 'openapi' || endpoint.key === 'docs' ? 'meta' : 'data'],
        parameters: params.length ? params : undefined,
        responses: responsesFor(schema, endpoint.description, endpoint.example, endpoint.key === 'docs', params.length > 0),
      },
    };
  }

  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'BSS Index API',
      version,
      summary: 'Item values, price history and beequip rolls for Bee Swarm Simulator.',
      description:
        'A read-only, public JSON API for the Bee Swarm Simulator value list.\n\n' +
        `Every value is a real JSON number (never a string), every image URL is absolute, every document is versioned and self-describing, and CORS is open (\`Access-Control-Allow-Origin: *\`) so the API can be called straight from a browser on any domain.\n\n` +
        `The catalogue currently holds ${itemCount} items across ${categories.length} categories. Start with \`/api/v1/index.json\`.`,
      license: { name: 'MIT', identifier: 'MIT' },
    },
    servers: [{ url: server, description: 'Production' }],
    tags: [
      { name: 'meta', description: 'Discovery, documentation and the OpenAPI description.' },
      { name: 'data', description: 'Items, categories, price history and market statistics.' },
    ],
    paths,
    components: { schemas },
  };
}

// ---------------------------------------------------------------------------
// HTML documentation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Landing page for the bare /api/v1/ base URL
// ---------------------------------------------------------------------------

function buildLandingHtml(version, itemCount, categoryCount) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BSS Index API v${esc(version)}</title>
<meta http-equiv="refresh" content="0; url=./docs.html">
<link rel="canonical" href="${esc(SITE_ORIGIN)}/api/v1/docs.html">
<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0b0f19;
    color: #f5f5f5;
    font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .card {
    background: rgba(11, 15, 25, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 28px 32px;
    max-width: 560px;
    text-align: center;
  }
  .badge {
    display: inline-block;
    background: linear-gradient(90deg, #f59e0b, #ca8a04);
    color: #0b0f19;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: .08em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 999px;
  }
  h1 { margin: 16px 0 6px; font-size: 24px; }
  h1 span { color: #fbbf24; }
  p { color: #a1a1aa; margin: 0 0 6px; }
  code { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 5px; padding: 1px 6px; color: #fde68a; }
  a { color: #fbbf24; }
</style>
</head>
<body>
  <div class="card">
    <span class="badge">Public JSON API · v${esc(version)}</span>
    <h1>BSS Index <span>API</span></h1>
    <p>${itemCount} items · ${categoryCount} categories · CORS enabled.</p>
    <p>Redirecting to the <a href="./docs.html">API reference</a>…</p>
    <p><code>${esc(SITE_ORIGIN)}/api/v1/index.json</code></p>
  </div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Legends
// ---------------------------------------------------------------------------

const DEMAND_LEGEND = [
  { value: 'Low', valueRu: 'Низкий', rank: 1, description: 'Low demand — sells slowly and usually below the listed value.' },
  { value: 'Average', valueRu: 'Средний', rank: 2, description: 'Average demand — takes a while to sell at the listed value.' },
  { value: 'High', valueRu: 'Высокий', rank: 3, description: 'High demand — sells quickly, often above the listed value.' },
  { value: 'Hype', valueRu: 'Хайп', rank: 4, description: 'Hype — everybody wants it, prices move fast and hard.' },
];

const STABILITY_LEGEND = [
  { value: 'Rising', valueRu: 'Растет', rank: 1, description: 'The price is trending up over the recorded history.' },
  { value: 'Stable', valueRu: 'Стабильно', rank: 2, description: 'The price is holding steady.' },
  { value: 'Falling', valueRu: 'Падает', rank: 3, description: 'The price is trending down over the recorded history.' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const items = loadItems(ITEMS_SRC);
  if (!items) {
    console.warn(`[generate-api-v1] ${ITEMS_SRC} not found or not a JSON array. Skipping.`);
    process.exitCode = 0;
    return;
  }

  // Slugs must be unique — the site routes /item/<slug> back to a single item.
  // The de-duplication matches scripts/prerender.cjs exactly so the API and
  // the static pages always point at the same item.
  const usedSlugs = new Map();
  const slugByItem = new Map();
  for (const item of items) {
    let slug = slugify(item.englishName || item.id || item.name);
    if (usedSlugs.has(slug)) {
      const n = usedSlugs.get(slug) + 1;
      usedSlugs.set(slug, n);
      slug = `${slug}-${n}`;
      console.warn(`[generate-api-v1] Slug collision on "${slug}" — item "${item.name}" was suffixed.`);
    } else {
      usedSlugs.set(slug, 0);
    }
    slugByItem.set(item, slug);
    item.__slug = slug;
  }

  // Group by category.
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }

  // Fresh output folder (no stale files from a previous run).
  fs.mkdirSync(DIST, { recursive: true });
  fs.rmSync(API_V1, { recursive: true, force: true });
  fs.mkdirSync(API_V1, { recursive: true });

  let files = 0;
  let bytes = 0;

  const write = (rel, data, pretty) => {
    bytes += writeJson(path.join(API_V1, rel), data, pretty);
    files++;
  };

  // -- compact items + per-item documents -----------------------------------
  const seriesByItem = new Map();
  const compactByItem = new Map();

  for (const item of items) {
    const slug = slugByItem.get(item);
    const series = buildSeries(item);
    seriesByItem.set(item, series);
    // Category slugs are English: the API is English-first and categories have
    // no pages of their own on the site, so the slug is free to choose.
    const compact = compactItem(item, slug, slugify(CATEGORY_EN[item.category] || item.category), series);
    compactByItem.set(item, compact);
  }

  const sortedItems = items
    .map((item) => compactByItem.get(item))
    .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));

  // -- items.json ------------------------------------------------------------
  write('items.json', sortedItems, false);

  // -- items/<slug>.json + items/<slug>/history.json -------------------------
  for (const item of items) {
    const slug = slugByItem.get(item);
    const compact = compactByItem.get(item);
    const series = seriesByItem.get(item);

    const related = relatedItems(item, items, byCategory);
    write(path.join('items', `${slug}.json`), detailItem(item, compact, series, related), true);

    if (series.length > 0) {
      write(path.join('items', slug, 'history.json'), historyDoc(compact, series), true);
    }
  }

  // -- categories.json + categories/<slug>/items.json -----------------------
  const categories = [];
  for (const [name, list] of byCategory) {
    const slug = slugify(CATEGORY_EN[name] || name);
    const values = list.map((i) => num(i.value, 0));
    const total = values.reduce((a, b) => a + b, 0);
    categories.push({
      slug,
      // English-first: `name` is the English category, `nameRu` the Russian
      // original. `categoryRu` repeats it under the key the items use, so a
      // consumer can read one key everywhere.
      name: CATEGORY_EN[name] || name,
      nameRu: name,
      categoryRu: name,
      count: list.length,
      minValue: round2(values.length ? Math.min(...values) : 0),
      maxValue: round2(values.length ? Math.max(...values) : 0),
      averageValue: round2(values.length ? total / values.length : 0),
      totalValue: round2(total),
    });

    const listItems = list
      .map((item) => compactByItem.get(item))
      .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));
    write(path.join('categories', slug, 'items.json'), listItems, false);
  }
  categories.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
  write('categories.json', categories, true);

  // -- changes.json ----------------------------------------------------------
  const movers = items
    .map((item) => compactByItem.get(item))
    .filter((item) => item.change7d !== null && item.change7d !== undefined)
    .map((item) => ({
      slug: item.slug,
      name: item.name,
      nameRu: item.nameRu,
      value: item.value,
      change7d: item.change7d,
      change30d: item.change30d,
    }));

  const gainers = movers
    .slice()
    .sort((a, b) => b.change7d - a.change7d || b.value - a.value)
    .slice(0, 10);
  const losers = movers
    .slice()
    .sort((a, b) => a.change7d - b.change7d || b.value - a.value)
    .slice(0, 10);

  const generated = new Date().toISOString();
  write('changes.json', { gainers, losers, updated: generated }, true);

  // -- stats.json ------------------------------------------------------------
  const allValues = sortedItems.map((i) => i.value);
  const totalValue = allValues.reduce((a, b) => a + b, 0);
  const median = (() => {
    if (!allValues.length) return 0;
    const s = allValues.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  })();

  write('stats.json', {
    itemCount: sortedItems.length,
    totalValue: round2(totalValue),
    averageValue: round2(allValues.length ? totalValue / allValues.length : 0),
    medianValue: round2(median),
    minValue: round2(allValues.length ? Math.min(...allValues) : 0),
    maxValue: round2(allValues.length ? Math.max(...allValues) : 0),
    itemsWithHistory: sortedItems.filter((i) => i.hasHistory).length,
    lastUpdated: generated,
  }, true);

  // -- search-index.json -----------------------------------------------------
  const searchIndex = sortedItems.map((item) => ({
    slug: item.slug,
    name: item.name,
    nameRu: item.nameRu,
    category: item.category,
    categorySlug: item.categorySlug,
    value: item.value,
  }));
  write('search-index.json', searchIndex, false);

  // -- index.json ------------------------------------------------------------
  const version = loadVersion(VERSION_SRC);
  const endpoints = buildEndpoints();

  const index = {
    name: 'BSS Index API',
    version,
    description:
      'Public JSON API for Bee Swarm Simulator item values: per-item documents, price history, beequip rolls, categories, market movers and a lean search index. All values are JSON numbers, all image URLs are absolute, CORS is open.',
    origin: SITE_ORIGIN,
    generated,
    itemCount: items.length,
    categoryCount: categories.length,
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, nameRu: c.nameRu, categoryRu: c.categoryRu, count: c.count })),
    endpoints: endpoints.map((e) => ({
      method: e.method,
      path: e.path,
      summary: e.summary,
      description: e.description,
      ...(e.params && e.params.length ? { params: e.params } : {}),
      example: e.example,
    })),
    demandLevels: DEMAND_LEGEND,
    stabilityLevels: STABILITY_LEGEND,
    documentation: `${SITE_ORIGIN}/api/v1/docs.html`,
    openapi: `${SITE_ORIGIN}/api/v1/openapi.json`,
    license: 'MIT',
  };
  write('index.json', index, true);

  // -- openapi.json ----------------------------------------------------------
  write('openapi.json', buildOpenApi(version, endpoints, categories, items.length), true);

  // -- docs.html (English) and docs.ru.html (Russian) ------------------------
  const statsForDocs = {
    totalValue: round2(totalValue),
    averageValue: round2(allValues.length ? totalValue / allValues.length : 0),
  };
  bytes += writeText(
    path.join(API_V1, 'docs.html'),
    buildDocsHtml('en', version, endpoints, categories, statsForDocs, generated, items.length)
  );
  files++;
  bytes += writeText(
    path.join(API_V1, 'docs.ru.html'),
    buildDocsHtml('ru', version, endpoints, categories, statsForDocs, generated, items.length)
  );
  files++;

  // -- index.html (landing page for the bare /api/v1/ base URL) --------------
  bytes += writeText(path.join(API_V1, 'index.html'), buildLandingHtml(version, items.length, categories.length));
  files++;

  // -- summary ---------------------------------------------------------------
  const size = (rel) => fs.statSync(path.join(API_V1, rel)).size;
  console.log(
    `[generate-api-v1] ${items.length} items, ${categories.length} categories, ${files} files written to dist/api/v1/`
  );
  console.log(
    `[generate-api-v1] items.json ${(size('items.json') / 1024).toFixed(1)} KB · ` +
      `search-index.json ${(size('search-index.json') / 1024).toFixed(1)} KB · ` +
      `total ${(bytes / 1024).toFixed(1)} KB`
  );
}

try {
  main();
} catch (err) {
  console.error(`[generate-api-v1] ${err && err.message ? err.message : err}`);
  process.exit(1);
}
