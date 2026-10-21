/**
 * Looks for roll values that are not plain numbers - expressions like
 * ">=100" or ">={Bee Cub}" - which our numeric parser would drop.
 */
const theirs = await (await fetch('https://bssmvalues.com/api/values')).json();
import fs from 'fs';
const ours = JSON.parse(fs.readFileSync('bot/items.json', 'utf8'));

const nonNumeric = [];
const numeric = [];
let exprRolls = 0;

for (const [name, entry] of Object.entries(theirs.Beequip || {})) {
  for (const [groupName, group] of Object.entries(entry.stat_groups || {})) {
    for (const [rollName, roll] of Object.entries(group || {})) {
      if (!roll || typeof roll !== 'object') continue;
      const low = roll.value_min;
      const high = roll.value_max;
      const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
      if (isNum(low) && isNum(high)) {
        numeric.push({ name, groupName, rollName, low: Number(low), high: Number(high), value: roll.value });
      } else {
        exprRolls++;
        nonNumeric.push({
          beequip: name, group: groupName, roll: rollName,
          value_min: low, value_max: high, value: roll.value,
          demand: roll.demand,
        });
      }
    }
  }
}

console.log('rolls total          :', numeric.length + exprRolls);
console.log('plain numeric        :', numeric.length);
console.log('expression-valued    :', exprRolls);
console.log('\nexpression samples:');
for (const e of nonNumeric.slice(0, 12)) console.log('  ' + JSON.stringify(e));

// How many of our rolls are 0-0 AND their source is a plain 0?
const zeroBoth = numeric.filter((r) => !r.low && !r.high);
console.log('\nsource rolls that are genuinely 0-0:', zeroBoth.length);
console.log('  sample:', zeroBoth.slice(0, 4).map((r) => r.name + '/' + r.rollName).join(', '));

// What do we store for an expression roll?
const ourItem = ours.find((i) => i.englishName === nonNumeric[0]?.beequip);
if (ourItem && nonNumeric[0]) {
  const grp = (ourItem.beequipData || []).find((g) => g.groupName === nonNumeric[0].group);
  const ourRoll = (grp?.rolls || []).find((r) => r.rollName === nonNumeric[0].rollName);
  console.log('\nwhat we store for that roll:', JSON.stringify(ourRoll));
  console.log('  (source says value_min=' + JSON.stringify(nonNumeric[0].value_min) + ')');
}
