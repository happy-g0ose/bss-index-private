/**
 * Embeddable widget page generator.
 *
 * Reads bot/items.json and writes ONE self-contained HTML page per item into
 * dist/w/<slug>/index.html. Each page is a tiny, dependency-free widget that
 * can be dropped into an <iframe> on any site (wikis, Discord embeds, Reddit
 * posts, dashboards) and still renders nicely as a link preview.
 *
 * Rules:
 *   - plain HTML + CSS + a few bytes of inline JS (no frameworks, no build step)
 *   - no external requests besides the item image (bssmvalues.com CDN)
 *   - the slug MUST match src/itemSlug.ts / scripts/prerender.cjs exactly
 *
 * Run:  node scripts/generate-widgets.cjs
 * Safe: a missing bot/items.json only prints a warning (exit code 0).
 */
const fs = require('fs');
const path = require('path');
const { getCategoryStyles } = require('./lib/category-styles.cjs');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'w');
const ITEMS_SRC = path.join(ROOT, 'bot', 'items.json');

// Canonical origin. Override with SITE_ORIGIN env var at build time.
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://bss-index.vercel.app').replace(/\/$/, '');

const DEMAND_EN = {
  'Хайп': 'Hype',
  'Высокий': 'High',
  'Средний': 'Average',
  'Низкий': 'Low',
};

const STABILITY_EN = {
  'Растет': 'Rising',
  'Падает': 'Falling',
  'Стабильно': 'Stable',
};

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
 * VERBATIM copy of scripts/prerender.cjs / src/itemSlug.ts — keep in sync.
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

/** Format a value for display: 12345 -> "12.3k", 9.75 -> "9.75". */
function fmtValue(v) {
  if (typeof v !== 'number' || !isFinite(v) || v === 0) return '—';
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Number(v.toFixed(2)));
}

/**
 * Week-over-week price change, identical to the rule used by the catalog
 * card in src/components/ItemCard.tsx: compare the newest price with the
 * history entry closest to (newest date - 7 days).
 */
