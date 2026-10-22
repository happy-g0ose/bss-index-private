/**
 * Generates the runtime item data for the site.
 *
 * WHY THIS EXISTS
 * The item data used to live in src/data/items.ts, which Vite inlined into the
 * JS bundle — 520 KB of prices, history and roll data inside a 1 MB bundle.
 * Now the data is served as a static JSON file and fetched at runtime, so the
 * bundle drops to ~480 KB and the data is cached separately from the code.
 *
 * SOURCE OF TRUTH
 * bot/items.json is the single source of truth. This script only transforms it:
 *   - star signs are pinned to a value of 1.0 (they were special-cased in the
 *     old items.ts mapping)
 *   - everything else is copied verbatim
 *
 * Note: the per-item colours (glowColor, borderColor, badgeColor, textColor)
 * are kept AS THEY ARE. The old items.ts used to overwrite them with a single
 * colour per category, which made the catalog disagree with the prerendered
 * item pages. Per-item colours are more varied and match the item pages.
 *
 * Outputs:
 *   public/data/items.json  - the runtime payload served to the browser
 */
const fs = require('fs');
const path = require('path');
const { applyCategoryStyles } = require('./lib/category-styles.cjs');
const { changes } = require('./lib/change.cjs');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'bot', 'items.json');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT_FILE = path.join(OUT_DIR, 'items.json');

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.warn('[runtime-items] bot/items.json not found. Skipping.');
    return;
  }

  const items = JSON.parse(fs.readFileSync(SOURCE, 'utf-8'));

  const out = items.map((item) => {
    const isSign = item.category === 'Звездные знаки';
    const adjusted = {
      ...item,
      value: isSign ? 1.0 : item.value,
      valueLow: isSign ? 1.0 : item.valueLow,
      valueHigh: isSign ? 1.0 : item.valueHigh,
      historicalPrices: isSign ? item.historicalPrices.map(() => 1.0) : item.historicalPrices,
    };
    // The 7/30 day changes are computed once here so the site, the API and
    // the static pages all show the same number.
    return applyCategoryStyles({ ...adjusted, ...changes(adjusted) });
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Compact, no BOM — a BOM breaks JSON.parse in the browser.
  fs.writeFileSync(OUT_FILE, JSON.stringify(out), 'utf-8');

  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  console.log(`[runtime-items] wrote ${out.length} items to public/data/items.json (${kb} KB)`);
}

main();
