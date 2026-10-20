/**
 * Live check of the English-first API and the Russian documentation.
 */
const ORIGIN = 'https://bss-index.vercel.app';

const results = [];
const ok = (name, cond, detail) => {
  results.push(cond);
  console.log('  ' + (cond ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(38) + (detail ?? ''));
};

const cyrillic = (s) => (s.match(/[\u0400-\u04FF]/g) || []).length;

async function main() {
  console.log('documentation:');
  for (const p of ['/api/v1/docs.html', '/api/v1/docs.ru.html']) {
    const res = await fetch(ORIGIN + p);
    const text = await res.text();
    ok(p, res.status === 200 && text.includes('<!doctype html>'),
      res.status + ', ' + text.length + ' bytes, ' + cyrillic(text) + ' cyrillic');
  }

  const ru = await (await fetch(ORIGIN + '/api/v1/docs.ru.html')).text();
  const en = await (await fetch(ORIGIN + '/api/v1/docs.html')).text();
  ok('ru links to en', ru.includes('./docs.html'));
  ok('en links to ru', en.includes('./docs.ru.html'));
  ok('ru has hreflang en', ru.includes('hreflang="en"'));
  ok('ru has no leftovers', !/undefined|NaN|\[object/.test(ru));

  console.log('\nenglish-first fields:');
  const items = await (await fetch(ORIGIN + '/api/v1/items.json')).json();
  ok('item count', items.length === 330, items.length + ' items');
  ok('no nameEn left', !items.some((i) => 'nameEn' in i));
  ok('no categoryEn left', !items.some((i) => 'categoryEn' in i));
  ok('name is english', items.every((i) => typeof i.name === 'string' && i.name.length > 0));
  ok('category is english', items.every((i) => !/[Ѐ-ӿ]/.test(i.category)));
  ok('categoryRu is russian', items.every((i) => /[Ѐ-ӿ]/.test(i.categoryRu)));
  const withRu = items.filter((i) => i.nameRu !== null);
  ok('nameRu set only where needed', withRu.length === 41, withRu.length + ' items have nameRu');

  const bee = items.find((i) => i.slug === 'bee-cub');
  ok('bee cub name', bee?.name === 'Bee Cub', bee?.name + ' / ' + bee?.nameRu);
  const hat = items.find((i) => i.slug === 'autumn-sunhat');
  ok('autumn sunhat name', hat?.name === 'Autumn Sunhat', hat?.name + ' / ' + hat?.nameRu);

  console.log('\nsearch with the new shape:');
  for (const [q, note] of [['q=bee', 'english'], ['q=панама', 'russian name'], ['q=куб', 'russian alias']]) {
    const r = await (await fetch(ORIGIN + '/api/v1/search?' + q)).json();
    const first = r.items?.[0];
    ok('search ' + note, r.total > 0, r.total + ' hits, first: ' + (first?.name ?? '-') + ' (' + (first?.nameRu ?? 'null') + ')');
  }

  const cats = await (await fetch(ORIGIN + '/api/v1/categories.json')).json();
  ok('categories english names', cats.every((c) => !/[Ѐ-ӿ]/.test(c.name)), cats.length + ' categories');
  ok('categories keep russian', cats.every((c) => /[Ѐ-ӿ]/.test(c.nameRu)));

  console.log('\nsummary: ' + results.filter(Boolean).length + '/' + results.length + ' checks passed');
}

main();
