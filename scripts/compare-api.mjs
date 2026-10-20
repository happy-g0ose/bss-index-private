/**
 * Side-by-side comparison of the BSS Index API against the competitor's.
 * Run with: node scripts/compare-api.mjs
 */
const OURS = 'https://bss-index.vercel.app';
const THEIRS = 'https://bssmvalues.com';

async function probe(origin, path, opts = {}) {
  try {
    const res = await fetch(origin + path, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      ...opts,
    });
    const cors = res.headers.get('access-control-allow-origin');
    // Measure the decoded body: content-length is the compressed size, which
    // would flatter one side and not the other.
    const text = await res.text();
    const bytes = Buffer.byteLength(text, 'utf8');
    return { ok: res.status === 200, status: res.status, cors, bytes, text };
  } catch (e) {
    return { ok: false, status: 'ERR', cors: null, bytes: 0 };
  }
}

function row(name, ours, theirs, better) {
  console.log(
    '  ' + name.padEnd(30) +
    String(ours).padEnd(26) +
    String(theirs).padEnd(26) +
    (better || '')
  );
}

const yesNo = (v) => (v ? 'yes' : 'no');

async function main() {
  console.log('BSS Index API vs bssmvalues.com\n');

  const ourRoot = await probe(OURS, '/api/v1/index.json');
  const theirRoot = await probe(THEIRS, '/api/values');

  console.log('  ' + 'metric'.padEnd(30) + 'bss-index.vercel.app'.padEnd(26) + 'bssmvalues.com'.padEnd(26) + 'winner');
  console.log('  ' + '-'.repeat(88));

  row('single item lookup', '/api/v1/items/bee-cub.json', 'none', 'us');
  row('per-item history', '/api/v1/items/bee-cub/history.json', 'none', 'us');
  row('search endpoint', '/api/v1/search?q=bee', 'none', 'us');
  row('category listing', '/api/v1/categories/vouchers/items.json', 'none', 'us');
  row('market movers', '/api/v1/changes.json', 'none', 'us');
  row('market stats', '/api/v1/stats.json', 'none', 'us');
  row('OpenAPI spec', '/api/v1/openapi.json', 'none', 'us');
  row('human docs', '/api/v1/docs.html', 'none', 'us');
  row('versioned', 'v1', 'no', 'us');

  console.log('');
  row('CORS header', yesNo(ourRoot.cors === '*'), yesNo(theirRoot.cors === '*'),
    ourRoot.cors === '*' && theirRoot.cors !== '*' ? 'us' : '');
  row('values as numbers', 'yes', 'no (strings)', 'us');
  row('Russian aliases', 'yes', 'no', 'us');
  row('documentation', 'yes', 'no', 'us');

  const ourItem = await probe(OURS, '/api/v1/items/bee-cub.json');
  console.log('');
  console.log('  size to read ONE item:      ours ' + (ourItem.bytes / 1024).toFixed(1) +
    ' KB   vs   theirs ' + (theirRoot.bytes / 1024).toFixed(0) + ' KB for everything');
  console.log('  ratio: ' + Math.round(theirRoot.bytes / Math.max(ourItem.bytes, 1)) + 'x smaller');
}

main();
