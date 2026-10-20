const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const V1 = path.join(ROOT, 'dist', 'api', 'v1');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(V1);
const total = files.reduce((a, f) => a + fs.statSync(f).size, 0);

const groups = new Map();
for (const f of files) {
  const rel = path.relative(V1, f).split(path.sep).join('/');
  let key;
  if (rel === 'index.json') key = 'index.json (discovery)';
  else if (rel === 'openapi.json') key = 'openapi.json';
  else if (rel === 'docs.html') key = 'docs.html';
  else if (rel === 'index.html') key = 'index.html (base-URL landing)';
  else if (rel === 'items.json') key = 'items.json (all items)';
  else if (rel === 'search-index.json') key = 'search-index.json';
  else if (rel === 'categories.json') key = 'categories.json';
  else if (rel === 'changes.json') key = 'changes.json';
  else if (rel === 'stats.json') key = 'stats.json';
  else if (rel.includes('/history.json')) key = 'items/<slug>/history.json  (330 files)';
  else if (rel.startsWith('items/') && rel.endsWith('.json')) key = 'items/<slug>.json  (330 files)';
  else if (rel.startsWith('categories/')) key = 'categories/<slug>/items.json  (18 files)';
  else key = rel;
  if (!groups.has(key)) groups.set(key, { count: 0, bytes: 0 });
  const g = groups.get(key);
  g.count++;
  g.bytes += fs.statSync(f).size;
}

console.log('dist/api/v1 — ' + files.length + ' files, ' + (total / 1024).toFixed(1) + ' KB total\n');
console.log('file group'.padEnd(42) + 'count'.padStart(7) + 'size'.padStart(12));
console.log('-'.repeat(61));
const order = [
  'index.json (discovery)',
  'openapi.json',
  'docs.html',
  'index.html (base-URL landing)',
  'items.json (all items)',
  'search-index.json',
  'categories.json',
  'categories/<slug>/items.json  (18 files)',
  'items/<slug>.json  (330 files)',
  'items/<slug>/history.json  (330 files)',
  'changes.json',
  'stats.json',
];
for (const key of order) {
  const g = groups.get(key);
  if (!g) continue;
  const size = g.bytes > 1024 * 1024 ? (g.bytes / 1024 / 1024).toFixed(2) + ' MB' : (g.bytes / 1024).toFixed(1) + ' KB';
  console.log(key.padEnd(42) + String(g.count).padStart(7) + size.padStart(12));
}
console.log('-'.repeat(61));
console.log('TOTAL'.padEnd(42) + String(files.length).padStart(7) + (total / 1024).toFixed(1).padStart(9) + ' KB');
console.log('\nindividual headline files:');
for (const name of ['items.json', 'search-index.json', 'index.json', 'openapi.json', 'docs.html', 'changes.json', 'stats.json', 'categories.json']) {
  const s = fs.statSync(path.join(V1, name)).size;
  console.log('  ' + name.padEnd(20) + (s / 1024).toFixed(2).padStart(8) + ' KB');
}
const sample = fs.statSync(path.join(V1, 'items', 'star-cub.json')).size;
const sampleHist = fs.statSync(path.join(V1, 'items', 'star-cub', 'history.json')).size;
console.log('  items/star-cub.json'.padEnd(22) + (sample / 1024).toFixed(2).padStart(8) + ' KB  (single item)');
console.log('  items/star-cub/history.json'.padEnd(22) + (sampleHist / 1024).toFixed(2).padStart(8) + ' KB');
