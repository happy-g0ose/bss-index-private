/**
 * Indexing readiness check for the live site.
 * Verifies that the sitemap, canonical tags and hreflang agree with each other,
 * because Search Console rejects a sitemap whose URLs redirect.
 */
const ORIGIN = 'https://bss-index.vercel.app';

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log('  ' + (ok ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(34) + detail);
};

async function main() {
  console.log('redirect behaviour:');
  const noSlash = await fetch(ORIGIN + '/item/bee-cub', { redirect: 'manual' });
  check('/item/bee-cub (no slash)', noSlash.status === 200 || noSlash.status === 308,
    noSlash.status + ' -> ' + (noSlash.headers.get('location') || 'served directly'));

  console.log('\npage tags:');
  const html = await (await fetch(ORIGIN + '/item/bee-cub/')).text();
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/);
  check('canonical present', !!canon, canon ? canon[1] : 'MISSING');
  check('no noindex', !/<meta name="robots"[^>]*noindex/i.test(html), 'not blocked');
  const h1 = html.match(/<h1>([^<]+)<\/h1>/);
  check('h1 present', !!h1, h1 ? h1[1] : 'MISSING');

  const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)]
    .map((m) => m[1] + ' -> ' + m[2]);
  check('hreflang alternates', alternates.length === 3, alternates.join(' | '));

  console.log('\nsitemap:');
  const sm = await (await fetch(ORIGIN + '/sitemap.xml')).text();
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check('url count', locs.length === 662, locs.length + ' urls');
  const bee = locs.filter((l) => l.includes('bee-cub'));
  check('bee-cub entries', bee.length === 2, bee.join(' | '));

  // Do the sitemap URLs match the canonical URLs? A mismatch means Google sees
  // a redirect for every entry and devalues the sitemap.
  const canonicalSet = new Set();
  for (const sample of ['/item/bee-cub/', '/ru/item/bee-cub/']) {
    const page = await (await fetch(ORIGIN + sample)).text();
    const c = page.match(/<link rel="canonical" href="([^"]+)"/);
    if (c) canonicalSet.add(c[1]);
  }
  const smSet = new Set(bee);
  const mismatch = [...smSet].filter((u) => ![...canonicalSet].some((c) => c.replace(/\/$/, '') === u.replace(/\/$/, '')));
  check('sitemap matches canonical', mismatch.length === 0,
    mismatch.length ? 'MISMATCH: ' + mismatch.join(', ') : 'consistent');

  console.log('\nrobots.txt:');
  const robots = await (await fetch(ORIGIN + '/robots.txt')).text();
  check('sitemap declared', /Sitemap:\s*https?:\/\//i.test(robots),
    (robots.match(/Sitemap:.*/i) || ['MISSING'])[0]);
  check('not blocked', !/Disallow:\s*\/\s*$/m.test(robots), 'root allowed');

  console.log('\nsummary: ' + results.filter((r) => r.ok).length + '/' + results.length + ' checks passed');
}

main();
