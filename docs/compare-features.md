# BSS Index vs BSS Values — competitive feature analysis

**Date:** 2026-10-21
**Ours:** https://bss-index.vercel.app
**Competitor:** https://bssmvalues.com

All claims below come from HTTP responses, DOM snapshots or file sizes captured during this analysis.
Anything I could not observe is marked **not verified**.

> **Environment note:** a script injected into the browser context monkey-patched
> `Number.prototype.toFixed` to throw `AUDIT_TEST_RENDER_ERROR` for any number in
> `(0, 100000)`. This is an environment artefact, **not** a defect on either site — it reproduced
> identically on `bss-index.vercel.app` and `bssmvalues.com`, and the error text is not present in
> either site's shipped JavaScript. All browser findings below were taken in a clean context with
> the patch absent.

---

## 1. Feature matrix

| # | Feature | Ours (bss-index) | Competitor (bssmvalues) | Notes |
|---|---|---|---|---|
| 1 | Total catalogue size | **330 items** | **341 items** | Ours: 289 stickers/vouchers + 41 beequips. Theirs: 300 stickers + 41 beequips. |
| 2 | Categories | **18** | **18 sticker categories** + separate beequip list | Ours: 17 sticker categories + "Beequips". Theirs: 18 incl. "Services". |
| 3 | Category-by-category counts | 17/18 identical to theirs | 1 category ahead | Only diff: competitor has **"Services" (11 items)**; we have 0. All other 17 categories match exactly (Cub Skins 12, Hive Skins 12, Vouchers 6, Bees 17, Bears 14, Mobs 18, Art 12, Gems 16, Nectar Icons 5, Flowers 5, Mushrooms 10, Leaves 11, Tools 19, Stamps 19, Beesmas 11, Misc 90, Star Signs 12). |
| 4 | Beequip section | yes — 41 beequips, 848 rolls, 142 stat groups | yes — 41 beequips, 848 rolls, 142 stat groups | Roll count identical. Group names identical. |
| 5 | Prices per item | yes | yes | Both give value + min/max range. |
| 6 | Prices per roll | yes, 848 rolls | yes, 848 rolls | But **131 of 848 roll ranges differ** — theirs carry `">=100"`, `">={Bee Cub}"` style expressions; we flattened those to `0-0`. |
| 7 | Demand field | yes — 4 named levels (Низкий/Средний/Высокий/Хайп = Low/Average/High/Hype) | yes — numeric 0–5 | Their scale has 6 levels; ours collapses their 0 and 1 into "Low". 167 of 289 stickers carry a "Low" label that maps to their 0 or 1. |
| 8 | Stability / trend field | **yes** — Падает / Растет / Стабильно (Falling/Rising/Stable) | **no** — absent from their entire API | Ours is a genuine data addition. Verified: their `/api/values` JSON contains no `stability` key. |
| 9 | 7-day % change on cards | **yes** — e.g. Bee Cub `-18%`, Camphor Lip Balm `-24%` | **no** — their cards show only value range + demand icon | |
| 10 | Per-item detail page | **yes** — `/item/<slug>` and `/ru/item/<slug>` | **no** | Their deep links 404: `/values/sticker/bee-cub`, `/item/bee-cub`, `/values/bee-cub`, `/values/stickers/bee-cub`, `/sticker/bee-cub`, `/values/beequips/kazoo` → all 404. |
| 11 | Item page shows value + range | yes | n/a (no page) | |
| 12 | Item page shows demand | yes | n/a | |
| 13 | Item page shows trend + % | yes | n/a | |
| 14 | Item page shows price history | yes — full dated table, 59 rows for Bee Cub | n/a | |
| 15 | Item page shows a chart | **no** — table only (i18n key `item.chart` exists, no chart is rendered) | **yes on homepage** — "Value History & Demand", 290.00 Signs, 4/5 Demand, date axis + demand axis | Their chart is on `/` only; their item cards have none. |
| 16 | Item page shows description | yes (Russian editorial text per item) | no | |
| 17 | Item page shows related items | yes — 12 on Bee Cub | n/a | |
| 18 | Item page share buttons | **no** | **no** | Neither has per-item share. |
| 19 | Item page schema.org JSON-LD | yes — `Product` with `AggregateOffer`, lowPrice/highPrice | no | |
| 20 | Item page <title>/meta description | yes, per item, EN + RU | n/a | |
| 21 | Crawlable item URLs | **yes — 660** (330 EN + 330 RU) | **no — 0** | Their sitemap has 12 URLs total, none per item. |
| 22 | Sitemap | `/sitemap.xml` 85,615 B, **664 URLs** | `/sitemap.xml` 2,006 B, **12 URLs** | |
| 23 | Static crawlable catalogue page | `/items/` 29,624 B, all 330 items grouped by category | `/values` (client-rendered only) | |
| 24 | Search — exists | yes | yes | |
| 25 | Search — invocation | **Ctrl+K / ⌘K** modal + a filter input on every tab + "Quick Search" button | inline `<input placeholder="Search stickers...">` / `"Search beequips..."` | |
| 26 | Search — English names | yes | yes | |
| 27 | Search — acronyms | yes (PPM, DDC, GGB, DDH…) | yes (ppm→Peppermint Cub + BBM From Below; DDC→Doodle Cub + Doodle Hive Skin) | |
| 28 | Search — Russian names | **yes** — "панама"→Autumn Sunhat, "казу"→Kazoo (⌘K); `пчела`→17, `медведь`→14 (API) | **no** — "медведь" and "звезда" both return the same 19 unrelated cub/hive-skin items | Their matcher is fuzzy and falls over on Cyrillic. |
| 29 | Search — partial words | yes | yes | |
| 30 | Search — beequip stat acronyms | **yes** — HAH→4 beequips, WFC→1, BP→2 | no | Their search covers item names only. |
| 31 | Search — server-side API | **yes** `/api/v1/search?q=` — matches EN + RU + slug + transliteration + category slang ("куб"→12, "кубь"→12, "kub"→12, "пчела"→17, "медведь"→14). Does **not** match acronyms (PPM/DDC/DDH/GGB → 0) | **no** — `/api/search` is 404 | Our two search paths have different coverage — see §3. |
| 32 | Trade calculator | yes | yes | |
| 33 | Calculator — two-sided A/B | yes — "Side A (You Give)" / "Side B (They Give)" | yes — "Offering" / "Looking For" | |
| 34 | Calculator — verdict | yes — "TRADE VERDICT", "HUGE L", "You lose -39.7%" | yes — "Trade Analysis", "Difference 0.00 (0.00%)", "W/L Status: Fair" | |
| 35 | Calculator — shareable URL | **yes** — `?trade=<idsA>|<idsB>`, e.g. `/?trade=bee-cub-0%7Csnow-cub-0` restores both sides and the verdict | **no URL parameter** — only "Save Offer"/"Load Offer" buttons; share mechanism **not verified** | |
| 36 | Calculator — image export | **yes** — html2canvas → PNG to clipboard, fallback download `bss-trade-<ts>.png` | "Screenshot" button present; output format **not verified** | |
| 37 | Calculator — demand-aware | yes (demand is on every card and in the verdict) | **no** — their page states "Item demand is not yet factored into calculations" | |
| 38 | Calculator — maturity | shipped | "This calculator is in BETA and may not be 100% accurate." | |
| 39 | Hide prices toggle | yes | no | |
| 40 | Online marketplace / user listings | **no** | **yes** — live listings (GET `/api/market/listings?page=1&limit=20&sort=newest`), Buying/Selling, prices, "Looking For:", Roblox usernames, filters, Create Listing, My Listings | **Biggest competitor feature we lack.** |
| 41 | User accounts | **no** | **yes** — `/api/auth/session`, `/api/user` → `{"logged_in":false}`, "Login" button | |
| 42 | Wax calculator (beequip odds) | **no** | **yes** — `/wax`: beequip + stat select, star potential, wax type, number of waxes, probability output | |
| 43 | Guides / editorial | **no** | **yes** — `/guides`, 6 categories (Blue Hive, Red Hive, White Hive, Early Game, RDP, Other), 5 guides on the Blue tab | But their guides **link out** to Google Docs and YouTube — no articles hosted on the site. |
| 44 | Blog / news | no | no | |
| 45 | Changelog | **no** | no | |
| 46 | Price alerts | **no** | no | |
| 47 | Watchlist / favourites | **no** | no | |
| 48 | Public JSON API | **yes — 14 documented endpoints**, `/api/v1/*` | **yes — 1 endpoint**, `/api/values` | |
| 49 | API — per-item document | yes `/api/v1/items/{slug}.json` (3,042 B for star-cub) | **no** — must download the whole 498 KB for one price | |
| 50 | API — per-category | yes `/api/v1/categories/{slug}/items.json` | no | |
| 51 | API — price history per item | yes `/api/v1/items/{slug}/history.json` (+ 7d/30d change, min/max/avg) | no | |
| 52 | API — search endpoint | yes `/api/v1/search` | no | |
| 53 | API — market movers | yes `/api/v1/changes.json` (10 gainers + 10 losers, 7d) | no | |
| 54 | API — market stats | yes `/api/v1/stats.json` | no | |
| 55 | API — lean search index | yes `/api/v1/search-index.json` (42,191 B) | no | |
| 56 | API — OpenAPI spec | yes `/api/v1/openapi.json` (33,389 B, OpenAPI 3.1) | no | |
| 57 | API — human docs | yes `/api/v1/docs.html` (24,044 B) + `docs.ru.html` (24,669 B) | no | |
| 58 | API — CORS | yes, `Access-Control-Allow-Origin: *` on every endpoint | not verified on `/api/values` | |
| 59 | API — value types | **real JSON numbers** | **strings** — `"280"`, `">=150"`, `">={Bee Cub}"` | A consumer must parse/evaluate theirs; ours are directly usable. |
| 60 | API — stable identifiers | yes (`slug`, `id`, `name`, `nameRu`, `category`, `categorySlug`) | none — identity is the display name ("Bee Cub") | Their consumers must slugify names themselves. |
| 61 | API — cache headers | CDN | `cache-control: public, max-age=60, stale-while-revalidate=300` | |
| 62 | API — data freshness | generated 2026-10-20T11:21:59Z | per-item `last_updated` 2026-05-22 → 2026-10-18 | |
| 63 | Public API docs linked from UI | yes — footer links "API v1", "API (документация)", "API" | no | |
| 64 | Dark / light theme | yes — Settings → THEME (Dark / Light) | yes — "Toggle theme" button | Both have it. |
| 65 | Background options | **yes — 4**: Dots, Grid, Smooth, Aurora (`bss_bg` localStorage) | no | |
| 66 | Reduce-motion toggle | yes | no | |
| 67 | Hide 7-day change badges | yes | no | |
| 68 | Language switching | **yes — full EN + RU**: 330 RU item pages, RU homepage, RU API docs, `hreflang` en/ru/x-default on every page | **no** | Their site is EN-only. |
| 69 | PWA manifest | **no** — `/manifest.json`, `/manifest.webmanifest`, `/site.webmanifest`, `/sw.js` all 404 | **yes** — `/site.webmanifest` (437 B, `display: standalone`, 192+512 maskable icons) | **They win this.** |
| 70 | apple-touch-icon | yes — 874,051 B PNG | yes — 46,677 B PNG | Both have it. |
| 71 | Favicon set | yes — favicon.png, favicon.ico (35,982 B) | yes — favicon.svg + favicon.ico | |
| 72 | Mobile layout | usable, **but 8 px horizontal overflow at 390 px** (`scrollWidth` 398 vs 390) | **no overflow** at 390 px; bottom tab bar (Home/Value/Online/Trade/Guides/Wax/More) | They win on mobile polish. |
| 73 | Onboarding / one-screen comprehension | partial — hero explains the site, two CTAs, a 4-card "OUR TOOLS" grid, popular-stickers strip | **stronger** — hero "Find your perfect BSS trade with confidence", "Trusted by 185K+ players", 4 feature cards each with a "Try it now" CTA | |
| 74 | Social — Discord | yes — 1 link (`discord.gg/ZXmycxjvv9`) + a "🪿 Authors" dialog | yes — 2 links (`discord.gg/5nRSUV2w28`, `discord.gg/PwYPcNkQDN`, both giveaway invites) | |
| 75 | Social — YouTube / Twitter / X | no | **no** — YouTube appears only inside one guide card; **no Twitter/X anywhere** | Neither has a real social presence in-page. |
| 76 | Social — GitHub | yes — `github.com/happy-g0ose` | no | |
| 77 | Giveaways / community engagement | no | **yes** — `/api/giveaways/active` widget on every page | |
| 78 | Cookie consent banner | no | **yes** — "Data collection notice", Accept / Decline | |
| 79 | Discord bot / embeddable widgets | no | no | |
| 80 | Ad load | none observed | **heavy** — pubnation, Google Ads, Criteo, Rubicon, OpenX, Media.net et al. in the CSP; `scripts.pubnation.com` was blocked by ORB in our browser | |
| 81 | Item images | hosted on `bssmvalues.com` — **330/330 of our items** | hosted on `bssmvalues.com` | Both depend on the competitor's image CDN. |
| 82 | Duplicate data between the two sites | **yes — our values are the competitor's** | source | 288/289 sticker ranges identical, identical history dates, identical roll names, 330/330 images hotlinked from bssmvalues.com. See §3. |

