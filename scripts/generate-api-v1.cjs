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

/** The compact entry used by items.json and the per-category files. */
function compactItem(item, slug, categorySlug, series) {
  return {
    slug,
    id: item.id,
    name: item.name,
    nameEn: item.englishName || item.name,
    category: item.category,
    categorySlug,
    value: num(item.value, 0),
    valueLow: num(item.valueLow, num(item.value, 0)),
    valueHigh: num(item.valueHigh, num(item.value, 0)),
    demand: item.demand || null,
    demandEn: (item.demand && DEMAND_EN[item.demand]) || item.demand || null,
    stability: item.stability || null,
    stabilityEn: (item.stability && STABILITY_EN[item.stability]) || item.stability || null,
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
        demand: roll.demand || null,
        demandEn: (roll.demand && DEMAND_EN[roll.demand]) || roll.demand || null,
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
    name: other.name,
    nameEn: other.englishName || other.name,
    value: num(other.value, 0),
    url: `${SITE_ORIGIN}/item/${other.__slug}/`,
  }));
}

/** The full per-item document. */
function detailItem(item, compact, series, related) {
  return {
    ...compact,
    description: item.description || '',
    historicalDates: series.map((point) => point.d),
    historicalPrices: series.map((point) => point.p),
    rolls: rollsOf(item),
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
    nameEn: compact.nameEn,
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
        'Every category with its slug, English name, item count and value statistics (min, max, average, total).',
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
        { name: 'slug', type: 'string', required: true, description: 'Category slug, e.g. "stikery-pchel". See /api/v1/categories.json for the full list.' },
      ],
      example: `${SITE_ORIGIN}/api/v1/categories/bee-stickers/items.json`,
    },
    {
      method: 'GET',
      path: '/api/v1/search',
      key: 'search',
      summary: 'Search items',
      description:
        'Server-side search. Matches the name in either language, the slug, and the community slang for each category (so "куб" finds Cub Skins). Returns items ranked by relevance, then by value.',
      params: [
        { name: 'q', type: 'string', description: 'Search term, e.g. "bee", "star cub", "куб".' },
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
        'Small, lean index (slug, names, category, value) meant to be downloaded once and filtered client-side for instant search. No history, no colours.',
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
      required: ['slug', 'id', 'name', 'nameEn', 'category', 'categorySlug', 'value', 'valueLow', 'valueHigh', 'demand', 'demandEn', 'stability', 'stabilityEn', 'change7d', 'change30d', 'image', 'url', 'hasHistory'],
      properties: {
        slug: { type: 'string', description: 'URL-safe identifier, identical to the /item/<slug>/ page.' },
        id: { type: 'string', description: 'Stable internal id of the item.' },
        name: { type: 'string', description: 'Display name as published on the site.' },
        nameEn: { type: 'string', description: 'English name.' },
        category: { type: 'string', description: 'Category name.' },
        categorySlug: { type: 'string', description: 'Slugified category name.' },
        value: { type: 'number', description: 'Current value in honey/beeswax units.' },
        valueLow: { type: 'number', description: 'Lower bound of the accepted price range.' },
        valueHigh: { type: 'number', description: 'Upper bound of the accepted price range.' },
        demand: { type: ['string', 'null'], enum: ['Низкий', 'Средний', 'Высокий', 'Хайп', null], description: 'Demand, Russian label.' },
        demandEn: { type: ['string', 'null'], enum: ['Low', 'Average', 'High', 'Hype', null], description: 'Demand, English label.' },
        stability: { type: ['string', 'null'], enum: ['Растет', 'Стабильно', 'Падает', null], description: 'Price stability, Russian label.' },
        stabilityEn: { type: ['string', 'null'], enum: ['Rising', 'Stable', 'Falling', null], description: 'Price stability, English label.' },
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
            description: { type: 'string', description: 'Human readable market description.' },
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
                  demand: { type: ['string', 'null'] },
                  demandEn: { type: ['string', 'null'] },
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
                  nameEn: { type: 'string' },
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
      required: ['slug', 'name', 'nameEn', 'dates', 'prices', 'change7d', 'change30d', 'min', 'max', 'average'],
      properties: {
        slug: { type: 'string' },
        name: { type: 'string' },
        nameEn: { type: 'string' },
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
      required: ['slug', 'name', 'nameEn', 'count', 'minValue', 'maxValue', 'averageValue', 'totalValue'],
      properties: {
        slug: { type: 'string' },
        name: { type: 'string' },
        nameEn: { type: 'string' },
        count: { type: 'integer' },
        minValue: { type: 'number' },
        maxValue: { type: 'number' },
        averageValue: { type: 'number' },
        totalValue: { type: 'number' },
      },
    },
    Mover: {
      type: 'object',
      required: ['slug', 'name', 'nameEn', 'value', 'change7d', 'change30d'],
      properties: {
        slug: { type: 'string' },
        name: { type: 'string' },
        nameEn: { type: 'string' },
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
      required: ['slug', 'name', 'nameEn', 'category', 'categorySlug', 'value'],
      properties: {
        slug: { type: 'string' },
        name: { type: 'string' },
        nameEn: { type: 'string' },
        category: { type: 'string' },
        categorySlug: { type: 'string' },
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

function buildDocsHtml(version, endpoints, categories, stats, generated, itemCount) {
  const rows = endpoints.map((e) => `
        <tr>
          <td class="method">${esc(e.method)}</td>
          <td class="path"><code>${esc(e.path)}</code></td>
          <td class="desc">${esc(e.description)}</td>
        </tr>`).join('');

  const paramBlocks = endpoints
    .filter((e) => e.params && e.params.length)
    .map((e) => `
        <h4 class="ep-title"><span class="method method--get">${esc(e.method)}</span><code>${esc(e.path)}</code></h4>
        <p class="muted">${esc(e.description)}</p>
        <table class="params">
          <thead><tr><th>Parameter</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
          <tbody>
${e.params.map((p) => `            <tr><td><code>${esc(p.name)}</code></td><td>path</td><td>${esc(p.type)}</td><td>yes</td><td>${esc(p.description)}</td></tr>`).join('\n')}
          </tbody>
        </table>
        <pre class="code"><code>curl "${esc(e.example)}"</code></pre>`)
    .join('');

  const exampleBlocks = endpoints
    .filter((e) => ['item', 'history', 'categoryItems', 'items', 'changes', 'searchIndex'].includes(e.key))
    .map((e) => `
      <div class="example">
        <div class="example-head"><span class="method method--get">GET</span><code>${esc(e.path)}</code></div>
        <pre class="code"><code>curl "${esc(e.example)}"</code></pre>
      </div>`)
    .join('');

  const demandRows = DEMAND_LEGEND.map((d) => `            <tr><td><code>${esc(d.value)}</code></td><td><code>${esc(d.valueEn)}</code></td><td>${d.rank}</td><td>${esc(d.description)}</td></tr>`).join('\n');
  const stabilityRows = STABILITY_LEGEND.map((d) => `            <tr><td><code>${esc(d.value)}</code></td><td><code>${esc(d.valueEn)}</code></td><td>${d.rank}</td><td>${esc(d.description)}</td></tr>`).join('\n');
  const categoryRows = categories.map((c) => `            <tr><td><code>${esc(c.slug)}</code></td><td>${esc(c.name)}</td><td>${esc(c.nameEn)}</td><td>${c.count}</td></tr>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BSS Index API v${esc(version)} — Bee Swarm Simulator value API</title>
<meta name="description" content="Public, documented JSON API for Bee Swarm Simulator item values, price history and beequip rolls.">
<link rel="canonical" href="${esc(SITE_ORIGIN)}/api/v1/docs.html">
<style>
  :root {
    --bg: #0b0f19;
    --surface: rgba(11, 15, 25, 0.65);
    --surface-solid: #0e1220;
    --border: rgba(255, 255, 255, 0.07);
    --border-strong: rgba(255, 255, 255, 0.12);
    --text: #f5f5f5;
    --muted: #a1a1aa;
    --dim: #71717a;
    --amber: #f59e0b;
    --amber-soft: #fbbf24;
    --green: #10b981;
    --red: #ef4444;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 44px 44px;
    z-index: -1;
  }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px 80px; }
  header.top {
    border-bottom: 1px solid var(--border);
    background: rgba(11, 15, 25, 0.85);
    backdrop-filter: blur(16px);
    padding: 28px 0 24px;
    margin-bottom: 32px;
  }
  header.top .wrap { padding-bottom: 0; }
  .badge {
    display: inline-block;
    background: linear-gradient(90deg, var(--amber), #ca8a04);
    color: #0b0f19;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: .08em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 999px;
    margin-bottom: 14px;
  }
  h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: -0.02em; }
  h1 span { color: var(--amber); }
  h2 {
    margin: 44px 0 14px;
    font-size: 20px;
    letter-spacing: -0.01em;
    border-left: 3px solid var(--amber);
    padding-left: 10px;
  }
  h3 { margin: 28px 0 10px; font-size: 16px; }
  h4.ep-title { margin: 26px 0 8px; font-size: 15px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  p { margin: 0 0 12px; }
  a { color: var(--amber-soft); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: var(--muted); }
  .dim { color: var(--dim); }
  code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: .88em;
    background: rgba(255, 255, 255, .05);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 6px;
    color: #fde68a;
  }
  pre.code {
    background: #070a10;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    overflow-x: auto;
    margin: 0 0 14px;
  }
  pre.code code { background: none; border: none; padding: 0; color: #d4d4d8; }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px 20px;
  }
  .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
  .stat .k { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); }
  .stat .v { font-size: 21px; font-weight: 700; color: var(--amber-soft); margin-top: 2px; }
  ul { margin: 0 0 12px; padding-left: 20px; }
  li { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); font-weight: 700; }
  tbody tr:hover { background: rgba(255, 255, 255, .02); }
  td.method { color: var(--green); font-weight: 700; white-space: nowrap; }
  td.path { white-space: nowrap; }
  td.desc { color: var(--muted); }
  .method {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .06em;
    padding: 2px 8px;
    border-radius: 5px;
  }
  .method--get { background: rgba(16, 185, 129, .12); color: #34d399; border: 1px solid rgba(16, 185, 129, .25); }
  .example { margin-bottom: 18px; }
  .example-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .up { color: var(--green); }
  .down { color: var(--red); }
  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--dim); font-size: 13px; }
  @media (max-width: 640px) {
    td.path, td.method { white-space: normal; }
    table { font-size: 13px; }
  }
</style>
</head>
<body>
<header class="top">
  <div class="wrap">
    <span class="badge">Public JSON API · v${esc(version)}</span>
    <h1>BSS Index <span>API</span></h1>
    <p class="muted" style="max-width: 70ch;">
      Every item value, price history and beequip roll of <strong>Bee Swarm Simulator</strong> as clean JSON.
      No key, no rate limit, CORS open to every origin. Built for price trackers, bots, fan sites and spreadsheets.
    </p>
  </div>
</header>

<div class="wrap">

  <div class="grid">
    <div class="stat"><div class="k">Version</div><div class="v">${esc(version)}</div></div>
    <div class="stat"><div class="k">Items</div><div class="v">${itemCount}</div></div>
    <div class="stat"><div class="k">Categories</div><div class="v">${categories.length}</div></div>
    <div class="stat"><div class="k">Total value</div><div class="v">${esc(stats.totalValue)}</div></div>
    <div class="stat"><div class="k">Average value</div><div class="v">${esc(stats.averageValue)}</div></div>
    <div class="stat"><div class="k">Generated</div><div class="v" style="font-size:14px;">${esc(generated)}</div></div>
  </div>

  <h2>Why this API</h2>
  <div class="card">
    <ul>
      <li><strong>Numbers, not strings.</strong> Every value is a real JSON number — no <code>"65"</code>.</li>
      <li><strong>One file per item.</strong> Read a single price without downloading the whole catalogue.</li>
      <li><strong>CORS enabled.</strong> <code>Access-Control-Allow-Origin: *</code> — fetch it from any website, any framework.</li>
      <li><strong>Absolute image URLs.</strong> Nothing to rewrite on your side.</li>
      <li><strong>Versioned &amp; documented.</strong> <code>/api/v1/</code> never breaks, plus an OpenAPI 3.1 description.</li>
      <li><strong>Search ready.</strong> A tiny <a href="${esc(SITE_ORIGIN)}/api/v1/search-index.json">search-index.json</a> for instant client-side filtering.</li>
    </ul>
  </div>

  <h2>Base URL</h2>
  <pre class="code"><code>${esc(SITE_ORIGIN)}/api/v1</code></pre>
  <p class="muted">All responses are <code>application/json</code> and served with an open CORS policy. Cache-Control is handled by the CDN.</p>

  <h2>Endpoints</h2>
  <table>
    <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>

  <h2>Parameters</h2>
${paramBlocks}

  <h2>Examples</h2>
  <p class="muted">Copy-paste friendly. Every URL below returns JSON directly.</p>
${exampleBlocks}
  <h3>JavaScript (fetch, straight from a browser)</h3>
  <pre class="code"><code>const items = await fetch('${esc(SITE_ORIGIN)}/api/v1/items.json').then(r =&gt; r.json());
const bee = await fetch('${esc(SITE_ORIGIN)}/api/v1/items/star-cub.json').then(r =&gt; r.json());
console.log(bee.value, bee.change7d, bee.rolls.length);</code></pre>

  <h3>Python</h3>
  <pre class="code"><code>import requests

r = requests.get('${esc(SITE_ORIGIN)}/api/v1/items/star-cub.json').json()
print(r['nameEn'], r['value'], r['change7d'])</code></pre>

  <h2>Item shape</h2>
  <p class="muted">The compact shape used by <code>items.json</code> and <code>categories/&lt;slug&gt;/items.json</code>. The per-item document adds <code>description</code>, <code>historicalDates</code>, <code>historicalPrices</code>, <code>rolls</code> and <code>related</code>.</p>
  <table>
    <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
    <tbody>
      <tr><td><code>slug</code></td><td>string</td><td>Identifier used by the website at <code>/item/&lt;slug&gt;/</code>.</td></tr>
      <tr><td><code>id</code></td><td>string</td><td>Stable internal id.</td></tr>
      <tr><td><code>name</code> / <code>nameEn</code></td><td>string</td><td>Display name and English name.</td></tr>
      <tr><td><code>category</code> / <code>categorySlug</code></td><td>string</td><td>Category name and its slug.</td></tr>
      <tr><td><code>value</code></td><td>number</td><td>Current value.</td></tr>
      <tr><td><code>valueLow</code> / <code>valueHigh</code></td><td>number</td><td>Accepted price range.</td></tr>
      <tr><td><code>demand</code> / <code>demandEn</code></td><td>string</td><td>Demand label (see legend below).</td></tr>
      <tr><td><code>stability</code> / <code>stabilityEn</code></td><td>string</td><td>Price stability label (see legend below).</td></tr>
      <tr><td><code>change7d</code> / <code>change30d</code></td><td>number | null</td><td>Percentage change over 7 / 30 days, <code>null</code> when the item has not enough history.</td></tr>
      <tr><td><code>image</code></td><td>string</td><td>Absolute image URL.</td></tr>
      <tr><td><code>url</code></td><td>string</td><td>Absolute URL of the item page.</td></tr>
      <tr><td><code>hasHistory</code></td><td>boolean</td><td>Whether a price history exists for the item.</td></tr>
    </tbody>
  </table>

  <h2>Legends</h2>
  <h3>Demand</h3>
  <table>
    <thead><tr><th>value</th><th>demandEn</th><th>Rank</th><th>Meaning</th></tr></thead>
    <tbody>
${demandRows}
    </tbody>
  </table>
  <h3>Stability</h3>
  <table>
    <thead><tr><th>value</th><th>stabilityEn</th><th>Rank</th><th>Meaning</th></tr></thead>
    <tbody>
${stabilityRows}
    </tbody>
  </table>

  <h2>Categories</h2>
  <table>
    <thead><tr><th>Slug</th><th>Name</th><th>English</th><th>Items</th></tr></thead>
    <tbody>
${categoryRows}
    </tbody>
  </table>

  <h2>How changes are calculated</h2>
  <div class="card">
    <p class="muted" style="margin-bottom:0;">
      Price history is an irregular series of dated snapshots. <code>change7d</code> compares the newest snapshot with the price
      interpolated at 7 days earlier, <code>change30d</code> does the same for 30 days. When the recorded series does not reach
      that far back, the change is <code>null</code> — never a guess. Percentages are rounded to one decimal.
      Items without a usable change are skipped in <code>changes.json</code>.
    </p>
  </div>

  <h2>OpenAPI</h2>
  <p>Full machine readable description: <a href="${esc(SITE_ORIGIN)}/api/v1/openapi.json"><code>${esc(SITE_ORIGIN)}/api/v1/openapi.json</code></a> — point Swagger UI, Redoc, Postman or your own codegen at it.</p>

  <footer>
    <p>BSS Index API · version ${esc(version)} · generated ${esc(generated)} · <a href="${esc(SITE_ORIGIN)}/api/v1/index.json">index.json</a> · <a href="${esc(SITE_ORIGIN)}/">BSS Index</a></p>
  </footer>
</div>
</body>
</html>
`;
}

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
  { value: 'Низкий', valueEn: 'Low', rank: 1, description: 'Low demand — sells slowly and usually below the listed value.' },
  { value: 'Средний', valueEn: 'Average', rank: 2, description: 'Average demand — takes a while to sell at the listed value.' },
  { value: 'Высокий', valueEn: 'High', rank: 3, description: 'High demand — sells quickly, often above the listed value.' },
  { value: 'Хайп', valueEn: 'Hype', rank: 4, description: 'Hype — everybody wants it, prices move fast and hard.' },
];

const STABILITY_LEGEND = [
  { value: 'Растет', valueEn: 'Rising', rank: 1, description: 'The price is trending up over the recorded history.' },
  { value: 'Стабильно', valueEn: 'Stable', rank: 2, description: 'The price is holding steady.' },
  { value: 'Падает', valueEn: 'Falling', rank: 3, description: 'The price is trending down over the recorded history.' },
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
      name,
      nameEn: CATEGORY_EN[name] || name,
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
  categories.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
  write('categories.json', categories, true);

  // -- changes.json ----------------------------------------------------------
  const movers = items
    .map((item) => compactByItem.get(item))
    .filter((item) => item.change7d !== null && item.change7d !== undefined)
    .map((item) => ({
      slug: item.slug,
      name: item.name,
      nameEn: item.nameEn,
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
    nameEn: item.nameEn,
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
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, nameEn: c.nameEn, count: c.count })),
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

  // -- docs.html -------------------------------------------------------------
  const statsForDocs = {
    totalValue: round2(totalValue),
    averageValue: round2(allValues.length ? totalValue / allValues.length : 0),
  };
  bytes += writeText(
    path.join(API_V1, 'docs.html'),
    buildDocsHtml(version, endpoints, categories, statsForDocs, generated, items.length)
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
