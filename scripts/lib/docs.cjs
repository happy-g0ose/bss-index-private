/**
 * Human readable API documentation (docs.html + docs.ru.html).
 *
 * This module is deliberately self-contained: the English page must stay
 * byte-for-byte identical to the page that used to be produced inline by
 * scripts/generate-api-v1.cjs, and the Russian page is a full translation of
 * the very same layout. Everything that used to live in the generator
 * (the `esc` helper, SITE_ORIGIN and the demand/stability legends) is
 * re-implemented here so the file can be required on its own.
 *
 * Only prose is translated. Code, URLs, JSON keys, endpoint paths and HTTP
 * methods stay in English/Latin in both languages.
 *
 * Payload shape
 * -------------
 * The docs page documents the payload it is generated from, so the two
 * tables that describe the payload follow the data:
 *
 *   - legacy shape    `name` is the Russian name, `nameEn` the English one
 *                     (the historical layout, kept byte-for-byte);
 *   - english-first   `name`/`category` hold the English value, the Russian
 *     shape           one lives in `nameRu`/`categoryRu`.
 *
 * The shape is detected from the category rows (`nameRu` present or not).
 */
'use strict';

/** Canonical origin. Override with SITE_ORIGIN env var at build time. */
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://bss-index.vercel.app').replace(/\/+$/, '');

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
// Legends (copied from scripts/generate-api-v1.cjs so the English page stays
// byte-for-byte identical; the Russian variants translate the descriptions)
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

const DEMAND_LEGEND_RU = [
  { value: 'Низкий', valueEn: 'Low', rank: 1, description: 'Низкий спрос — предмет продаётся медленно и обычно дешевле указанной стоимости.' },
  { value: 'Средний', valueEn: 'Average', rank: 2, description: 'Средний спрос — уходит по указанной стоимости не сразу.' },
  { value: 'Высокий', valueEn: 'High', rank: 3, description: 'Высокий спрос — предмет продаётся быстро, часто дороже указанной стоимости.' },
  { value: 'Хайп', valueEn: 'Hype', rank: 4, description: 'Хайп — предмет нужен всем, цены меняются быстро и резко.' },
];

const STABILITY_LEGEND_RU = [
  { value: 'Растет', valueEn: 'Rising', rank: 1, description: 'Цена растёт на протяжении всей записанной истории.' },
  { value: 'Стабильно', valueEn: 'Stable', rank: 2, description: 'Цена держится ровно.' },
  { value: 'Падает', valueEn: 'Falling', rank: 3, description: 'Цена снижается на протяжении всей записанной истории.' },
];

// ---------------------------------------------------------------------------
// Russian translations of the endpoint catalogue
// ---------------------------------------------------------------------------

/**
 * Russian summary/description for every endpoint of the catalogue in
 * scripts/generate-api-v1.cjs, keyed by `endpoint.key`.
 *
 * `params` holds the Russian explanation of every query/path parameter of the
 * endpoint, keyed by parameter name. When a key or a parameter is missing
 * here, the English text from the catalogue is used as a fallback.
 */
