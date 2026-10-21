# BSS Index — technical + SEO audit

- **Live site:** `https://bss-index.vercel.app`
- **Repo:** `C:\Users\Пользователь\OneDrive\Desktop\Новая папка (7)`
- **Date:** 2026-10-21
- **Method:** every number below was measured. Commands are given so each can be re-run.

> **Not checked (environment limits)**
> - `google.com` / `bing.com` are network-blocked here → no Google Search Console, Bing Webmaster, PageSpeed Insights, CrUX or Rich Results Test data. All SEO judgements are based on the raw HTML/headers I fetched plus a headless Chrome render, not on how Google actually indexed the site.
> - Lighthouse/WebPageTest were not run (no `lighthouse` binary, no throttling harness). Performance numbers are raw transfer sizes from `performance.getEntriesByType('resource')` and byte counts from `fetch` + `zlib`, plus one cold-load run in headless Chromium.
> - The Discord bot was not run (needs `bot/.env` with a real token); bot findings are static-code findings only.
> - The `scripts/check-*.mjs` / `scripts/verify-*.cjs` helper scripts were read but not executed (most of them hit the live site and the competitor).

---

## 1. Live site measurements

All sizes: `raw` = bytes on the wire after the server's content-encoding, `decoded` = after decompression. `gzip`/`brotli` were recomputed locally with `zlib` at level 9 / quality 11.

**Method**
```bash
node scratch/audit/fetch.mjs      # HEAD-ish GET of each URL, sizes + headers
node scratch/audit/http.mjs       # status/redirect/method probes
node scratch/audit/assets.mjs     # bundle + static asset sizes
node scratch/audit/seo.mjs        # per-page SEO tag parse
node scratch/audit/sitemap-parse.mjs
node scratch/audit/crawl.mjs      # internal link graph, 3 levels
node scratch/audit/contrast.mjs   # WCAG ratios
```

### 1.1 Page payloads

| URL | status | raw | gzip | brotli | decoded | TTFB (fetch) |
|---|---|---|---|---|---|---|
| `/` | 200 | 2,844 | 1,037 | 754 | 2,844 | 739 ms (cold), 327 ms (warm) |
| `/items/` | 200 | 30,294 | 6,506 | 5,511 | 30,294 | 109 ms |
| `/ru/items/` | 200 | 32,500 | 7,326 | 6,099 | 32,500 | 297 ms |
| `/ru/` | 200 | 14,876 | — | — | 14,876 | 80 ms |
| `/item/star-cub` | 200 | 16,101 | — | — | 16,101 | 252 ms |
| `/ru/item/star-cub` | 200 | 16,774 | — | — | 16,774 | 286 ms |
| `/api/v1/docs.html` | 200 | 24,318 | 6,100 | 4,964 | 24,318 | 144 ms |
| `/data/items.json` | 200 | 384,096 | 31,359 | 23,986 | 384,096 | 328 ms |
| `/api/v1/items.json` | 200 | 161,883 | 14,472 | 11,780 | 161,883 | 309 ms |
| `/api/v1/search-index.json` | 200 | 42,191 | — | — | 42,191 | 274 ms |
| `/api/v1/openapi.json` | 200 | 33,389 | — | — | 33,389 | 265 ms |
| `/api/v1/categories.json` | 200 | 4,470 | — | — | 4,470 | 300 ms |
| `/api/v1/changes.json` | 200 | 3,603 | — | — | 3,603 | 84 ms |
| `/api/v1/stats.json` | 200 | 200 | — | — | 200 | 83 ms |
| `/sitemap.xml` | 200 | 85,615 | 4,078 | 3,534 | 85,615 | 322 ms |
| `/robots.txt` | 200 | 74 | — | — | 74 | 106 ms |
| `/404.html` | 200 | 3,144 | 1,223 | 896 | 3,144 | 86 ms |
| `/w/` (widget index) | 200 | 86,910→86,668 | — | — | — | 457 ms |

### 1.2 Bundle + static assets

| Asset | raw | gzip | brotli | decoded in browser |
|---|---|---|---|---|
| `/assets/index-CeGoOVQ9.js` | 677,131 | 189,246 | 156,874 | 677,131 |
| `/assets/index-m1jlCiaC.css` | 92,506 | 13,303 | 10,675 | 92,506 |
| **`/logo.png`** | **874,051** | — | — | 874,051 |
| `/apple-touch-icon.png` | 874,051 | — | — | — |
| `/favicon.png` | 874,051 | — | — | — |
| `/bee-logo.png` | 401,508 | — | — | — |
| `/avatar.jpg` | 371,076 | — | — | — |
| `/favicon.ico` | 35,982 | — | — | 35,982 |
| `/icons.svg` | 5,031 | 2,104 | 1,886 | — |

`logo.png`, `apple-touch-icon.png` and `favicon.png` are **byte-identical 874,051-byte files** (2.6 MB of duplicated image on disk and over the wire).

### 1.3 Cold-load totals (headless Chromium, same-origin only)

`node scratch/audit/` → Playwright `performance.getEntriesByType('resource')`:

**Homepage `/`**
| Resource | transfer | decoded |
|---|---|---|
| HTML (doc) | 1,366 | 2,844 |
| JS bundle | 195,212 | 677,131 |
| CSS | 13,768 | 92,506 |
| `data/items.json` | 33,580 | 384,096 |
| **`logo.png`** | **874,351** | **874,051** |
| `favicon.ico` | 36,162 | 35,982 |
| **Total** | **1,154,439 (1.15 MB)** | **2,066,610 (2.07 MB)** |

External on top: Google Fonts CSS 1,136 B + Inter woff2 **29,636 + 72,920 = 102,556 B**; gtag.js; 4 × `bssmvalues.com` webp.
**FCP 992 ms.** `logo.png` alone is **75.7 %** of the same-origin payload.

**Item page `/item/star-cub`** (after JS runs): **11,222 DOM nodes**, **291 `<img>` elements**, 32,141 characters of text, document height 49,367 px.

### 1.4 HTTP behaviour (`scratch/audit/http.mjs`)

| Request | Result |
|---|---|
| `GET /items` vs `GET /items/` | **both 200**, byte-identical (30,294 B). No redirect. |
| `GET /item/star-cub` vs `GET /item/star-cub/` | **both 200**, byte-identical (16,101 B). No redirect. |
| `GET /ru/item/star-cub` vs `.../` | **both 200**, byte-identical. |
| `GET /nonexistent-page-xyz` | **404** + 3,144 B `404.html` body ✓ |
| `GET /nonexistent-page-xyz/` | 404 ✓ |
| `HEAD /`, `/data/items.json`, `/item/star-cub` | 200, empty body ✓ |
| `HEAD /nonexistent-page-xyz` | 404 ✓ |
| `GET /?utm_source=audit&x=1` | 200, same body, no canonical change ✓ |
| `GET /data/items.json?x=1` | 200 ✓ |
| `GET /Item/Star-Cub`, `/ITEM/STAR-CUB`, `/item/STAR-CUB` | **404** (case-sensitive, no redirect) |
| `GET /demo/index.html`, `/demo/app.js`, `/demo/style.css`, `/demo/` | **404** — but these files exist in `public/demo/` in the repo and in the local `dist/`. See §5.5. |
| `GET /w/demo.html` | 404 ✓ |

**Cache-Control — every static file is `public, max-age=0, must-revalidate`:**
```
/                     public, max-age=0, must-revalidate
/assets/*.js          public, max-age=0, must-revalidate
/assets/*.css         public, max-age=0, must-revalidate
/data/items.json      public, max-age=0, must-revalidate
/api/v1/items.json    public, max-age=0, must-revalidate
/api/v1/search?q=…    public, max-age=300          ← the only exception
```
So the 195 KB JS bundle, the 92 KB CSS and the 384 KB JSON are revalidated on **every single navigation**, even though `/assets/*` is content-hashed and can never change.

