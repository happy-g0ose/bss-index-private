import json
import re
import os

DEMAND_MAP = {
    0: "Низкий",
    1: "Низкий",
    2: "Низкий",
    3: "Средний",
    4: "Высокий",
    5: "Хайп"
}

DEMAND_DESC_MAP = {
    0: "Item is effectively unsellable at its listed value. Индикаторы: No one wants it, no offers, extreme lowballs only.",
    1: "Item is difficult to sell and heavily underpaid. Индикаторы: Low buyer interest, frequent lowballs, takes long time to trade.",
    2: "Item is slow to sell and often receives lowballs. Индикаторы: Slow to sell, mostly lowballs, few real buyers.",
    3: "Item sells, but not quickly, and value acceptance varies. Индикаторы: Sells, but not quickly, mix of fair offers and lowballs, needs some patience.",
    4: "Item usually sells at or near its listed value without struggle. Индикаторы: Sells fast, gets fair offers, lowballs are rare.",
    5: "Item has massive hype and high trade velocity. Индикаторы: High demand, sells instantly, often overpaid."
}

def clean_float(val):
    if val is None:
        return 0.0
    try:
        return float(val)
    except:
        return 0.0

def calc_stability(prices):
    if len(prices) >= 2:
        if prices[-1] > prices[-2]:
            return "Растет"
        elif prices[-1] < prices[-2]:
            return "Падает"
    return "Стабильно"

with open("values_live.json", "r", encoding="utf-8") as f:
    live = json.load(f)

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

# Save values.json as well
with open("values.json", "w", encoding="utf-8") as f:
    json.dump(live, f, ensure_ascii=False, indent=2)

live_stickers = {}
for g_name, group in live["Sticker"]["groups"].items():
    for item_name, data in group["items"].items():
        live_stickers[item_name.lower().strip()] = (g_name, item_name, data)

live_beequips = {}
for bq_name, data in live["Beequip"].items():
    live_beequips[bq_name.lower().strip()] = (bq_name, data)

# Несовпадения названий: наше englishName -> имя в bssmvalues.com
NAME_ALIASES = {
    "cub voucher": "cub buddy voucher",
    "round basic": "round basic bee",
    "wobbly looker": "wobbly looker bee",
}

for our_key, live_key in NAME_ALIASES.items():
    if live_key in live_stickers and our_key not in live_stickers:
        live_stickers[our_key] = live_stickers[live_key]
    elif live_key not in live_stickers:
        print(f"WARNING: alias target not found in live data: {live_key!r}")

updated_count = 0
price_changes = []

