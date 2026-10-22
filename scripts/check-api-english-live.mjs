/**
 * Live check that the public API is English-first.
 */
const ORIGIN = 'https://bss-index.vercel.app';
const CYR = /[\u0400-\u04FF]/;

const results = [];
const ok = (name, cond, detail) => {
  results.push(cond);
  console.log('  ' + (cond ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(40) + (detail ?? ''));
};

async function main() {
  console.log('index.json:');
  const index = await (await fetch(`${ORIGIN}/api/v1/index.json`)).json();
  ok('categories are English', index.categories.every((c) => !CYR.test(c.name)),
    index.categories.slice(0, 3).map((c) => c.name).join(', '));
  ok('categories keep nameRu', index.categories.every((c) => CYR.test(c.nameRu || '')),
    index.categories[0].nameRu);
  ok('demand legend English', index.demandLevels.every((d) => !CYR.test(d.value)),
    index.demandLevels.map((d) => d.value).join(', '));
  ok('stability legend English', index.stabilityLevels.every((d) => !CYR.test(d.value)),
    index.stabilityLevels.map((d) => d.value).join(', '));
  ok('no Russian in endpoint text', !index.endpoints.some((e) => CYR.test(e.description || '') || CYR.test(e.summary || '')));

  console.log('\nitems.json:');
  const items = await (await fetch(`${ORIGIN}/api/v1/items.json`)).json();
  ok('item count', items.length === 330, items.length);
  ok('name is English', items.every((i) => !CYR.test(i.name)));
  ok('category is English', items.every((i) => !CYR.test(i.category)));
  ok('demand is English', items.every((i) => !CYR.test(String(i.demand))));
  ok('stability is English', items.every((i) => !CYR.test(String(i.stability))));
  ok('demandRu kept', items.every((i) => 'demandRu' in i));
  ok('stabilityRu kept', items.every((i) => 'stabilityRu' in i));
  ok('nameRu kept', items.every((i) => 'nameRu' in i));
  const sample = items.find((i) => i.nameRu);
  console.log('  sample:', JSON.stringify({
    name: sample.name, nameRu: sample.nameRu,
    category: sample.category, categoryRu: sample.categoryRu,
    demand: sample.demand, demandRu: sample.demandRu,
    stability: sample.stability, stabilityRu: sample.stabilityRu,
  }));

  console.log('\nitem detail:');
  const detail = await (await fetch(`${ORIGIN}/api/v1/items/autumn-sunhat.json`)).json();
  ok('description is English', !CYR.test(detail.description), detail.description.slice(0, 60));
  ok('descriptionRu keeps the original', CYR.test(detail.descriptionRu || ''), (detail.descriptionRu || '').slice(0, 45));
  ok('roll demand is English', (detail.rolls || []).every((r) => !CYR.test(String(r.demand))));
  ok('roll demandRu kept', (detail.rolls || []).every((r) => 'demandRu' in r));

  console.log('\nsearch:');
  const s = await (await fetch(`${ORIGIN}/api/v1/search?q=bee&limit=2`)).json();
  ok('search returns English demand', s.items.every((i) => !CYR.test(String(i.demand))),
    s.items[0].name + ' / ' + s.items[0].demand);
  ok('search keeps demandRu', s.items.every((i) => 'demandRu' in i));

  console.log('\ndocs:');
  const docs = await (await fetch(`${ORIGIN}/api/v1/docs.html`)).text();
  ok('english docs served', docs.includes('BSS Index API'));
  const ruDocs = await (await fetch(`${ORIGIN}/api/v1/docs.ru.html`)).text();
  ok('russian docs served', ruDocs.includes('BSS Index API'));

  console.log('\nsummary: ' + results.filter(Boolean).length + '/' + results.length + ' checks passed');
}

main();