Other headers: `strict-transport-security: max-age=63072000; includeSubDomains; preload`, `x-vercel-cache: HIT|MISS`, `server: Vercel`, `etag: W/"…"`. No `content-security-policy` on the app pages (the widget pages do set `frame-ancestors *`).

### 1.5 Sitemap (`scratch/audit/sitemap-parse.mjs`)

```
url entries: 664 | unique <loc>: 664 | duplicates: 0
entries WITH lastmod: 0 / 664  (0.0%)
entries with changefreq: 664 | with priority: 664
sitemapindex present: false
prefix buckets: { '(root)': 1, ru: 332, item: 330, items: 1 }
```
- 664 = 1 root + 1 `/ru/` + 330 `/item/<slug>` + 330 `/ru/item/<slug>` + 2 `/items/` + `/ru/items/`.
- **Zero `<lastmod>`** elements.
- Every `<changefreq>` is `daily` — even though `scripts/prerender.cjs:748` pushes `changefreq: 'weekly'` for item pages, `buildSitemap` (line 589) hard-codes `daily` and ignores the field.
- Sitemap URLs have **no trailing slash** (`/item/star-cub`); the `<a href>` links inside the generated HTML **do** (`/item/bee-cub/`). See §2.5.
- `robots.txt` (74 B) is correct and points at the sitemap:
  ```
  User-agent: *
  Allow: /

  Sitemap: https://bss-index.vercel.app/sitemap.xml
  ```

### 1.6 Internal link graph (`scratch/audit/crawl.mjs`, raw HTML, no JS)

| Seed | item pages @1 click | @2 | @3 | total pages crawled |
|---|---|---|---|---|
| `/` | **0** | **0** | **0** | **1** |
| `/items/` | 330 | 330 | 530 | 1,192 |
| `/item/star-cub` | 13 | 37 | 44 | 95 |

**The homepage has zero internal links in its HTML.** A crawler that does not execute JavaScript reaches exactly one page and stops.

After JS runs, the homepage DOM contains **4 internal links** (`/items/`, `/api/v1/docs.html`, `/api/v1/docs.ru.html`, `/api/index.json`) — still **zero links to any item page**.

---

## 2. SEO findings (ordered by severity)

### 2.1 CRITICAL — `/` is an empty SPA shell; Google gets no content and no links
`index.html` is the whole document:
```html
<body><div id="app"></div></body>
```
Measured on the raw HTML of `/`:
- visible text length: **72 characters** (just the loading-spinner label "BSS Index")
- `<h1>`–`<h6>`: **0**
- JSON-LD blocks: **0**
- `<img>`: 0, `<a href>`: **0**
- initial `<title>`/description/canonical/hreflang/OG are present and correct (`BSS Index — Sticker, Voucher & Beequip Values in Bee Swarm Simulator`, 72 chars; description 147 chars; canonical `https://bss-index.vercel.app/`; hreflang `en`/`ru`/`x-default`; `og:*` + `twitter:card=summary_large_image`).

**Why it matters:** the homepage is the strongest URL on the site and it currently carries no indexable body, no structured data and no crawlable links. `scripts/prerender.cjs` already builds a static `/ru/` landing page (`buildRussianLanding`, line 595) — the English root was never given the same treatment.

**Fix:** run the root through the same prerender path — emit a static `/index.html` with an `<h1>`, a real paragraph, a table of the top ~24 items (as `/ru/` does), `ItemList`/`WebSite` JSON-LD, and a `<nav>` of category links. 330-item catalogue is already at `/items/`.

### 2.2 CRITICAL — every item page also renders the entire 330-item catalogue below its own content
`src/App.tsx:115-119` sets `activeTab='catalog'` on `/item/<slug>` paths, so React mounts the **whole catalogue** into the `#app` div that `scripts/prerender.cjs` places *after* the prerendered block (line 673).

Measured on `/item/star-cub` after JS:
- **11,222 DOM nodes**, **291 `<img>`**, **32,141 chars of text**, 49,367 px tall
- 293 headings: `H1 STAR CUB` (prerendered) → `H2 STATS` → `H2 PRICE HISTORY` → `H2 RELATED ITEMS` → then **~290 `H3`** from the catalogue cards

**Why it matters:** every one of the 660 item URLs ends up with essentially the same DOM — 330 item cards — below a ~1,500-character item-specific block. That is textbook duplicate content spread over 660 URLs, and it burns crawl budget for nothing. It also means the item-specific text is a rounding error in the page's keyword profile.

**Fix:** on `/item/<slug>` and `/ru/item/<slug>`, don't mount the catalogue. Either render the SPA into a collapsed container, or drop the `#app` div on item pages entirely and let the prerendered block *be* the page (the "Open in the trade calculator" CTA already points at `#app`; point it at `/` instead).

### 2.3 CRITICAL — the homepage links to zero item pages
The "POPULAR STICKERS" cards are `<div onClick={...}>` (`src/components/Home.tsx:293-296`) and the floating hero stickers are `<motion.div onClick>` (`Home.tsx:137-196`) — neither is an `<a href>`. The only 4 internal links on the rendered homepage are `/items/`, `/api/v1/docs.html`, `/api/v1/docs.ru.html`, `/api/index.json`.

**Fix:** make both the hero stickers and the popular-item cards real `<a href="/item/<slug>/">` links. One line each, and it hands link equity to 330 pages from the strongest URL on the site.

### 2.4 IMPORTANT — sitemap has no `lastmod`, and `changefreq` is a lie
- 0/664 entries carry `<lastmod>`. Google explicitly asks for it so it can prioritise re-crawls.
- `scripts/prerender.cjs:587-592` writes `<changefreq>daily</changefreq>` for every URL and **ignores the `changefreq` value it was passed** (`:748` pushes `'weekly'` for item pages, `:842` `'weekly'` for `/items/`).

**Fix:** in `buildSitemap`, emit `u.changefreq` instead of the literal, and add `<lastmod>` from a build-time date (the price data changes daily, so one ISO date per build is accurate for all URLs).

### 2.5 IMPORTANT — three different canonical URL forms for the same item page
| Source | URL form |
|---|---|
| sitemap + the item page's own `<link rel="canonical">` | `/item/star-cub` (no slash) |
| `<a href>` inside `/items/`, `/ru/items/`, `/ru/` and every item page's "Related items" | `/item/bee-cub/` (slash) |
| `/api/v1/items.json` → `url` field, `/api/v1/search` → `url`, `/w/<slug>/` → `canonical` | `/item/star-cub/` (slash) |

Both forms return **200 with identical bytes** (§1.4), so 660 pages have two live duplicates and the third URL form (from the API and the widgets) points at the *non-canonical* one.

**Fix:** pick `/item/<slug>/` (or without) and make `scripts/prerender.cjs:699/711`, `:736`, `:773`, `:857` and `api/v1/search.js:156` all emit the same string; add a `vercel.json` redirect from the other form to the canonical one.

### 2.6 IMPORTANT — JSON-LD `priceCurrency: "BSS"` is not a valid ISO-4217 code
`scripts/prerender.cjs:174` hard-codes `priceCurrency: 'BSS'`. Google's Product rich-result validator requires a real currency code; an invalid one makes the `offers` block ineligible for price rich results.

The JSON-LD itself **parses cleanly** (verified with `JSON.parse` on 3 live pages — `scratch/audit/jsonld.mjs`): `@type: Product`, `brand`, `AggregateOffer` with `lowPrice`/`highPrice`/`offerCount`/`availability`, plus `additionalProperty` for demand. Structure is fine; only the currency is wrong.

**Fix:** use `"USD"` (or whatever the real currency is) — the `★` symbol is decorative and can stay in `description`.

### 2.7 IMPORTANT — `/items/` and `/ru/items/` have no structured data, no `og:image`, no Twitter tags, no hreflang
Measured on `/items/`:
- JSON-LD blocks: **0** (no `ItemList` — yet the page is literally a list of 330 items)
- `og:image`: **absent**; `twitter:*`: **absent** (only `twitter:card` exists on `/`, and not at all here)
- hreflang: **0 links** — `/items/` and `/ru/items/` do not reference each other
- `robots`: `index, follow` ✓, canonical ✓, title (32 chars) ✓, description (92 chars) ✓, `h1` ×1 + `h2` ×18 ✓

