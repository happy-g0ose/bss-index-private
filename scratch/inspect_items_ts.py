import re
import json

# Read src/data/items.ts
with open("src/data/items.ts", "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("const rawBssItemsData: any[] = [")
array_start = content.find("[", start_idx)
bracket_count = 1
idx = array_start + 1
while bracket_count > 0 and idx < len(content):
    if content[idx] == '[':
        bracket_count += 1
    elif content[idx] == ']':
        bracket_count -= 1
    idx += 1

items_json_str = content[array_start:idx]
items = json.loads(items_json_str)

print(f"Total items in items.ts: {len(items)}")

# Check category distribution
categories = {}
for it in items:
    cat = it.get("category")
    categories[cat] = categories.get(cat, 0) + 1
print("Categories:", categories)

# Check a few sample items (Sticker & Beequip)
sticker_sample = next(it for it in items if it.get("category") == "Скины на куба")
beequip_sample = next(it for it in items if it.get("category") == "Биквипы")

print("\nSample Sticker:")
print(json.dumps(sticker_sample, ensure_ascii=False, indent=2))

print("\nSample Beequip:")
print(json.dumps(beequip_sample, ensure_ascii=False, indent=2)[:800])