---

## 2. Where we win

### 1. Every item has a real, crawlable page. They have none.
We ship **660 item URLs** (330 EN + 330 RU) as server-rendered HTML with per-item `<title>`,
`<meta description>`, `hreflang` pairs and schema.org `Product` + `AggregateOffer` JSON-LD.
A user can paste `https://bss-index.vercel.app/item/bee-cub/` into Discord and it renders a
complete price card in the preview.
The competitor has **no per-item URL at all** — every probe 404s
(`/values/sticker/bee-cub`, `/item/bee-cub`, `/values/bee-cub`, `/values/stickers/bee-cub`,
`/sticker/bee-cub`, `/values/beequips/kazoo`). Their item selection is a query string on
`/values/stickers?category=Cub+Skins&item=Bee+Cub`, which is not in their sitemap, is not
shareable as a page, and — verified in the browser — **clicking the item card opens no detail
view and no modal** (0 `[role=dialog]` elements after the click). Their best per-item data
exposure is a homepage chart for one hard-coded item (Bee Cub).

### 2. A real API vs one 498 KB blob.
`/api/v1/` exposes **14 documented endpoints** — per-item documents, per-category lists,
per-item history (with 7-day/30-day change and min/max/avg), server-side search, market
movers, market stats, a lean search index, an OpenAPI 3.1 description, and an English **and**
Russian HTML documentation page. Every response carries `Access-Control-Allow-Origin: *`.
Values are **real JSON numbers**, and every record has stable `slug` / `id` / `name` / `nameRu` /
`category` / `categorySlug` identifiers.

