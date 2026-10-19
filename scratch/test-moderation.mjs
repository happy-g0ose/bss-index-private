/**
 * Moderation rule checks. Run with: node scratch/test-moderation.mjs
 * Written as a real file (not a shell heredoc) so the Cyrillic survives.
 */
import { inspectMessage, updateConfig } from '../bot/lib/moderation.js';

const member = (id = '1', roles = []) => ({
  id,
  roles: { cache: { has: (r) => roles.includes(r) } },
});

const cases = [
  ['го в дискорд discord.gg/cheat123', true, 'discord invite'],
  ['ЗАБЕРИ СВОЙ НИТРО бесплатно', true, 'ru nitro'],
  ['бесплатные стикеры в подарок', true, 'ru free stickers'],
  ['твой аккаунт угнали', true, 'ru account theft'],
  ['акк угнал мошенник', true, 'ru account theft 2'],
  ['мой аккаунт взломали', true, 'ru hacked'],
  ['мой аккаунт украли', true, 'ru stolen'],
  ['@everyone @everyone @everyone @everyone @everyone', true, 'mention spam'],
  ['давайте поменяем 2x Star Cub на 1x Bee Cub', false, 'legit trade'],
  ['кто знает цену на Nessie?', false, 'normal question'],
  ['бесплатно отдам 5 стикеров', false, "benign 'free'"],
  ['скины cub дешевле на рынке', false, 'benign skins'],
  ['а где тут валют лист', false, 'normal ru text'],
];

let pass = 0;
const failed = [];

for (const [text, shouldHit, note] of cases) {
  const { hits } = inspectMessage({ content: text, member: member() });
  const ok = hits.length > 0 === shouldHit;
  if (ok) pass++;
  else failed.push(note);
  console.log(
    ' ', ok ? 'PASS' : 'FAIL',
    (hits.length ? 'HIT  ' : 'clean'),
    note.padEnd(20),
    hits.map((h) => h.rule).join(',')
  );
}

console.log('  ->', `${pass}/${cases.length}`,
  failed.length ? `FAILED: ${failed.join(', ')}` : 'all green');

// exempt roles must win
updateConfig({ exemptRoleIds: ['MOD'] });
const exemptHits = inspectMessage({ content: 'discord.gg/x', member: member('1', ['MOD']) }).hits;
console.log('  exempt role  ->', exemptHits.length, 'hits (want 0)', exemptHits.length === 0 ? 'OK' : 'BROKEN');
updateConfig({ exemptRoleIds: [] });

// off mode must silence everything
updateConfig({ mode: 'off' });
const offHits = inspectMessage({ content: 'discord.gg/x', member: member() }).hits;
console.log('  mode off    ->', offHits.length, 'hits (want 0)', offHits.length === 0 ? 'OK' : 'BROKEN');
updateConfig({ mode: 'watch' });
