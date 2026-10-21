/**
 * Pulls real payloads from the live API so the partner documentation can show
 * actual output rather than made-up samples.
 */
const ORIGIN = 'https://bss-index.vercel.app';

async function main() {
  console.log('=== GET /api/v1/items/bee-cub.json (trimmed) ===');
  const item = await (await fetch(`${ORIGIN}/api/v1/items/bee-cub.json`)).json();
  console.log(JSON.stringify({
    slug: item.slug,
    name: item.name,
    nameRu: item.nameRu,
    category: item.category,
    categoryRu: item.categoryRu,
    value: item.value,
    valueLow: item.valueLow,
    valueHigh: item.valueHigh,
    demand: item.demand,
    demandEn: item.demandEn,
    stability: item.stability,
    change7d: item.change7d,
    change30d: item.change30d,
    image: item.image,
    url: item.url,
    historyPoints: item.historicalPrices?.length,
    related: item.related?.slice(0, 2).map((r) => r.name),
  }, null, 2));

  console.log('\n=== GET /api/v1/search?q=bee&limit=2 ===');
  const search = await (await fetch(`${ORIGIN}/api/v1/search?q=bee&limit=2`)).json();
  console.log(JSON.stringify({
    query: search.query,
    total: search.total,
    count: search.count,
    limit: search.limit,
    items: search.items.map((i) => ({ name: i.name, value: i.value, change7d: i.change7d, url: i.url })),
  }, null, 2));

  console.log('\n=== GET /api/v1/changes.json (trimmed) ===');
  const changes = await (await fetch(`${ORIGIN}/api/v1/changes.json`)).json();
  console.log(JSON.stringify({
    gainers: changes.gainers.slice(0, 3).map((g) => ({ name: g.name, value: g.value, change7d: g.change7d })),
    losers: changes.losers.slice(0, 3).map((g) => ({ name: g.name, value: g.value, change7d: g.change7d })),
  }, null, 2));

  console.log('\n=== GET /api/v1/stats.json ===');
  console.log(JSON.stringify(await (await fetch(`${ORIGIN}/api/v1/stats.json`)).json(), null, 2));

  console.log('\n=== widget embed snippet ===');
  console.log(`<iframe src="${ORIGIN}/w/bee-cub/" width="320" height="180" style="border:0;border-radius:12px"></iframe>`);
  console.log(`\n=== widget with no footer link ===`);
  console.log(`${ORIGIN}/w/bee-cub/?embed=1`);
}

main();
