/**
 * Checks the generated API documentation: the English page, the Russian page,
 * and that the two are linked to each other.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const V1 = path.join(__dirname, '..', 'dist', 'api', 'v1');
const en = fs.readFileSync(path.join(V1, 'docs.html'), 'utf8');
const ru = fs.readFileSync(path.join(V1, 'docs.ru.html'), 'utf8');

const results = [];
const ok = (name, cond, detail) => {
  results.push(cond);
  console.log('  ' + (cond ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(40) + (detail ?? ''));
};

const cyrillic = (s) => (s.match(/[\u0400-\u04FF]/g) || []).length;

console.log('english page:');
ok('starts with doctype', en.trimStart().startsWith('<!doctype html>'));
ok('html lang is en', /<html lang="en"/.test(en));
ok('has no untranslated leftovers', !/undefined|NaN|\[object/.test(en));
ok('links to the russian page', en.includes('./docs.ru.html'));
ok('declares hreflang ru', en.includes('hreflang="ru"'));
ok('shows endpoint paths', en.includes('/api/v1/items/') && en.includes('/api/v1/search'));
ok('documents the english-first fields', en.includes('nameRu') && en.includes('categoryRu'));

console.log('\nrussian page:');
ok('starts with doctype', ru.trimStart().startsWith('<!doctype html>'));
ok('html lang is ru', /<html lang="ru"/.test(ru));
ok('has cyrillic text', cyrillic(ru) > 200, cyrillic(ru) + ' cyrillic chars');
ok('no untranslated leftovers', !/undefined|NaN|\[object/.test(ru));
ok('links back to the english page', ru.includes('./docs.html'));
ok('declares hreflang en', ru.includes('hreflang="en"'));
ok('shows endpoint paths', ru.includes('/api/v1/items/') && ru.includes('/api/v1/search'));
ok('documents the new fields', ru.includes('nameRu') && ru.includes('categoryRu'));

console.log('\ntranslations:');
// The pages show endpoint PATHS, not the internal catalogue keys, so check
// the paths instead — that is what a reader actually looks for.
const endpointPaths = [
  '/api/v1/index.json',
  '/api/v1/items.json',
  '/api/v1/items/{slug}.json',
  '/api/v1/items/{slug}/history.json',
  '/api/v1/categories.json',
  '/api/v1/categories/{slug}/items.json',
  '/api/v1/search',
  '/api/v1/changes.json',
  '/api/v1/stats.json',
  '/api/v1/search-index.json',
  '/api/v1/openapi.json',
  '/api/v1/docs.html',
];
const missingRu = endpointPaths.filter((p) => !ru.includes(p));
const missingEn = endpointPaths.filter((p) => !en.includes(p));
ok('every endpoint path in the RU page', missingRu.length === 0,
  missingRu.length ? 'missing: ' + missingRu.join(', ') : endpointPaths.length + ' paths');
ok('every endpoint path in the EN page', missingEn.length === 0,
  missingEn.length ? 'missing: ' + missingEn.join(', ') : endpointPaths.length + ' paths');

console.log('\nsummary: ' + results.filter(Boolean).length + '/' + results.length + ' checks passed');
process.exitCode = results.every(Boolean) ? 0 : 1;