**Fix:** add `ItemList` JSON-LD (name + `ListItem` with `url` + `position`), copy the `og:image`/`twitter:*` block from the item pages, and add the `en`/`ru`/`x-default` hreflang triple.

### 2.8 IMPORTANT — `/api/v1/docs.html` has no OG/Twitter tags and no JSON-LD; heading order breaks
Measured: `og:*` = none, `twitter:*` = none, JSON-LD = 0 blocks, heading order violation **h2 → h4** (`GET /api/v1/items/{slug}.json` etc. are `<h4 class="ep-title">` directly under `<h2>Endpoints</h2>`).

**Fix:** add the standard OG/Twitter block, add `TechArticle`/`WebPage` JSON-LD, and change `h4.ep-title` to `h3`.

### 2.9 IMPORTANT — `og:image` on the homepage points at a different origin
- `/` → `https://happy-g0ose.github.io/bss-index/logo.png` (GitHub Pages, not the canonical domain)
- `/item/<slug>` → `https://bssmvalues.com/images/<Name>.webp` ✓ (right image)
- `/ru/` → `https://bss-index.vercel.app/logo.png` ✓
- `/w/` → `https://bss-index.vercel.app/logo.png` ✓

**Fix:** use the site's own `/logo.png` (absolute URL) for `/`, or a purpose-built 1200×630 OG image.

### 2.10 IMPORTANT — the homepage shows hard-coded, stale prices
`src/components/Home.tsx:15-56` hard-codes 4 items with static values:

| Homepage shows | Real value (`/items/`, `bot/items.json`) |
|---|---|
| Stick Cub **23.50** | **15.5** |
| Robo Cub **15.50** | **9.25** |
| Star Cub **10.25** | **9.75** |
| Leo Star Sign 1.00 | 1.0 ✓ |

Confirmed live: the rendered homepage contains `23.50 Val` for Stick Cub while `/items/` lists `15.5★`.

**Why it matters:** these are the first numbers a visitor sees, and if Google renders JS it will index prices that contradict the rest of the site (and the JSON-LD). Also note `Home.tsx:292` renders the module-level `floatingStickers` constant while `Home.tsx:137` renders the `stickers` **state** — so clicking a hero sticker updates one section and not the other.

**Fix:** derive the four cards from `useItems()` (pick by id), and delete the constant.

### 2.11 MINOR — `og:locale:alternate` missing; `keywords` meta is ignored
`/` has `og:locale=en_US` but no `og:locale:alternate=ru_RU`. The `<meta name="keywords">` tag on `/` and on item pages has been ignored by every major engine since 2009 — harmless, but it is 1 KB of dead weight per page in the head.

### 2.12 MINOR — `/w/` widget section is a crawl silo
`/w/` has 331 distinct `href`s, all relative (`./star-cub/` etc.) and **0** pointing at `/item/…`. `/w/<slug>/` declares `canonical` → `https://bss-index.vercel.app/item/star-cub/` (the trailing-slash variant, see §2.5). The widget pages themselves have good titles/descriptions/OG but no JSON-LD and no `robots` meta.

---

## 3. Performance findings (biggest wins first)

