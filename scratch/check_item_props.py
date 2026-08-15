import json

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

for it in items[:15]:
    print(f"[{it['name']} / {it['englishName']}] (Demand: {it['demand']}, Value: {it['value']}, Low: {it['valueLow']}, High: {it['valueHigh']}, Stability: {it['stability']})")
    print(f"  Desc: {it.get('description', '')[:80]}")
