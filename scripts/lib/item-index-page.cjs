/**
 * The static item index at /items/ and /ru/items/.
 *
 * This is the one page in the site that links to every item, so it is also the
 * crawler's way in. It therefore keeps every item as a plain <a href> in the
 * server-rendered HTML, and JavaScript is only an enhancement on top.
 *
 * The page follows the site's own theme: it reads the saved theme from
 * localStorage, so it does not stay dark while the rest of the site is light.
 */
const { getCategoryStyles } = require('./category-styles.cjs');
const { changeOver } = require('./change.cjs');

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

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** The category slug used in the anchor links. */
function slugify(str) {
  return (
    String(str ?? '')
      .toLowerCase()
      .split('')
      .map((c) => (c in TRANSLIT ? TRANSLIT[c] : c))
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.round(n * 100) / 100);
};

/**
 * @param {Array} items   raw items from bot/items.json
 * @param {boolean} isEn  English page (true) or Russian page (false)
 * @param {{slugify?: Function}} [opts]  slug function to reuse, so the links
 *        here can never drift from the item page URLs
 */
function buildIndexPage(items, isEn, opts = {}) {
  const slug = opts.slugify || slugify;
  const prefix = isEn ? '' : '/ru';

  // Group by category, biggest first.
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }
  const groups = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length);

  const navChips = groups
    .map(([category, list]) => {
      const id = `cat-${slug(category)}`;
      const title = isEn ? CATEGORY_EN[category] || category : category;
      return `<a class="chip" href="#${id}" data-target="${id}">${esc(title)} <span>${list.length}</span></a>`;
    })
    .join('\n        ');

  // Every item, in a flat list, for the JSON-LD ItemList and for the sitemap.
  const flat = [];
  const sections = groups
    .map(([category, list]) => {
      const id = `cat-${slug(category)}`;
      const title = isEn ? CATEGORY_EN[category] || category : category;

      const cards = list
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((i) => {
          const itemSlug = slug(i.englishName || i.id || i.name);
          const label = isEn ? i.englishName : i.name;
          const altLabel = isEn ? i.name : i.englishName;
          const change = changeOver(i, 7);
          const styles = getCategoryStyles(i.category);
          const changeChip =
            change === null
              ? ''
              : `<span class="chg ${change > 0 ? 'up' : change < 0 ? 'down' : ''}">${
                  change > 0 ? '↗' : change < 0 ? '↘' : '→'
                } ${change > 0 ? '+' : ''}${change.toFixed(0)}%</span>`;

          flat.push({ slug: itemSlug, name: label, value: Number(i.value) || 0, category: title });

          return `          <a class="card-item" href="${prefix}/item/${itemSlug}/"
             data-name="${esc(label.toLowerCase())}"
             data-alt="${esc(String(altLabel || '').toLowerCase())}"
             data-category="${esc(title.toLowerCase())}"
             data-value="${Number(i.value) || 0}"
             data-change="${change === null ? '' : change}"
             style="--glow:${esc(styles.glowColor)};--cat:${esc(styles.hexColor)}">
            <span class="thumb">${
              i.image
                ? `<img src="${esc(i.image)}" alt="${esc(label)}" loading="lazy" decoding="async" width="36" height="36">`
                : ''
            }</span>
            <span class="meta">
              <span class="name">${esc(label)}</span>
              <span class="sub">${esc(title)}</span>
            </span>
            <span class="price">
              <span class="val">${esc(fmt(i.value))}<span class="star">★</span></span>
              ${changeChip}
            </span>
          </a>`;
        })
        .join('\n');

      return `      <section class="group" id="${id}">
        <h2 class="ghead"><span class="gtitle">${esc(title)}</span><span class="gcount">${list.length}</span></h2>
        <div class="grid">
${cards}
        </div>
      </section>`;
    })
    .join('\n');

  const totalValue = items.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const top = items.slice().sort((a, b) => (b.value || 0) - (a.value || 0))[0];

  const pageTitle = isEn
    ? 'All items — BSS Index value list'
    : 'Все предметы — валют лист BSS Index';
  const pageDesc = isEn
    ? `Every sticker, voucher and beequip in Bee Swarm Simulator with its current value. ${items.length} items, searchable and sortable.`
    : `Все стикеры, ваучеры и биквипы в Bee Swarm Simulator с актуальной ценностью. ${items.length} предметов, с поиском и сортировкой.`;

  const t = isEn
    ? {
        h1: 'All items',
        lead: pageDesc,
        search: 'Search items…',
        sort: 'Sort',
        sortValue: 'By value',
        sortName: 'By name',
        sortChange: 'By change',
        found: 'found',
        none: 'Nothing matches that search.',
        reset: 'Reset',
        top: 'Most expensive',
        total: 'Total value',
        count: 'Items',
        home: 'BSS Index home',
        api: 'API',
        demo: 'Live demo',
        brand: 'BSS Index',
      }
    : {
        h1: 'Все предметы',
        lead: pageDesc,
        search: 'Поиск предметов…',
        sort: 'Сортировка',
        sortValue: 'По цене',
        sortName: 'По названию',
        sortChange: 'По изменению',
        found: 'найдено',
        none: 'Ничего не найдено.',
        reset: 'Сбросить',
        top: 'Самый дорогой',
        total: 'Общая ценность',
        count: 'Предметов',
        home: 'На главную BSS Index',
        api: 'API',
        demo: 'Живое демо',
        brand: 'BSS Index',
      };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.h1,
    description: pageDesc,
    numberOfItems: flat.length,
    itemListElement: flat.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: `${ORIGIN}${prefix}/item/${item.slug}/`,
    })),
  };

  return `<!doctype html>
<html lang="${isEn ? 'en' : 'ru'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(pageDesc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${ORIGIN}${prefix}/items/">
<link rel="alternate" hreflang="en" href="${ORIGIN}/items/">
<link rel="alternate" hreflang="ru" href="${ORIGIN}/ru/items/">
<link rel="alternate" hreflang="x-default" href="${ORIGIN}/items/">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(pageDesc)}">
<meta property="og:url" content="${ORIGIN}${prefix}/items/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BSS Index">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://bssmvalues.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(itemListJsonLd)}</script>
<style>
  :root {
    color-scheme: dark;
    --bg: #0b0f19;
    --surface: rgba(11, 15, 25, .65);
    --surface-2: rgba(255, 255, 255, .04);
    --border: rgba(255, 255, 255, .07);
    --text: #e5e5e5;
    --muted: #a1a1aa;
    --faint: #71717a;
    --accent: #fbbf24;
    --chip-bg: rgba(255, 255, 255, .05);
  }
  html.light {
    color-scheme: light;
    --bg: #f4f5f7;
    --surface: #ffffff;
    --surface-2: rgba(15, 23, 42, .03);
    --border: rgba(15, 23, 42, .12);
    --text: #18181b;
    --muted: #4b5563;
    --faint: #6b7280;
    --accent: #b45309;
    --chip-bg: rgba(15, 23, 42, .05);
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: Inter, system-ui, -apple-system, sans-serif; line-height: 1.55;
    transition: background .2s ease, color .2s ease;
  }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 72px; }
  .brand { display: inline-flex; align-items: center; gap: 9px; margin-bottom: 18px; font-size: 11px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; color: var(--faint); text-decoration: none; }
  .brand img { width: auto; height: 26px; display: block; filter: drop-shadow(0 2px 8px rgba(245, 158, 11, .25)); }
  .brand:hover { color: var(--accent); }
  h1 { font-size: clamp(24px, 5vw, 38px); font-weight: 900; text-transform: uppercase; margin: 0 0 8px; letter-spacing: -.01em; }
  .lead { color: var(--muted); font-size: 15px; margin: 0 0 22px; max-width: 62ch; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 24px; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
  .stat b { display: block; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); margin-bottom: 5px; }
  .stat span { font-size: 17px; font-weight: 800; color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .stat i { display: block; font-style: normal; font-size: 11.5px; font-weight: 700; color: var(--muted); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
  .search { position: relative; flex: 1 1 260px; min-width: 220px; }
  .search input {
    width: 100%; padding: 11px 14px 11px 38px; border-radius: 12px;
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    font-size: 14px; font-family: inherit; outline: none; transition: border-color .15s, box-shadow .15s;
  }
  .search input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(245, 158, 11, .15); }
  .search svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--faint); pointer-events: none; }
  .toolbar select, .toolbar button {
    padding: 11px 12px; border-radius: 12px; background: var(--surface);
    border: 1px solid var(--border); color: var(--text); font-size: 13px; font-family: inherit; outline: none; cursor: pointer;
  }
  .toolbar button { color: var(--muted); font-weight: 700; }
  .toolbar select:focus, .toolbar button:focus-visible { border-color: var(--accent); }
  .count { font-size: 12px; color: var(--faint); font-weight: 700; margin-left: auto; }

  .chips { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 30px; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px;
    background: var(--chip-bg); border: 1px solid var(--border); color: var(--muted);
    text-decoration: none; font-size: 12px; font-weight: 700; transition: all .15s;
  }
  .chip span { color: var(--faint); font-size: 10px; }
  .chip:hover { border-color: var(--accent); color: var(--accent); }
  .chip.active { background: rgba(245, 158, 11, .12); border-color: var(--accent); color: var(--accent); }

  .group { margin-bottom: 34px; scroll-margin-top: 20px; }
  .group[hidden] { display: none; }
  .ghead { display: flex; align-items: baseline; gap: 9px; margin: 0 0 12px; }
  .gtitle { font-size: 12px; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; color: var(--accent); }
  .gcount { font-size: 11px; color: var(--faint); font-weight: 700; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
  .card-item {
    display: flex; align-items: center; gap: 11px; padding: 9px 12px 9px 9px;
    border-radius: 13px; border: 1px solid var(--border); background: var(--surface);
    text-decoration: none; color: var(--text); transition: border-color .15s, transform .15s, background .15s;
  }
  .card-item:hover { border-color: var(--accent); transform: translateY(-2px); }
  .card-item[hidden] { display: none; }
  .thumb {
    width: 42px; height: 42px; flex-shrink: 0; border-radius: 10px;
    background: var(--glow, var(--surface-2)); display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  .thumb img { width: 36px; height: 36px; object-fit: contain; }
  .meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .name { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 10.5px; color: var(--cat, var(--faint)); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .price { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
  .val { font-size: 14px; font-weight: 900; color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
  .star { font-size: 10px; color: var(--accent); }
  .chg { font-size: 10px; font-weight: 800; font-family: ui-monospace, monospace; white-space: nowrap; }
  .chg.up { color: #34d399; }
  .chg.down { color: #f87171; }
  /* The category colours are tuned for a dark background. On white they need
     to be darkened to stay readable, and the up/down colours need a darker
     variant for the same reason. */
  html.light .sub { color: color-mix(in srgb, var(--cat, #64748b) 62%, #111827); }
  html.light .chg.up { color: #047857; }
  html.light .chg.down { color: #b91c1c; }
  .empty { padding: 40px 0; text-align: center; color: var(--faint); font-size: 14px; display: none; }
  .empty.show { display: block; }
  .foot { margin-top: 44px; padding-top: 18px; border-top: 1px solid var(--border); font-size: 13px; color: var(--faint); display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
  .foot a { color: var(--accent); text-decoration: none; font-weight: 700; }
  .foot a:hover { text-decoration: underline; }
  @media (max-width: 560px) { .wrap { padding: 24px 14px 56px; } .grid { grid-template-columns: 1fr; } }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .card-item { transition: none; } }
</style>
</head>
<body>
<main class="wrap">
  <a class="brand" href="${isEn ? '/' : '/ru/'}"><img src="/logo-128.png" alt="${esc(t.brand)}" width="24" height="21">${esc(t.brand)}</a>
  <h1>${esc(t.h1)}</h1>
  <p class="lead">${esc(t.lead)}</p>

  <div class="stats">
    <div class="stat"><b>${esc(t.count)}</b><span>${items.length}</span></div>
    <div class="stat"><b>${esc(t.total)}</b><span>${esc(fmt(totalValue))}★</span></div>
    <div class="stat">
      <b>${esc(t.top)}</b>
      <span>${esc(fmt(top ? top.value : 0))}★</span>
      <i>${esc(top ? (isEn ? top.englishName || top.name : top.name) : '')}</i>
    </div>
  </div>

  <div class="toolbar">
    <label class="search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="${esc(t.search)}" autocomplete="off" aria-label="${esc(t.search)}">
    </label>
    <select id="sort" aria-label="${esc(t.sort)}">
      <option value="value">${esc(t.sortValue)}</option>
      <option value="name">${esc(t.sortName)}</option>
      <option value="change">${esc(t.sortChange)}</option>
    </select>
    <button id="reset" type="button">${esc(t.reset)}</button>
    <span class="count" id="count" role="status" aria-live="polite"></span>
  </div>

  <nav class="chips">
        ${navChips}
  </nav>

  <div id="list">
${sections}
  </div>

  <p class="empty" id="empty">${esc(t.none)}</p>

  <footer class="foot">
    <a href="${isEn ? '/' : '/ru/'}">← ${esc(t.home)}</a>
    <a href="/api/">${esc(t.api)}</a>
    <a href="/demo/">${esc(t.demo)}</a>
  </footer>
</main>
<script>
(function () {
  var root = document.documentElement;
  try {
    if (localStorage.getItem('bss_theme') === 'light') root.classList.add('light');
  } catch (e) {}

  var q = document.getElementById('q');
  var sort = document.getElementById('sort');
  var reset = document.getElementById('reset');
  var count = document.getElementById('count');
  var empty = document.getElementById('empty');
  var groups = Array.prototype.slice.call(document.querySelectorAll('.group'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));

  var FOUND = ${JSON.stringify(t.found)};

  function cardsOf(group) {
    return Array.prototype.slice.call(group.querySelectorAll('.card-item'));
  }

  function apply() {
    var needle = (q.value || '').trim().toLowerCase();
    var mode = sort.value;
    var shown = 0;

    groups.forEach(function (group) {
      var cards = cardsOf(group);
      cards.forEach(function (card) {
        var name = card.getAttribute('data-name') || '';
        var alt = card.getAttribute('data-alt') || '';
        var cat = card.getAttribute('data-category') || '';
        var hit = !needle || name.indexOf(needle) !== -1 || alt.indexOf(needle) !== -1 || cat.indexOf(needle) !== -1;
        card.hidden = !hit;
        if (hit) shown++;
      });

      // Hide a whole category when nothing in it matches.
      var visible = cards.filter(function (c) { return !c.hidden; });
      group.hidden = visible.length === 0;

      // Sort inside the group.
      visible.sort(function (a, b) {
        if (mode === 'name') {
          return (a.getAttribute('data-name') || '').localeCompare(b.getAttribute('data-name') || '');
        }
        if (mode === 'change') {
          var ca = a.getAttribute('data-change');
          var cb = b.getAttribute('data-change');
          var va = ca === '' ? -Infinity : Number(ca);
          var vb = cb === '' ? -Infinity : Number(cb);
          return vb - va;
        }
        return Number(b.getAttribute('data-value')) - Number(a.getAttribute('data-value'));
      });
      var grid = group.querySelector('.grid');
      visible.forEach(function (c) { grid.appendChild(c); });
    });

    count.textContent = shown + ' ' + FOUND;
    empty.classList.toggle('show', shown === 0);
  }

  // Highlight the category chip of the section in view.
  function spy() {
    var best = null;
    var bestTop = -Infinity;
    groups.forEach(function (g) {
      if (g.hidden) return;
      var top = g.getBoundingClientRect().top;
      if (top < 140 && top > bestTop) { bestTop = top; best = g; }
    });
    chips.forEach(function (c) {
      var on = best && c.getAttribute('data-target') === best.id;
      c.classList.toggle('active', !!on);
    });
  }

  q.addEventListener('input', apply);
  sort.addEventListener('change', apply);
  reset.addEventListener('click', function () { q.value = ''; apply(); });

  // Clicking a chip scrolls to the section; prevent the default jump so the
  // smooth scroll applies.
  chips.forEach(function (c) {
    c.addEventListener('click', function (e) {
      var target = document.getElementById(c.getAttribute('data-target'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { spy(); ticking = false; });
  }, { passive: true });

  apply();
  spy();
})();
</script>
</body>
</html>`;
}

module.exports = { buildIndexPage, CATEGORY_EN, slugify };
