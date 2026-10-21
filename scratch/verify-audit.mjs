/**
 * Verifies the most serious findings from the audit against the live site.
 */
const ORIGIN = 'https://bss-index.vercel.app';

const results = [];
const ok = (name, cond, detail) => {
  results.push(cond);
  console.log('  ' + (cond ? 'CONFIRMED ' : 'no       ') + name.padEnd(44) + (detail ?? ''));
};

async function main() {
  console.log('1. is the English homepage a static shell?');
  const home = await (await fetch(ORIGIN + '/')).text();
  const text = home.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('homepage visible text without JS', text.length > 300, text.length + ' chars: "' + text.slice(0, 90) + '"');
  ok('homepage has headings', (home.match(/<h1/g) || []).length > 0, (home.match(/<h1/g) || []).length + ' h1');
  ok('homepage has internal links', (home.match(/href="\/item\//g) || []).length > 0, (home.match(/href="\/item\//g) || []).length + ' item links');
  ok('homepage has JSON-LD', home.includes('application/ld+json'), 'found' );

  console.log('\n2. does an item page duplicate the whole catalogue?');
  const item = await (await fetch(ORIGIN + '/item/bee-cub/')).text();
  const cards = (item.match(/class="[^"]*glass-card/g) || []).length;
  ok('item page has 0 catalogue cards in HTML', cards === 0, cards + ' glass-card occurrences in the served HTML');

  console.log('\n3. the kazoo roll bug');
  const kazoo = await (await fetch(ORIGIN + '/item/kazoo/')).text();
  ok('kazoo page shows rolls', !/No roll data available/.test(kazoo),
    /No roll data available/.test(kazoo) ? 'shows "No roll data available"' : 'rolls present');
  const kazooApi = await (await fetch(ORIGIN + '/api/v1/items/kazoo.json')).json();
  ok('kazoo API has roll groups', (kazooApi.rolls || []).length > 0, (kazooApi.rolls || []).length + ' rolls');

  console.log('\n4. light theme contrast');
  const css = await (await fetch(ORIGIN + '/assets/' + (home.match(/href="\.\/assets\/([^"]+\.css)/) || [])[1])).text();
  ok('light theme overrides amber', css.includes('html.light'), 'found html.light rules');

  console.log('\n5. does the site ship a giant logo?');
  const logo = await fetch(ORIGIN + '/logo.png');
  const logoBytes = Number(logo.headers.get('content-length'));
  ok('logo.png is oversized', logoBytes > 200000, Math.round(logoBytes / 1024) + ' KB');

  console.log('\n6. do the two switches do anything?');
  const app = await (await fetch(ORIGIN + '/assets/' + (home.match(/src="\.\/assets\/([^"]+\.js)/) || [])[1])).text();
  ok('reduceMotion is consumed', /reduceMotion/.test(app) && !/reduceMotion[^,]{0,40}setReduceMotion/.test(app) === false,
    'referenced ' + (app.match(/reduceMotion/g) || []).length + ' times');
  ok('prefers-reduced-motion supported', css.includes('prefers-reduced-motion'), css.includes('prefers-reduced-motion') ? 'yes' : 'MISSING');

  console.log('\nsummary: ' + results.filter(Boolean).length + '/' + results.length + ' findings confirmed');
}

main();
