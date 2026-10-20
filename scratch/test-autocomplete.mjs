/**
 * Checks the /price autocomplete label: emoji + name + value, and that the
 * result never exceeds Discord's 100 character limit for suggestion names.
 */
import { categoryEmoji } from '../bot/lib/items.js';
import { getItems } from '../bot/lib/items.js';

const items = getItems();
const over = [];
const samples = [];

for (const item of items) {
  const valStr =
    item.valueLow !== item.valueHigh
      ? `${item.valueLow}-${item.valueHigh}`
      : `${item.value}`;
  const label = `${categoryEmoji(item.category)} ${item.name} — ${valStr}★`;
  if (label.length > 100) over.push({ name: item.name, len: label.length });
  if (samples.length < 8) samples.push(label);
}

console.log('items            :', items.length);
console.log('over 100 chars   :', over.length, over.slice(0, 5));
console.log('sample labels    :');
for (const s of samples) console.log('   ', s);

console.log('\nevery category has an emoji?');
const cats = [...new Set(items.map((i) => i.category))];
for (const c of cats) {
  const e = categoryEmoji(c);
  console.log('  ', (e === '📦' ? 'MISSING' : 'ok     '), c, e);
}
