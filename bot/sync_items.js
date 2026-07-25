import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const itemsTsPath = path.join(__dirname, '..', 'src', 'data', 'items.ts');
const outJsonPath = path.join(__dirname, 'items.json');

try {
  const content = fs.readFileSync(itemsTsPath, 'utf-8');
  
  // Find rawBssItemsData array start after equals sign
  const startIdx = content.indexOf("const rawBssItemsData");
  const equalsIdx = content.indexOf("=", startIdx);
  const arrayStart = content.indexOf("[", equalsIdx);
  
  let bracketCount = 1;
  let currentIdx = arrayStart + 1;
  while (bracketCount > 0 && currentIdx < content.length) {
    if (content[currentIdx] === '[') bracketCount++;
    else if (content[currentIdx] === ']') bracketCount--;
    currentIdx++;
  }
  
  const jsonText = content.substring(arrayStart, currentIdx);
  // Parse and sanitize items JSON
  const items = JSON.parse(jsonText);
  
  fs.writeFileSync(outJsonPath, JSON.stringify(items, null, 2), 'utf-8');
  console.log(`✅ Successfully synced ${items.length} BSS items to bot/items.json!`);
} catch (err) {
  console.error('❌ Error syncing items:', err);
}