for item in items:
    eng_name_key = item["englishName"].lower().strip()
    is_beequip = item.get("category") == "Биквипы" or "beequipData" in item
    
    if is_beequip and eng_name_key in live_beequips:
        orig_name, bq_live = live_beequips[eng_name_key]
        old_val = item["value"]
        
        # Build beequipData
        stat_groups = bq_live.get("stat_groups", {})
        new_beequip_data = []
        all_roll_lows = []
        all_roll_highs = []
        
        primary_history = []
        
        for g_name, rolls_dict in stat_groups.items():
            rolls_list = []
            for roll_name, roll_data in rolls_dict.items():
                r_low = clean_float(roll_data.get("value_min"))
                r_high = clean_float(roll_data.get("value_max"))
                r_val = round((r_low + r_high) / 2.0, 4) if (r_low != r_high) else r_low
                r_demand_num = roll_data.get("demand", 1)
                r_demand = DEMAND_MAP.get(r_demand_num, "Низкий")
                
                all_roll_lows.append(r_low)
                all_roll_highs.append(r_high)
                
                rolls_list.append({
                    "rollName": roll_name,
                    "valueLow": r_low,
                    "valueHigh": r_high,
                    "value": r_val,
                    "demand": r_demand
                })
                
                if not primary_history and roll_data.get("history"):
                    primary_history = roll_data["history"]
                    
            if rolls_list:
                new_beequip_data.append({
                    "groupName": g_name,
                    "rolls": rolls_list
                })
                
        item["beequipData"] = new_beequip_data
        
        if all_roll_lows and all_roll_highs:
            item["valueLow"] = min(all_roll_lows)
            item["valueHigh"] = max(all_roll_highs)
            item["value"] = round((item["valueLow"] + item["valueHigh"]) / 2.0, 4)
            
        if primary_history:
            h_prices = []
            h_dates = []
            for h in primary_history:
                h_low = clean_float(h.get("value_min"))
                h_high = clean_float(h.get("value_max"))
                h_val = round((h_low + h_high) / 2.0, 4) if (h_low != h_high) else h_low
                h_prices.append(h_val)
                if h.get("date"):
                    h_dates.append(h["date"])
            item["historicalPrices"] = h_prices
            if h_dates:
                item["historicalDates"] = h_dates
            item["stability"] = calc_stability(h_prices)
            
        if old_val != item["value"]:
            updated_count += 1
            price_changes.append((item["name"], old_val, item["value"]))
            
    elif eng_name_key in live_stickers:
        g_name, orig_name, st_live = live_stickers[eng_name_key]
        old_val = item["value"]
        
        v_low = clean_float(st_live.get("value_min"))
        v_high = clean_float(st_live.get("value_max"))
        v_val = round((v_low + v_high) / 2.0, 4) if (v_low != v_high) else v_low
        demand_num = st_live.get("demand", 1)
        
        item["valueLow"] = v_low
        item["valueHigh"] = v_high
        item["value"] = v_val
        item["demand"] = DEMAND_MAP.get(demand_num, "Низкий")
        item["description"] = DEMAND_DESC_MAP.get(demand_num, item.get("description", ""))
        
        history = st_live.get("history", [])
        if history:
            h_prices = []
            h_dates = []
            for h in history:
                h_low = clean_float(h.get("value_min"))
                h_high = clean_float(h.get("value_max"))
                h_val = round((h_low + h_high) / 2.0, 4) if (h_low != h_high) else h_low
                h_prices.append(h_val)
                if h.get("date"):
                    h_dates.append(h["date"])
            item["historicalPrices"] = h_prices
            if h_dates:
                item["historicalDates"] = h_dates
            item["stability"] = calc_stability(h_prices)
            
        if old_val != item["value"]:
            updated_count += 1
            price_changes.append((item["name"], old_val, item["value"]))

print(f"Total items processed: {len(items)}")
print(f"Total items with changed values: {updated_count}")
print("Top 15 price changes:")
for name, old_v, new_v in sorted(price_changes, key=lambda x: abs(x[2]-x[1]), reverse=True)[:15]:
    try:
        print(f"  {name}: {old_v} -> {new_v} (diff: {new_v - old_v:+.2f})")
    except:
        pass

# Save to bot/items.json
with open("bot/items.json", "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

# Update src/data/items.ts
# Read existing items.ts to keep the interfaces and exports
with open("src/data/items.ts", "r", encoding="utf-8") as f:
    ts_content = f.read()

array_start = ts_content.find("const rawBssItemsData: any[] = [")
prefix = ts_content[:array_start]
prefix += "const rawBssItemsData: any[] = "

# Bracket-match to find the exact end of the array, keep everything after it as suffix
bracket_idx = ts_content.find("[", ts_content.find("=", array_start))
depth = 1
i = bracket_idx + 1
while depth > 0 and i < len(ts_content):
    ch = ts_content[i]
    if ch == '[':
        depth += 1
    elif ch == ']':
        depth -= 1
    i += 1

suffix = "\n\n" + ts_content[i:]

items_json_formatted = json.dumps(items, ensure_ascii=False, indent=2)
new_ts_content = prefix + items_json_formatted + ";\n" + suffix

with open("src/data/items.ts", "w", encoding="utf-8") as f:
    f.write(new_ts_content)

print("Successfully updated src/data/items.ts, bot/items.json, and values.json!")
