import json

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

for it in items:
    for g in it.get("beequipData", []):
        for r in g.get("rolls", []):
            if r.get("value", 0) <= 0 or r.get("valueLow", 0) <= 0:
                print(f"Remaining 0 roll: {it['englishName']} -> [{g['groupName']}] {ascii(r['rollName'])} (low: {r.get('valueLow')}, high: {r.get('valueHigh')}, val: {r.get('value')})")