The competitor exposes exactly **one** public endpoint, `/api/values` (498,810 bytes uncompressed,
33,314 brotli). A consumer who wants Bee Cub's price today must download all 498 KB and walk
`Sticker.groups["Cub Skins"].items["Bee Cub"]`. Their values are **strings** — `"280"`,
`">=150"`, `">={Bee Cub}"` — so a consumer must parse and sometimes evaluate them. Their records
have no identifier beyond the English display name, so any consumer must slugify names itself.
`/api/search`, `/api/categories`, `/api/stats`, `/api/changes` all return 404.

### 3. Russian is a first-class language, not a translation afterthought.
We serve **330 RU item pages**, a prerendered RU homepage (`/ru/`, 13,997 B, with the top-25
table in Russian), an RU API doc page, `hreflang` `en`/`ru`/`x-default` on every page, and an
RU version of the API docs.
Their site is English-only — no language switcher, no `hreflang` in their HTML.

### 4. Search actually understands Russian; theirs does not.
Our API search resolves `куб` → 12 Cub Skins, `кубь` → 12, `kub` → 12 (transliteration),
`пчела` → 17 Bee Stickers, `медведь` → 14 Bears, `star-cub` → 1, `voucher` → 6, `honey` → 2.
In-app, the ⌘K modal matches Russian item names ("панама" → Autumn Sunhat, "казу" → Kazoo).

