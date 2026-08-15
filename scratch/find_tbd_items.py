import json

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

zero_stickers = []
zero_beequips = []
zero_rolls = []

for it in items:
    if it.get("category") == "Биквипы" or "beequipData" in it:
        # Check overall beequip
        if it.get("value", 0) <= 0 or it.get("valueLow", 0) <= 0:
            zero_beequips.append(it)
        # Check rolls
        for g in it.get("beequipData", []):
            for r in g.get("rolls", []):
                if r.get("value", 0) <= 0 or r.get("valueLow", 0) <= 0:
                    zero_rolls.append((it["name"], it["englishName"], g["groupName"], r["rollName"], r.get("demand")))
    else:
        if it.get("value", 0) <= 0 or it.get("valueLow", 0) <= 0:
            zero_stickers.append(it)

print(f"Stickers with 0/TBD value ({len(zero_stickers)}):")
for s in zero_stickers:
    print(f"  - {s['name']} ({s['englishName']}) | Cat: {s['category']} | Demand: {s['demand']}")

print(f"\nBeequips with overall 0/TBD value ({len(zero_beequips)}):")
for b in zero_beequips:
    print(f"  - {b['name']} ({b['englishName']}) | Demand: {b['demand']}")

print(f"\nBeequip rolls with 0/TBD value ({len(zero_rolls)}):")
for bq_ru, bq_en, g_name, r_name, dem in zero_rolls:
    print(f"  - {bq_ru} ({bq_en}) -> [{g_name}] {r_name} (Demand: {dem})")
