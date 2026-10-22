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
const { getCategoryStyles } = require('./lib/category-styles.cjs');
const { buildIndexPage } = require('./lib/item-index-page.cjs');

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

function buildSeoFields(item, lang) {
  const en = lang === 'en';
  const isBeequip = item.category === 'Биквипы';
  const displayName = item.name;
  const categoryRu = item.category;
  const categoryEn = CATEGORY_EN[item.category] || item.category;
  const demandRu = item.demand;
  const demandEn = DEMAND_EN[item.demand] || item.demand;

  const title = en
    ? isBeequip
      ? `${item.englishName} — beequip value & rolls in Bee Swarm Simulator`
      : `${item.englishName} — price in Bee Swarm Simulator (${item.value > 0 ? fmtValue(item.value) : 'TBD'}★)`
    : isBeequip
      ? `${displayName} — цена и роллы биквипа Bee Swarm Simulator`
      : `${displayName} — цена в Bee Swarm Simulator`;

  let description;
  if (en) {
    description = isBeequip
      ? `${item.englishName}: values for every roll of this beequip in Bee Swarm Simulator. Category: ${categoryEn}. Full roll list and prices.`
      : `${item.englishName} price in Bee Swarm Simulator: ${fmtValue(item.value)}★${
          item.valueLow !== item.valueHigh ? ` (${fmtValue(item.valueLow)}–${fmtValue(item.valueHigh)})` : ''
        }. Demand: ${demandEn}. Category: ${categoryEn}. 6-week price history.`;
  } else {
    description = isBeequip
      ? `${displayName}: значения всех роллов биквипа в Bee Swarm Simulator. Категория: ${categoryRu}. Полный список роллов и их цен.`
      : `${displayName}: цена ${fmtValue(item.value)}★${
          item.valueLow !== item.valueHigh ? ` (${fmtValue(item.valueLow)}–${fmtValue(item.valueHigh)})` : ''
        } в Bee Swarm Simulator. Спрос: ${demandRu}. Категория: ${categoryRu}. Динамика цены за 6 недель.`;
  }

  const keywords = en
    ? [item.englishName, item.name, 'Bee Swarm Simulator', 'BSS', isBeequip ? 'beequip value' : 'sticker price', categoryEn, isBeequip ? 'beequip rolls' : 'sticker prices', 'value list']
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ')
    : [displayName, item.englishName, 'Bee Swarm Simulator', 'BSS', isBeequip ? 'биквип цена' : 'стикер цена', categoryRu, ...(isBeequip ? ['биквипы'] : ['стикеры', 'цены'])]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ');

  return {
    lang,
    en,
    title,
    description,
    keywords,
    isBeequip,
    displayName,
    categoryRu,
    categoryEn,
    category: en ? categoryEn : categoryRu,
    demandRu,
    demandEn,
    demand: en ? demandEn : demandRu,
    stability: en ? ({ 'Растет': 'Rising', 'Падает': 'Falling', 'Стабильно': 'Stable' }[item.stability] || item.stability) : item.stability,
    valueLowText: item.valueLow !== item.valueHigh ? `${fmtValue(item.valueLow)} – ${fmtValue(item.valueHigh)}★` : '',
  };
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

  payload.additionalProperty = [
    { '@type': 'PropertyValue', name: 'Спрос / Demand', value: seo.demandEn },
  ];

  return payload;
}

function countRolls(item) {
  if (!Array.isArray(item.beequipData)) return 0;
  return item.beequipData.reduce((sum, g) => sum + (Array.isArray(g.rolls) ? g.rolls.length : 0), 0);
}

