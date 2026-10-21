/**
 * Verifies the roll-price fix: how many rolls now carry a real value, and
 * whether the resolved numbers match the source expression.
 */
import fs from 'fs';

const ours = JSON.parse(fs.readFileSync('bot/items.json', 'utf8'));
const theirs = await (await fetch('https://bssmvalues.com/api/values')).json();

let total = 0;
let zero = 0;
let withText = 0;
let floors = 0;
let resolvedComposite = 0;
const samples = [];

for (const item of ours.filter((i) => i.category === 'Биквипы')) {
  for (const g of item.beequipData || []) {
    for (const r of g.rolls || []) {
      total++;
      if (!r.valueLow && !r.valueHigh) zero++;
      if (r.valueText) {
        withText++;
        if (r.isFloor) floors++;
        if (/[{}]/.test(r.valueText)) resolvedComposite++;
        if (samples.length < 8) {
          samples.push(`${item.englishName} / ${g.groupName} / ${r.rollName}: ${r.valueText} -> ${r.valueLow} (floor=${!!r.isFloor})`);
        }
      }
    }
  }
}

console.log('rolls total            :', total);
console.log('still 0-0              :', zero, zero === 3 ? '(the genuinely empty ones)' : '');
console.log('with valueText         :', withText);
console.log('marked as floor        :', floors);
console.log('composite resolved     :', resolvedComposite);
console.log('\nsamples:');
for (const s of samples) console.log('  ' + s);

// Cross-check every roll against the source.
let mismatch = 0;
const byName = new Map(ours.map((i) => [i.englishName, i]));
for (const [name, entry] of Object.entries(theirs.Beequip || {})) {
  const ourItem = byName.get(name);
  if (!ourItem) continue;
  for (const [groupName, group] of Object.entries(entry.stat_groups || {})) {
    const ourGroup = (ourItem.beequipData || []).find((g) => g.groupName === groupName);
    if (!ourGroup) continue;
    for (const [rollName, roll] of Object.entries(group || {})) {
      const ourRoll = (ourGroup.rolls || []).find((r) => r.rollName === rollName);
      if (!ourRoll) continue;
      const srcText = roll.value_min;
      const srcNum = typeof srcText === 'number' ? srcText : Number(String(srcText).match(/-?\d+(\.\d+)?/)?.[0]);
      // For a plain numeric source the value must match exactly.
      if (srcText !== null && srcText !== undefined && !/[{}<>]/.test(String(srcText))) {
        if (Math.abs(ourRoll.valueLow - srcNum) > 0.001) {
          mismatch++;
          if (mismatch <= 5) console.log('  MISMATCH', name, rollName, 'src', srcNum, 'ours', ourRoll.valueLow);
        }
      }
    }
  }
}
console.log('\nnumeric mismatches vs source:', mismatch);
