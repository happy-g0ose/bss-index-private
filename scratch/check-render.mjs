import fs from 'fs';

const s = fs.readFileSync('dist/item/autumn-sunhat/index.html', 'utf8');
const marker = '+ ★';

console.log('  has "14 Wfc":', s.includes('14 Wfc'));
console.log('  has "15 Wfc":', s.includes('15 Wfc'));
console.log('  floor markers ("+ ★"):', s.split(marker).length - 1);

const i = s.indexOf('14 Wfc');
const chunk = s.slice(Math.max(0, i - 260), i + 420).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log('\n  context:\n   ' + chunk);

// Also check the API output
const api = JSON.parse(fs.readFileSync('dist/api/v1/items/autumn-sunhat.json', 'utf8'));
const roll = api.rolls.find((r) => r.rollName === '14 Wfc');
console.log('\n  API roll 14 Wfc:', JSON.stringify(roll));
const roll2 = api.rolls.find((r) => r.rollName === '15 Wfc');
console.log('  API roll 15 Wfc:', JSON.stringify(roll2));
const floors = api.rolls.filter((r) => r.isFloor).length;
const withText = api.rolls.filter((r) => r.valueText).length;
console.log('  API rolls: ' + api.rolls.length + ' | with valueText: ' + withText + ' | floors: ' + floors);
