/**
 * Finds the roll-price mapping bug: our beequip rolls that have 0-0 while the
 * source API has a real range.
 */
import fs from 'fs';

const theirs = await (await fetch('https://bssmvalues.com/api/values')).json();
const ours = JSON.parse(fs.readFileSync('bot/items.json', 'utf8'));

const byEnglish = new Map(ours.map((i) => [i.englishName, i]));

let total = 0;
let zeroOurs = 0;
let zeroTheirs = 0;
let mismatched = 0;
const samples = [];

for (const [name, entry] of Object.entries(theirs.Beequip || {})) {
  const ourItem = byEnglish.get(name);
  if (!ourItem) {
    console.log('  NO MATCH for beequip:', name);
    continue;
  }
  const ourGroups = new Map((ourItem.beequipData || []).map((g) => [g.groupName, g.rolls || []]));

  for (const [groupName, group] of Object.entries(entry.stat_groups || {})) {
    const ourRolls = new Map((ourGroups.get(groupName) || []).map((r) => [r.rollName, r]));

    for (const [rollName, roll] of Object.entries(group || {})) {
      if (!roll || typeof roll !== 'object') continue;
      total++;

      const theirLow = Number(roll.value_min);
      const theirHigh = Number(roll.value_max);
      const our = ourRolls.get(rollName);

      if (!our) {
        if (samples.length < 6) samples.push({ beequip: name, group: groupName, roll: rollName, issue: 'MISSING in ours', theirs: { low: theirLow, high: theirHigh } });
        mismatched++;
        continue;
      }

      const ourIsZero = !our.valueLow && !our.valueHigh;
      const theirIsZero = !theirLow && !theirHigh;

      if (ourIsZero) zeroOurs++;
      if (theirIsZero) zeroTheirs++;

      if (ourIsZero && !theirIsZero) {
        mismatched++;
        if (samples.length < 8) {
          samples.push({
            beequip: name,
            group: groupName,
            roll: rollName,
            issue: 'ours 0-0, theirs has values',
            theirs: { low: theirLow, high: theirHigh, value: roll.value ?? null, demand: roll.demand },
            ours: { low: our.valueLow, high: our.valueHigh, value: our.value, demand: our.demand },
          });
        }
      } else if (!ourIsZero && !theirIsZero) {
        // values differ?
        if (Math.abs(our.valueLow - theirLow) > 0.001 || Math.abs(our.valueHigh - theirHigh) > 0.001) {
          mismatched++;
          if (samples.length < 8) {
            samples.push({
              beequip: name, group: groupName, roll: rollName,
              issue: 'values differ',
              theirs: { low: theirLow, high: theirHigh },
              ours: { low: our.valueLow, high: our.valueHigh },
            });
          }
        }
      }
    }
  }
}

console.log('rolls in source      :', total);
console.log('ours with 0-0        :', zeroOurs);
console.log('theirs with 0-0      :', zeroTheirs);
console.log('mismatched           :', mismatched);
console.log('\nsamples:');
for (const s of samples) console.log('  ' + JSON.stringify(s));
