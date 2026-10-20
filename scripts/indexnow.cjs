/**
 * IndexNow — tells search engines about changed URLs immediately.
 *
 * Why: the "Request indexing" button in Google Search Console has a daily
 * quota of roughly ten URLs. That is useless for 660 pages. The sitemap is the
 * proper mechanism for a full crawl, and IndexNow covers the rest: it pushes
 * URLs straight to Bing, Yandex and the other participating engines, with no
 * quota at all.
 *
 * Requirements: a key that is also served from the site root, so the endpoint
 * can be verified. The key lives in indexnow.key (committed) and is written
 * to <dist>/<key>.txt during the build.
 *
 * Usage: node scripts/indexnow.cjs [--all]
 *   --all   push every item URL (use after a big change)
 *   (default) push the URLs whose values changed in the last update
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEY_PATH = path.join(ROOT, 'indexnow.key');
const ITEMS_PATH = path.join(ROOT, 'bot', 'items.json');
const ORIGIN = (process.env.SITE_ORIGIN || 'https://bss-index.vercel.app').replace(/\/$/, '');

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

function readKey() {
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY.trim();
  if (fs.existsSync(KEY_PATH)) return fs.readFileSync(KEY_PATH, 'utf-8').trim();
  return null;
}

async function main() {
  const key = readKey();
  if (!key) {
    console.warn('[indexnow] no key found (indexnow.key or INDEXNOW_KEY) — skipping.');
    return;
  }

  const items = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf-8'));
  const pushAll = process.argv.includes('--all');

  // Without --all we can only report what changed in this run, which the
  // workflow knows; it passes the changed ids as arguments.
  const changedIds = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const targets = changedIds.length
    ? items.filter((i) => changedIds.includes(i.id))
    : pushAll
      ? items
      : [];

  if (targets.length === 0) {
    console.log('[indexnow] nothing to push (pass --all or changed item ids).');
    return;
  }

  const urlList = [];
  for (const item of targets) {
    const slug = slugify(item.englishName || item.id || item.name);
    urlList.push(`${ORIGIN}/item/${slug}/`);
    urlList.push(`${ORIGIN}/ru/item/${slug}/`);
    urlList.push(`${ORIGIN}/w/${slug}/`);
  }

  const body = {
    host: new URL(ORIGIN).host,
    key,
    keyLocation: `${ORIGIN}/${key}.txt`,
    urlList,
  };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      console.log(`[indexnow] submitted ${urlList.length} URLs — ${res.status}`);
    } else {
      const text = await res.text().catch(() => '');
      console.warn(`[indexnow] rejected: ${res.status} ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn('[indexnow] request failed:', err.message);
  }
}

main();
