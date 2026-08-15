import json

with open("values_live.json", "r", encoding="utf-8") as f:
    live = json.load(f)

with open("bot/items.json", "r", encoding="utf-8") as f:
    current_items = json.load(f)

print(f"Total current items: {len(current_items)}")

# Match items by englishName
current_by_name = {it["englishName"].lower(): it for it in current_items}

# Check stickers from live
live_stickers = {}
for g_name, group in live["Sticker"]["groups"].items():
    for item_name, data in group["items"].items():
        live_stickers[item_name.lower()] = (g_name, item_name, data)

print(f"Total live stickers: {len(live_stickers)}")

matched_stickers = 0
unmatched_stickers = []
for name, (g_name, orig_name, data) in live_stickers.items():
    if name in current_by_name:
        matched_stickers += 1
    else:
        unmatched_stickers.append((g_name, orig_name))

print(f"Matched stickers: {matched_stickers}, Unmatched stickers: {len(unmatched_stickers)}")
if unmatched_stickers:
    print("Unmatched stickers sample:", unmatched_stickers[:10])

# Check beequips from live
live_beequips = {}
for bq_name, data in live["Beequip"].items():
    live_beequips[bq_name.lower()] = (bq_name, data)

print(f"Total live beequips: {len(live_beequips)}")

matched_bq = 0
unmatched_bq = []
for name, (orig_name, data) in live_beequips.items():
    if name in current_by_name:
        matched_bq += 1
    else:
        unmatched_bq.append(orig_name)

print(f"Matched beequips: {matched_bq}, Unmatched beequips: {len(unmatched_bq)}")
if unmatched_bq:
    print("Unmatched beequips sample:", unmatched_bq[:10])
