/**
 * Generates the IndexNow key file and writes it into public/ so the build
 * publishes it at <origin>/<key>.txt. IndexNow requires the key to be
 * verifiable from the site root.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const KEY_PATH = path.join(ROOT, 'indexnow.key');
const PUBLIC_DIR = path.join(ROOT, 'public');

function main() {
  let key = process.env.INDEXNOW_KEY;

  if (!key && fs.existsSync(KEY_PATH)) {
    key = fs.readFileSync(KEY_PATH, 'utf-8').trim();
  }

  if (!key) {
    key = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(KEY_PATH, key + '\n', 'utf-8');
    console.log('[indexnow-key] generated a new key');
  }

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, `${key}.txt`), key, 'utf-8');
  console.log(`[indexnow-key] key file ready (${key.length} chars)`);
}

main();
