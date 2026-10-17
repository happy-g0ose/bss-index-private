/**
 * URL helpers shared by the app.
 *
 * The build step (scripts/prerender.cjs) writes one static page per item at
 * /item/<slug>. These helpers keep the slug logic identical on both sides so
 * the SPA can resolve an incoming /item/<slug> URL back to its item.
 *
 * Keep `slugify` in sync with the copy in scripts/prerender.cjs.
 */

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Transliterate + lowercase into a URL-safe slug. */
export function slugify(str: string): string {
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

/** Public URL for an item's standalone page. */
export function itemUrl(item: { englishName?: string; id?: string; name?: string }): string {
  return `/item/${slugify(item.englishName || item.id || item.name || '')}/`;
}

/** Extract the slug from a /item/<slug> path, or null if it is not one. */
export function slugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/item\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}