function getWeekChange(item) {
  const prices = Array.isArray(item.historicalPrices) ? item.historicalPrices : [];
  const dates = Array.isArray(item.historicalDates) ? item.historicalDates : [];
  if (prices.length < 2 || dates.length < 2) return null;
  const n = Math.min(prices.length, dates.length);
  const lastDate = new Date(dates[n - 1]);
  if (isNaN(lastDate.getTime())) return null;
  const lastPrice = prices[n - 1];
  const target = lastDate.getTime() - 7 * 86400000;
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < n - 1; i++) {
    const d = new Date(dates[i]);
    if (isNaN(d.getTime())) continue;
    const diff = Math.abs(d.getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return null;
  const prev = prices[bestIdx];
  if (!prev) return null;
  return ((lastPrice - prev) / prev) * 100;
}

/** Flatten a beequip's groups/rolls into a single list. */
function flattenRolls(item) {
  if (!Array.isArray(item.beequipData)) return [];
  const rolls = [];
  for (const g of item.beequipData) {
    if (!g || !Array.isArray(g.rolls)) continue;
    for (const r of g.rolls) if (r) rolls.push(r);
  }
  return rolls;
}

/** Roll count + cheapest / most expensive roll of a beequip. */
function beequipStats(item) {
  const rolls = flattenRolls(item);
  // Rolls without a price (0 / 0) carry no information — ignore them unless
  // that would leave us with nothing at all.
  const priced = rolls.filter((r) => r.valueLow > 0 || r.valueHigh > 0);
  const pool = priced.length ? priced : rolls;
  let min = Infinity;
  let max = -Infinity;
  for (const r of pool) {
    const lo = Number(r.valueLow) || 0;
    const hi = Number(r.valueHigh) || 0;
    if (lo < min) min = lo;
    if (hi > max) max = hi;
  }
  if (!isFinite(min)) min = 0;
  if (!isFinite(max)) max = 0;
  return { rolls: rolls.length, min, max };
}

/**
 * Widget stylesheet.
 * Kept inline so a widget is a single request with zero extra dependencies.
 * Sizes use vw units so the widget scales with the width of the iframe it
 * lives in (320px embed and 480px embed both look intentional).
 */
const WIDGET_CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{
  color-scheme:dark;
  --bg:#0b0f19;
  --card:rgba(11,15,25,.65);
  --border:rgba(255,255,255,.06);
  --text:#e5e5e5;
  --muted:#a1a1aa;
  --faint:#71717a;
  --accent:#fbbf24;
  --icon-bg:rgba(255,255,255,.04);
  --isz:clamp(38px,13vw,60px);
}
html.light{
  color-scheme:light;
  --bg:#f4f5f7;
  --card:#fff;
  --border:rgba(15,23,42,.12);
  --text:#18181b;
  --muted:#52525b;
  --faint:#a1a1aa;
  --icon-bg:rgba(15,23,42,.04);
}
html,body{height:100%;margin:0;padding:0;overflow:hidden}
body{
  background-color:var(--bg);
  background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
  background-size:44px 44px;
  color:var(--text);
  font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  padding:10px;
  -webkit-font-smoothing:antialiased;
}
html.light body{
  background-image:linear-gradient(rgba(15,23,42,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.05) 1px,transparent 1px);
}
.card{
  width:100%;max-width:480px;
  display:grid;grid-template-columns:auto minmax(0,1fr) auto;
  align-items:center;column-gap:12px;row-gap:7px;
  background:var(--card);border:1px solid var(--border);border-radius:14px;
  padding:12px 14px;box-shadow:0 14px 34px -22px rgba(0,0,0,.95);
}
.iconbox{
  position:relative;width:var(--isz);height:var(--isz);
  border-radius:16px;overflow:hidden;border:1px solid var(--border);
  background:var(--icon-bg);display:flex;align-items:center;justify-content:center;
}
.iconbox::before{
  content:"";position:absolute;inset:0;
  background:radial-gradient(circle at 50% 38%,var(--glow),transparent 72%);opacity:.85;
}
.icon{position:relative;width:78%;height:78%;object-fit:contain}
.name{
  font-size:clamp(13px,3.5vw,19px);font-weight:900;line-height:1.15;
  text-transform:uppercase;letter-spacing:.01em;color:var(--text);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.cat{
  margin-top:3px;font-size:clamp(9px,2.1vw,11px);font-weight:800;
  text-transform:uppercase;letter-spacing:.09em;color:var(--accent);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.val{text-align:right;justify-self:end}
.price{
  font-size:clamp(16px,4.4vw,24px);font-weight:800;line-height:1;
  color:var(--accent);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  white-space:nowrap;
}
.price .st{font-size:.72em;margin-left:1px;letter-spacing:0}
.price.tbd{color:var(--faint)}
.range{
  margin-top:5px;font-size:clamp(9px,2.1vw,12px);line-height:1.2;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color:var(--muted);white-space:nowrap;
}
.chips{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px}
.chip{
  display:inline-flex;align-items:center;font-size:clamp(9px,2vw,11px);font-weight:800;
  padding:2px 7px;border-radius:6px;border:1px solid;letter-spacing:.03em;white-space:nowrap;
}
.c-red{background:rgba(248,113,113,.12);color:#f87171;border-color:rgba(248,113,113,.25)}
.c-amber{background:rgba(251,191,36,.12);color:#fbbf24;border-color:rgba(251,191,36,.25)}
.c-blue{background:rgba(96,165,250,.12);color:#60a5fa;border-color:rgba(96,165,250,.25)}
.c-green{background:rgba(52,211,153,.12);color:#34d399;border-color:rgba(52,211,153,.25)}
.c-gray{background:rgba(161,161,170,.12);color:#a1a1aa;border-color:rgba(161,161,170,.25)}
.foot{width:100%;max-width:480px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.brand{
  font-size:clamp(8px,1.9vw,10px);font-weight:900;letter-spacing:.18em;
  text-transform:uppercase;color:var(--accent);opacity:.9;white-space:nowrap;
  text-decoration:none;
}
.brand:hover{opacity:1;text-decoration:underline}
.more{
  font-size:clamp(9px,2.1vw,11px);font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;color:var(--faint);text-decoration:none;
}
.more:hover{color:var(--accent)}
html.embed .more{display:none}
`;

/** Inline bootstrap: restore the saved theme + detect ?embed=1 before first paint. */
const BOOT_SCRIPT = `(function(){try{var r=document.documentElement;if(localStorage.getItem('bss_theme')==='light')r.classList.add('light');if(/(\\?|&)embed=1(&|$)/.test(location.search))r.classList.add('embed');}catch(e){}})();`;

/** One-line summary used for the meta description and og:description. */
function buildDescription(item, priceText, rangeText, change) {
  const name = item.englishName || item.id || item.name;
  const categoryEn = CATEGORY_EN[item.category] || item.category;
  const demandEn = DEMAND_EN[item.demand] || item.demand;
  const stabilityEn = STABILITY_EN[item.stability] || item.stability;
  const bits = [`${name} (${categoryEn}) in Bee Swarm Simulator: ${priceText}${rangeText ? ' (' + rangeText + ')' : ''}.`];
  bits.push(`Demand ${demandEn.toLowerCase()}, trend ${stabilityEn.toLowerCase()}.`);
  if (change !== null && Math.abs(change) >= 1) {
    bits.push(`7-day change ${change > 0 ? '+' : ''}${change.toFixed(0)}%.`);
  }
  return bits.join(' ').replace(/\s+/g, ' ').trim();
}

/** Render the self-contained widget page for a single item. */
function renderWidget(item, slug) {
  const isBeequip = item.category === 'Биквипы';
  const name = item.englishName || item.id || item.name;
  const categoryEn = CATEGORY_EN[item.category] || item.category;
  const demandEn = DEMAND_EN[item.demand] || item.demand;
  const stabilityEn = STABILITY_EN[item.stability] || item.stability;

  const canonical = `${SITE_ORIGIN}/item/${slug}/`;
  const widgetUrl = `${SITE_ORIGIN}/w/${slug}/`;
  const ogImage = item.image || `${SITE_ORIGIN}/logo.png`;

  const demandChip = { 'Хайп': 'c-red', 'Высокий': 'c-amber', 'Средний': 'c-blue' }[item.demand] || 'c-green';
  const stabilityChip = { 'Растет': 'c-green', 'Падает': 'c-red' }[item.stability] || 'c-gray';

  const change = getWeekChange(item);
  const changeChip =
    change !== null && Math.abs(change) >= 1
      ? `<span class="chip ${change > 0 ? 'c-green' : 'c-red'}">${change > 0 ? '↗ +' : '↘ '}${change.toFixed(0)}%</span>`
      : '';

  const stats = isBeequip ? beequipStats(item) : null;

  let priceHtml = '';
  let rangeHtml = '';
  let priceText = '';
  let rangeText = '';
  let titlePrice = '';

  if (isBeequip) {
    priceText = `${stats.rolls} rolls`;
    // Rolls without a price (all zero) cannot produce a meaningful range.
    const hasRange = stats.min > 0 || stats.max > 0;
    if (hasRange) {
      rangeText = `${fmtValue(stats.min)}★ - ${fmtValue(stats.max)}★`;
      rangeHtml = `<div class="range">${esc(fmtValue(stats.min))}★ - ${esc(fmtValue(stats.max))}★</div>`;
    }
    priceHtml = `<div class="price">${esc(stats.rolls)}<span class="st"> rolls</span></div>`;
    titlePrice = rangeText ? `${priceText} · ${rangeText}` : priceText;
  } else if (item.value > 0) {
    priceText = `${fmtValue(item.value)}★`;
    titlePrice = priceText;
    priceHtml = `<div class="price">${esc(fmtValue(item.value))}<span class="st">★</span></div>`;
    if (item.valueLow !== item.valueHigh) {
      rangeText = `${fmtValue(item.valueLow)} - ${fmtValue(item.valueHigh)}`;
      rangeHtml = `<div class="range">${esc(fmtValue(item.valueLow))} - ${esc(fmtValue(item.valueHigh))}</div>`;
    }
  } else {
    priceText = 'TBD';
    titlePrice = 'TBD★';
    priceHtml = `<div class="price tbd">TBD</div>`;
  }

  const title = `${name} — ${titlePrice} in Bee Swarm Simulator`;
  const description = buildDescription(item, priceText, rangeText, change);
  const glow = getCategoryStyles(item.category).glowColor;

  const icon = item.image
    ? `<div class="iconbox" style="--glow:${esc(glow)}"><img class="icon" src="${esc(item.image)}" alt="${esc(name)}" width="96" height="96" loading="eager" decoding="async"></div>`
    : `<div class="iconbox" style="--glow:${esc(glow)}"></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="frame-ancestors *">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BSS Index">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(widgetUrl)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:alt" content="${esc(name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="color-scheme" content="dark light">
<script>${BOOT_SCRIPT}</script>
<style>${WIDGET_CSS}</style>
</head>
<body>
<main class="card">
${icon}
<div class="info">
<div class="name">${esc(name)}</div>
<div class="cat">${esc(categoryEn)}</div>
</div>
<div class="val">
${priceHtml}
${rangeHtml}
</div>
<div class="chips">
<span class="chip ${demandChip}">${esc(demandEn)}</span>
<span class="chip ${stabilityChip}">${esc(stabilityEn)}</span>
${changeChip}
</div>
</main>
<div class="foot"><a class="brand" href="${esc(canonical)}" target="_blank" rel="noopener">BSS Index</a><a class="more" href="${esc(canonical)}" target="_blank" rel="noopener">Full price list →</a></div>
</body>
</html>
`;
}

/** Index page listing every generated widget. */
function renderIndex(entries) {
  const rows = entries
    .map(
      (e) =>
        `<a class="row" href="./${esc(e.slug)}/" title="${esc(e.name)} — ${esc(e.slug)}"><span class="nm">${esc(
          e.name
        )}</span><span class="mt"><span class="ct">${esc(e.category)}</span><span class="sl">${esc(
          e.slug
        )}</span></span><span class="pv">${esc(e.price)}</span></a>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="frame-ancestors *">
<title>BSS Index — embeddable item widgets</title>
<meta name="description" content="Embeddable Bee Swarm Simulator price widgets for ${entries.length} items. Drop them into any page with a single iframe.">
<link rel="canonical" href="${esc(SITE_ORIGIN)}/w/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BSS Index">
<meta property="og:title" content="BSS Index — embeddable item widgets">
<meta property="og:description" content="${entries.length} embeddable Bee Swarm Simulator price widgets.">
<meta property="og:url" content="${esc(SITE_ORIGIN)}/w/">
<meta property="og:image" content="${esc(SITE_ORIGIN)}/logo.png">
<meta name="twitter:card" content="summary_large_image">
<script>${BOOT_SCRIPT}</script>
<style>
*,*::before,*::after{box-sizing:border-box}
:root{color-scheme:dark;--bg:#0b0f19;--card:rgba(11,15,25,.65);--border:rgba(255,255,255,.06);--text:#e5e5e5;--muted:#a1a1aa;--faint:#71717a;--accent:#fbbf24}
html.light{color-scheme:light;--bg:#f4f5f7;--card:#fff;--border:rgba(15,23,42,.12);--text:#18181b;--muted:#52525b;--faint:#a1a1aa;--accent:#b45309}
html,body{margin:0;padding:0}
body{
  background-color:var(--bg);
  background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
  background-size:44px 44px;
  color:var(--text);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;
}
html.light body{background-image:linear-gradient(rgba(15,23,42,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.05) 1px,transparent 1px)}
.wrap{max-width:900px;margin:0 auto;padding:32px 20px 64px}
h1{margin:0;font-size:clamp(22px,5vw,34px);font-weight:900;text-transform:uppercase;letter-spacing:-.01em}
.lead{margin:10px 0 18px;color:var(--muted);font-size:15px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:6px;padding:8px 10px;display:block;overflow:auto;color:var(--accent)}
html.light code{background:rgba(15,23,42,.05)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-top:22px}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"nm pv" "mt pv";gap:0 10px;align-items:center;text-decoration:none;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 11px}
.row:hover{border-color:rgba(251,191,36,.4)}
.nm{grid-area:nm;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mt{grid-area:mt;display:flex;align-items:center;gap:6px;min-width:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)}
.ct{flex:0 0 auto;white-space:nowrap}
.sl{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:600;letter-spacing:0;text-transform:none;opacity:.8;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv{grid-area:pv;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;font-weight:800;color:var(--accent);white-space:nowrap}
</style>
</head>
<body>
<div class="wrap">
<h1>BSS Widgets</h1>
<p class="lead">${entries.length} embeddable price widgets. Each one is a standalone page — no scripts, no trackers, just HTML and CSS.</p>
<code>&lt;iframe src="${esc(SITE_ORIGIN)}/w/&lt;slug&gt;/" width="480" height="260" frameborder="0" loading="lazy" title="BSS price widget"&gt;&lt;/iframe&gt;</code>
<div class="grid">
${rows}
</div>
</div>
</body>
</html>
`;
}

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function main() {
  if (!fs.existsSync(ITEMS_SRC)) {
    console.warn(`[widgets] ${ITEMS_SRC} not found. Skipping.`);
    return;
  }

  let items;
  try {
    items = JSON.parse(fs.readFileSync(ITEMS_SRC, 'utf-8'));
  } catch (err) {
    console.warn(`[widgets] Could not parse ${ITEMS_SRC}: ${err.message}. Skipping.`);
    return;
  }
  if (!Array.isArray(items)) {
    console.warn(`[widgets] ${ITEMS_SRC} is not an array. Skipping.`);
    return;
  }

  fs.mkdirSync(OUT, { recursive: true });

  const used = new Map();
  const entries = [];
  let written = 0;
  let totalBytes = 0;

  for (const item of items) {
    const slug = slugify(item.englishName || item.id || item.name);

    // englishName is unique across the catalogue, so slugs must be unique too.
    if (used.has(slug)) {
      throw new Error(
        `[widgets] slug collision: "${slug}" is produced by both "${used.get(slug)}" and "${
          item.englishName || item.id || item.name
        }". Slugs must be unique so widget URLs stay stable.`
      );
    }
    used.set(slug, item.englishName || item.id || item.name);

    const html = renderWidget(item, slug);
    const dir = path.join(OUT, slug);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'index.html');
    fs.writeFileSync(file, html, 'utf-8');
    written++;
    totalBytes += Buffer.byteLength(html, 'utf-8');

    const isBeequip = item.category === 'Биквипы';
    const stats = isBeequip ? beequipStats(item) : null;
    entries.push({
      slug,
      name: item.englishName || item.id || item.name,
      category: CATEGORY_EN[item.category] || item.category,
      price: isBeequip
        ? `${stats.rolls} rolls`
        : item.value > 0
        ? `${fmtValue(item.value)}★`
        : 'TBD',
    });
  }

  const indexHtml = renderIndex(entries);
  fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml, 'utf-8');
  totalBytes += Buffer.byteLength(indexHtml, 'utf-8');

  console.log(
    `[widgets] wrote ${written} widget pages + index.html to ${path.relative(ROOT, OUT)} ` +
      `(${entries.length} items, ${fmtBytes(totalBytes)} total)`
  );
}

try {
  main();
} catch (err) {
  console.error(`[widgets] ERROR: ${err.message}`);
  process.exitCode = 1;
}