const ENDPOINT_TRANSLATIONS_RU = {
  index: {
    summary: 'Документ обнаружения API',
    description:
      'Документ обнаружения API. Содержит версию API, origin, количество предметов и категорий, список всех категорий, легенды спроса и стабильности и полный каталог эндпоинтов. Начните с него.',
    params: {},
  },
  items: {
    summary: 'Все предметы',
    description:
      'Все предметы каталога в компактной структуре, отсортированные по убыванию стоимости. Один массив — пагинация не нужна.',
    params: {},
  },
  item: {
    summary: 'Один предмет, полные данные',
    description:
      'Полная запись одного предмета: компактные поля плюс описание, история цен с датами, роллы beequip и до 10 связанных предметов.',
    params: {
      slug: 'Slug предмета, например "star-cub". Полный список — в /api/v1/search-index.json.',
    },
  },
  history: {
    summary: 'История цен одного предмета',
    description:
      'История цен одного предмета в виде двух параллельных массивов (даты + цены), а также min/max/average и изменения за 7 и 30 дней. Такой файл есть только у предметов с записанной историей.',
    params: {
      slug: 'Slug предмета, например "star-cub".',
    },
  },
  categories: {
    summary: 'Все категории',
    description:
      'Все категории: slug, английское и русское названия, количество предметов и статистика стоимости (min, max, average, total).',
    params: {},
  },
  categoryItems: {
    summary: 'Предметы одной категории',
    description:
      'Все предметы одной категории в той же компактной структуре, что и /api/v1/items.json, отсортированные по убыванию стоимости.',
    params: {
      slug: 'Slug категории, например "stikery-pchel". Полный список — в /api/v1/categories.json.',
    },
  },
  search: {
    summary: 'Поиск предметов',
    description:
      'Поиск на стороне сервера. Ищет по названию на любом из двух языков, по slug и по сленгу сообщества для каждой категории (например, «куб» находит Cub Skins). Результаты отсортированы сначала по релевантности, затем по стоимости.',
    params: {
      q: 'Поисковый запрос, например "bee", "star cub", "куб".',
      category: 'Фильтр по slug категории, например "vouchers", "cub-skins".',
      sort: 'relevance (по умолчанию), value, value-asc, name, change.',
      limit: 'Предметов на страницу, 1-100, по умолчанию 25.',
      offset: 'Смещение для пагинации, по умолчанию 0.',
    },
  },
  changes: {
    summary: 'Лидеры рынка',
    description:
      'Лидеры рынка: 10 самых подорожавших и 10 самых подешевевших предметов за последние 7 дней с изменением за 30 дней. Предметы без достаточной истории пропускаются.',
    params: {},
  },
  stats: {
    summary: 'Статистика рынка',
    description:
      'Сводка по рынку: количество предметов, суммарная/средняя/медианная/минимальная/максимальная стоимость и сколько предметов имеют историю цен.',
    params: {},
  },
  searchIndex: {
    summary: 'Компактный поисковый индекс',
    description:
      'Небольшой лёгкий индекс (slug, английское и русское названия, английская категория, стоимость): скачивается один раз и фильтруется на клиенте для мгновенного поиска. Без истории и без цветов.',
    params: {},
  },
  openapi: {
    summary: 'Описание OpenAPI 3.1',
    description:
      'Описание этого API в формате OpenAPI 3.1. Укажите на него свой API-клиент, Swagger UI или Redoc.',
    params: {},
  },
  docs: {
    summary: 'Справка для разработчиков',
    description: 'Понятная человеку справка по API (эта страница).',
    params: {},
  },
};

// ---------------------------------------------------------------------------
// Item shape tables
// ---------------------------------------------------------------------------

/** [first cell (raw HTML), type] — the description comes from the copy below. */
const ITEM_SHAPE_ROWS = {
  legacy: [
    ['<code>slug</code>', 'string'],
    ['<code>id</code>', 'string'],
    ['<code>name</code> / <code>nameEn</code>', 'string'],
    ['<code>category</code> / <code>categorySlug</code>', 'string'],
    ['<code>value</code>', 'number'],
    ['<code>valueLow</code> / <code>valueHigh</code>', 'number'],
    ['<code>demand</code> / <code>demandEn</code>', 'string'],
    ['<code>stability</code> / <code>stabilityEn</code>', 'string'],
    ['<code>change7d</code> / <code>change30d</code>', 'number | null'],
    ['<code>image</code>', 'string'],
    ['<code>url</code>', 'string'],
    ['<code>hasHistory</code>', 'boolean'],
  ],
  englishFirst: [
    ['<code>slug</code>', 'string'],
    ['<code>id</code>', 'string'],
    ['<code>name</code>', 'string'],
    ['<code>nameRu</code>', 'string | null'],
    ['<code>category</code>', 'string'],
    ['<code>categoryRu</code>', 'string'],
    ['<code>categorySlug</code>', 'string'],
    ['<code>value</code>', 'number'],
    ['<code>valueLow</code> / <code>valueHigh</code>', 'number'],
    ['<code>demand</code> / <code>demandEn</code>', 'string'],
    ['<code>stability</code> / <code>stabilityEn</code>', 'string'],
    ['<code>change7d</code> / <code>change30d</code>', 'number | null'],
    ['<code>image</code>', 'string'],
    ['<code>url</code>', 'string'],
    ['<code>hasHistory</code>', 'boolean'],
  ],
};

