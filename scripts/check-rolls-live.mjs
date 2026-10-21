/**
 * Live verification of the roll-price fix on production.
 */
const ORIGIN = 'https://bss-index.vercel.app';

const results = [];
const ok = (name, cond, detail) => {
  results.push(cond);
  console.log('  ' + (cond ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(42) + (detail ?? ''));
};

async function main() {
  console.log('beequip pages:');
  for (const slug of ['autumn-sunhat', 'kazoo', 'bang-snap', 'electric-candle']) {
    const res = await fetch(`${ORIGIN}/item/${slug}/`);
    const html = await res.text();
    const noData = /No roll data available|Нет данных о роллах/.test(html);
    const rollRows = (html.match(/<tr><td>/g) || []).length;
    ok(`/${slug}/`, res.status === 200 && !noData && rollRows > 0,
      res.status + ', ' + rollRows + ' roll rows' + (noData ? ' — SHOWS "no roll data"' : ''));
  }

  console.log('\nfloor markers:');
  const page = await (await fetch(`${ORIGIN}/item/autumn-sunhat/`)).text();
  ok('shows "100+" for a floor roll', page.includes('100+'), page.includes('100+') ? 'found' : 'missing');
  ok('shows "290+" for a composite roll', page.includes('290+'), page.includes('290+') ? 'found' : 'missing');

  console.log('\nAPI:');
  const api = await (await fetch(`${ORIGIN}/api/v1/items/autumn-sunhat.json`)).json();
  const floors = api.rolls.filter((r) => r.isFloor);
  const withText = api.rolls.filter((r) => r.valueText);
  ok('rolls expose valueText', withText.length > 0, withText.length + ' of ' + api.rolls.length);
  ok('rolls expose isFloor', floors.length > 0, floors.length + ' floors');
  const zero = api.rolls.filter((r) => !r.valueLow && !r.valueHigh);
  ok('few rolls left at zero', zero.length <= 2, zero.length + ' without a value');

  console.log('\ndemo site:');
  const demo = await fetch(`${ORIGIN}/demo/`);
  ok('/demo/ served', demo.status === 200, 'status ' + demo.status);

  console.log('\nsummary: ' + results.filter(Boolean).length + '/' + results.length + ' checks passed');
}

main();