### 3.1 `logo.png` is 874 KB and is 75.7 % of the homepage payload — **save ~870 KB**
Measured: 874,351 B transfer on every page load (it's in the sticky navbar, `src/components/Navbar.tsx:27-31`). It is rendered at `h-9 w-9` (36×36 px). The same 874,051-byte file is also shipped as `favicon.png` and `apple-touch-icon.png` (2.6 MB total on disk).

**Fix:** ship a 64×64 (or 96×96) PNG/WebP/SVG of the logo (≈5 KB) as `/logo.png`, generate a separate 180×180 `apple-touch-icon.png` (≈8 KB) and a 32 KB `favicon.ico`. **Saves ≈ 870 KB (75 %) of the homepage transfer and 2.6 MB of repository/deploy weight.**

### 3.2 `html2canvas` is statically imported into the main bundle — **save ~45–50 KB brotli (≈25 % of the JS)**
`src/components/TradeCalculator.tsx:5` → `import html2canvas from 'html2canvas'`, and `TradeCalculator` is statically imported by `src/App.tsx:9`. `node_modules/html2canvas/dist/html2canvas.min.js` is **198,689 bytes** before minification. The built bundle is 677,131 B raw / 195,212 B transferred.

**Fix:** `const { default: html2canvas } = await import('html2canvas');` inside `handleCopyImage` (line 127). Vite will split it into a separate chunk loaded only when the user clicks "Copy screenshot". **Saves ~150 KB raw / ~45 KB brotli off the critical path of every page.**

### 3.3 `data/items.json` (384 KB decoded) is fetched on every page, including pages that need 4 items
Measured 33,580 B transferred on `/`. The homepage shows 4 stickers; the catalogue needs all 330.

**Fix:** (a) serve `/data/items.json` with `Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800` so repeat visits skip the revalidation round trip; (b) split into `/data/home.json` (4 items) + `/data/items.json` (the rest) so the homepage doesn't pull the full set. (c) The JSON also carries `description`, `historicalPrices` (21 points × 330 items) and `beequipData` — the homepage needs none of it.

### 3.4 Nothing is cached in the browser — **save ~320 KB of revalidation per navigation**
Every response is `public, max-age=0, must-revalidate` (§1.4), including the content-hashed `/assets/index-*.js` and `/assets/index-*.css`, which can never change.

**Fix** in `vercel.json`:
```json
{ "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
{ "source": "/data/(.*)",    "headers": [{ "key": "Cache-Control", "value": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" }] }
```
**Saves a conditional request per asset on every navigation; with `immutable` the 195 KB JS and 92 KB CSS are never re-fetched at all.**

### 3.5 Item pages load the whole catalogue (see §2.2) — **save ~280 image requests and ~10,000 DOM nodes per item page**
Fixing §2.2 removes the catalogue render, the 291 `<img>` elements and the DOM bloat from all 660 item pages.

### 3.6 The CSS bundle depends on files outside `src/` — **reproducibility + 8.4 % CSS bloat**
`src/style.css:1` is just `@import "tailwindcss";` with **no `@source` directive**, so Tailwind v4 auto-detects sources across the whole project.

Verified experiment (`node scratch/audit/repro.mjs` + a controlled `vite build`):
| Working tree | CSS output | JS output |
|---|---|---|
| with `public/demo/` + `scratch/` present | `index-CN-ljGGr.css` **100,317 B** | `index-D45X714A.js` 677,131 B |
| with both moved out | `index-DWMDQscM.css` **92,509 B** | `index-7UXHnUfJ.js` 677,131 B |
| deployed (live) | `index-m1jlCiaC.css` 92,506 B | `index-CeGoOVQ9.js` 677,131 B |

The 100,317 B build has **92 CSS selectors the 92,509 B build does not** (`collapse`, `container`, `inline-grid`, `table-cell`, `flow-root`, `resize`, `gap-0`, `border-amber-400`, `border-cyan-500`, `border-rose-500`, …) — they come from class-name strings inside `public/demo/app.js`, `scripts/lib/category-styles.cjs` and `public/data/items.json` (which stores `badgeColor`/`borderColor` as Tailwind class strings).

**Why it matters:** the shipped CSS hash — and therefore the cache key for every visitor — changes depending on which untracked files happen to be in the working tree. A stray `.mjs` in `scratch/` silently invalidates the CSS cache for the whole site.

**Fix:** pin the sources explicitly:
```css
@import "tailwindcss" source(none);
@source "./**/*.{ts,tsx}";
```
**Saves 7,808 B (8.4 %) of CSS and makes the asset hash deterministic.**

### 3.7 Google Fonts: 102 KB of woff2 from a third party
Measured on `/`: `fonts.googleapis.com/css2` 1,136 B + `UcCo3FwrK3iLTcvmYwYL8g.woff2` 29,636 B + `UcCo3FwrK3iLTcviYwY.woff2` 72,920 B. The `preconnect` hints are already there. Self-hosting Inter (subset) or using `font-display: swap` with a system fallback would cut this to ~40 KB and remove a third-party dependency from the critical path.

### 3.8 330 × `motion layout` + `AnimatePresence mode="popLayout"` on the catalogue
`src/App.tsx:436-466` wraps all 330 cards in a `motion.div layout` grid, and every card is a `motion.div layout` with `whileHover`. Framer Motion's `layout` measures and animates on every filter/sort change — with 330 cards this is the main cause of sluggishness in the catalogue tab. `layout` on the grid container plus `layout` on every card is redundant.

---

## 4. Accessibility and mobile findings

### 4.1 CRITICAL — the light theme is unreadable: amber text is 1.53:1 on the background
Computed styles read live on `/item/star-cub` with `html.light` applied (background `#f4f5f7`):

| Element | Computed colour | Ratio | Verdict |
|---|---|---|---|
| `.tag` ("CUB SKINS") | `rgb(251,191,36)` | **1.53:1** | FAIL |
| `.card h2` ("STATS") | `rgb(251,191,36)` | **1.53:1** | FAIL |
| `thead th` ("DATE") | `rgb(251,191,36)` | **1.53:1** | FAIL |
| `.stat-k` ("VALUE") | `rgb(251,191,36)` | **1.53:1** | FAIL |
| `.stat-v.price` ("9.75★") | `rgb(251,191,36)` | **1.53:1** | FAIL |
| `.cta a.ghost` ("ALL ITEMS") | `rgb(212,212,216)` | **~1.30:1** | FAIL |
| `.stat-n` ("9.5 – 10★") | `rgb(161,161,170)` | **2.35:1** | FAIL |
| `.lead` | `rgb(82,82,91)` | 7.09:1 | AAA ✓ |

`src/style.css:111-298` overrides the neutral scale for `html.light` but **never overrides `text-amber-400` / `text-amber-500`**, so every accent-coloured label, price, tag and heading becomes invisible in the light theme. The same applies to the SPA's `text-amber-400` (measured `oklch(0.828 0.189 84.429)` = `#fbbf24` on `#f4f5f7`).

**Fix:** add `html.light .text-amber-400 { color: #b45309 !important; }` (and `-500`, `-300`, `-600`) to `src/style.css`, plus the same for the prerender stylesheet's `#fbbf24` usages (`.tag`, `.card h2`, `thead th`, `.stat-k`, `.stat-v.price`, `.crumbs a`, `.upd`, `.relitem span`).

### 4.2 IMPORTANT — dark theme misses AA on the small labels
| Colour | Ratio | Used for |
|---|---|---|
| `#737373` (`text-neutral-500`) on `#0b0f19` | **4.04:1** | 10 px "VALUE / DEMAND / STABILITY" labels (`ItemCard.tsx:230,243,249`), search placeholder |
| `#525252` (`text-neutral-600`) on `#0b0f19` | **2.45:1** | loading-spinner label (`App.tsx:36`), CommandMenu empty-state text |
| `#71717a` (`--faint`) on `#0b0f19` | **3.96:1** | prerendered `.foot`, `.stat-n` |
| `#a1a1aa` (`--faint`) on `#f4f5f7` | **2.35:1** | prerendered `.foot` / `.stat-n` in light mode |
| `#71717a` (`text-neutral-400` light override) on `#f4f5f7` | 4.43:1 | light-theme secondary text |

All fail WCAG 2.1 AA (4.5:1) for normal-size text.

### 4.3 CRITICAL — `prefers-reduced-motion` is not supported at all, and the "Reduce Motion" switch is a no-op
- The built CSS (92,506 B, downloaded) contains **0 occurrences** of `prefers-reduced-motion`.
- The built JS contains the string, but only inside framer-motion's own internals — `src/` has **0** references to `prefers-reduced-motion`.
- `src/App.tsx:85-87` reads `bss_motion` into `reduceMotion` and `src/App.tsx:559` passes it to `SettingsModal` — and **nothing ever reads it**. `src/components/SettingsModal.tsx:177-204` renders a working `role="switch"` toggle that persists to localStorage and changes nothing.
- Meanwhile `src/components/Home.tsx:148-159` runs **4 infinite `framer-motion` loops** (`repeat: Infinity`) and `ItemCard` animates every card entrance, `whileHover` and `whileTap`.

**Fix:** add to `src/style.css`
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```
and gate the framer-motion loops on `useReducedMotion()` from framer-motion (or on the existing `reduceMotion` state), and wire `reduceMotion` to a `<MotionConfig reducedMotion="always">` wrapper.

### 4.4 IMPORTANT — the "Weekly change badges" switch is also a no-op
`src/App.tsx:89-91` reads `bss_badges` into `showWeekBadges`; `src/App.tsx:561` passes it to `SettingsModal`; `src/App.tsx:443-452` renders `<ItemCard …/>` **without** the `showWeekBadge` prop. `ItemCard.tsx:21` accepts `showWeekBadge = true` and `ItemCard.tsx:117` uses it — so the prop is never `false`. Toggling the switch has no effect on any card.

**Fix:** `<ItemCard … showWeekBadge={showWeekBadges} />`.

### 4.5 IMPORTANT — icon-only buttons with no accessible name
Confirmed by DOM inspection (`icon-only w/o label` counter) and by reading the JSX:

| File | Line | Button |
|---|---|---|
| `src/components/CommandMenu.tsx` | 141 | `X` close |
| `src/components/SettingsModal.tsx` | 94 | `X` close |
| `src/components/ItemPickerModal.tsx` | 87, 102, 180 | `ChevronLeft` back, `X` close ×2 |
| `src/components/TradeCalculator.tsx` | 274, 346 | `X` remove-from-side |
| `src/components/ItemDetailModal.tsx` | — | `X` close |
| `src/App.tsx` | 598 | toast close `X` |

**Fix:** `aria-label={t('common.close', lang)}` on each.

### 4.6 IMPORTANT — mouse-only interactive elements
- `src/components/Navbar.tsx:20-45` — the logo/home button is a `<div onClick>`, not focusable, no `role`, no `tabIndex`. Keyboard and screen-reader users cannot activate it.
- `src/components/Home.tsx:137-196` — the four floating hero stickers are `<motion.div onClick>`.
- `src/components/Home.tsx:293-296` — the four popular-sticker cards are `<div onClick>`.
- `src/components/App.tsx:520` — "happy goose" (author) is a `<span onClick>`.

**Fix:** use `<a href>` / `<button type="button">`.

### 4.7 IMPORTANT — heading structure
- Homepage (rendered): `H1 → H2 → H3 → H2 → **H4**` — the "POPULAR STICKERS" section uses `<h4>` (`Home.tsx:315`) directly under an `<h2>`.
- Catalogue tab in the SPA: **no `<h1>` at all**; 330 `<h3>` cards (`ItemCard.tsx:213`) with no parent `<h2>`.
- Item page (rendered): the prerendered block is `H1 → H2 ×3 → H3 ×12`, then the SPA adds ~290 `<h3>` with no `<h2>` between.
- `/api/v1/docs.html`: `h2 → h4` skip.

**Fix:** add a visually-hidden `<h1>` to the catalogue/calculator/beequips tabs, use `<h3>` (not `<h4>`) for the popular stickers, and give the catalogue grid a real `<h2>`.

### 4.8 MINOR — `<html lang>` never updates when the user switches language
`src/App.tsx:68-71` `setLang()` writes `localStorage` and React state but never touches `document.documentElement.lang`. The prerendered pages get it right (`<html lang="ru">` on `/ru/…`), but after hydration a user switching to Russian still has `<html lang="en">`, so screen readers pronounce Russian with an English voice and Google sees the wrong language.

**Fix:** `document.documentElement.lang = newLang;` in `setLang`.

### 4.9 Things that are already correct (no action)
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` present on `/`, `/items/`, `/ru/items/`, `/api/v1/docs.html`, `/404.html` ✓
- `<html lang="…">` present on every page ✓
- **0 images without `alt`** out of 291 on the item page and 9 on the homepage ✓
- The catalogue search input has an associated `placeholder` ✓
- The settings switches use the correct `role="switch"` + `aria-checked` pattern ✓
- `404.html` carries `<meta name="robots" content="noindex">` ✓

---

## 5. Code findings

### 5.1 CRITICAL

**5.1.1 — `src/App.tsx:289` — `<ErrorBoundary fallback={null}>` blanks the whole page on any render error**
Verified live by injecting a render-time throw (`Number.prototype.toFixed`) and clicking into the catalogue:
```
console: "ErrorBoundary caught an error: Error: AUDIT_TEST_RENDER_ERROR"
DOM:     hasMain: false,  hasErrorText: false,  hasErrorPre: false,  bodyLen: 287
```
The inner boundary **does** catch the error, but because its fallback is `null` it renders nothing — the entire `<main>` (tab bar + content) disappears and the user is left with just the navbar and footer, no message and no way to recover. The outer boundary (`App.tsx:266`) never sees the error because the inner one already handled it.

**Fix:** remove the inner `fallback={null}` (or give it the default error UI). The outer boundary already provides a readable error page with Reload / Back-to-home.

**5.1.2 — `src/components/Home.tsx:15-56` — hard-coded, stale prices in the hero**
Already covered in §2.10. Also `Home.tsx:292` renders the module constant instead of the `stickers` state used at `:137`, so the two "popular stickers" sections can disagree.

**5.1.3 — `src/components/ItemDetailModal.tsx:49-56` — the sparkline produces `NaN` coordinates**
```ts
const minVal = Math.min(...prices);
const x = padding + (idx * (width - padding * 2)) / (prices.length - 1);
```
With a single history point `prices.length - 1 === 0` → `x = NaN`. **29 of 330 items have exactly one history point** (verified against `public/data/items.json`: `white-hive-skin-0`, `wavy-festive-hive-skin-0`, `porcelain-dipper-0`, `golden-rake-0`, `festive-pufferfish-0`, …).
Confirmed live on `/item/white-hive-skin` after opening the modal:
```
path M NaN 130.0 L NaN 150 L NaN 150 Z
path M NaN 130.0
circle NaN
```
**Fix:** `if (prices.length < 2) return null;` and render a "no history" placeholder.

**5.1.4 — `src/components/ItemCard.tsx:91-115` vs `api/v1/search.js:98-131` — two different "7-day change" algorithms that disagree for 178 of 330 items**
- `ItemCard.getWeekChange()` picks the **nearest snapshot** to exactly 7 days ago (no interpolation) → what the catalogue badge and the widget show.
- `api/v1/search.js change7d()` (and `scripts/generate-api-v1.cjs`) **interpolate** the price at the 7-day mark → what `/api/v1/items.json` returns.

Measured against the live API (`scratch/audit/change7d.mjs`):

| Item | site badge | API `change7d` |
|---|---|---|
| Whistle | **+180 %** | **+12.7 %** |
| Thumbtack | +66.7 % | +3.5 % |
| Charm Bracelet | −43.1 % | −9.6 % |
| Elf Cap | −22.7 % | −6.0 % |
| Candy Ring | −24.1 % | −3.0 % |
| Star Cub | −4.9 % | −0.4 % |

**178/330 items differ by >0.5 pp; 154/330 differ by >5 pp.** The website and its own public API publish contradictory numbers for the same item on the same day.

**Fix:** extract one implementation (the interpolated one is the better definition and is what the docs describe) into a shared module and use it in `ItemCard.tsx`, `scripts/generate-widgets.cjs`, `scripts/generate-api-v1.cjs` and `api/v1/search.js`.

**5.1.5 — `bot/index.js` — no `unhandledRejection` / `uncaughtException` handler, and `main()` is called without a `.catch()`**
`bot/index.js:1313` → `main();` and `bot/index.js:1310` → `client.login(token);` (promise not awaited, not caught). `bot/index.js:1219` registers an **async** `messageCreate` handler whose body can throw (`getConfig()`, `recordHit()`), and `bot/index.js:1240/1256` swallow errors with `.catch(() => null)` without logging.
Discord.js v14 explicitly requires `process.on('uncaughtException')` and `process.on('unhandledRejection')`; without them one unhandled rejection kills the bot with a raw stack trace.

**Fix:** add the two handlers at the top of `bot/index.js` (log + graceful `client.destroy()`), `await client.login(token)` inside the existing `try`, and `.catch()` the `main()` call.

### 5.2 IMPORTANT

**5.2.1 — `src/data/itemsStore.tsx:31` — a malformed `items.json` produces an infinite spinner instead of the error page**
```ts
.then((data: BSSItem[]) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
```
If the JSON parses but is an object (or `{}`), `items` stays `[]` and `failed` stays `false` → `src/App.tsx:31` renders the loading spinner forever. Only a network error or invalid JSON reaches the error page.

**Fix:** `if (!Array.isArray(data)) throw new Error('items.json is not an array');` so the `.catch` sets `failed`.

*(Verified separately: when the fetch genuinely fails, the site **does** degrade correctly — `scratch/` browser test with `/data/items.json` aborted showed the "Could not load the price list" page with an `<h1>` and a Reload button.)*

**5.2.2 — `src/main.tsx:7-13` — `ItemsProvider` is outside any `ErrorBoundary`**
`ReactDOM.createRoot(...).render(<React.StrictMode><ItemsProvider><App /></ItemsProvider></React.StrictMode>)`. The only boundary lives inside `BssApp` (`App.tsx:266`), so a throw in `ItemsProvider` itself or in `App`'s own render (before `BssApp` mounts) produces a **blank white page** with no error UI.

**Fix:** wrap `<ItemsProvider>` in `<ErrorBoundary>` in `main.tsx`.

**5.2.3 — `src/components/TradeCalculator.tsx:5` — static `html2canvas` import**
See §3.2. Fix: dynamic `import()`.

**5.2.4 — `src/components/TradeCalculator.tsx:87` — stray unbalanced parenthesis in user-visible output**
```ts
diffText: `${t('calc.verdict.fairMsg', lang)} ${formattedDiff})`,
```
Renders e.g. `Fair trade +1.2%)`. **Fix:** remove the `)`.

