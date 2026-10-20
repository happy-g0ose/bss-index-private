/**
 * Lists the ids of items whose price changed, by comparing the working copy of
 * bot/items.json with the version in git.
 *
 * A plain `git diff` will not do: with unified=0 only the changed lines show
 * up, and the "id" line is not one of them — so the diff approach silently
 * reported zero changed items.
 *
 * Usage: node scripts/changed-items.cjs [ref]
 *   ref defaults to HEAD (the last commit).
 *   Prints one id per line, and also writes changed-ids.txt for the workflow.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REL = 'bot/items.json';

function loadFromGit(ref) {
  try {
    const raw = execSync(`git show ${ref}:${REL}`, { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function main() {
  const ref = process.argv[2] || 'HEAD';
  const file = path.join(ROOT, REL);

  let current = [];
  try {
    current = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`[changed-items] cannot read ${REL}: ${err.message}`);
    process.exit(1);
  }

  const previous = loadFromGit(ref);
  if (!previous) {
    console.log(`[changed-items] no previous version at ${ref} - treating everything as changed.`);
    const ids = current.map((i) => i.id);
    fs.writeFileSync(path.join(ROOT, 'changed-ids.txt'), ids.join(' ') + '\n', 'utf-8');
    console.log(ids.join(' '));
    return;
  }

  const prevById = new Map(previous.map((i) => [i.id, i]));
  const changed = [];

  for (const item of current) {
    const before = prevById.get(item.id);
    if (!before) {
      changed.push(item.id); // new item
      continue;
    }
    if (
      before.value !== item.value ||
      before.valueLow !== item.valueLow ||
      before.valueHigh !== item.valueHigh ||
      before.demand !== item.demand ||
      before.stability !== item.stability
    ) {
      changed.push(item.id);
    }
  }

  fs.writeFileSync(path.join(ROOT, 'changed-ids.txt'), changed.join(' ') + '\n', 'utf-8');
  console.log(`[changed-items] ${changed.length} item(s) changed`);
  console.log(changed.join(' '));
}

main();
