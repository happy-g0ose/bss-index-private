import json

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

zero_stickers = []
zero_beequips = []
zero_rolls = []

for it in items:
    if it.get("category") == "Биквипы" or "beequipData" in it:
        if it.get("value", 0) <= 0 or it.get("valueLow", 0) <= 0:
            zero_beequips.append(it["englishName"])
        for g in it.get("beequipData", []):
            for r in g.get("rolls", []):
                if r.get("value", 0) <= 0 or r.get("valueLow", 0) <= 0:
                    zero_rolls.append((it["englishName"], g["groupName"], r["rollName"]))
    else:
        if it.get("value", 0) <= 0 or it.get("valueLow", 0) <= 0:
            zero_stickers.append(it["englishName"])

print(f"Stickers with 0/TBD value: {len(zero_stickers)}")
print(f"Beequips with 0/TBD value: {len(zero_beequips)}")
print(f"Beequip rolls with 0/TBD value: {len(zero_rolls)}")