**5.2.5 — `src/components/TradeCalculator.tsx:117, 142, 152` and `src/components/CommandMenu.tsx:54` — timers are never cleared**
`setTimeout(() => setCopiedLink(false), 2000)` etc. are not stored in a ref and not cleared on unmount → the callback fires after the component is gone (React 18+ no longer warns, but it is a leak and can clobber state on a remount).

**Fix:** keep the timeout id in a `useRef` and clear it in the effect cleanup.

**5.2.6 — `src/components/CommandMenu.tsx:101-120` — the keydown effect re-registers a listener on every render**
The dependency array includes `allResults`, which is a **new array on every render** (`:99`). The effect therefore removes and re-adds the `window` keydown listener on every keystroke.

**Fix:** memoise `allResults` with `useMemo` keyed on `filteredItems`/`filteredBeequips`, or hold the results in a ref.

**5.2.7 — `src/components/ItemCard.tsx:22-30` — `setState` on every `mousemove`**
`handleMouseMove` calls `setCoords(...)` on every pointer move over a card. With 330 cards in the catalogue grid this re-renders the card (and its `motion.div`) on every pixel of movement.

**Fix:** move the glow into a CSS custom property updated via `ref.current.style.setProperty(...)` (no React state), or throttle with `requestAnimationFrame`.

**5.2.8 — `src/components/ItemPickerModal.tsx:63` and `src/components/ItemDetailModal.tsx:41` — `if (!isOpen) return null` placed *before* `<AnimatePresence>`**
The exit animation can never play (the component is already unmounted), so the `AnimatePresence`/`motion.div exit` props are dead code.

