/**
 * Prints the title and og:title of a built HTML page.
 * Usage: node scripts/peek.mjs dist/ru/item/bee-cub/index.html [...]
 */
const fs = require('fs');

for (const p of process.argv.slice(2)) {
  if (!fs.existsSync(p)) {
    console.log(p + '  MISSING');
    continue;
  }
  const h = fs.readFileSync(p, 'utf8');
  const title = (h.match(/<title>([^<]*)/) || [])[1];
  const og = (h.match(/property="og:title" content="([^"]*)/) || [])[1];
  const desc = (h.match(/name="description" content="([^"]*)/) || [])[1];
  console.log(p);
  console.log('  title: ' + title);
  console.log('  og   : ' + og);
  console.log('  desc : ' + String(desc || '').slice(0, 120));
}
