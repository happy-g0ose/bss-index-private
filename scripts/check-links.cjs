/**
 * Verifies the internal link graph of the built site.
 *
 * A crawler can only find the item pages if something links to them. This
 * checks that every item page links onwards to other items, and that the
 * static /items/ index lists all of them.
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

const itemDirs = fs.readdirSync(path.join(DIST, 'item')).filter((d) =>
  fs.existsSync(path.join(DIST, 'item', d, 'index.html'))
);
const ruItemDirs = fs.readdirSync(path.join(DIST, 'ru', 'item')).filter((d) =>
  fs.existsSync(path.join(DIST, 'ru', 'item', d, 'index.html'))
);

let noRelated = 0;
let totalRelated = 0;
for (const d of itemDirs) {
  const s = fs.readFileSync(path.join(DIST, 'item', d, 'index.html'), 'utf8');
  const rel = [...s.matchAll(/class="relitem" href="([^"]+)"/g)].map((m) => m[1]);
  if (rel.length === 0) noRelated++;
  totalRelated += rel.length;
}

const idx = fs.readFileSync(path.join(DIST, 'items', 'index.html'), 'utf8');
const idxLinks = [...idx.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]);
const ruIdx = fs.readFileSync(path.join(DIST, 'ru', 'items', 'index.html'), 'utf8');
const ruIdxLinks = [...ruIdx.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]);

const sm = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const smUrls = (sm.match(/<loc>/g) || []).length;

console.log('item pages (EN)          :', itemDirs.length);
console.log('item pages (RU)          :', ruItemDirs.length);
console.log('pages with no related    :', noRelated);
console.log('related links per page   :', (totalRelated / itemDirs.length).toFixed(1), 'avg');
console.log('links on /items/         :', idxLinks.length);
console.log('links on /ru/items/      :', ruIdxLinks.length);
console.log('sitemap urls             :', smUrls);
console.log('/items/ in sitemap      :', sm.includes('/items/') ? 'yes' : 'NO');
console.log('/ru/items/ in sitemap   :', sm.includes('/ru/items/') ? 'yes' : 'NO');

// How many distinct item pages are reachable from the index alone?
const reachable = new Set(idxLinks.map((h) => h.replace(/^\/|\/$/g, '').replace('/ru', '')));
console.log('distinct items reachable from index:', reachable.size);