**Fix:** move the early return *inside* the `AnimatePresence` so the exit transition runs.

**5.2.9 — Three components fight over `document.body.style.overflow`**
`src/components/SettingsModal.tsx:46-55`, `src/components/ItemPickerModal.tsx:33-42`, `src/components/ItemDetailModal.tsx:21-30` each independently set `overflow = 'hidden'` when open and `'unset'` when closed (and again in the cleanup). Opening the settings modal while the item-detail modal is open, then closing one, **unlocks page scroll while the other is still open**.

**Fix:** a single `useBodyScrollLock()` hook with a reference count.

**5.2.10 — `src/components/SettingsModal.tsx:57-63` and `src/components/ItemDetailModal.tsx:33-39` — global `Escape` listeners are attached even when the modal is closed**
Both attach `window.addEventListener('keydown', …)` unconditionally. The settings one fires `onClose()` on every Escape press site-wide. It also races Radix Dialog's own Escape handling in `CommandMenu`.

**Fix:** only attach the listener while `isOpen` / `item` is truthy.

**5.2.11 — `src/itemSlug.ts:11-30` vs `src/components/BeequipsPage.tsx:187-197` — the two transliteration tables disagree**
| char | `itemSlug.ts` (slug family) | `BeequipsPage.tsx` (search family) |
|---|---|---|
| `в` | `v` | **`w`** |
| `щ` | `sch` | **`shch`** |

The slug family is consistent across all 6 copies (`src/itemSlug.ts`, `scripts/prerender.cjs:55`, `scripts/generate-widgets.cjs:70`, `scripts/generate-api-v1.cjs`, `scripts/generate-api.cjs`, `api/v1/search.js:21`, `bot/lib/items.js:17` — 7 copies actually). The **search** family (`BeequipsPage.tsx` and `bot/index.js:182`) uses the other mapping. A user who transliterates a Russian name into Latin and pastes it into search gets different results than the URL slug would suggest.

**Fix:** one shared table, imported by both sides.

**5.2.12 — `bot/index.js:266-296` — the bot's `RU_ABBR_MAP` is out of sync with the website's**
The site (`src/components/BeequipsPage.tsx:53-86`) maps `ар→AR`, `атл→ATL`, `бап→BAP`, `бар→BAR`. The bot has none of those; the bot has `кап→CAP`, which the site lacks. So `/price ар` works on the website but not in Discord, and vice-versa for `кап`.

**Fix:** extract the map into a shared JSON/JS module imported by both.

**5.2.13 — `bot/index.js:149-154` + `:196-228` — a second, never-refreshed copy of the item database**
`bot/lib/items.js:52-71` re-reads `bot/items.json` every 30 s, but `bot/index.js` loads it **once** at startup into `itemsData` and caches `flattenedItems` forever. After `npm run sync` the command handlers still serve stale data until the bot restarts.

**Fix:** delete the duplicate loader in `bot/index.js` and use `getItems()` from `bot/lib/items.js`.

**5.2.14 — `bot/index.js:208` — the bot's synthetic roll id format differs from the website's**
Bot: `` `${item.id}-${roll.rollName}` `` (raw name, spaces kept).
Site: `` `${item.id}-roll-${roll.rollName.replace(/\s+/g,'-')}` `` (`ItemCard.tsx:340/350`, `ItemPickerModal.tsx:142`, `ItemDetailModal.tsx:287/306`).
A `?trade=` link built on the website (`src/App.tsx:111`) therefore cannot be resolved by the bot, and vice-versa.

**Fix:** one shared `rollItemId(item, roll)` helper.

**5.2.15 — `scripts/prerender.cjs:589` — `buildSitemap` discards the `changefreq` it is given**
Covered in §2.4. Also `scripts/prerender.cjs:161` — `'@type': isBeequip ? 'Product' : 'Product'` — both branches are identical (dead ternary).

**5.2.16 — `scripts/prerender.cjs:717-723` — O(n²) related-item computation**
For each of the 330 items the script filters and sorts the full 330-item array twice (`sameCategory`, `others`) → ~330 × 2 × 330·log330 ≈ 1.9 M comparisons, and allocates two 330-element array per item. The build takes ~10 s, most of it here.

**Fix:** group items by category once into a `Map`, and pre-sort each bucket by value once.

**5.2.17 — `scripts/generate-runtime-items.cjs:48` vs `scripts/prerender.cjs` — the runtime data pins star signs to 1.0 but the prerendered pages do not**
```js
historicalPrices: isSign ? item.historicalPrices.map(() => 1.0) : item.historicalPrices,
```
`scripts/prerender.cjs` reads `bot/items.json` directly and applies no such pin. Today the **values** happen to match (the diff of `bot/items.json` vs `public/data/items.json` shows 0 value differences), but the **historical prices** are rewritten in one file and not the other — the exact class of drift the script's own header comment warns about. Any future change to `bot/items.json` star-sign values will make the catalogue and the item pages disagree again.

**Fix:** apply the pin in one shared place, or delete the pin.

**5.2.18 — `scripts/prerender.cjs:736, 773, 857` vs `:699, 711` — the sitemap and the internal links use different URL forms**
Covered in §2.5.

**5.2.19 — `src/style.css:1` — Tailwind auto-detection is not pinned**
Covered in §3.6. **Also:** `public/data/items.json` (gitignored, regenerated) contains Tailwind class strings (`badgeColor`, `borderColor`, `textColor`) that Tailwind scans, so the CSS output depends on the *contents of the price data*.

**5.2.20 — `bot/lib/store.js:54` — `flushAll()` is never called**
The doc-comment says "used on shutdown", but grep finds no caller: there is no `SIGINT`/`SIGTERM` handler anywhere in `bot/`. Up to 1.5 s of debounced writes (activity counters, trade log, moderation log) are lost on every restart.

**Fix:** `process.on('SIGINT', () => { flushAll(); process.exit(0); })` (and `SIGTERM`).

**5.2.21 — `bot/index.js:592-612` — `lastCommandAt` grows without bound**
One entry per user id, never evicted. Minor memory leak, but trivial to fix with a periodic sweep or an `LruCache`.

**5.2.22 — `api/v1/search.js:33-52` — the API's category map is missing two keys**
`api/v1/search.js` has no `'Скины на куба'` and no `'Стикеры полей'`, while `scripts/prerender.cjs:30`, `scripts/generate-widgets.cjs:42`, `scripts/generate-api-v1.cjs`, `scripts/generate-api.cjs` and `src/locales.ts:237` all have both. Verified with a probe over all 9 files.

### 5.3 MINOR

