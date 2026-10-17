/**
 * Post-build SEO prerender + sitemap generator.
 *
 * The app is a client-side rendered SPA: Google fetches one empty <div id="app">.
 * This script copies the built index.html into a real static page per item,
 * injecting item-specific <title>, meta description, Open Graph tags and
 * JSON-LD structured data so crawlers get actual content.
 *
 * Run automatically after `vite build` (see package.json).
 * Safe to delete: the app works exactly the same without it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ITEMS_SRC = path.join(ROOT, 'bot', 'items.json');

// Canonical origin. Override with SITE_ORIGIN env var at build time.
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://bss-index.vercel.app').replace(/\/$/, '');

const DEMAND_EN = {
  'Хайп': 'Hype',
  'Высокий': 'High',
  'Средний': 'Average',
  'Низкий': 'Low',
};

const RARITY_EN = {
  'Обычный': 'Common',
  'Редкий': 'Rare',
  'Эпический': 'Epic',
  'Легендарный': 'Legendary',
  'Мифический': 'Mythic',
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

/** Transliterate a Cyrillic item name into a stable URL slug. */
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

function escJson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

/** Format a value for display: 12345 -> "12.3k", 9.75 -> "9.75". */
function fmtValue(v) {
  if (typeof v !== 'number' || !isFinite(v) || v === 0) return '—';
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Number(v.toFixed(2)));
}

function buildSeoFields(item) {
  const isBeequip = item.category === 'Биквипы';
  const displayName = item.name;
  const categoryRu = item.category;
  const categoryEn = CATEGORY_EN[item.category] || item.category;

  const title = isBeequip
    ? `${displayName} — цена и роллы биквипа Bee Swarm Simulator`
    : `${displayName} — цена в Bee Swarm Simulator`;

  const demandRu = item.demand;
  const demandEn = DEMAND_EN[item.demand] || item.demand;
  const rarityRu = item.rarity;
  const rarityEn = RARITY_EN[item.rarity] || item.rarity;

  let description;
  if (isBeequip) {
    description = `${displayName}: значения всех роллов биквипа в Bee Swarm Simulator. Категория: ${categoryRu}. Полный список роллов и их цен.`;
  } else {
    const range = item.valueLow !== item.valueHigh
      ? ` (${fmtValue(item.valueLow)}–${fmtValue(item.valueHigh)})`
      : '';
    description = `${displayName}: цена ${fmtValue(item.value)}★${range} в Bee Swarm Simulator. Спрос: ${demandRu}. Категория: ${categoryRu}. Динамика цены за 6 недель.`;
  }

  const keywords = [
    displayName,
    item.englishName,
    'Bee Swarm Simulator',
    'BSS',
    isBeequip ? 'биквип цена' : 'стикер цена',
    categoryRu,
    rarityRu,
    ...(isBeequip ? ['биквипы'] : ['стикеры', 'цены']),
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

  return { title, description, keywords, isBeequip, categoryRu, categoryEn, demandRu, demandEn, rarityRu, rarityEn };
}

/** Build JSON-LD structured data for an item page. */
function buildJsonLd(item, url, seo) {
  const isBeequip = item.category === 'Биквипы';

  const payload = {
    '@context': 'https://schema.org',
    '@type': isBeequip ? 'Product' : 'Product',
    name: item.name,
    alternateName: item.englishName,
    description: seo.description,
    image: item.image ? [item.image] : undefined,
    category: seo.categoryEn,
    url,
    brand: { '@type': 'Brand', name: 'Bee Swarm Simulator' },
  };

  if (item.value > 0) {
    payload.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'BSS',
      lowPrice: item.valueLow > 0 ? item.valueLow : item.value,
      highPrice: item.valueHigh > 0 ? item.valueHigh : item.value,
      offerCount: isBeequip ? countRolls(item) : 1,
      availability: 'https://schema.org/InStock',
    };
  }

  if (item.rarity) {
    payload.additionalProperty = [
      { '@type': 'PropertyValue', name: 'Спрос / Demand', value: seo.demandEn },
      { '@type': 'PropertyValue', name: 'Редкость / Rarity', value: seo.rarityEn },
    ];
  }

  return payload;
}

