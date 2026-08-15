import json

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

print(f"Total items in bot/items.json: {len(items)}")

categories = {}
for it in items:
    cat = it.get("category")
    categories[cat] = categories.get(cat, 0) + 1
print("Categories:", categories)

sticker_sample = next(it for it in items if it.get("category") == "Скины на куба")
beequip_sample = next(it for it in items if it.get("category") == "Биквипы")

print("\nSample Sticker:")
print(json.dumps(sticker_sample, ensure_ascii=False, indent=2))

print("\nSample Beequip:")
print(json.dumps(beequip_sample, ensure_ascii=False, indent=2)[:800])