- **`src/App.tsx:446` / `src/components/ItemCard.tsx:15, 21`** — `index={idx}` is threaded all the way into `ItemCard` and then renamed `index: _index` and never used. Dead prop. Remove it from `App.tsx:446`, `BeequipsPage.tsx:335`, `ItemCardProps` and the destructuring.
- **`src/components/BeequipsPage.tsx:161-164`** — `getStatBadge()` is exported but has **zero** callers (grep: 1 match, the definition itself). Dead export.
- **`src/components/BeequipsPage.tsx:88`** — `getStatBadgesForGroup(groupName: string, rolls: any[] = [])`. Use `BeequipRoll[]` from `src/data/items.ts`.
- **`src/components/BeequipsPage.tsx:283`** — `e.target.value as any`; use the same `SortType` union that `src/App.tsx:23` defines (it is duplicated inline at `BeequipsPage.tsx:202`).
- **`src/components/ItemCard.tsx:166`, `src/components/ItemDetailModal.tsx:140`** — `style={{ '--hover-glow': item.glowColor } as any}`. Use `as React.CSSProperties` with a typed custom-property cast.
- **`src/components/ItemCard.tsx:269`** — `const matches: any[] = []` → `BeequipRoll[]`.
- **`src/components/ItemCard.tsx:310-322`, `src/components/ItemPickerModal.tsx:122-134`, `src/components/ItemDetailModal.tsx:243-263`** — the demand-colour mapping and the `formatVal`/`valueText` roll formatting are **triplicated verbatim**. Extract to `src/lib/rolls.ts`.
- **`src/components/ItemCard.tsx:338-353` and `src/components/ItemPickerModal.tsx:139-151`** — the `rollItem` object literal is built twice in `ItemCard.tsx` (once for +A, once for +B) and once in `ItemPickerModal.tsx`. Extract to one `makeRollItem(item, roll)`.
- **`src/App.tsx:223-228` and `src/components/BeequipsPage.tsx:204-209`** — the `demandRank` map is duplicated.
- **`src/App.tsx:59-66`** — the language is read from `localStorage` in a `useState` initialiser; the initialiser runs during SSR-less hydration but is fine here. However `src/App.tsx:61` hard-codes `/ru` detection while `src/itemSlug.ts:45` already exports `isRussianPath()` — use it.
- **`src/locales.ts:212-214`** — `t()` silently returns the key when a translation is missing, so a typo shows up as `catalog.sort.label` in the UI with no error. Add a dev-mode `console.warn`.
- **`src/components/CommandMenu.tsx:127-128`** — `<Dialog.Title>`/`<Dialog.Description>` are hard-coded Russian (`Поиск`, `Введите название предмета…`) even in English mode.
- **`src/components/SettingsModal.tsx:125`** — `'🌙 Dark'` / `'☀️ Light'` are hard-coded English, not translated.
- **`src/components/Home.tsx:137-196`** — 4 `framer-motion` `repeat: Infinity` loops with no reduced-motion guard (§4.3).
- **`src/components/ItemDetailModal.tsx:76-84`** — `sparkline.points.forEach` + `setHoveredPointIndex` on every `mousemove`.
- **`src/components/ItemCard.tsx:309-314`** — `else` chains instead of a lookup map for the demand colour.
- **`src/components/TradeCalculator.tsx:214`, `src/components/ItemPickerModal.tsx:178/294`, `src/components/BeequipsPage.tsx:270/280/297`** — hard-coded Russian/English strings bypassing the `t()` i18n layer (the rest of the app uses `t()`).
- **`generate-build-meta.cjs:37-38`** — the fallback strings for `message`/`author` are mojibake in the source file itself (`'�����쭠� ᡮઠ / ...'`). They are only used when git is unavailable, but they would ship garbage to `/build-meta.json`.
- **`scripts/prerender.cjs:94-152`** — the EN/RU SEO field builder is a second implementation of the demand/stability translations that already exist in `src/locales.ts:216-235` and `scripts/generate-api-v1.cjs`.
- **Dead files:** `src/assets/typescript.svg`, `src/assets/vite.svg`, `src/assets/hero.png` (0 references — Vite template leftovers); `public/icons.svg`, `public/bee-logo.png` (0 references in `src/`, `index.html`, `public/404.html` or any build script); `public/demo/*` (22 KB `app.js` + 24 KB `style.css` + 13 KB `index.html`, **not deployed** — see §5.5).
- **`values_live.json`** — a byte-identical 1,187,392-byte copy of `values.json` (verified with `Buffer.equals`), gitignored, used only by `scratch/compare_bq.py`.
- **`changed-ids.txt`** — contains a single newline; it is the output of `scripts/changed-items.cjs` and is gitignored.
- **`bot/index.js:584-586`** — three identical copies of the comment `// Helper function to format all channels` above no function.
- **`bot/lib/items.js:140`** — `partial.sort((a, b) => a.value - b.value)[0]` sorts the whole match list to take the first element; use a `reduce`/`find` min-scan.
- **`bot/lib/roles.js:69`** — `guild.roles.cache.find(...)` can miss an existing role on a cold cache, and the `guild.roles.create` then fails with a name conflict (caught and logged, but the role is never assigned). Fetch roles from the API or fall back to `guild.roles.fetch`.
- **`bot/lib/roles.js:108-111`** — `member.roles.add(target).catch(() => null)` swallows every error, including missing permissions. At least log it.
- **`src/data/itemsStore.tsx:25`** — `fetch('/data/items.json')` uses an absolute path while `vite.config.ts:12` sets `base: './'`. Fine on Vercel (root-served), but it breaks the `base: './'` promise if the site is ever served from a sub-path.
- **`src/data/items.ts:16/32`** — the `demand` and `stability` unions are typed as Russian literals, so the type system cannot represent the English values the API serves.

### 5.4 Dead / duplicated data sources

| Data | Where it is duplicated | Consequence |
|---|---|---|
| Item data | `bot/items.json` (551 KB) → `public/data/items.json` (384 KB) → `dist/api/v1/*.json` (1.7 MB) → `dist/w/*` (2.2 MB) | 3 different public shapes for the same data: `/data/items.json` uses `englishName` + Russian `category`; `/api/v1/items.json` uses `name` (English) + `nameRu` + `category` (English) + `categoryRu` |
| Transliteration | 7 copies of the slug table, 2 copies of the search table | see §5.2.11 |
| Category → English | 6 copies (`prerender.cjs:30`, `generate-widgets.cjs:42`, `generate-api-v1.cjs`, `generate-api.cjs`, `api/v1/search.js:33`, `src/locales.ts:237`) + `scripts/lib/category-styles.cjs` | see §5.2.22 |
| Stat abbreviations | `src/components/BeequipsPage.tsx:16-86` and `bot/index.js:230-296` | see §5.2.12 |
| Demand → colour | `ItemCard.tsx:32-44`, `ItemCard.tsx:310-314`, `ItemPickerModal.tsx:130-134`, `ItemDetailModal.tsx:243-251` | visual drift |
| 7-day change | `ItemCard.tsx:91-115`, `generate-widgets.cjs:110-134`, `generate-api-v1.cjs:215-…`, `api/v1/search.js:98-131` | see §5.1.4 |
| Homepage prices | `Home.tsx:15-56` (hard-coded) vs `bot/items.json` | see §2.10 |
| `values.json` / `values_live.json` | byte-identical 1.19 MB files | dead weight |

### 5.5 Build reproducibility

**`npm run build` succeeds** (verified end-to-end on 2026-10-21):
```
[runtime-items] wrote 330 items to public/data/items.json (375 KB)
vite v8.1.0 ✓ built in 3.15s
dist/assets/index-D45X714A.js   677.13 kB │ gzip: 191.34 kB
dist/assets/index-CN-ljGGr.css  100.31 kB │ gzip:  14.70 kB
[prerender] wrote 660 item pages + sitemap.xml (664 urls)
[generate-api] 330 items, 18 categories, 680 files written to dist/api/
[generate-api-v1] 330 items, 18 categories, 688 files written to dist/api/v1/
[widgets] wrote 330 widget pages + index.html to dist\w (330 items, 2.21 MB total)
```
`npx tsc --noEmit` → **0 errors**.

**Byte-for-byte comparison of the freshly built `dist/` against the live site** (`scratch/audit/repro.mjs`):

| Artefact | local | live | identical |
|---|---|---|---|
| `sitemap.xml` | 85,615 | 85,615 | **yes** (sha256 `488df2c7…`) |
| `items/index.html` | 30,294 | 30,294 | **yes** (`69821ec6…`) |
| `ru/items/index.html` | 32,500 | 32,500 | **yes** (`c9ea13dc…`) |
| `robots.txt` | 74 | 74 | **yes** (`98ff1c38…`) |
| `data/items.json` | 384,096 | 384,096 | **yes** (`6f1a8f27…`) |
| `api/v1/items.json` | 161,883 | 161,883 | **yes** (`fc7ec11c…`) |
| `item/star-cub/index.html` | 16,115 | 16,101 | no — **CRLF vs LF only** |
| `ru/item/star-cub/index.html` | 16,788 | 16,774 | no — CRLF vs LF only |
| `ru/index.html` | 14,890 | 14,876 | no — CRLF vs LF only |
| `api/v1/index.json` | 10,415 | 10,415 | no — `generated` timestamp |
| `api/v1/docs.html` | 24,318 | 24,318 | no — `Generated` timestamp |

