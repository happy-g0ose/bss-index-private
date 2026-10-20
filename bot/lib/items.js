/**
 * Item lookup shared by every command.
 *
 * Important: `slugify` here MUST stay identical to the one in the site's
 * src/itemSlug.ts, because the bot builds links to /item/<slug>/ pages and the
 * site resolves those slugs back to items. They drifted before — the bot used
 * item.id ("star-cub-0") while the site used englishName ("star-cub") — which
 * made every item button in Discord dead on arrival.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ITEMS_PATH = path.join(__dirname, '..', 'items.json');

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Same algorithm as src/itemSlug.ts — keep both in sync. */
export function slugify(str) {
  const out = String(str ?? '')
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return out || 'item';
}

/** Canonical slug for an item — englishName first, matching the site. */
export function itemSlug(item) {
  return slugify(item?.englishName || item?.id || item?.name || '');
}

export const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://bss-index.vercel.app';

/** Public URL of an item's standalone page. */
export function itemUrl(item, lang = 'en') {
  const slug = itemSlug(item);
  return lang === 'ru' ? `${SITE_ORIGIN}/ru/item/${slug}/` : `${SITE_ORIGIN}/item/${slug}/`;
}

let cache = { at: 0, items: [], bySlug: new Map() };

function load() {
  // Re-read at most every 30s so `npm run sync` updates are picked up
  // without restarting the bot.
  const fresh = Date.now() - cache.at < 30_000;
  if (fresh && cache.items.length) return cache;

  let items = [];
  try {
    items = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf-8'));
  } catch (err) {
    console.error('[items] cannot read items.json:', err.message);
    return cache;
  }

  const bySlug = new Map();
  for (const item of items) bySlug.set(itemSlug(item), item);

  cache = { at: Date.now(), items, bySlug };
  return cache;
}

export function getItems() {
  return load().items;
}

export function getItemBySlug(slug) {
  return load().bySlug.get(slug) || null;
}

/** Category -> emoji, so the autocomplete list is visually scannable. */
export const CATEGORY_EMOJI = {
  'Скины на каба': '🧸',
  'Скины на куба': '🧸',
  'Скины на улей': '🏠',
  'Ваучеры': '🎟️',
  'Стикеры пчел': '🐝',
  'Стикеры медведей': '🐻',
  'Стикеры мобов': '🐍',
  'Искусство': '🎨',
  'Драгоценности': '💎',
  'Иконки нектара': '🍯',
  'Цветы': '🌸',
  'Грибы': '🍄',
  'Листья': '🍂',
  'Инструменты': '🪄',
  'Марки': '📮',
  'Стикеры Пчелождества': '🎄',
  'Разное': '✨',
  'Звездные знаки': '⭐',
  'Биквипы': '🧤',
};

export function categoryEmoji(category) {
  return CATEGORY_EMOJI[category] || '📦';
}

export function isBeequip(item) {
  return item?.category === 'Биквипы';
}

/**
 * Resolve free text to an item.
 * Accepts a site slug, an item id, or a (partial) name in either language.
 */
export function resolveItem(query) {
  const raw = String(query || '').trim();
  if (!raw) return null;

  const { items, bySlug } = load();

  const bySlugHit = bySlug.get(slugify(raw)) || bySlug.get(raw);
  if (bySlugHit) return bySlugHit;

  const byId = items.find((i) => i.id === raw);
  if (byId) return byId;

  const needle = raw.toLowerCase();
  const nameHits = items.filter(
    (i) => i.name.toLowerCase() === needle || i.englishName.toLowerCase() === needle
  );
  if (nameHits.length) return nameHits[0];

  const partial = items.filter(
    (i) => i.name.toLowerCase().includes(needle) || i.englishName.toLowerCase().includes(needle)
  );
  if (partial.length) {
    // Prefer the cheapest exact-ish match so short queries don't surface a
    // hyper-rare item first.
    return partial.sort((a, b) => a.value - b.value)[0];
  }

  return null;
}

/** Flattened roll list for beequips, so `Autumn Sunhat (Max)` resolves. */
export function resolveRoll(item, rollName) {
  if (!item?.beequipData) return null;
  const needle = String(rollName || '').trim().toLowerCase();
  if (!needle) return null;

  for (const group of item.beequipData) {
    for (const roll of group.rolls || []) {
      if (roll.rollName.toLowerCase() === needle) return { item, group, roll };
    }
  }
  for (const group of item.beequipData) {
    for (const roll of group.rolls || []) {
      if (roll.rollName.toLowerCase().includes(needle)) return { item, group, roll };
    }
  }
  return null;
}
