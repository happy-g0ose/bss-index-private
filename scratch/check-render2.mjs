import fs from 'fs';

const s = fs.readFileSync('dist/item/autumn-sunhat/index.html', 'utf8');
console.log('  contains Wfc      :', s.includes('Wfc'));
console.log('  contains Stats     :', s.includes('Stats'));
console.log('  contains Характеристики:', s.includes('Характеристики'));
console.log('  card blocks       :', s.split('class="card"').length - 1);

const i = s.indexOf('Wfc');
console.log('\n  Wfc context:');
console.log('   ' + (i >= 0
  ? s.slice(Math.max(0, i - 400), i + 260).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  : 'NOT FOUND'));

// What does the prerender script think it produced?
console.log('\n  section headers in the page:');
for (const m of s.matchAll(/<h2>([^<]{0,40})</g)) console.log('    - ' + m[1]);