**Conclusions:**
1. The **data pipeline is reproducible** — the sitemap, the item index and the runtime JSON are byte-identical to production. ✓
2. **The item pages differ only in line endings.** The Vite template `index.html` is committed with CRLF (Windows checkout, `core.autocrlf`), so the local build emits `\r\n` while the Linux build on Vercel emits `\n`. The 14/16-byte deltas equal the line count. Harmless for SEO, but it means local and production HTML are never byte-identical. Fix: add `.gitattributes` with `* text=auto eol=lf`.
3. **The JS/CSS asset hash is not reproducible across working trees** — see §3.6. The CSS grew 92,509 → 100,317 bytes purely because `public/demo/` and `scratch/` were present. The JS hash also changed (`index-7UXHnUfJ.js` → `index-D45X714A.js`) with identical byte length, i.e. a line-ending-only difference in the sources.
4. **`public/build-meta.json` embeds a timestamp + git SHA**, so it changes on every build by design — but it is **committed to git** (it is not in `.gitignore`), so every build dirties the working tree. `git diff public/build-meta.json` after my build showed 3 changed lines.
5. **`/demo/` is not deployed**: `public/demo/{index.html,app.js,style.css}` exist in the repo and are copied into the local `dist/`, but all three return **404** on `bss-index.vercel.app`. The cause could not be determined from this environment (no Vercel build logs). Two possibilities: the deployment predates the `public/demo/` addition (`git status` shows `public/demo/` is **untracked** — it has never been committed), or the Vercel build excludes it. **Treat as "not deployed, dead weight"** and either commit it or delete it.

### 5.6 Data integrity checks (`scratch/audit/data-check.mjs`, `scratch/audit/consistency.mjs`)

```
items: 330                       duplicate ids: 0
categories: 18                   beequips: 41 / non-beequips: 289
items with EMPTY historicalPrices: 0
items with exactly 1 history point: 29        ← NaN sparkline source (§5.1.3)
items where dates.length != prices.length: 0
items with value === 0: 2  (bbm-from-below-0, beequip-electric-candle)
sum of all values: 4243.995  avg 12.86      ← matches docs.html "Total value 4244 / Average 12.86" (computed, not hard-coded ✓)
VALUE differences bot/items.json vs public/data/items.json: 0
STYLE differences bot/items.json vs public/data/items.json: 330 / 330   ← badgeColor/borderColor/glowColor/textColor
```
The 330/330 style difference is expected: `scripts/generate-runtime-items.cjs:43` applies `applyCategoryStyles()` (one colour per category) while `scripts/prerender.cjs` uses `getCategoryStyles()` (`scripts/prerender.cjs:307`) — two different functions with the same name in two different files. The prerendered item pages only use `--glow` from `getCategoryStyles`, so the divergence is currently invisible, but it is one refactor away from becoming a visible inconsistency.

The docs page's "Items 330 / Categories 18 / Total value 4244 / Average 12.86" **are computed from the data** (`scripts/generate-api-v1.cjs:1065-1076`), not hard-coded. ✓

---

## 6. Top 10 things to fix, ranked

| # | What | Why it matters | Effort |
|---|---|---|---|
| **1** | **Stop rendering the whole 330-item catalogue on every item page.** In `src/App.tsx:115-119`, don't set `activeTab='catalog'` on `/item/<slug>`; in `scripts/prerender.cjs:673`, don't emit `<div id="app">` on item pages. | 660 URLs currently contain the same 330-card catalogue (11,222 DOM nodes, 291 images, 32 KB of text each) below ~1,500 characters of item-specific content. Pure duplicate content, and it is the single biggest perf and crawl-budget problem on the site. | S (App.tsx + one line in prerender.cjs) |
| **2** | **Prerender the English homepage** the way `/ru/` already is (`scripts/prerender.cjs:595 buildRussianLanding`). Add an `<h1>`, a paragraph, the top-24 table, `WebSite`/`ItemList` JSON-LD and a category `<nav>`. | `/` currently has **72 characters** of visible text, **0 headings**, **0 JSON-LD** and **0 links** in the raw HTML. Google receives an empty shell from the most important URL on the site. | M |
| **3** | **Replace `logo.png` (874 KB) with a ~5 KB icon**, and stop shipping the same 874 KB file three times as `favicon.png` / `apple-touch-icon.png`. | `logo.png` is **874,351 B = 75.7 %** of the homepage's 1.15 MB same-origin payload, for a 36×36 px logo rendered on every page. | XS |
| **4** | **Make the homepage's popular stickers real `<a href="/item/<slug>/">` links** (`src/components/Home.tsx:137-196`, `:293-296`), and delete the hard-coded price array at `Home.tsx:15-56` in favour of `useItems()`. | The homepage currently links to **zero** item pages, and displays **wrong prices** (Stick Cub 23.50 vs 15.5, Robo Cub 15.50 vs 9.25, Star Cub 10.25 vs 9.75). | XS |
| **5** | **Fix the light theme's contrast.** Add `html.light .text-amber-400/500/600 { color: #b45309 !important }` to `src/style.css` and override `#fbbf24` in the prerender stylesheet. | `#fbbf24` on `#f4f5f7` = **1.53:1** (needs 4.5). Every price, tag, table header and section heading is invisible in the light theme — confirmed live on `/item/star-cub`. | XS |
| **6** | **Unify the "7-day change" calculation.** One shared implementation used by `ItemCard.tsx`, `generate-widgets.cjs`, `generate-api-v1.cjs` and `api/v1/search.js`. | The website and the site's own public API publish **contradictory numbers for 178 of 330 items** (Whistle +180 % vs +12.7 %; Charm Bracelet −43.1 % vs −9.6 %). | S |
| **7** | **Add `prefers-reduced-motion` support and wire the two dead settings switches.** `@media (prefers-reduced-motion: reduce)` in `src/style.css` + `<MotionConfig reducedMotion>`; pass `showWeekBadge={showWeekBadges}` to `ItemCard` (`App.tsx:443-452`) and actually consume `reduceMotion` (`App.tsx:85-87`). | The built CSS has **zero** `prefers-reduced-motion` rules; the homepage runs 4 infinite animation loops; **both** settings toggles are complete no-ops that persist to localStorage and change nothing. | S |
| **8** | **Set proper `Cache-Control` in `vercel.json`** — `immutable, max-age=31536000` for `/assets/*`, `max-age=300, s-maxage=86400, stale-while-revalidate` for `/data/*` and `/api/v1/*`. | Everything is `public, max-age=0, must-revalidate`, so the 195 KB JS, 92 KB CSS and 384 KB JSON are revalidated on **every navigation** even though `/assets/*` is content-hashed. | XS |
| **9** | **Fix the item-page URL canonicalisation and the sitemap.** Make `prerender.cjs:699/711/736/773/857` and `api/v1/search.js:156` emit one form; add a 301 for the other; emit `<lastmod>` and the real `changefreq` (`buildSitemap` line 589 currently ignores the value it is given). | Today `/item/star-cub` and `/item/star-cub/` are **both 200 with identical bytes**, the sitemap uses one form and every internal link + the API + the widgets use the other, and **0/664 sitemap entries have `lastmod`**. | S |
| **10** | **Pin Tailwind's sources and stop letting the data/scripts set the CSS hash.** `src/style.css`: `@import "tailwindcss" source(none); @source "./**/*.{ts,tsx}";`. Also `src/components/App.tsx:289` — delete the `fallback={null}` ErrorBoundary so a render error shows the error page instead of a blank `<main>`. | The CSS bundle changes by **+7,808 B (+8.4 %)** and the asset hash changes depending on which untracked files are in the tree (`public/demo/`, `scratch/`) — verified experimentally. And a single render error currently blanks the entire main area with no message and no recovery button. | XS each |

**Runner-up (just below the top 10):** drop `html2canvas` into a dynamic `import()` (`TradeCalculator.tsx:5`) — removes ~150 KB raw / ~45 KB brotli of the 195 KB JS bundle from the critical path of every page, for a two-line change.