function countRolls(item) {
  if (!Array.isArray(item.beequipData)) return 0;
  return item.beequipData.reduce((sum, g) => sum + (Array.isArray(g.rolls) ? g.rolls.length : 0), 0);
}

/** Render the visible, indexable body content for an item page. */
function renderBody(item, seo, url) {
  const isBeequip = item.category === 'Биквипы';

  // Value history as a tiny sparkline-ish list of week labels + values
  const history = Array.isArray(item.historicalPrices) ? item.historicalPrices : [];
  const dates = Array.isArray(item.historicalDates) ? item.historicalDates : [];

  let historyBlock = '';
  if (history.length > 0) {
    const rows = history
      .map((v, i) => {
        const d = dates[i] ? dates[i].split('-').reverse().join('.') : `week ${history.length - i}`;
        return `<tr><td>${esc(d)}</td><td>${esc(fmtValue(v))}★</td></tr>`;
      })
      .join('');
    historyBlock = `
      <section class="card">
        <h2>Динамика цены (6 недель)</h2>
        <table><thead><tr><th>Дата</th><th>Цена</th></tr></thead><tbody>${rows}</tbody></table>
      </section>`;
  }

  let rollsBlock = '';
  if (isBeequip && Array.isArray(item.beequipData)) {
    const groups = item.beequipData
      .map((g) => {
        const rolls = (g.rolls || [])
          .map(
            (r) => `<tr><td>${esc(r.rollName)}</td><td>${esc(fmtValue(r.value))}★</td><td>${
              r.valueLow !== r.valueHigh
                ? `${esc(fmtValue(r.valueLow))}–${esc(fmtValue(r.valueHigh))}★`
                : ''
            }</td><td>${esc(DEMAND_EN[r.demand] || r.demand)}</td></tr>`
          )
          .join('');
        return `
          <section class="card">
            <h2>${esc(g.groupName)}</h2>
            <table><thead><tr><th>Ролл</th><th>Цена</th><th>Диапазон</th><th>Спрос</th></tr></thead><tbody>${rolls}</tbody></table>
          </section>`;
      })
      .join('');
    rollsBlock = rollsBlock || '<section class="card"><h2>Роллы</h2><p>Нет данных о роллах.</p></section>';
  }

  const statsBlock = `
    <section class="card">
      <h2>Характеристики</h2>
      <table><tbody>
        <tr><th>Категория</th><td>${esc(seo.categoryRu)}</td></tr>
        <tr><th>Редкость</th><td>${esc(seo.rarityRu)}</td></tr>
        <tr><th>Спрос</th><td>${esc(seo.demandRu)}</td></tr>
        ${item.stability ? `<tr><th>Стабильность</th><td>${esc(item.stability)}</td></tr>` : ''}
        <tr><th>Текущая цена</th><td>${item.value > 0 ? esc(fmtValue(item.value)) + '★' : '—'}</td></tr>
        ${
          item.valueLow !== item.valueHigh && item.value > 0
            ? `<tr><th>Диапазон</th><td>${esc(fmtValue(item.valueLow))}–${esc(fmtValue(item.valueHigh))}★</td></tr>`
            : ''
        }
      </tbody></table>
    </section>`;

  return `
  <main class="wrap">
    <nav class="crumbs"><a href="/">← BSS Index</a> <span>/</span> <a href="/">${esc(seo.categoryRu)}</a></nav>

    <header class="hero">
      ${item.image ? `<img class="icon" src="${esc(item.image)}" alt="${esc(item.name)}" loading="eager" width="96" height="96">` : ''}
      <div>
        <h1>${esc(item.name)}</h1>
        ${item.englishName && item.englishName !== item.name ? `<p class="alt">${esc(item.englishName)}</p>` : ''}
        <p class="tag">${esc(seo.categoryRu)} · ${esc(seo.rarityRu)}</p>
      </div>
    </header>

    <p class="lead">${esc(seo.description)}</p>

    <div class="cta">
      <a href="#app">${seo.isBeequip
        ? (seo.title.includes('ролл') ? 'Открыть биквип в приложении' : 'Открыть в приложении')
        : 'Открыть в калькуляторе обменов'} ↓</a>
      <a href="/" class="ghost">Все предметы</a>
    </div>

    ${isBeequip ? '' : statsBlock}
    ${rollsBlock}
    ${isBeequip ? statsBlock : ''}
    ${historyBlock}

    <footer class="foot">
      <p>Данные обновляются ежедневно. Источник: bssmvalues.com</p>
      <p><a href="/">Все предметы и калькулятор обменов →</a></p>
    </footer>
  </main>

  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #0b0f19;
      color: #e5e5e5;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      line-height: 1.6;
    }
    .wrap { max-width: 720px; margin: 0 auto; padding: 24px 20px 64px; }
    .crumbs { font-size: 13px; color: #a1a1aa; margin-bottom: 24px; display: flex; gap: 8px; }
    .crumbs a { color: #fbbf24; text-decoration: none; }
    .crumbs a:hover { text-decoration: underline; }
    .hero { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
    .hero .icon { width: 96px; height: 96px; object-fit: contain; background: rgba(255,255,255,.04); border-radius: 16px; padding: 10px; border: 1px solid rgba(255,255,255,.08); }
    h1 { margin: 0; font-size: clamp(26px, 5vw, 40px); font-weight: 900; line-height: 1.1; text-transform: uppercase; }
    .alt { margin: 4px 0 0; color: #a1a1aa; font-size: 14px; font-family: ui-monospace, monospace; }
    .tag { margin: 8px 0 0; color: #fbbf24; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .lead { margin: 28px 0; font-size: 16px; color: #d4d4d8; }
    .card { background: rgba(11,15,25,.65); border: 1px solid rgba(255,255,255,.06); border-radius: 16px; padding: 20px; margin: 20px 0; }
    .card h2 { margin: 0 0 14px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; color: #fbbf24; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid rgba(255,255,255,.06); }
    thead th { color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    tbody th { font-weight: 600; color: #a1a1aa; width: 45%; }
    tbody td { font-family: ui-monospace, monospace; color: #fbbf24; font-weight: 700; }
    .foot { margin-top: 48px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.06); font-size: 13px; color: #71717a; }
    .foot a { color: #fbbf24; text-decoration: none; }
    .foot a:hover { text-decoration: underline; }
    .cta { margin-top: 28px; display: flex; gap: 10px; flex-wrap: wrap; }
    .cta a { display: inline-block; background: #f59e0b; color: #0b0f19; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; padding: 12px 20px; border-radius: 12px; text-decoration: none; }
    .cta a:hover { background: #fbbf24; }
    .cta a.ghost { background: transparent; color: #d4d4d8; border: 1px solid rgba(255,255,255,.14); }
    .cta a.ghost:hover { background: rgba(255,255,255,.06); color: #fbbf24; }
  </style>`;
}

