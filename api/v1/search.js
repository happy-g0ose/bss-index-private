/**
 * BSS Index API — server-side search.
 *
 * GET /api/v1/search?q=bee&category=vouchers&limit=20&offset=0&sort=value
 *
 * The static v1 API already exposes every item, but a consumer that only wants
 * "the price of the thing whose name starts with bee" should not have to
 * download 155 KB first. This endpoint does the filtering server-side.
 *
 * The competitor has no equivalent: their API is a single 498 KB file with no
 * CORS header, so a browser on another site cannot even fetch it.
 */
import { createRequire } from 'module';

// createRequire works both when Vercel bundles the function and when it runs
// plain Node ESM, and it makes the bundler include the JSON file.
// The path is resolved from the repo root so it survives a move of this file.
const require = createRequire(import.meta.url);
const items = require('../../bot/items.json');

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const DEMAND_EN = { 'Низкий': 'Low', 'Средний': 'Average', 'Высокий': 'High', 'Хайп': 'Hype' };
const STABILITY_EN = { 'Растет': 'Rising', 'Стабильно': 'Stable', 'Падает': 'Falling' };

const ORIGIN = (process.env.SITE_ORIGIN || 'https://bss-index.vercel.app').replace(/\/$/, '');

const CATEGORY_EN = {
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
  'Биквипы': 'Beequips',
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

const CATEGORY_SLUG = new Map(
  Object.keys(CATEGORY_EN).map((name) => [name, slugify(CATEGORY_EN[name] || name)])
);

// Community slang for the categories, so a Russian search finds the right
// group even though the item names themselves are in English.
const CATEGORY_ALIASES = {
  'Скины на каба': ['куб', 'каб', 'cub', 'cubs', 'кабы', 'кубы', 'скины куба', 'скины каба'],
  'Стикеры пчел': ['пчела', 'пчелы', 'bee', 'bees', 'стикер пчелы'],
  'Стикеры медведей': ['медведь', 'медведи', 'bear', 'bears'],
  'Стикеры мобов': ['моб', 'мобы', 'mob', 'mobs'],
  'Ваучеры': ['ваучер', 'voucher', 'vouchers', 'билет', 'тикет'],
  'Биквипы': ['биквип', 'beequip', 'beequips', 'экипировка'],
  'Звездные знаки': ['звезда', 'знак', 'зодиак', 'star sign', 'zodiac'],
  'Искусство': ['арт', 'art', 'painting', 'картина'],
  'Драгоценности': ['самоцвет', 'gem', 'gems', 'алмаз'],
  'Цветы': ['цветок', 'flower', 'flowers'],
  'Грибы': ['гриб', 'mushroom', 'mushrooms'],
  'Листья': ['лист', 'leaf', 'leaves'],
  'Инструменты': ['инструмент', 'tool', 'tools'],
  'Марки': ['марка', 'stamp', 'stamps'],
  'Иконки нектара': ['нектар', 'nectar'],
  'Скины на улей': ['улей', 'hive'],
  'Стикеры Пчелождества': ['пчелождество', 'beesmas', 'beesmas'],
  'Разное': ['разное', 'misc', 'other'],
};

const CATEGORY_ALIAS_SLUG = new Map();
for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
  for (const alias of aliases) {
    CATEGORY_ALIAS_SLUG.set(slugify(alias), category);
  }
}

function change7d(item) {
  const prices = item.historicalPrices;
  const dates = item.historicalDates;
  if (!Array.isArray(prices) || !Array.isArray(dates) || prices.length < 2) return null;

  const series = prices
    .map((v, i) => ({ t: new Date(dates[i]).getTime(), v }))
    .filter((p) => !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t);
  if (series.length < 2) return null;

  const last = series[series.length - 1];
  const target = last.t - 7 * 86400000;

  // Interpolate the value at the target date.
  let before = series[0];
  let after = series[0];
  for (let i = 0; i < series.length - 1; i++) {
    if (series[i].t <= target && series[i + 1].t >= target) {
      before = series[i];
      after = series[i + 1];
      break;
    }
    if (series[i].t <= target) before = series[i];
  }
  if (before.v <= 0) return null;

  const span = after.t - before.t;
  const valueAt =
    span > 0 ? before.v + ((after.v - before.v) * (target - before.t)) / span : before.v;
  if (valueAt <= 0) return null;

  return Number((((last.v - valueAt) / valueAt) * 100).toFixed(1));
}