/** Render the visible, indexable body content for an item page. */
function renderBody(item, seo, url, altUrl, related) {
  const isBeequip = item.category === 'Биквипы';
  const en = seo.en;

  // Value history as a tiny week-by-week table
  const history = Array.isArray(item.historicalPrices) ? item.historicalPrices : [];
  const dates = Array.isArray(item.historicalDates) ? item.historicalDates : [];

  let historyBlock = '';
  if (history.length > 0) {
    const rows = history
      .map((v, i) => {
        const d = dates[i]
          ? dates[i].split('-').reverse().join(en ? '-' : '.')
          : `${en ? 'Week' : 'неделя'} ${history.length - i}`;
        return `<tr><td>${esc(d)}</td><td>${esc(fmtValue(v))}★</td></tr>`;
      })
      .join('');
    historyBlock = `
      <section class="card">
        <h2>${en ? 'Price history (6 weeks)' : 'Динамика цены (6 недель)'}</h2>
        <table><thead><tr><th>${en ? 'Date' : 'Дата'}</th><th>${en ? 'Price' : 'Цена'}</th></tr></thead><tbody>${rows}</tbody></table>
      </section>`;
  }

  let rollsBlock = '';
  if (isBeequip && Array.isArray(item.beequipData)) {
    const groups = item.beequipData
      .map((g) => {
        const rolls = (g.rolls || [])
          .map(
            (r) => `<tr><td>${esc(r.rollName)}</td><td>${esc(fmtValue(r.value))}${r.isFloor ? '+' : ''}★</td><td>${
              r.valueLow !== r.valueHigh
                ? `${esc(fmtValue(r.valueLow))}–${esc(fmtValue(r.valueHigh))}★`
                : ''
            }</td><td>${esc(en ? DEMAND_EN[r.demand] || r.demand : r.demand)}</td></tr>`
          )
          .join('');
        return `
          <section class="card">
            <h2>${esc(g.groupName)}</h2>
            <table><thead><tr><th>${en ? 'Roll' : 'Ролл'}</th><th>${en ? 'Price' : 'Цена'}</th><th>${en ? 'Range' : 'Диапазон'}</th><th>${en ? 'Demand' : 'Спрос'}</th></tr></thead><tbody>${rolls}</tbody></table>
          </section>`;
      })
      .join('');
    rollsBlock = groups || `<section class="card"><h2>${en ? 'Rolls' : 'Роллы'}</h2><p>${en ? 'No roll data available.' : 'Нет данных о роллах.'}</p></section>`;
  }

  const demandChip = { 'Хайп': 'c-red', 'Высокий': 'c-amber', 'Средний': 'c-blue' }[item.demand] || 'c-green';
  const stabilityChip = { 'Растет': 'c-green', 'Падает': 'c-red' }[item.stability] || 'c-gray';

  // 7-day change from the price history, same rule as the catalog card badge.
  let changeChip = '';
  const hist = Array.isArray(item.historicalPrices) ? item.historicalPrices : [];
  if (hist.length >= 2 && hist[hist.length - 2] > 0) {
    const pct = ((hist[hist.length - 1] - hist[hist.length - 2]) / hist[hist.length - 2]) * 100;
    if (Math.abs(pct) >= 1) {
      const up = pct > 0;
      changeChip = `<span class="chip ${up ? 'c-green' : 'c-red'}">${up ? '↗ +' : '↘ '}${pct.toFixed(0)}%</span>`;
    }
  }

  const statsBlock = `
    <section class="card">
      <h2>${en ? 'Stats' : 'Характеристики'}</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-k">${en ? 'Value' : 'Ценность'}</div>
          <div class="stat-v price">${item.value > 0 ? esc(fmtValue(item.value)) + '★' : (en ? 'TBD' : '—')}</div>
          <div class="stat-n">${seo.valueLowText || '&nbsp;'}</div>
        </div>
        <div class="stat">
          <div class="stat-k">${en ? 'Demand' : 'Спрос'}</div>
          <div class="stat-v"><span class="chip ${demandChip}">${esc(seo.demand)}</span></div>
          <div class="stat-n">&nbsp;</div>
        </div>
        <div class="stat">
          <div class="stat-k">${en ? 'Trend' : 'Динамика'}</div>
          <div class="stat-v"><span class="chip ${stabilityChip}">${esc(seo.stability || '—')}</span></div>
          <div class="stat-n">${changeChip || '&nbsp;'}</div>
        </div>
      </div>
      <table class="meta"><tbody>
        <tr><th>${en ? 'Category' : 'Категория'}</th><td>${esc(seo.category)}</td></tr>
      </tbody></table>
    </section>`;

  // Related items — this is what gives the crawler a way into the other 329
  // pages. Without these links every item page was a dead end that only the
  // sitemap pointed at, and Google only ever indexed the home page.
  const relatedBlock = related && related.length
    ? `
      <section class="card">
        <h2>${en ? 'Related items' : 'Похожие предметы'}</h2>
        <div class="rel">
          ${related.map((r) => `<a class="relitem" href="${esc(r.url)}">${esc(r.name)}<span>${esc(r.value)}★</span></a>`).join('')}
        </div>
      </section>`
    : '';

  return `
  <main class="wrap">
    <nav class="crumbs">
      <a href="${en ? '/' : '/ru/'}">← BSS Index</a> <span>/</span> <a href="${en ? '/' : '/ru/'}">${esc(seo.category)}</a>
      <span class="langswitch">
        ${en ? `<a href="${esc(altUrl)}">RU</a>` : `<a href="${esc(altUrl)}">EN</a>`}
      </span>
    </nav>

    <header class="hero">
      ${
        item.image
          ? `<div class="iconbox" style="--glow:${esc(getCategoryStyles(item.category).glowColor)}">
               <img class="icon" src="${esc(item.image)}" alt="${esc(en ? item.englishName : item.name)}" loading="eager" width="96" height="96">
             </div>`
          : ''
      }
      <div>
        <h1>${esc(en ? item.englishName : item.name)}</h1>
        ${en
          ? (item.name && item.name !== item.englishName ? `<p class="alt">${esc(item.name)}</p>` : '')
          : (item.englishName && item.englishName !== item.name ? `<p class="alt">${esc(item.englishName)}</p>` : '')}
        <p class="tag">${esc(seo.category)}</p>
      </div>
    </header>

    <p class="lead">${esc(seo.description)}</p>

    <div class="cta">
      <a href="#app">${en
        ? (seo.isBeequip ? 'Open beequip in the app' : 'Open in the trade calculator')
        : (seo.isBeequip ? 'Открыть биквип в приложении' : 'Открыть в калькуляторе обменов')} ↓</a>
      <a href="${en ? '/' : '/ru/'}" class="ghost">${en ? 'All items' : 'Все предметы'}</a>
    </div>

    ${isBeequip ? '' : statsBlock}
    ${rollsBlock}
    ${isBeequip ? statsBlock : ''}
    ${historyBlock}
    ${relatedBlock}

    <footer class="foot">
      <p class="upd">${en ? 'Prices update daily' : 'Цены обновляются ежедневно'}</p>
      <p><a href="${en ? '/' : '/ru/'}">${en ? 'All items and the trade calculator →' : 'Все предметы и калькулятор обменов →'}</a></p>
    </footer>
  </main>

  <style>${ITEM_PAGE_CSS}</style>`;
}

