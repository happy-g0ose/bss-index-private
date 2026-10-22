/**
 * Landing page for /api/ — the public entry point of the BSS Index API.
 *
 * It lists the endpoints, shows a copy-paste example and points at the full
 * documentation. The previous /api/ index.json was the legacy v0 shape, which
 * is now served from /api/v0/ instead.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const API_DIR = path.join(DIST, 'api');
const ORIGIN = (process.env.SITE_ORIGIN || 'https://bss-index.vercel.app').replace(/\/$/, '');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ENDPOINTS = [
  ['GET', '/api/v1/index.json', 'Discovery document: version, categories, every endpoint.'],
  ['GET', '/api/v1/items.json', 'Every item with its current value. Also at /api/v1/values.json.'],
  ['GET', '/api/v1/items/{slug}.json', 'One item: value, range, history, rolls and related items.'],
  ['GET', '/api/v1/items/{slug}/history.json', 'The full price series with 7 and 30 day change.'],
  ['GET', '/api/v1/categories.json', 'Every category with counts and value statistics.'],
  ['GET', '/api/v1/categories/{slug}/items.json', 'All items of one category.'],
  ['GET', '/api/v1/changes.json', 'Biggest gainers and losers of the last 7 days.'],
  ['GET', '/api/v1/stats.json', 'Market summary: counts, average, median, extremes.'],
  ['GET', '/api/v1/search-index.json', 'A 41 KB index for instant client-side search.'],
  ['GET', '/api/v1/search?q=&category=&sort=&limit=&offset=', 'Server-side search with ranking and pagination.'],
  ['GET', '/api/v1/openapi.json', 'OpenAPI 3.1 specification.'],
  ['GET', '/api/v1/docs.html', 'This documentation, in English.'],
  ['GET', '/api/v1/docs.ru.html', 'The same documentation, in Russian.'],
];

function main() {
  if (!fs.existsSync(API_DIR)) {
    console.warn('[api-landing] dist/api not found. Skipping.');
    return;
  }

  const rows = ENDPOINTS.map(
    ([method, p, desc]) =>
      `        <tr>
          <td><span class="m">${esc(method)}</span></td>
          <td><code>${esc(p)}</code></td>
          <td>${esc(desc)}</td>
        </tr>`
  ).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BSS Index API — values for Bee Swarm Simulator</title>
<meta name="description" content="Free public JSON API for Bee Swarm Simulator item values: per-item prices, price history, beequip rolls, categories, market movers and server-side search. CORS enabled, no key required.">
<link rel="canonical" href="${esc(ORIGIN)}/api/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BSS Index API">
<meta property="og:title" content="BSS Index API — values for Bee Swarm Simulator">
<meta property="og:description" content="Free public JSON API for Bee Swarm Simulator item values. No key required, CORS enabled.">
<meta property="og:url" content="${esc(ORIGIN)}/api/">
<meta property="og:image" content="${esc(ORIGIN)}/logo.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #0b0f19; color: #e5e5e5;
    font-family: Inter, system-ui, -apple-system, sans-serif; line-height: 1.6;
  }
  .wrap { max-width: 880px; margin: 0 auto; padding: 48px 20px 72px; }
  .badge {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    border: 1px solid rgba(245,158,11,.3); background: rgba(245,158,11,.1);
    color: #fbbf24; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  }
  h1 { margin: 18px 0 10px; font-size: clamp(28px, 6vw, 44px); font-weight: 900; line-height: 1.05; text-transform: uppercase; }
  h2 { margin: 44px 0 14px; font-size: 13px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #fbbf24; }
  p { color: #a1a1aa; margin: 0 0 14px; }
  .lead { font-size: 17px; color: #d4d4d8; max-width: 62ch; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 18px; }
  .box { background: rgba(11,15,25,.65); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 16px 18px; }
  .box b { display: block; color: #fbbf24; font-size: 13px; margin-bottom: 4px; }
  .box span { font-size: 13px; color: #a1a1aa; }
  pre {
    background: #070a10; border: 1px solid rgba(255,255,255,.07); border-radius: 12px;
    padding: 16px; overflow-x: auto; font-size: 12.5px; line-height: 1.65;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #d4d4d8;
  }
  pre .k { color: #fbbf24; }
  pre .s { color: #86efac; }
  pre .c { color: #52525b; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: #71717a; font-weight: 800; padding: 0 10px 8px 0; }
  td { padding: 9px 10px 9px 0; border-top: 1px solid rgba(255,255,255,.06); vertical-align: top; color: #a1a1aa; }
  td code { color: #fbbf24; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  .m { color: #34d399; font-weight: 800; font-size: 11px; letter-spacing: .06em; }
  .links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  a.primary, a.ghost {
    display: inline-block; padding: 11px 18px; border-radius: 11px; text-decoration: none;
    font-size: 13px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
  }
  a.primary { background: #f59e0b; color: #0b0f19; }
  a.primary:hover { background: #fbbf24; }
  a.ghost { border: 1px solid rgba(255,255,255,.14); color: #d4d4d8; }
  a.ghost:hover { border-color: #fbbf24; color: #fbbf24; }
  footer { margin-top: 52px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.07); font-size: 13px; color: #71717a; }
  footer a { color: #fbbf24; }
  @media (max-width: 560px) { .wrap { padding: 32px 16px 56px; } }
</style>
</head>
<body>
<main class="wrap">
  <span class="badge">Public API · No key required</span>
  <h1>BSS Index API</h1>
  <p class="lead">Every sticker, voucher and beequip in Roblox <b>Bee Swarm Simulator</b> with its current value, price history and market state. Free, CORS enabled, and ready to read from a browser, a bot or a spreadsheet.</p>

  <div class="links">
    <a class="primary" href="/api/v1/docs.html">Read the docs</a>
    <a class="ghost" href="/api/v1/docs.ru.html">Документация на русском</a>
    <a class="ghost" href="/demo/">Live demo</a>
    <a class="ghost" href="/">BSS Index site</a>
  </div>

  <h2>Quick start</h2>
<pre><span class="c">// one item, 3 KB</span>
<span class="k">fetch</span>(<span class="s">'/api/v1/items/bee-cub.json'</span>)
  .then(r =&gt; r.json())
  .then(({ name, value, demand, change7d }) =&gt;
    console.log(name, value, demand, change7d));
<span class="c">// -&gt; Bee Cub 290 Low -14.5</span>

<span class="c">// search, server-side</span>
<span class="k">fetch</span>(<span class="s">'/api/v1/search?q=bee&amp;limit=5'</span>).then(r =&gt; r.json());

<span class="c">// curl</span>
curl ${esc(ORIGIN)}/api/v1/items/star-cub.json</pre>

  <h2>What you get</h2>
  <div class="grid">
    <div class="box"><b>Values as numbers</b><span>Real JSON numbers, not strings. Ready to sum and compare.</span></div>
    <div class="box"><b>Per-item endpoints</b><span>3 KB for one price instead of downloading the whole list.</span></div>
    <div class="box"><b>Price history</b><span>Full series plus 7 and 30 day change on every item.</span></div>
    <div class="box"><b>Beequip rolls</b><span>Every roll with its own price, including the floored ones.</span></div>
    <div class="box"><b>Server-side search</b><span>Ranking, sorting and pagination, Russian names included.</span></div>
    <div class="box"><b>Market movers</b><span>What went up and what went down this week.</span></div>
  </div>

  <h2>Endpoints</h2>
  <table>
    <thead><tr><th style="width:56px">Method</th><th style="width:330px">Path</th><th>What it returns</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <h2>Notes</h2>
  <p>Every primary field is English. The Russian counterpart sits next to it in a <code style="color:#fbbf24">*Ru</code> field, so nothing is lost: <code style="color:#fbbf24">name</code> / <code style="color:#fbbf24">nameRu</code>, <code style="color:#fbbf24">demand</code> / <code style="color:#fbbf24">demandRu</code>.</p>
  <p>CORS is <code style="color:#fbbf24">*</code>, so you can call it straight from a browser. The older API shape is still available under <a href="/api/v0/">/api/v0/</a> and is deprecated.</p>

  <footer>
    Data for <a href="https://bssmvalues.com/api/values">bssmvalues.com</a>, served by BSS Index. Built for Bee Swarm Simulator traders.
  </footer>
</main>
</body>
</html>`;

  fs.writeFileSync(path.join(API_DIR, 'index.html'), html, 'utf-8');
  console.log('[api-landing] wrote dist/api/index.html');
}

main();
