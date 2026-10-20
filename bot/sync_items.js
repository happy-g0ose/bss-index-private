/**
 * Kept for backwards compatibility with `npm run sync`.
 *
 * The item data now lives in bot/items.json only — that file IS the source of
 * truth. It is written by scratch/update_prices.py and turned into
 * public/data/items.json for the site by scripts/generate-runtime-items.cjs.
 *
 * There is nothing to sync any more, so this just reports the current state.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const itemsPath = path.join(__dirname, 'items.json');

try {
  const items = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
  const withValue = items.filter((i) => i.value > 0).length;
  console.log(`✓ bot/items.json is up to date: ${items.length} items (${withValue} with a value).`);
  console.log('  Run `node scripts/generate-runtime-items.cjs` to refresh the site payload.');
} catch (err) {
  console.error('✖ Error reading items.json:', err.message);
  process.exitCode = 1;
}