/**
 * Inject item-specific SEO tags into the built index.html template.
 *
 * We keep the original app bundle (module script, stylesheet, analytics) so the
 * SPA still boots on item pages, but rewrite its asset paths to absolute ones:
 * `vite.config.ts` uses `base: './'` and item pages live one directory deeper.
 */
function injectIntoTemplate(template, item, seo, url, altUrl, related) {
  const ogImage = item.image ? item.image : `${SITE_ORIGIN}/logo.png`;
  const jsonLd = buildJsonLd(item, url, seo);

  const { gtagLoader, gtagInline, moduleScript, cssLink } = headAssets(template);

  const absolutise = (tag) => tag.replace(/(src|href)="\.\//g, '$1="/');

  const headTags = `
    ${gtagLoader}
    ${gtagInline}
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

    <title>${esc(seo.title)}</title>
    <meta name="description" content="${esc(seo.description)}" />
    <meta name="keywords" content="${esc(seo.keywords)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${esc(url)}" />
    <link rel="alternate" hreflang="ru" href="${esc(seo.en ? altUrl : url)}" />
    <link rel="alternate" hreflang="en" href="${esc(seo.en ? url : altUrl)}" />
    <link rel="alternate" hreflang="x-default" href="${esc(seo.en ? url : altUrl)}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BSS Index" />
    <meta property="og:locale" content="${seo.en ? 'en_US' : 'ru_RU'}" />
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
    ${THEME_BOOT}
`;

  // Replace the original <head>...</head> with our generated head.
  const html = template.replace(/<head>[\s\S]*?<\/head>/i, `<head>${headTags}  </head>`);

  // IMPORTANT: the static block is a SIBLING of #app, not a child.
  // React wipes #app on mount, so content inside it would be erased for crawlers
  // that execute JS. Outside it, the <h1>, price tables and internal links survive
  // for both visitors and Google.
  const body = renderBody(item, seo, url, altUrl, related);
  return html.replace(
    '<div id="app"></div>',
    `${STATIC_START}\n${body}\n${STATIC_END}\n<div id="app"></div>`
  );
}

/** Restore the visitor's saved theme / background before first paint. */
const THEME_BOOT = `
    <script>
      (function () {
        try {
          var r = document.documentElement;
          if (localStorage.getItem('bss_theme') === 'light') r.classList.add('light');
          r.setAttribute('data-bsbg', localStorage.getItem('bss_bg') || 'grid');
        } catch (e) {}
      })();
    <\/script>`;

/** Stylesheet shared by item pages and the English landing page. */
const ITEM_PAGE_CSS = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }

    /* Theme tokens — swapped wholesale for the light theme. */
    .wrap {
      --bg: #0b0f19;
      --bg-img: none;
      --card: rgba(11, 15, 25, .65);
      --border: rgba(255, 255, 255, .07);
      --text: #e5e5e5;
      --muted: #a1a1aa;
      --faint: #71717a;
      --icon-bg: rgba(255, 255, 255, .04);
    }
    html.light .wrap {
      --bg: #f4f5f7;
      --card: #ffffff;
      --border: rgba(15, 23, 42, .12);
      --text: #18181b;
      --muted: #52525b;
      --faint: #a1a1aa;
      --icon-bg: rgba(15, 23, 42, .04);
    }

    body {
      margin: 0;
      background: #0b0f19;
      color: #e5e5e5;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      line-height: 1.6;
    }
    html.light body { background: #f4f5f7; color: #18181b; }

    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 20px 64px;
      background-color: var(--bg);
      background-image: var(--bg-img);
      color: var(--text);
    }

    /* Background presets — mirror the ones offered in the app settings. */
    html[data-bsbg="grid"] .wrap {
      --bg-img:
        linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
      background-size: 44px 44px;
    }
    html[data-bsbg="dots"] .wrap {
      --bg-img: radial-gradient(rgba(255,255,255,.08) 1px, transparent 1.5px);
      background-size: 26px 26px;
    }
    html[data-bsbg="solid"] .wrap { --bg-img: none; }
    html[data-bsbg="aurora"] .wrap {
      --bg-img:
        radial-gradient(ellipse 70% 45% at 15% 0%, rgba(168,85,247,.12), transparent 60%),
        radial-gradient(ellipse 60% 40% at 85% 15%, rgba(56,189,248,.10), transparent 60%),
        radial-gradient(ellipse 70% 50% at 50% 100%, rgba(245,158,11,.08), transparent 62%);
    }
    /* Light theme needs darker pattern strokes, otherwise white-on-white. */
    html.light[data-bsbg="grid"] .wrap {
      --bg-img:
        linear-gradient(rgba(15,23,42,.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(15,23,42,.06) 1px, transparent 1px);
    }
    html.light[data-bsbg="dots"] .wrap {
      --bg-img: radial-gradient(rgba(15,23,42,.16) 1px, transparent 1.5px);
    }

    .crumbs { font-size: 13px; color: var(--muted); margin-bottom: 24px; display: flex; gap: 8px; align-items: center; }
    .crumbs a { color: #fbbf24; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 7px; }
    .crumbs a:hover { text-decoration: underline; }
    .crumbs .brandlogo { height: 20px; width: auto; display: block; filter: drop-shadow(0 2px 6px rgba(245,158,11,.22)); }
    .hero { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
    /* Every sticker gets the same hatched fill treatment, tinted per item. */
    .iconbox {
      position: relative;
      width: 96px; height: 96px;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--icon-bg);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .iconbox::before {
      content: "";
      position: absolute; inset: 0;
      background: radial-gradient(circle at 50% 38%, var(--glow), transparent 72%);
      opacity: .75;
    }
    .iconbox::after {
      content: "";
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,.05), transparent 55%);
      pointer-events: none;
    }
    .icon { position: relative; width: 74px; height: 74px; object-fit: contain; }
    /* color is set explicitly because the app's global stylesheet forces a
       fixed dark colour on every h1-h6, which breaks the light theme. */
    h1 { margin: 0; color: var(--text); font-size: clamp(26px, 5vw, 40px); font-weight: 900; line-height: 1.1; text-transform: uppercase; }
    .alt { margin: 4px 0 0; color: var(--faint); font-size: 14px; font-family: ui-monospace, monospace; }
    .tag { margin: 8px 0 0; color: #fbbf24; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
    .lead { margin: 28px 0; font-size: 16px; color: var(--muted); }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin: 20px 0; }
    .card h2 { margin: 0 0 14px; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; color: #fbbf24; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--border); }
    thead th { color: #fbbf24; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    tbody th { font-weight: 700; color: #fbbf24; width: 45%; }
    tbody td { font-family: ui-monospace, monospace; color: var(--text); font-weight: 700; }
    tbody td a { color: #fbbf24; text-decoration: none; font-weight: 700; }
    tbody td a:hover { text-decoration: underline; }
    .foot { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 13px; color: var(--faint); }
    .foot a { color: #fbbf24; text-decoration: none; font-weight: 700; }
    .foot a:hover { text-decoration: underline; }

    /* Colour-coded stat tiles */
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .stat-k { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #fbbf24; font-weight: 800; margin-bottom: 8px; }
    .stat-v { font-size: 20px; font-weight: 800; line-height: 1.1; }
    .stat-v.price { color: #fbbf24; font-family: ui-monospace, monospace; }
    .stat-n { font-size: 11px; color: var(--faint); margin-top: 6px; font-family: ui-monospace, monospace; }
    .chip { display: inline-block; font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 6px; border: 1px solid; }
    .c-red { background: rgba(248,113,113,.12); color: #f87171; border-color: rgba(248,113,113,.25); }
    .c-amber { background: rgba(251,191,36,.12); color: #fbbf24; border-color: rgba(251,191,36,.25); }
    .c-blue { background: rgba(96,165,250,.12); color: #60a5fa; border-color: rgba(96,165,250,.25); }
    .c-green { background: rgba(52,211,153,.12); color: #34d399; border-color: rgba(52,211,153,.25); }
    .c-gray { background: rgba(161,161,170,.12); color: #a1a1aa; border-color: rgba(161,161,170,.25); }
    table.meta { margin-top: 4px; }
    table.meta tbody td { color: var(--text); font-weight: 600; }
    .langswitch { margin-left: auto; display: inline-flex; gap: 8px; }
    .langswitch a { padding: 2px 9px; border: 1px solid var(--border); border-radius: 6px; font-size: 11px; letter-spacing: .08em; }
    .langswitch a:hover { border-color: #fbbf24; }

    .cta { margin-top: 28px; display: flex; gap: 10px; flex-wrap: wrap; }
    .cta a { display: inline-block; background: #f59e0b; color: #0b0f19; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; padding: 12px 20px; border-radius: 12px; text-decoration: none; }
    .cta a:hover { background: #fbbf24; }
    .cta a.ghost { background: transparent; color: #d4d4d8; border: 1px solid rgba(255,255,255,.14); }
    .cta a.ghost:hover { background: rgba(255,255,255,.06); color: #fbbf24; }
    html.light .cta a.ghost { color: #3f3f46; border-color: rgba(15,23,42,.16); }
    html.light .cta a.ghost:hover { background: rgba(15,23,42,.04); color: #b45309; }

    /* Category grid on the landing pages */
    .cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    .cats a {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--icon-bg); text-decoration: none; color: var(--text);
      font-size: 13px; font-weight: 700; transition: border-color .15s, color .15s;
    }
    .cats a:hover { border-color: #fbbf24; color: #fbbf24; }
    .cats a em { font-style: normal; font-size: 11px; color: var(--faint); font-family: ui-monospace, monospace; }
    .upd { display: inline-flex; align-items: center; gap: 7px; color: #fbbf24; font-weight: 700; font-size: 12px; margin: 0; }
    .upd::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399; }

    /* Related items */
    .rel { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
    .relitem {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border);
      background: rgba(255,255,255,.02); text-decoration: none; color: var(--text);
      font-size: 13px; font-weight: 600; transition: border-color .2s, background .2s;
    }
    .relitem:hover { border-color: #fbbf24; background: rgba(245,158,11,.06); }
    .relitem span { color: #fbbf24; font-family: ui-monospace, monospace; font-size: 12px; white-space: nowrap; }
`;

function buildSitemap(urls) {
  const entries = urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc><changefreq>daily</changefreq><priority>${u.priority}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

/**
 * Pull the parts of the built <head> that must survive: the analytics
 * snippets, the stylesheet and the module script.
 *
 * The asset URLs are matched in both their relative and absolute form —
 * the template is rewritten by this script, so on a second run the paths are
 * already absolute, and a relative-only match would silently drop the
 * stylesheet. If the template no longer has them, the files are looked up in
 * dist/assets instead.
 */
function headAssets(template) {
  const gtagLoader =
    (template.match(/<script async src="https:\/\/www\.googletagmanager\.com[^>]*><\/script>/i) || [])[0] || '';
  const gtagInline =
    (template.match(/<script>\s*window\.dataLayer[\s\S]*?<\/script>/i) || [])[0] || '';
  const moduleScript =
    (template.match(/<script type="module"[^>]*><\/script>/i) || [])[0] || '';
  const cssLink =
    (template.match(/<link rel="stylesheet"[^>]*href="(?:\.\/|\/)assets\/[^"]*"[^>]*>/i) || [])[0] || '';

  let css = cssLink;
  let js = moduleScript;
  const assetsDir = path.join(DIST, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    if (!css) {
      const file = files.find((f) => f.endsWith('.css'));
      if (file) css = `<link rel="stylesheet" href="/assets/${file}">`;
    }
    if (!js) {
      const file = files.find((f) => f.endsWith('.js'));
      if (file) js = `<script type="module" crossorigin src="/assets/${file}"></script>`;
    }
  }

  return { gtagLoader, gtagInline, moduleScript: js, cssLink: css };
}

/**
 * Build the landing page at / and /ru/.
 *
 * The app itself is a client-side rendered SPA, so without this block a
 * crawler that does not run JavaScript sees a page with a <title> and nothing
 * else — no heading, no links, no structured data. The static block below is
 * a SIBLING of #app, so React replaces only the app area and this content
 * stays in the document for both visitors and search engines.
 */
function buildLanding(template, items, isEn) {
  const { gtagLoader, gtagInline, moduleScript, cssLink } = headAssets(template);
  const absolutise = (tag) => tag.replace(/(src|href)="\.\//g, '$1="/');

  const prefix = isEn ? '' : '/ru';
  const origin = `${SITE_ORIGIN}${prefix}/`;

  const copy = isEn
    ? {
        title: 'BSS Index — Sticker, Voucher & Beequip Values in Bee Swarm Simulator',
        description:
          'Live prices for every sticker, voucher and beequip in Roblox Bee Swarm Simulator. Check values, compare demand and plan trades with the calculator.',
        h1: 'BSS VALUES',
        tag: 'Stickers · Vouchers · Beequips',
        open: 'Open the app ↓',
        allItems: 'All items',
        api: 'API',
        demo: 'Live demo',
        top: 'Most expensive items',
        item: 'Item',
        price: 'Price',
        cats: 'Categories',
        upd: 'Prices update daily',
        home: 'BSS Index home',
        lang: 'RU',
        langHref: '/ru/',
        itemCol: 'Item',
      }
    : {
        title: 'BSS Index — Ценность стикеров, ваучеров и биквипов в Bee Swarm Simulator',
        description:
          'Актуальные цены на все стикеры, ваучеры и биквипы в Roblox Bee Swarm Simulator. Проверяй ценность, сравнивай спрос и считай выгоду сделок в калькуляторе.',
        h1: 'ЦЕННОСТИ BSS',
        tag: 'Стикеры · Ваучеры · Биквипы',
        open: 'Открыть приложение ↓',
        allItems: 'Все предметы',
        api: 'API',
        demo: 'Живое демо',
        top: 'Самые дорогие предметы',
        item: 'Предмет',
        price: 'Цена',
        cats: 'Категории',
        upd: 'Цены обновляются ежедневно',
        home: 'На главную BSS Index',
        lang: 'EN',
        langHref: '/',
        itemCol: 'Предмет',
      };

  // A beequip has no price of its own — what it is worth depends on the roll
  // you got, so the totals and the "most expensive" list leave them out.
  const isBeequip = (item) => item.category === 'Биквипы';
  const priced = items.filter((i) => !isBeequip(i));

  // Top items, most valuable first.
  const topItems = [...priced]
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 24);

  const topRows = topItems
    .map((i) => {
      const label = isEn ? i.englishName || i.name : i.name;
      const slug = slugify(i.englishName || i.id || i.name);
      return `<tr><td><a href="${prefix}/item/${slug}/">${esc(label)}</a></td><td>${esc(fmtValue(i.value))}★</td></tr>`;
    })
    .join('');

  // Category links, pointing at the anchors of the static item index.
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }
  const catLinks = [...byCategory.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, list]) => {
      const title = isEn ? CATEGORY_EN[category] || category : category;
      return `<a href="${prefix}/items/#cat-${slugify(category)}">${esc(title)} <em>${list.length}</em></a>`;
    })
    .join('');

  const totalValue = priced.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const topItem = topItems[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}#website`,
        name: 'BSS Index',
        url: origin,
        inLanguage: isEn ? 'en' : 'ru',
        description: copy.description,
      },
      {
        '@type': 'ItemList',
        '@id': `${origin}#items`,
        name: copy.top,
        numberOfItems: topItems.length,
        itemListElement: topItems.map((i, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: isEn ? i.englishName || i.name : i.name,
          url: `${SITE_ORIGIN}${prefix}/item/${slugify(i.englishName || i.id || i.name)}/`,
        })),
      },
    ],
  };

  const head = `
    ${gtagLoader}
    ${gtagInline}
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(copy.title)}</title>
    <meta name="description" content="${esc(copy.description)}" />
    <meta name="keywords" content="BSS, Bee Swarm Simulator, Roblox, trading, value list, sticker prices, trade calculator, beequips, beequip rolls, bee swarm values" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${esc(origin)}" />
    <link rel="alternate" hreflang="en" href="${esc(`${SITE_ORIGIN}/`)}" />
    <link rel="alternate" hreflang="ru" href="${esc(`${SITE_ORIGIN}/ru/`)}" />
    <link rel="alternate" hreflang="x-default" href="${esc(`${SITE_ORIGIN}/`)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BSS Index" />
    <meta property="og:locale" content="${isEn ? 'en_US' : 'ru_RU'}" />
    <meta property="og:title" content="${esc(copy.title)}" />
    <meta property="og:description" content="${esc(copy.description)}" />
    <meta property="og:url" content="${esc(origin)}" />
    <meta property="og:image" content="${esc(`${SITE_ORIGIN}/logo.png`)}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(copy.title)}" />
    <meta name="twitter:description" content="${esc(copy.description)}" />
    <meta name="twitter:image" content="${esc(`${SITE_ORIGIN}/logo.png`)}" />
    <script type="application/ld+json">${escJson(jsonLd)}</script>
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap" rel="stylesheet">
    ${absolutise(cssLink)}
    ${absolutise(moduleScript)}
    ${THEME_BOOT}`;

  const body = `
  <main class="wrap">
    <nav class="crumbs">
      <a href="${isEn ? '/' : '/ru/'}"><img src="/logo-128.png" alt="BSS Index" width="22" height="19" class="brandlogo" />${esc(copy.home)}</a>
      <span class="langswitch"><a href="${copy.langHref}">${esc(copy.lang)}</a></span>
    </nav>
    <h1>${esc(copy.h1)}</h1>
    <p class="tag">${esc(copy.tag)}</p>
    <p class="lead">${esc(copy.description)}</p>
    <div class="cta">
      <a href="#app">${esc(copy.open)}</a>
      <a href="${prefix}/items/" class="ghost">${esc(copy.allItems)}</a>
      <a href="/api/" class="ghost">${esc(copy.api)}</a>
      <a href="/demo/" class="ghost">${esc(copy.demo)}</a>
    </div>

    <div class="stats">
      <div><div class="stat-k">${isEn ? 'Items' : 'Предметов'}</div><div class="stat-v">${items.length}</div></div>
      <div><div class="stat-k">${isEn ? 'Total value' : 'Общая ценность'}</div><div class="stat-v price">${esc(fmtValue(totalValue))}★</div><div class="stat-n">${esc(isEn ? 'excluding beequips' : 'без биквипов')}</div></div>
      <div><div class="stat-k">${isEn ? 'Most expensive' : 'Самый дорогой'}</div><div class="stat-v price">${esc(fmtValue(topItem.value))}★</div><div class="stat-n">${esc(isEn ? topItem.englishName || topItem.name : topItem.name)}</div></div>
    </div>

    <section class="card">
      <h2>${esc(copy.top)}</h2>
      <table><thead><tr><th>${esc(copy.item)}</th><th>${esc(copy.price)}</th></tr></thead><tbody>${topRows}</tbody></table>
    </section>

    <section class="card">
      <h2>${esc(copy.cats)}</h2>
      <div class="cats">${catLinks}</div>
    </section>

    <footer class="foot">
      <p class="upd">${esc(copy.upd)}</p>
      <p><a href="${prefix}/items/">${esc(copy.allItems)} →</a></p>
    </footer>
  </main>

  <style>${ITEM_PAGE_CSS}</style>`;

  // The English home page is the app and nothing else — no static block in
  // the body at all. Everything a crawler needs (title, description,
  // canonical, hreflang, Open Graph and the JSON-LD) lives in the head.
  // The Russian landing page has always been a landing page, so its block
  // stays on top of the app.
  if (!isEn) {
    return template
      .replace(/<html lang="[a-z]{2}">/i, '<html lang="ru">')
      .replace(/<head>[\s\S]*?<\/head>/i, `<head>${head}  </head>`)
      .replace(
        '<div id="app"></div>',
        `${STATIC_START}\n${body}\n${STATIC_END}\n<div id="app"></div>`
      );
  }

  return template
    .replace(/<html lang="[a-z]{2}">/i, '<html lang="en">')
    .replace(/<head>[\s\S]*?<\/head>/i, `<head>${head}  </head>`);
}

/**
 * Markers around the static block that gets injected into a page.
 *
 * The script rewrites dist/index.html, which it also reads as its template.
 * Without the markers a second run would inject a second copy of the block
 * into the already-injected file — so the template is always stripped of any
 * previous block before it is used.
 */
const STATIC_START = '<!--bss-static-->';
const STATIC_END = '<!--/bss-static-->';

/** Remove any previously injected static block from a template. */
function stripStatic(html) {
  return html.replace(
    new RegExp(`${STATIC_START}[\\s\\S]*?${STATIC_END}\\s*`, 'g'),
    ''
  );
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

  const template = stripStatic(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'));
  const items = JSON.parse(fs.readFileSync(ITEMS_SRC, 'utf8'));

  const urls = [
    { loc: `${SITE_ORIGIN}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_ORIGIN}/ru/`, changefreq: 'daily', priority: '1.0' },
  ];
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

    // English is the primary site and lives at the root; Russian mirrors under /ru/.
    const enUrl = `${SITE_ORIGIN}/item/${slug}`;
    const ruUrl = `${SITE_ORIGIN}/ru/item/${slug}`;
    const priority = item.category === 'Биквипы' ? '0.6' : '0.8';

    // Related items: same category first (by value), then the priciest items
    // overall so that every page has a way out towards the rest of the site.
    const sameCategory = items
      .filter((i) => i.id !== item.id && i.category === item.category)
      .sort((a, b) => b.value - a.value);
    const others = items
      .filter((i) => i.id !== item.id && i.category !== item.category && i.value > 0)
      .sort((a, b) => b.value - a.value);
    const relatedPool = [...sameCategory, ...others].slice(0, 12);

    for (const lang of ['en', 'ru']) {
      const isEn = lang === 'en';
      const url = isEn ? enUrl : ruUrl;
      const altUrl = isEn ? ruUrl : enUrl;
      const seo = buildSeoFields(item, lang);

      const related = relatedPool.map((r) => {
        const rSlug = slugify(r.englishName || r.id || r.name);
        return {
          name: isEn ? r.englishName : r.name,
          value: fmtValue(r.value),
          url: isEn ? `/item/${rSlug}/` : `/ru/item/${rSlug}/`,
        };
      });

      const html = injectIntoTemplate(template, item, seo, url, altUrl, related)
        // Match the document language so screen readers and Google agree.
        .replace(/<html lang="[a-z]{2}">/i, `<html lang="${isEn ? 'en' : 'ru'}">`);

      const dir = isEn ? path.join(DIST, 'item', slug) : path.join(DIST, 'ru', 'item', slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');

      urls.push({ loc: url, changefreq: 'weekly', priority });
      written++;
    }
  }

  // Static item index at /items/ and /ru/items/ — a searchable catalogue of
  // every item, grouped by category. The catalog itself is rendered
  // client-side, so without this page there was not a single crawlable link
  // from the site to the 330 item pages.
  for (const lang of ['en', 'ru']) {
    const isEn = lang === 'en';
    const prefix = isEn ? '' : '/ru';
    const indexHtml = buildIndexPage(items, isEn, { slugify });

    const dir = isEn ? path.join(DIST, 'items') : path.join(DIST, 'ru', 'items');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), indexHtml, 'utf8');
    urls.push({ loc: `${SITE_ORIGIN}${prefix}/items/`, changefreq: 'weekly', priority: '0.9' });
  }

  // Sitemap last, so it includes the item index pages added above.
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(urls), 'utf8');

  // Landing pages at / and /ru/. The app is a client-side rendered SPA, so
  // without the static block these pages are empty shells for any crawler
  // that does not run JavaScript — no heading, no links, no structured data.
  fs.writeFileSync(path.join(DIST, 'index.html'), buildLanding(template, items, true), 'utf8');
  const ruDir = path.join(DIST, 'ru');
  fs.mkdirSync(ruDir, { recursive: true });
  fs.writeFileSync(path.join(ruDir, 'index.html'), buildLanding(template, items, false), 'utf8');

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