// ---------------------------------------------------------------------------
// Page copy
// ---------------------------------------------------------------------------

const TEXT_EN = {
  htmlLang: 'en',
  docPath: 'docs.html',
  otherPath: 'docs.ru.html',
  otherLabel: 'Русский',
  titlePrefix: 'BSS Index API v',
  titleSuffix: ' — Bee Swarm Simulator value API',
  metaDescription:
    'Public, documented JSON API for Bee Swarm Simulator item values, price history and beequip rolls.',
  badgePrefix: 'Public JSON API · v',
  intro1:
    'Every item value, price history and beequip roll of <strong>Bee Swarm Simulator</strong> as clean JSON.',
  intro2:
    'No key, no rate limit, CORS open to every origin. Built for price trackers, bots, fan sites and spreadsheets.',
  stats: {
    version: 'Version',
    items: 'Items',
    categories: 'Categories',
    totalValue: 'Total value',
    averageValue: 'Average value',
    generated: 'Generated',
  },
  whyTitle: 'Why this API',
  why: [
    '<strong>Numbers, not strings.</strong> Every value is a real JSON number — no <code>"65"</code>.',
    '<strong>One file per item.</strong> Read a single price without downloading the whole catalogue.',
    '<strong>CORS enabled.</strong> <code>Access-Control-Allow-Origin: *</code> — fetch it from any website, any framework.',
    '<strong>Absolute image URLs.</strong> Nothing to rewrite on your side.',
    '<strong>Versioned &amp; documented.</strong> <code>/api/v1/</code> never breaks, plus an OpenAPI 3.1 description.',
    '<strong>Search ready.</strong> A tiny <a href="{origin}/api/v1/search-index.json">search-index.json</a> for instant client-side filtering.',
  ],
  baseUrlTitle: 'Base URL',
  baseUrlNote:
    'All responses are <code>application/json</code> and served with an open CORS policy. Cache-Control is handled by the CDN.',
  endpointsTitle: 'Endpoints',
  endpointsHeaders: ['Method', 'Path', 'Description'],
  paramsTitle: 'Parameters',
  paramHeaders: ['Parameter', 'In', 'Type', 'Required', 'Description'],
  paramIn: 'path',
  paramRequired: 'yes',
  examplesTitle: 'Examples',
  examplesNote: 'Copy-paste friendly. Every URL below returns JSON directly.',
  jsTitle: 'JavaScript (fetch, straight from a browser)',
  pyTitle: 'Python',
  itemShapeTitle: 'Item shape',
  itemShapeNote:
    'The compact shape used by <code>items.json</code> and <code>categories/&lt;slug&gt;/items.json</code>. The per-item document adds <code>description</code>, <code>historicalDates</code>, <code>historicalPrices</code>, <code>rolls</code> and <code>related</code>.',
  itemShapeNote2:
    'The API is English-first: <code>name</code> and <code>category</code> always hold the English value, the Russian one lives in <code>nameRu</code> and <code>categoryRu</code>. <code>nameRu</code> is <code>null</code> when the item has no separate Russian name.',
  itemShapeHeaders: ['Field', 'Type', 'Description'],
  itemShapeFields: [
    'Identifier used by the website at <code>/item/&lt;slug&gt;/</code>.',
    'Stable internal id.',
    'Display name and English name.',
    'Category name and its slug.',
    'Current value.',
    'Accepted price range.',
    'Demand label (see legend below).',
    'Price stability label (see legend below).',
    'Percentage change over 7 / 30 days, <code>null</code> when the item has not enough history.',
    'Absolute image URL.',
    'Absolute URL of the item page.',
    'Whether a price history exists for the item.',
  ],
  itemShapeFieldsEnglishFirst: [
    'Identifier used by the website at <code>/item/&lt;slug&gt;/</code>.',
    'Stable internal id.',
    'English name of the item.',
    'Russian name of the item, <code>null</code> when there is no separate Russian name.',
    'English category name, e.g. <code>Cub Skins</code>.',
    'Russian category name, e.g. <code>Скины на каба</code>.',
    'Slug of the English category name, e.g. <code>cub-skins</code>.',
    'Current value.',
    'Accepted price range.',
    'Demand label (see legend below).',
    'Price stability label (see legend below).',
    'Percentage change over 7 / 30 days, <code>null</code> when the item has not enough history.',
    'Absolute image URL.',
    'Absolute URL of the item page.',
    'Whether a price history exists for the item.',
  ],
  legendsTitle: 'Legends',
  demandTitle: 'Demand',
  stabilityTitle: 'Stability',
  legendHeaders: ['value', '{legend}', 'Rank', 'Meaning'],
  categoriesTitle: 'Categories',
  categoryHeaders: ['Slug', 'Name', 'English', 'Items'],
  categoryHeadersEnglishFirst: ['Slug', 'Name (English)', 'Name (Russian)', 'Items'],
  calcTitle: 'How changes are calculated',
  calc: [
    'Price history is an irregular series of dated snapshots. <code>change7d</code> compares the newest snapshot with the price',
    'interpolated at 7 days earlier, <code>change30d</code> does the same for 30 days. When the recorded series does not reach',
    'that far back, the change is <code>null</code> — never a guess. Percentages are rounded to one decimal.',
    'Items without a usable change are skipped in <code>changes.json</code>.',
  ],
  openapiTitle: 'OpenAPI',
  openapiNote:
    'Full machine readable description: <a href="{origin}/api/v1/openapi.json"><code>{origin}/api/v1/openapi.json</code></a> — point Swagger UI, Redoc, Postman or your own codegen at it.',
  footerVersion: 'version',
  footerGenerated: 'generated',
};

