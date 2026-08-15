import json

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

beequips = [it for it in items if it.get("category") == "Биквипы" or "beequipData" in it]
print(f"Total beequips in bot/items.json: {len(beequips)}")

sample = beequips[0]
print("Sample beequip name:", sample["name"])
print("Sample beequipData:", json.dumps(sample["beequipData"], ensure_ascii=False, indent=2)[:600])