The competitor's matcher is fuzzy and **collapses on Cyrillic**: "медведь" (bear) and "звезда"
(star) both return the *same* 19 cub/hive-skin items — the Cyrillic needle is dropped and the
matcher returns its nearest fallback. "ZZZZ" returns Fuzz Bomb, Fuzzy Alt, Pizza Delivery Man and
Ticket Voucher. Their search only really works for English names and acronyms.

*Caveat on our side:* the API search and the ⌘K modal do not cover the same ground — see §3.16.

### 5. Trade calculator output is shareable and exportable.
Our `Link` button copies `https://bss-index.vercel.app/?trade=bee-cub-0%7Csnow-cub-0`; loading
that URL restores Side A = Bee Cub (290★), Side B = Snow Cub (175★) and the verdict
("HUGE L — You lose -39.7%"). `Screenshot` renders the trade card via html2canvas and copies a PNG
to the clipboard, falling back to downloading `bss-trade-<timestamp>.png`.
The competitor's calculator has `Save Offer` / `Load Offer` / `Screenshot` buttons, but no URL
parameter carries the trade and their own page warns "Item demand is not yet factored into
calculations" and "This calculator is in BETA".

### 6. Richer per-item data: trend, stability, 7-day change, descriptions, related items.
Our item pages show value, range, demand, **trend with a % delta** (`↗ +5%`), a **stability
label** (Falling/Rising/Stable), a full dated history table (59 rows for Bee Cub), an editorial
description and 12 related items.
Their competitor API has **no `stability` field at all** (verified: the string `stability` does
not occur anywhere in their 498 KB JSON), their cards show no trend and no % change, and there
is no per-item page to hang any of it on.

### 7. Beequip tooling: stat-acronym filtering and stat search.
Our Beequips tab has a filter chip row of **32 stat acronyms** (AR, ATL, BAP, BAR, BP, BBP, BFC,
BFT, BGP, BMS, CC, CR, CRAH, GBP, HAH, HFT, HM, HPG, HFIC, IC, MD, MEL, MRT, PMS, RBA, RP, SCC,
SCP, TL, WFC, WP, WGA, CAP), and ⌘K search resolves a stat acronym straight to the beequips that
carry it (HAH → 4 beequips, WFC → 1, BP → 2).
Their search covers item names only — there is no way to ask "which beequips have HAH?"

### 8. Search is a global keyboard-first modal; theirs is a page-local input.
Ours is `Ctrl+K` / `⌘K` from anywhere (the header carries a live `OPEN SEARCH: CTRL + K` badge),
with `↑↓` / `↵` / `esc` navigation. Theirs is a plain input inside the current page's filter row.

### 9. Cosmetic control: background presets, reduced motion, badge toggle.
Four background presets (Dots, Grid, Smooth, Aurora) plus Reduce Motion and a Price-Change-Badges
toggle, all persisted in `localStorage`. They have only a light/dark toggle.

### 10. We are cleaner to load.
No ad stack, no pubnation/Google-ads/Criteo scripts, no `analytics.bssmvalues.com`, no cookie
banner intercepting the first interaction, no giveaway modal popping over the content (their modal
blocked pointer events on our test run and had to be dismissed before the search box was clickable).

---

## 3. Where we lose

> ### The bluntest one first: our value data **is** their value data.
>
> This is not a guess — it is measurable:
>
> - **330 of 330** of our item images are hotlinked from `https://bssmvalues.com/images/...`.
> - **288 of our 289 sticker value ranges are numerically identical** to their live API
>   (the 289th is BBM From Below, which they list as `TBD`).
> - Item history is the **same series with the min/max collapsed to a midpoint**: for Star Cub
>   both datasets carry the identical 21 dates (`2025-05-14` → `2026-09-16`), and our values
>   `7, 7.25, 6.75, …` are exactly the midpoints of their `value_min`/`value_max` pairs
>   (`7/7, 7/7.5, 6.5/7, …`).
> - Category structure and per-category counts match **17 out of 18** exactly; the only difference
>   is the "Services" category we are missing.
> - All **848** beequip roll names and **142** stat-group names are identical.
> - The demand scales are the same scale re-labelled: their `3`→our "Average" (64 items),
>   `4`→our "High" (11), `5`→our "Hype" (16), and their `0`/`1`/`2` all collapse into our "Low"
>   (128 / 39 / 30 items).
>
> In short: we are a **Russian-language re-skin of the competitor's dataset** with our own UI,
> our own API shape and our own editorial voice. That is a legitimate product decision — but it
> means we are a **downstream consumer of their data**, not a peer. Two consequences:
> 1. They can change, throttle or withdraw their data at any time and 330 of our item pages go dark.
> 2. Any feature built purely on their numbers is, by definition, never a differentiator —
>    our wins have to come from presentation, localisation, tooling and API quality (which is
>    where the rest of this section is pointed).