/**
 * Inject item-specific SEO tags into the built index.html template.
 *
 * We keep the original app bundle (module script, stylesheet, analytics) so the
 * SPA still boots on item pages, but rewrite its asset paths to absolute ones:
 * `vite.config.ts` uses `base: './'` and item pages live one directory deeper.
 */
function injectIntoTemplate(template, item, seo, url) {
  const ogImage = item.image ? item.image : `${SITE_ORIGIN}/logo.png`;
  const jsonLd = buildJsonLd(item, url, seo);

  // Pull the parts of the original <head> that must survive.
  const gtagLoader =
    (template.match(/<script async src="https:\/\/www\.googletagmanager\.com[^>]*><\/script>/i) || [])[0] || '';
  const gtagInline =
    (template.match(/<script>\s*window\.dataLayer[\s\S]*?<\/script>/i) || [])[0] || '';
  const moduleScript = (template.match(/<script type="module"[^>]*><\/script>/i) || [])[0] || '';
  const cssLink =
    (template.match(/<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]*"[^>]*>/i) || [])[0] || '';

  const absolutise = (tag) => tag.replace(/(src|href)="\.\//g, '$1="/');

  const headTags = `
    ${gtagLoader}
    ${gtagInline}
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>${esc(seo.title)}</title>
    <meta name="description" content="${esc(seo.description)}" />
    <meta name="keywords" content="${esc(seo.keywords)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${esc(url)}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BSS Index" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:title" content="${esc(seo.title)}" />
    <meta property="og:description" content="${esc(seo.description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(ogImage)}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(seo.title)}" />
    <meta name="twitter:description" content="${esc(seo.description)}" />
    <meta name="twitter:image" content="${esc(ogImage)}" />

    <script type="application/ld+json">${escJson(jsonLd)}</script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    ${absolutise(cssLink)}
    ${absolutise(moduleScript)}
`;

  // Replace the original <head>...</head> with our generated head.
  const html = template.replace(/<head>[\s\S]*?<\/head>/i, `<head>${headTags}  </head>`);

  // IMPORTANT: the static block is a SIBLING of #app, not a child.
  // React wipes #app on mount, so content inside it would be erased for crawlers
  // that execute JS. Outside it, the <h1>, price tables and internal links survive
  // for both visitors and Google.
  const body = renderBody(item, seo, url);
  return html.replace('<div id="app"></div>', `${body}\n<div id="app"></div>`);
}

function buildSitemap(urls) {
  const entries = urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc><changefreq>daily</changefreq><priority>${u.priority}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.warn('[prerender] dist/ not found — run vite build first. Skipping.');
    return;
  }
  if (!fs.existsSync(ITEMS_SRC)) {
    console.warn(`[prerender] ${ITEMS_SRC} not found. Skipping.`);
    return;
  }

  const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const items = JSON.parse(fs.readFileSync(ITEMS_SRC, 'utf8'));

  const urls = [{ loc: `${SITE_ORIGIN}/`, changefreq: 'daily', priority: '1.0' }];
  const usedSlugs = new Map();
  let written = 0;

  for (const item of items) {
    // Prefer the english name for readable URLs (it is unique across all items);
    // fall back to id only if something is off.
    let slug = slugify(item.englishName || item.id || item.name);

    // Safety net: if two different items slugify identically, append a counter.
    if (usedSlugs.has(slug)) {
      const n = usedSlugs.get(slug) + 1;
      usedSlugs.set(slug, n);
      slug = `${slug}-${n}`;
    } else {
      usedSlugs.set(slug, 0);
    }
    const url = `${SITE_ORIGIN}/item/${slug}`;
    const seo = buildSeoFields(item);
    const html = injectIntoTemplate(template, item, seo, url);

    const dir = path.join(DIST, 'item', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');

    urls.push({
      loc: `${SITE_ORIGIN}/item/${slug}`,
      changefreq: 'weekly',
      priority: item.category === 'Биквипы' ? '0.6' : '0.8',
    });
    written++;
  }

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(urls), 'utf8');

  // Point robots.txt at the sitemap.
  const robotsPath = path.join(DIST, 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    let robots = fs.readFileSync(robotsPath, 'utf8');
    robots = robots.replace(/^Sitemap:.*$/m, '').trimEnd();
    fs.writeFileSync(robotsPath, `${robots}\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, 'utf8');
  }

  console.log(`[prerender] wrote ${written} item pages + sitemap.xml (${urls.length} urls)`);
}

main();