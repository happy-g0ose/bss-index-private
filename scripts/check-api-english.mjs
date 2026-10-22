/**
 * Checks that the public API is fully English.
 *
 * The API is English-first: every primary field holds the English value and the
 * Russian counterpart lives in a *Ru field. This script makes sure no Russian
 * text leaks into a primary field, and that the *Ru fields are still present
 * so nothing is silently lost.
 */
import fs from 'fs';
import path from 'path';

const V1 = path.join(process.cwd(), 'dist', 'api', 'v1');
const CYR = /[\u0400-\u04FF]/;

const results = [];
const ok = (name, cond, detail) => {
  results.push(cond);
  console.log('  ' + (cond ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(46) + (detail ?? ''));
};

/** Fields that are allowed to contain Russian. */
const RUSSIAN_OK = new Set(['nameRu', 'categoryRu', 'demandRu', 'stabilityRu', 'descriptionRu', 'valueRu']);

function scan(label, value, pathParts, hits) {
  if (typeof value === 'string') {
    if (CYR.test(value) && !RUSSIAN_OK.has(pathParts[pathParts.length - 1])) {
      hits.push(pathParts.join('.') + ' = ' + JSON.stringify(value.slice(0, 40)));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scan(label, v, pathParts.concat(String(i)), hits));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) scan(label, v, pathParts.concat(k), hits);
  }
}

function main() {
  const index = JSON.parse(fs.readFileSync(path.join(V1, 'index.json'), 'utf8'));
  const items = JSON.parse(fs.readFileSync(path.join(V1, 'items.json'), 'utf8'));
  const cats = JSON.parse(fs.readFileSync(path.join(V1, 'categories.json'), 'utf8'));
  const detail = JSON.parse(fs.readFileSync(path.join(V1, 'items', 'star-cub.json'), 'utf8'));
  const bq = JSON.parse(fs.readFileSync(path.join(V1, 'items', 'autumn-sunhat.json'), 'utf8'));
  const changes = JSON.parse(fs.readFileSync(path.join(V1, 'changes.json'), 'utf8'));
  const stats = JSON.parse(fs.readFileSync(path.join(V1, 'stats.json'), 'utf8'));
  const searchIndex = JSON.parse(fs.readFileSync(path.join(V1, 'search-index.json'), 'utf8'));

  console.log('Russian text in primary fields:');
  for (const [label, doc] of [
    ['index.json', index],
    ['items.json', items],
    ['categories.json', cats],
    ['items/star-cub.json', detail],
    ['items/autumn-sunhat.json', bq],
    ['changes.json', changes],
    ['stats.json', stats],
    ['search-index.json', searchIndex],
  ]) {
    const hits = [];
    scan(label, doc, [], hits);
    ok(label, hits.length === 0, hits.length ? hits.slice(0, 3).join(' | ') : 'clean');
  }

  console.log('\nEnglish-first shape:');
  const sample = items[0];
  ok('item.name is English', !CYR.test(sample.name), sample.name);
  ok('item.category is English', !CYR.test(sample.category), sample.category);
  ok('item.demand is English', !CYR.test(String(sample.demand)), sample.demand);
  ok('item.stability is English', !CYR.test(String(sample.stability)), sample.stability);
  ok('item.nameRu kept', 'nameRu' in sample, JSON.stringify(sample.nameRu));
  ok('item.categoryRu kept', 'categoryRu' in sample, sample.categoryRu);
  ok('item.demandRu kept', 'demandRu' in sample, sample.demandRu);
  ok('item.stabilityRu kept', 'stabilityRu' in sample, sample.stabilityRu);
  ok('no demandEn left', !('demandEn' in sample));
  ok('no stabilityEn left', !('stabilityEn' in sample));

  console.log('\nDescriptions:');
  ok('description is English', !CYR.test(detail.description), detail.description.slice(0, 70));
  ok('descriptionRu keeps the original', CYR.test(detail.descriptionRu || ''), (detail.descriptionRu || '').slice(0, 50));

  console.log('\nCategories:');
  ok('category name English', !CYR.test(cats[0].name), cats[0].name);
  ok('category nameRu kept', CYR.test(cats[0].nameRu), cats[0].nameRu);
  ok('index categories English', index.categories.every((c) => !CYR.test(c.name)));

  console.log('\nLegends:');
  ok('demand legend English', index.demandLevels.every((d) => !CYR.test(d.value)),
    index.demandLevels.map((d) => d.value).join(', '));
  ok('stability legend English', index.stabilityLevels.every((d) => !CYR.test(d.value)),
    index.stabilityLevels.map((d) => d.value).join(', '));

  console.log('\nsummary: ' + results.filter(Boolean).length + '/' + results.length + ' checks passed');
  process.exitCode = results.every(Boolean) ? 0 : 1;
}

main();