const TEXT_RU = {
  htmlLang: 'ru',
  docPath: 'docs.ru.html',
  otherPath: 'docs.html',
  otherLabel: 'English',
  titlePrefix: 'BSS Index API v',
  titleSuffix: ' — API значений в Bee Swarm Simulator',
  metaDescription:
    'Публичный документированный JSON API со значениями предметов, историей цен и роллами beequip в Bee Swarm Simulator.',
  badgePrefix: 'Публичный JSON API · v',
  intro1:
    'Все значения предметов, история цен и роллы beequip из <strong>Bee Swarm Simulator</strong> — в виде чистого JSON.',
  intro2:
    'Без ключа, без ограничений по частоте запросов, CORS открыт для любого источника. Сделано для трекеров цен, ботов, фан-сайтов и таблиц.',
  stats: {
    version: 'Версия',
    items: 'Предметы',
    categories: 'Категории',
    totalValue: 'Суммарная стоимость',
    averageValue: 'Средняя стоимость',
    generated: 'Сгенерировано',
  },
  whyTitle: 'Почему именно это API',
  why: [
    '<strong>Числа, а не строки.</strong> Каждое значение — настоящее JSON-число, а не <code>"65"</code>.',
    '<strong>Один файл на предмет.</strong> Получите цену одного предмета, не скачивая весь каталог.',
    '<strong>CORS включён.</strong> <code>Access-Control-Allow-Origin: *</code> — запрашивайте с любого сайта и из любого фреймворка.',
    '<strong>Абсолютные URL изображений.</strong> Ничего не нужно переписывать на своей стороне.',
    '<strong>Версионирован и документирован.</strong> Префикс <code>/api/v1/</code> не ломается, плюс описание OpenAPI 3.1.',
    '<strong>Готов к поиску.</strong> Компактный <a href="{origin}/api/v1/search-index.json">search-index.json</a> для мгновенной фильтрации на клиенте.',
  ],
  baseUrlTitle: 'Базовый URL',
  baseUrlNote:
    'Все ответы отдаются как <code>application/json</code> с открытой политикой CORS. Заголовки Cache-Control управляются CDN.',
  endpointsTitle: 'Эндпоинты',
  endpointsHeaders: ['Метод', 'Путь', 'Описание'],
  paramsTitle: 'Параметры',
  paramHeaders: ['Параметр', 'Расположение', 'Тип', 'Обязательный', 'Описание'],
  paramIn: 'путь',
  paramRequired: 'да',
  examplesTitle: 'Примеры',
  examplesNote: 'Готово к копированию. Каждый URL ниже сразу возвращает JSON.',
  jsTitle: 'JavaScript (fetch, прямо из браузера)',
  pyTitle: 'Python',
  itemShapeTitle: 'Структура предмета',
  itemShapeNote:
    'Компактная структура, которую используют <code>items.json</code> и <code>categories/&lt;slug&gt;/items.json</code>. Документ отдельного предмета дополнительно содержит <code>description</code>, <code>historicalDates</code>, <code>historicalPrices</code>, <code>rolls</code> и <code>related</code>.',
  itemShapeNote2:
    'API сначала на английском: <code>name</code> и <code>category</code> всегда содержат английское значение, а русское лежит в <code>nameRu</code> и <code>categoryRu</code>. <code>nameRu</code> равен <code>null</code>, если у предмета нет отдельного русского названия.',
  itemShapeHeaders: ['Поле', 'Тип', 'Описание'],
  itemShapeFields: [
    'Идентификатор, который сайт использует по адресу <code>/item/&lt;slug&gt;/</code>.',
    'Стабильный внутренний идентификатор.',
    'Отображаемое название и английское название.',
    'Название категории и её slug.',
    'Текущая стоимость.',
    'Диапазон принимаемых цен.',
    'Метка спроса (см. легенду ниже).',
    'Метка стабильности цены (см. легенду ниже).',
    'Изменение в процентах за 7 / 30 дней, <code>null</code>, если истории предмета недостаточно.',
    'Абсолютный URL изображения.',
    'Абсолютный URL страницы предмета.',
    'Есть ли у предмета история цен.',
  ],
  itemShapeFieldsEnglishFirst: [
    'Идентификатор, который сайт использует по адресу <code>/item/&lt;slug&gt;/</code>.',
    'Стабильный внутренний идентификатор.',
    'Английское название предмета.',
    'Русское название предмета, <code>null</code>, если отдельного русского названия нет.',
    'Английское название категории, например <code>Cub Skins</code>.',
    'Русское название категории, например <code>Скины на каба</code>.',
    'Slug английского названия категории, например <code>cub-skins</code>.',
    'Текущая стоимость.',
    'Диапазон принимаемых цен.',
    'Метка спроса (см. легенду ниже).',
    'Метка стабильности цены (см. легенду ниже).',
    'Изменение в процентах за 7 / 30 дней, <code>null</code>, если истории предмета недостаточно.',
    'Абсолютный URL изображения.',
    'Абсолютный URL страницы предмета.',
    'Есть ли у предмета история цен.',
  ],
  legendsTitle: 'Легенды',
  demandTitle: 'Спрос',
  stabilityTitle: 'Стабильность',
  legendHeaders: ['value', '{legend}', 'Ранг', 'Значение'],
  categoriesTitle: 'Категории',
  categoryHeaders: ['Slug', 'Название', 'Английское', 'Предметы'],
  categoryHeadersEnglishFirst: ['Slug', 'Название', 'Английское', 'Предметы'],
  calcTitle: 'Как рассчитываются изменения',
  calc: [
    'История цен — нерегулярный ряд датированных снимков. <code>change7d</code> сравнивает последний снимок с ценой,',
    'интерполированной на 7 дней раньше, <code>change30d</code> делает то же самое за 30 дней. Если записанный ряд не дотягивается',
    'до этой точки, изменение равно <code>null</code> — мы никогда не гадаем. Проценты округляются до одного знака после запятой.',
    'Предметы без пригодного изменения пропускаются в <code>changes.json</code>.',
  ],
  openapiTitle: 'OpenAPI',
  openapiNote:
    'Полное машинночитаемое описание: <a href="{origin}/api/v1/openapi.json"><code>{origin}/api/v1/openapi.json</code></a> — укажите на него свой API-клиент, Swagger UI, Redoc, Postman или собственный кодогенератор.',
  footerVersion: 'версия',
  footerGenerated: 'сгенерировано',
};