### 1. No marketplace. This is their product and ours is not a product.
`bssmvalues.com/market` is a live, working peer-to-peer trading board: real listings with
timestamps ("10/21/2026, 8:24:53 AM"), `Selling` / `Buying` types, asking prices, free-text
"Looking For" terms, **the other player's Roblox username** (`Buyer: tebtebtebtebtebtebtebtebtebteb(@bax_zxlol)`),
filters (All/Selling/Looking to Buy, Newest/Oldest/Price High→Low/Price Low→High), a
"Search items..." box, a `Create Listing` flow and `My Listings`, backed by
`GET /api/market/listings?page=1&limit=20&sort=newest`.
We have **nothing equivalent** — no listings, no user accounts, no user-generated supply.
This is the single largest gap: it is a destination people bookmark, not a tool they open once.

### 2. No user accounts at all.
They have `/api/auth/session`, `/api/user` (`{"logged_in":false}`), a "Login" button in the header,
and gated features behind it (create/manage listings). We have no login, no profile, no
per-user persistence — the calculator state is anonymous `localStorage`.

### 3. No wax calculator.
`/wax` computes the odds of getting a given stat when waxing a beequip: pick beequip → pick stat →
set star potential (0–5) → choose wax type (Soft Wax: "100% Survival, 100% Success, 1 Upgrade") →
number of waxes → probability output. This is a daily-use tool for the beequip crowd that we do
not have in any form.

### 4. No guides / editorial content of any kind.
They have `/guides` with 6 categories (Blue Hive, Red Hive, White Hive, Early Game, RDP, Other)
and 5 guides on the Blue tab (Hive composition & macro settings, reading hourly graphs, 100× RBC
Blessing boosts, Honeyday, a 40-minute video). We have **zero** guides, zero blog, zero news,
zero changelog.
Mitigation to be fair: their guides are **links out** to Google Docs and YouTube, not articles
hosted on the site, and they carry no in-page search.

### 5. No chart on our item pages.
The competitor's homepage renders a real "Value History & Demand" chart for Bee Cub — a dated
price line plus a 0/5–5/5 demand axis. Our item pages render **only a table**. Our bundle still
contains the i18n key `item.chart` = "Value Dynamics (6 weeks)", so the chart was planned and
never shipped. Worse, both the heading and the meta description hard-code "6 weeks" while the
table actually lists **59 points spanning 15 months** — so the copy is actively wrong.

### 6. No PWA / installability.
They serve `/site.webmanifest` (437 B, `display: standalone`, `theme_color: #ffffff`,
192×192 + 512×512 maskable icons) and both manifest PNGs. Every manifest path on our side
(`/manifest.json`, `/manifest.webmanifest`, `/site.webmanifest`, `/sw.js`) returns **404**, so we
are not installable and have no service worker.

### 7. Their mobile layout is cleaner than ours.
At a 390 px viewport their site has **no horizontal overflow** and collapses to a bottom tab bar
(Home / Value / Online / Trade / Guides / Wax / More). Ours **overflows by 8 px**
(`document.documentElement.scrollWidth` = 398 vs `window.innerWidth` = 390).