function toCompact(item) {
  const slug = slugify(item.englishName || item.id || item.name);
  return {
    slug,
    id: item.id,
    name: item.name,
    nameEn: item.englishName,
    category: item.category,
    categoryEn: CATEGORY_EN[item.category] || item.category,
    categorySlug: CATEGORY_SLUG.get(item.category) || slugify(item.category),
    value: item.value,
    valueLow: item.valueLow,
    valueHigh: item.valueHigh,
    demand: item.demand,
    demandEn: DEMAND_EN[item.demand] || item.demand,
    stability: item.stability,
    stabilityEn: STABILITY_EN[item.stability] || item.stability,
    change7d: change7d(item),
    image: item.image,
    url: `${ORIGIN}/item/${slug}/`,
  };
}

// Precompute once per cold start.
const ALL = items.map(toCompact);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    'X-API-Version': '1.0',
  };
}

function fail(res, status, code, message) {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify({ error: { code, message } }));
  return res;
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }
  if (req.method !== 'GET') {
    return fail(res, 405, 'method_not_allowed', 'Only GET is supported.');
  }

  const q = String(req.query.q || '').trim();
  const categoryFilter = String(req.query.category || '').trim().toLowerCase();
  const sort = String(req.query.sort || (q ? 'relevance' : 'value')).toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  let results = ALL;

  if (categoryFilter && categoryFilter !== 'all') {
    results = results.filter(
      (i) =>
        i.categorySlug.toLowerCase() === categoryFilter ||
        i.category.toLowerCase() === categoryFilter ||
        (i.categoryEn || '').toLowerCase() === categoryFilter ||
        slugify(i.category) === categoryFilter
    );
  }

  if (q) {
    const needle = q.toLowerCase();
    const transNeedle = slugify(needle);
    // A Russian query may name a whole category rather than one item.
    const aliasCategory = CATEGORY_ALIAS_SLUG.get(transNeedle) || null;

    results = results
      .map((item) => {
        const name = item.name.toLowerCase();
        const nameEn = (item.nameEn || '').toLowerCase();
        const nameSlug = slugify(item.name);
        const nameEnSlug = slugify(item.nameEn || '');
        const slug = item.slug;

        let score = 0;
        if (slug === transNeedle || nameSlug === transNeedle || nameEnSlug === transNeedle) score = 100;
        else if (name === needle || nameEn === needle) score = 90;
        else if (slug.startsWith(transNeedle) || nameSlug.startsWith(transNeedle) || nameEnSlug.startsWith(transNeedle)) score = 70;
        else if (name.startsWith(needle) || nameEn.startsWith(needle)) score = 60;
        else if (slug.includes(transNeedle) || nameSlug.includes(transNeedle) || nameEnSlug.includes(transNeedle)) score = 40;
        else if (name.includes(needle) || nameEn.includes(needle)) score = 30;
        else if ((item.category || '').toLowerCase().includes(needle)) score = 15;
        else if (aliasCategory && item.category === aliasCategory) score = 12;
        return { item, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || b.item.value - a.item.value)
      .map((r) => r.item);
  }

  if (sort === 'value') {
    results = results.slice().sort((a, b) => b.value - a.value);
  } else if (sort === 'value-asc') {
    results = results.slice().sort((a, b) => a.value - b.value);
  } else if (sort === 'name') {
    results = results.slice().sort((a, b) => (a.nameEn || '').localeCompare(b.nameEn || ''));
  } else if (sort === 'change') {
    results = results
      .slice()
      .sort((a, b) => (b.change7d ?? -Infinity) - (a.change7d ?? -Infinity));
  }

  const total = results.length;
  const page = results.slice(offset, offset + limit);

  res.writeHead(200, corsHeaders());
  res.end(
    JSON.stringify({
      query: q || null,
      category: categoryFilter || null,
      sort,
      total,
      count: page.length,
      limit,
      offset,
      items: page,
    })
  );
  return res;
}