const TEXT = { en: TEXT_EN, ru: TEXT_RU };

// ---------------------------------------------------------------------------
// HTML documentation
// ---------------------------------------------------------------------------

/**
 * Build the human readable API reference.
 *
 * @param {'en'|'ru'} lang            Page language.
 * @param {string} version            API version, e.g. "1.0.0".
 * @param {Array} endpoints           Endpoint catalogue (see buildEndpoints()).
 * @param {Array} categories          Category rows.
 * @param {Object} stats              { totalValue, averageValue }.
 * @param {string} generated          Generation timestamp.
 * @param {number} itemCount          Number of items in the catalogue.
 * @returns {string} A complete HTML document.
 */
function buildDocsHtml(lang, version, endpoints, categories, stats, generated, itemCount) {
  const T = TEXT[lang] || TEXT.en;
  const isRu = (lang || 'en') === 'ru';
  const origin = SITE_ORIGIN;

  /** Replace every {origin} placeholder with the canonical origin. */
  const fill = (str) => String(str).split('{origin}').join(esc(origin));

  /**
   * The payload is either the legacy one (`name` is Russian, `nameEn` is
   * English) or the english-first one (`name`/`category` are English, the
   * Russian value lives in `nameRu`/`categoryRu`).
   */
  const englishFirst = (categories || []).some((c) => c && c.nameRu != null && c.nameRu !== '');
  const shape = englishFirst ? 'englishFirst' : 'legacy';

  /** Russian description of an endpoint, with an English fallback. */
  const epText = (e) => {
    if (!isRu) return e.description;
    const tr = ENDPOINT_TRANSLATIONS_RU[e.key];
    return (tr && tr.description) || e.description;
  };

  /** Russian description of a parameter, with an English fallback. */
  const paramText = (e, p) => {
    if (!isRu) return p.description;
    const tr = ENDPOINT_TRANSLATIONS_RU[e.key];
    const t = tr && tr.params ? tr.params[p.name] : null;
    return t || p.description;
  };

  const rows = endpoints.map((e) => `
        <tr>
          <td class="method">${esc(e.method)}</td>
          <td class="path"><code>${esc(e.path)}</code></td>
          <td class="desc">${esc(epText(e))}</td>
        </tr>`).join('');

  const paramBlocks = endpoints
    .filter((e) => e.params && e.params.length)
    .map((e) => `
        <h4 class="ep-title"><span class="method method--get">${esc(e.method)}</span><code>${esc(e.path)}</code></h4>
        <p class="muted">${esc(epText(e))}</p>
        <table class="params">
          <thead><tr><th>${esc(T.paramHeaders[0])}</th><th>${esc(T.paramHeaders[1])}</th><th>${esc(T.paramHeaders[2])}</th><th>${esc(T.paramHeaders[3])}</th><th>${esc(T.paramHeaders[4])}</th></tr></thead>
          <tbody>
${e.params.map((p) => `            <tr><td><code>${esc(p.name)}</code></td><td>${esc(T.paramIn)}</td><td>${esc(p.type)}</td><td>${esc(T.paramRequired)}</td><td>${esc(paramText(e, p))}</td></tr>`).join('\n')}
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

  const demandLegend = isRu ? DEMAND_LEGEND_RU : DEMAND_LEGEND;
  const stabilityLegend = isRu ? STABILITY_LEGEND_RU : STABILITY_LEGEND;

  const demandRows = demandLegend.map((d) => `            <tr><td><code>${esc(d.value)}</code></td><td><code>${esc(d.valueEn)}</code></td><td>${d.rank}</td><td>${esc(d.description)}</td></tr>`).join('\n');
  const stabilityRows = stabilityLegend.map((d) => `            <tr><td><code>${esc(d.value)}</code></td><td><code>${esc(d.valueEn)}</code></td><td>${d.rank}</td><td>${esc(d.description)}</td></tr>`).join('\n');

  // Category rows.
  //   legacy shape    `name` is the Russian name, `nameEn` the English one:
  //                   the layout is the historical one (Name | English).
  //   english-first   `name` is the English name, `nameRu` the Russian one.
  // The English page leads with the English name, the Russian page with the
  // Russian one; the second column always carries the other name.
  const categoryRows = categories
    .map((c) => {
      let first;
      let second;
      if (englishFirst) {
        first = isRu ? c.nameRu : c.name;
        second = isRu ? c.name : c.nameRu;
      } else {
        first = c.name;
        second = c.nameEn;
      }
      return `            <tr><td><code>${esc(c.slug)}</code></td><td>${esc(first)}</td><td>${esc(second)}</td><td>${c.count}</td></tr>`;
    })
    .join('\n');

  const categoryHeaders = englishFirst ? T.categoryHeadersEnglishFirst : T.categoryHeaders;

  // Item shape rows.
  const itemShapeFields = englishFirst ? T.itemShapeFieldsEnglishFirst : T.itemShapeFields;
  const itemShapeRows = ITEM_SHAPE_ROWS[shape]
    .map(([cell, type], i) => `      <tr><td>${cell}</td><td>${type}</td><td>${itemShapeFields[i]}</td></tr>`)
    .join('\n');
  const itemShapeNote2 = englishFirst ? `\n  <p class="muted">${T.itemShapeNote2}</p>` : '';

  // The Python example reads the name field of the payload.
  const pythonNameField = englishFirst
    ? (isRu ? 'nameRu' : 'name')
    : (isRu ? 'name' : 'nameEn');

  // Language switcher + hreflang links.
  const switcher = `    <p style="margin: 0;"><a href="./${esc(T.otherPath)}" style="color:#fbbf24; font-size:13px;">${esc(T.otherLabel)}</a></p>`;
  const hreflang = isRu
    ? `<link rel="alternate" hreflang="en" href="${esc(origin)}/api/v1/docs.html">
<link rel="alternate" hreflang="x-default" href="${esc(origin)}/api/v1/docs.html">`
    : `<link rel="alternate" hreflang="ru" href="${esc(origin)}/api/v1/docs.ru.html">
<link rel="alternate" hreflang="x-default" href="${esc(origin)}/api/v1/docs.html">`;

  return `<!doctype html>
<html lang="${esc(T.htmlLang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(T.titlePrefix)}${esc(version)}${esc(T.titleSuffix)}</title>
<meta name="description" content="${esc(T.metaDescription)}">
<link rel="canonical" href="${esc(origin)}/api/v1/${esc(T.docPath)}">
${hreflang}
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
    <span class="badge">${esc(T.badgePrefix)}${esc(version)}</span>
    <h1>BSS Index <span>API</span></h1>
    <p class="muted" style="max-width: 70ch;">
      ${T.intro1}
      ${T.intro2}
    </p>
${switcher}
  </div>
</header>

<div class="wrap">

  <div class="grid">
    <div class="stat"><div class="k">${esc(T.stats.version)}</div><div class="v">${esc(version)}</div></div>
    <div class="stat"><div class="k">${esc(T.stats.items)}</div><div class="v">${itemCount}</div></div>
    <div class="stat"><div class="k">${esc(T.stats.categories)}</div><div class="v">${categories.length}</div></div>
    <div class="stat"><div class="k">${esc(T.stats.totalValue)}</div><div class="v">${esc(stats.totalValue)}</div></div>
    <div class="stat"><div class="k">${esc(T.stats.averageValue)}</div><div class="v">${esc(stats.averageValue)}</div></div>
    <div class="stat"><div class="k">${esc(T.stats.generated)}</div><div class="v" style="font-size:14px;">${esc(generated)}</div></div>
  </div>

  <h2>${esc(T.whyTitle)}</h2>
  <div class="card">
    <ul>
      <li>${T.why[0]}</li>
      <li>${T.why[1]}</li>
      <li>${T.why[2]}</li>
      <li>${T.why[3]}</li>
      <li>${T.why[4]}</li>
      <li>${fill(T.why[5])}</li>
    </ul>
  </div>

  <h2>${esc(T.baseUrlTitle)}</h2>
  <pre class="code"><code>${esc(origin)}/api/v1</code></pre>
  <p class="muted">${T.baseUrlNote}</p>

  <h2>${esc(T.endpointsTitle)}</h2>
  <table>
    <thead><tr><th>${esc(T.endpointsHeaders[0])}</th><th>${esc(T.endpointsHeaders[1])}</th><th>${esc(T.endpointsHeaders[2])}</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>

  <h2>${esc(T.paramsTitle)}</h2>
${paramBlocks}

  <h2>${esc(T.examplesTitle)}</h2>
  <p class="muted">${esc(T.examplesNote)}</p>
${exampleBlocks}
  <h3>${esc(T.jsTitle)}</h3>
  <pre class="code"><code>const items = await fetch('${esc(origin)}/api/v1/items.json').then(r =&gt; r.json());
const bee = await fetch('${esc(origin)}/api/v1/items/star-cub.json').then(r =&gt; r.json());
console.log(bee.value, bee.change7d, bee.rolls.length);</code></pre>

  <h3>${esc(T.pyTitle)}</h3>
  <pre class="code"><code>import requests

r = requests.get('${esc(origin)}/api/v1/items/star-cub.json').json()
print(r['${esc(pythonNameField)}'], r['value'], r['change7d'])</code></pre>

  <h2>${esc(T.itemShapeTitle)}</h2>
  <p class="muted">${T.itemShapeNote}</p>${itemShapeNote2}
  <table>
    <thead><tr><th>${esc(T.itemShapeHeaders[0])}</th><th>${esc(T.itemShapeHeaders[1])}</th><th>${esc(T.itemShapeHeaders[2])}</th></tr></thead>
    <tbody>
${itemShapeRows}
    </tbody>
  </table>

  <h2>${esc(T.legendsTitle)}</h2>
  <h3>${esc(T.demandTitle)}</h3>
  <table>
    <thead><tr><th>${esc(T.legendHeaders[0])}</th><th>${esc(T.legendHeaders[1].replace('{legend}', 'demandEn'))}</th><th>${esc(T.legendHeaders[2])}</th><th>${esc(T.legendHeaders[3])}</th></tr></thead>
    <tbody>
${demandRows}
    </tbody>
  </table>
  <h3>${esc(T.stabilityTitle)}</h3>
  <table>
    <thead><tr><th>${esc(T.legendHeaders[0])}</th><th>${esc(T.legendHeaders[1].replace('{legend}', 'stabilityEn'))}</th><th>${esc(T.legendHeaders[2])}</th><th>${esc(T.legendHeaders[3])}</th></tr></thead>
    <tbody>
${stabilityRows}
    </tbody>
  </table>

  <h2>${esc(T.categoriesTitle)}</h2>
  <table>
    <thead><tr><th>${esc(categoryHeaders[0])}</th><th>${esc(categoryHeaders[1])}</th><th>${esc(categoryHeaders[2])}</th><th>${esc(categoryHeaders[3])}</th></tr></thead>
    <tbody>
${categoryRows}
    </tbody>
  </table>

  <h2>${esc(T.calcTitle)}</h2>
  <div class="card">
    <p class="muted" style="margin-bottom:0;">
      ${T.calc[0]}
      ${T.calc[1]}
      ${T.calc[2]}
      ${T.calc[3]}
    </p>
  </div>

  <h2>${esc(T.openapiTitle)}</h2>
  <p>${fill(T.openapiNote)}</p>

  <footer>
    <p>BSS Index API · ${esc(T.footerVersion)} ${esc(version)} · ${esc(T.footerGenerated)} ${esc(generated)} · <a href="${esc(origin)}/api/v1/index.json">index.json</a> · <a href="${esc(origin)}/">BSS Index</a></p>
  </footer>
</div>
</body>
</html>
`;
}

module.exports = { buildDocsHtml, ENDPOINT_TRANSLATIONS_RU };