### 8. Their onboarding is better.
Their homepage states the value proposition in one line ("Find your perfect BSS trade with
confidence"), adds a social proof badge ("Trusted by 185K+ players"), and lists four feature
cards each with its own "Try it now" CTA, plus a live Bee Cub chart above the fold.
Ours has a hero, two CTAs, a four-card "OUR TOOLS" grid and a popular-stickers strip — but no
social proof, and the four cards read as generic ("PRICE CATALOG", "EXPLORE", "TRADE CALCULATOR")
rather than as concrete differentiators.

### 9. We are missing 11 items: their whole "Services" category.
Their API has an 11-item `Services` group we do not carry at all:
`Caustic Waxes (3-4 Waxes)`, `Colored Drives (9-10x)`, `Debug Wax`, `Fuzzy Alt (30-45 Minutes)`,
`Glitched Drives (1x)`, `Gumdroppers (30-45 Minutes)`, `Nectar Shower Vial (1-2 Vials)`,
`Sprouts (50-55x)`, `Swirled Waxes (3-4 Waxes)`, `Tadpole Alt (24 Hours)`, `Turpentine`.
We are 11 items short — the only category where they lead.

### 10. Their per-roll history is richer than ours.
Their API stores **2,883 history points across 724 of 848 rolls**. We store **0 roll-level
history points** — our beequip rolls carry only a static value, range and demand.
Their roll values also carry `>=` and cross-item expressions (`">={Bee Cub}+{Doodle Cub}"`) which
we discarded: **131 of our 848 roll ranges read `0-0`** where theirs carry a real floor
(e.g. `Autumn Sunhat → "14 Wfc"` is `>=100` for them, `0` for us; `Bang Snap → "Red Bomb + Red
Bomb+ (Full Waxed)" / Standard` is `>=30` for them, `0` for us).

### 11. Our beequip detail pages are broken.
`https://bss-index.vercel.app/item/kazoo/` renders the section **"ROLLS — No roll data available."**
even though `/api/item/kazoo.json` contains 36 roll groups with full values and demand. The
prerender pipeline does not read `beequipData`. The same page shows a "Price history (6 weeks)"
table with a **single row** (11-06-2026, 5.5★) sitting under a headline value of 125★.

### 12. They have community features we do not.
An always-on giveaways widget (`/api/giveaways/active`: "2 Stranded Sunbear", "1x Petal Cub",
with Discord join buttons), a cookie-consent flow, and a named team credits page
(Slymi — Lead Developer & Manager; CLPD — Developer; gyhkijffk — Help with Maths; GUI — Initial
Trade Offer Creator Design; Delta — Initial Ideas; "And all BSSM List Evaluators").
We have a Discord link and an Authors dialog, nothing else.

### 13. Their beequip browse UX is better than ours.
Their `/values/beequips` splits the list into **NON-BEESMAS / BEESMAS** groups and drills down
`Beequips / Kazoo / Base Critical Power (Unwaxed)` → 8 roll variants each with value and demand
(verified: clicking the `→` expands the group inline). Our Beequips tab shows one flat list of 41
rows with no roll breakdown.

### 14. Our images are theirs.
**330 of 330** of our item images are hotlinked from `https://bssmvalues.com/images/...`. If
they ever block that host, every item image on our site breaks — and we have no fallback.

### 15. Our ⌘K search modal is hard-coded in Russian, even on the English site.
On `https://bss-index.vercel.app/` (lang="en") the modal renders "Поиск", "Введите название
предмета или аббревиатуру стата", "↑↓ навигация / ↵ выбрать / esc закрыть". The competitor's
search UI is fully English. Our English visitors get a Russian-language search dialog with no
way to switch it.

### 16. Our two search paths disagree with each other.
The API resolves Russian category slang ("куб" → 12 Cub Skins) but has **no acronym index**
(`PPM`, `DDC`, `DDH`, `GGB` → 0 results). The ⌘K modal resolves acronyms and Russian item names
but **not** category slang ("куб" → "No items found"). Same product, two different result sets
for the same query — a bug that will read as "search is broken" to anyone who tries both.

---

## 4. What we have that they do not

- **330 real, server-rendered item pages** (plus 330 RU equivalents) with per-item title, meta,
  `hreflang` and schema.org `Product` JSON-LD. They have **zero**.
- **A 14-endpoint public JSON API** at `/api/v1/` with CORS `*`, OpenAPI 3.1, and English +
  Russian HTML docs. They have **one** unversioned, undocumented endpoint.
- **Per-item and per-category API documents** — fetch one item's full record without downloading
  the whole catalogue.
- **A server-side search API** that understands English, Russian, slugs, transliteration and
  community slang ("куб", "кубь", "kub").
- **A market-movers endpoint** (`/api/v1/changes.json` — 10 biggest gainers and 10 biggest losers
  over 7 days with 30-day change) and a **stats endpoint** (`/api/v1/stats.json`).
- **A lean search index** (`/api/v1/search-index.json`, 42 KB) for instant client-side filtering.
- **A full Russian localisation** — 330 RU item pages, RU homepage, RU API docs, `hreflang`.
- **A global ⌘K / Ctrl+K search modal** with keyboard navigation, covering names, acronyms
  **and beequip stat acronyms** (HAH / WFC / BP).
- **32 beequip stat-acronym filter chips** in the Beequips tab.
- **A stability / trend field** (Falling / Rising / Stable) plus **7-day % change badges** on every
  card. Their entire dataset has no equivalent of either.
- **Editorial descriptions** written per item (Russian prose explaining what the item's demand
  actually feels like).
- **Shareable trade URLs** (`?trade=…`) that restore both sides of a calculator trade.
- **Screenshot-to-clipboard** PNG export of a trade card.
- **A "Hide Prices" mode** in the calculator.
- **4 background presets** (Dots / Grid / Smooth / Aurora), a **Reduce Motion** toggle and a
  **price-badge visibility** toggle.
- **Related items** on every item page (12 for Bee Cub).
- **A `Changes` / market-movers concept at API level** and a 7-day trend on every card.
- **A GitHub link** (`github.com/happy-g0ose`) and an Authors/about dialog in the header.
- **A static crawlable catalogue page** at `/items/` listing all 330 items grouped by category.
- **Real JSON numbers** in the API instead of the competitor's numeric strings.

---

## 5. What they have that we do not

- **An online marketplace** with live user listings, prices, "Looking For" terms, seller/buyer
  Roblox usernames, filters, `Create Listing` and `My Listings`.
- **User accounts** (`/api/auth/session`, `/api/user`, header Login button).
- **A wax calculator** (`/wax`) for beequip waxing odds by stat, star potential and wax type.
- **A guides section** with 6 categories (Blue Hive, Red Hive, White Hive, Early Game, RDP, Other).
- **A "Services" category with 11 items** we do not carry (waxes, drives, alt accounts, Turpentine…).
- **Per-roll price history** for 724 of 848 beequip rolls (2,883 points). We have none.
- **`>=` and cross-item value expressions** on rolls (`">={Bee Cub}"`, `">={Bee Cub}+{Doodle Cub}"`)
  — we flattened 131 of 848 rolls to `0-0`.
- **A working PWA manifest** (`/site.webmanifest`, standalone display, 192/512 maskable icons).
- **A real value chart** on the homepage (dated price line + 0/5–5/5 demand axis).
- **A giveaways widget** fed by `/api/giveaways/active`.
- **A cookie-consent flow** (Accept / Decline).
- **A team credits page** naming 5 contributors.
- **"Trusted by 185K+ players"** social proof.
- **A 6-level numeric demand scale (0–5)** — we compress their 0 and 1 into a single "Low" label.
- **Non-Beequips / Beesmas split** in the beequip browser, plus inline roll expansion.
- **A mobile bottom tab bar** and zero horizontal overflow at 390 px.
- **An ad-supported revenue model** (pubnation, Google Ads, Criteo, Rubicon, OpenX, Media.net …).
- **A dedicated "Wax" nav item**, a "Guides" nav item and a "More" overflow menu in the header.
- **Two Discord servers** linked from the chrome (ours has one).

---

## 6. Unique angles for us — features neither site has, worth building

1. **A trade *matchmaker* built on our API.** Not a marketplace — a stateless "who has what" board
   driven by the listings we already expose via `/api/v1/`, letting players post needs without
   accounts. Cheaper than building the competitor's marketplace, and it plugs our existing API.
2. **A "trade optimiser" that prices demand, not just averages.** Our calculator already has
   demand + stability per item and theirs explicitly says "Item demand is not yet factored into
   calculations". Factor demand into the verdict and we own a niche they have publicly left open.
3. **A beequip roll *scanner*.** Our API exposes 848 rolls across 142 stat groups. Build a
   "which beequip can give me HAH ≥ 8 WFC" tool, with the 32 stat-acronym filter we already have
   as the entry point. Neither site does this.
4. **A wax-odds calculator we own.** They have one (`/wax`). We could beat it by adding
   our roll values + demand so the output is a *value* estimate, not just a probability.
5. **Real per-roll history.** They have 2,883 roll history points and we have none. Starting to
   publish roll-level history is a direct, defensible data lead.
6. **A price-alert / watchlist layer.** Nobody has one. We already have `/api/v1/changes.json` and
   stable slugs — a "notify me when Star Cub drops below 8★" feature is a natural extension and
   creates a reason to come back daily.
7. **An embeddable widget + Discord bot.** `/api/v1/openapi.json` and CORS `*` are already in
   place. A `bss-index.vercel.app/widget?item=star-cub` iframe and a Discord slash command
   (`/value star-cub`) would put us inside the community the competitor can only link to.
8. **A wax/roll value expression engine.** Their `">={Bee Cub}"` strings prove the data model
   wants expressions. A resolver that evaluates those against our live values is a genuinely
   novel, defensible feature.
9. **A public "price index" / market summary dashboard.** We have `/api/v1/stats.json` and
   `/api/v1/changes.json`; nothing renders them as a market overview page with a trend chart.
10. **First-class Russian-language editorial.** They have none. Even a short "how to read BSS
    values / what demand means / how to flip a beequip" guide in Russian, written by us and
    hosted on us (not a Google Doc), would own a category that the Russian-speaking majority of
    this audience searches for.
11. **A PWA.** Cheapest win on the list — add a `site.webmanifest` and a service worker and we
    match their installability.
12. **A price-history chart on item pages.** They have one chart; we have 2,287 history points
    and a table. Shipping the chart we already designed (`item.chart` i18n key exists) closes a
    visible gap in minutes.

---

## 7. Numbers

### Catalogue

| Metric | Ours | Competitor |
|---|---|---|
| Total items | 330 | 341 |
| Stickers / vouchers | 289 | 300 |
| Beequips | 41 | 41 |
| Beequip stat groups | 142 | 142 |
| Beequip rolls | 848 | 848 |
| Sticker categories | 17 | 18 |
| Total categories (incl. Beequips) | 18 | 18 + beequip list |
| Categories where counts differ | 1 (Services: ours 0, theirs 11) | — |
| Sticker history data points | 2,287 | 2,298 |
| Roll history data points | **0** | 2,883 (across 724/848 rolls) |
| Roll value ranges that differ from theirs | 131 (we show `0-0`) | — |
| Sticker value ranges identical to theirs | **288 / 289** | — |
| Item images hosted on bssmvalues.com | 330 / 330 | 330 / 300 |

### URLs and pages

| Metric | Ours | Competitor |
|---|---|---|
| Sitemap URLs | **664** (85,615 B) | **12** (2,006 B) |
| Per-item pages (EN) | 330 | **0** |
| Per-item pages (RU) | 330 | 0 |
| Total indexable item URLs | 660 | 0 |
| Item page HTML size (bee-cub) | 17,502 B | n/a |
| Item page HTML size (RU bee-cub) | 17,632 B | n/a |
| Static catalogue page | `/items/` 29,624 B, 330 items | none (client-rendered only) |
| Prerendered RU landing | `/ru/` 13,997 B | n/a |
| JS bundle | 672,990 B | 14 chunks + 2 CSS |
| CSS bundle | 92,506 B | — |
| robots.txt | 74 B, points to our sitemap | 68 B, points to their sitemap |

### API

| Metric | Ours | Competitor |
|---|---|---|
| Public endpoints | **14** (`/api/v1/*`) | **1** (`/api/values`) |
| Documented endpoints | 14 in `/api/v1/docs.html` (24,044 B) + `docs.ru.html` (24,669 B) | 0 |
| OpenAPI spec | yes, 33,389 B, OpenAPI 3.1 | no |
| Full catalogue document | `/api/v1/items.json` 161,883 B | `/api/values` 498,810 B (33,314 B brotli) |
| Compact values document | `/api/values.json` 154,952 B | — |
| Search index | `/api/v1/search-index.json` 42,191 B | — |
| Legacy discovery doc | `/api/index.json` 3,153 B (v2.1.0, lists categories + 5 endpoints) | — |
| Raw app data file | `/data/items.json` 384,096 B | — |
| Per-item document | 3,042 B (`star-cub.json`) | not available |
| Per-category document | 8,260 B (`bee-stickers/items.json`) | not available |
| Per-item history document | 775 B (`star-cub/history.json`) | not available |
| CORS | `Access-Control-Allow-Origin: *` on all | not verified |
| Value types | real JSON numbers | strings (`"280"`, `">=150"`, `">={Bee Cub}"`) |
| Stable identifiers | slug + id + name + nameRu + category + categorySlug | display name only |
| Cache policy | CDN | `public, max-age=60, stale-while-revalidate=300` |
| Data timestamp | generated 2026-10-20T11:21:59Z | per-item `last_updated` 2026-05-22 → 2026-10-18 |

### Search behaviour (measured in-browser)

| Query | Ours (API `/api/v1/search`) | Ours (⌘K modal) | Competitor (`/values/stickers`) |
|---|---|---|---|
| no query | 330 items | 330 items | 300 cards |
| `cub` | 13 | 12 | 15 |
| `voucher` | 6 | — | 6 |
| `bear` | — | — | 19 |
| `honey` | 2 | — | — |
| `star cub` (multi-word) | — | 1 (Star Cub) | — |
| `ppm` (acronym) | **0** | **1 (Peppermint Cub (PPM))** | 2 (Peppermint Cub, BBM From Below) |
| `DDC` (acronym) | **0** | **1 (Doodle Cub (DDC))** | 2 (Doodle Cub, Doodle Hive Skin) |
| `DDH` (acronym) | 0 | — | 2 (Doodle Cub, Doodle Hive Skin) |
| `hah` / `wfc` / `bp` (stat acronyms) | 0 | **resolves to the beequips carrying that stat (HAH → 4)** | not supported |
| `куб` / `кубь` / `kub` | **12** | 0 | 19 (unrelated fallback set) |
| `пчела` | **17** | — | — |
| `медведь` | **14** | — | 19 (identical set to `звезда`) |
| `панама` (Russian item name) | — | **1 (Autumn Sunhat)** | — |
| `казу` (Russian item name) | — | **1 (Kazoo)** | — |
| `ZZZZ` | 0 | 0 | 4 (fuzzy: Fuzz Bomb, Fuzzy Alt, Pizza Delivery Man, Ticket Voucher) |
| `xyz` | 0 | 0 | 0 |

**Our two search paths do not cover the same things.** The API resolves Russian category slang
("куб" → 12 Cub Skins) but has **no acronym index** (PPM/DDC/DDH/GGB → 0). The ⌘K modal resolves
acronyms and Russian *item* names but has **no category slang** ("куб" → "No items found").
The competitor's single fuzzy matcher handles English names and acronyms but nothing else.

### Assets, PWA, mobile

| Metric | Ours | Competitor |
|---|---|---|
| PWA manifest | **none** (404 × 4 paths) | `/site.webmanifest` 437 B, standalone, 192+512 maskable |
| apple-touch-icon | 874,051 B | 46,677 B |
| favicon.ico | 35,982 B | yes |
| favicon.svg | no | yes |
| Service worker | none | none (no `/sw.js`) |
| Mobile overflow @ 390 px | **398 px (8 px overflow)** | 380 px (none) |
| Mobile nav | top bar, collapses | bottom tab bar (Home/Value/Online/Trade/Guides/Wax/More) |
| Cookie banner | none | yes |
| Ad vendors in CSP | none | pubnation, Google Ads, Criteo, Rubicon, OpenX, Media.net, 40+ more |

### Business / community

| Metric | Ours | Competitor |
|---|---|---|
| Claimed audience | "Created for Bee Swarm Simulator traders" | "Trusted by 185K+ players" |
| Discord links in chrome | 1 (`discord.gg/ZXmycxjvv9`) | 2 (giveaway invites) |
| YouTube / Twitter / X links in chrome | none / none | none / none (YouTube only inside one guide card) |
| GitHub link | yes (`github.com/happy-g0ose`) | no |
| Giveaways widget | no | yes (`/api/giveaways/active`) |
| Team credits page | Authors dialog (1 person) | Credits page (5 named people) |
| Account system | no | yes |
| Market listings | 0 | live feed |
| Guides | 0 | 6 categories, external links |
| Wax calculator | no | yes |

---

## Appendix — how the data was gathered

- `node` + `fetch` for all raw HTTP: both homepages, sitemaps, robots.txt, manifests, icons,
  both APIs, all 14 of our `/api/v1/` endpoints, and 21 competitor URL probes.
- Playwright (Chromium) in a clean browser context for every rendered page: our home / Stickers /
  Beequips / Calculator / Settings / `?trade=` restore / `/item/bee-cub/` / `/item/kazoo/` /
  `/ru/` / `/ru/item/bee-cub/` / 390 px viewport; competitor home / `/values/stickers` /
  `/values/beequips` / `/market` / `/calculator` / `/wax` / `/guides` / 390 px viewport.
- Direct JSON diff of `/data/items.json` (330 items) against `/api/values` (341 items) for
  per-item value ranges, demand levels, history point counts and all 848 beequip roll ranges.
