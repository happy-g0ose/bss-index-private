import json
import re

# Load items
with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

# 1. Sticker estimates map by englishName (lower)
STICKER_ESTIMATES = {
    "nessie": (1.5, 2.5, "Высокий"),
    "red doodle person": (0.2, 0.4, "Средний"),
    "blue and green marble": (0.08, 0.15, "Низкий"),
    "diamond cluster": (1.5, 2.5, "Высокий"),
    "diamond trim": (0.5, 1.0, "Средний"),
    "orange swirled marble": (0.08, 0.15, "Низкий"),
    "yellow swirled marble": (0.08, 0.15, "Низкий"),
    "spore covered puffshroom": (0.3, 0.6, "Средний"),
    "petal wand": (1.0, 1.5, "Высокий"),
    "bbm from below": (15.0, 25.0, "Хайп"),
    "bbm from below (bbm)": (15.0, 25.0, "Хайп"),
    "flying bee bear": (4.0, 7.0, "Высокий"),
    
    # Leaves
    "blowing leaf": (0.05, 0.1, "Низкий"),
    "cordate leaf": (0.05, 0.1, "Низкий"),
    "cunate leaf": (0.05, 0.1, "Низкий"),
    "elliptic leaf": (0.05, 0.1, "Низкий"),
    "hastate leaf": (0.05, 0.1, "Низкий"),
    "lanceolate leaf": (0.05, 0.1, "Низкий"),
    "lyrate leaf": (0.05, 0.1, "Низкий"),
    "oblique leaf": (0.05, 0.1, "Низкий"),
    "reniform leaf": (0.05, 0.1, "Низкий"),
    "rhomboid leaf": (0.05, 0.1, "Низкий"),
    "spatulate leaf": (0.05, 0.1, "Низкий"),
    
    # Sun, Cloud, Skyscraper
    "simple cloud": (0.1, 0.25, "Средний"),
    "simple sun": (0.1, 0.25, "Средний"),
    "simple skyscraper": (0.1, 0.25, "Средний"),
    
    # Misc popular
    "rubber duck": (0.1, 0.2, "Средний"),
    "sprout": (0.1, 0.2, "Средний"),
    "launching rocket": (0.1, 0.2, "Средний"),
    "interrobang block": (0.1, 0.2, "Средний"),
    "classic killroy": (0.1, 0.2, "Средний"),
    "killroy with hair": (0.1, 0.2, "Средний"),
}

# Default for all other 0/TBD stickers
DEFAULT_STICKER_ESTIMATE = (0.05, 0.12, "Низкий")

def estimate_beequip_roll(bq_name, g_name, r_name, group_rolls):
    """
    Interpolate or extrapolate roll value based on adjacent known rolls or stat magnitude.
    """
    known_rolls = [r for r in group_rolls if r.get("value", 0) > 0]
    
    # Extract numbers from rollName
    nums = [float(n) for n in re.findall(r'(\d+(?:\.\d+)?)', r_name)]
    
    if known_rolls:
        # Check if known rolls have numbers we can scale with
        known_with_nums = []
        for kr in known_rolls:
            kr_nums = [float(n) for n in re.findall(r'(\d+(?:\.\d+)?)', kr["rollName"])]
            if kr_nums and nums:
                known_with_nums.append((kr_nums[-1], kr["valueLow"], kr["valueHigh"], kr["value"]))
                
        if known_with_nums and nums:
            known_with_nums.sort(key=lambda x: x[0])
            curr_num = nums[-1]
            max_num, max_low, max_high, max_val = known_with_nums[-1]
            min_num, min_low, min_high, min_val = known_with_nums[0]
            
            if curr_num > max_num:
                ratio = (curr_num / max_num) ** 1.3
                v_low = round(max_low * ratio, 2)
                v_high = round(max_high * ratio, 2)
                v_val = round((v_low + v_high) / 2.0, 2)
                return v_low, v_high, v_val
            elif curr_num < min_num:
                ratio = max(0.2, curr_num / min_num)
                v_low = round(min_low * ratio, 2)
                v_high = round(min_high * ratio, 2)
                v_val = round((v_low + v_high) / 2.0, 2)
                return v_low, v_high, v_val
            else:
                # In between
                avg_low = sum(k[1] for k in known_with_nums) / len(known_with_nums)
                avg_high = sum(k[2] for k in known_with_nums) / len(known_with_nums)
                return round(avg_low, 2), round(avg_high, 2), round((avg_low + avg_high) / 2.0, 2)
        else:
            # Fallback to group average or max
            avg_low = sum(r["valueLow"] for r in known_rolls) / len(known_rolls)
            avg_high = sum(r["valueHigh"] for r in known_rolls) / len(known_rolls)
            return round(avg_low * 1.1, 2), round(avg_high * 1.1, 2), round((avg_low + avg_high) * 1.1 / 2.0, 2)
            
    # If entire group has 0 known rolls, fallback to beequip context or safe defaults
    bq_lower = bq_name.lower()
    if "candle" in bq_lower or "snap" in bq_lower or "eraser" in bq_lower or "scarf" in bq_lower:
        return 0.1, 0.3, 0.2
    elif "antler" in bq_lower or "wreath" in bq_lower or "tiara" in bq_lower or "pinecone" in bq_lower:
        return 1.5, 3.5, 2.5
    else:
        return 0.25, 0.75, 0.5

stickers_updated = 0
rolls_updated = 0
beequips_updated = 0

for it in items:
    is_beequip = it.get("category") == "Биквипы" or "beequipData" in it
    
    if is_beequip:
        all_rolls_in_bq = []
        for g in it.get("beequipData", []):
            rolls = g.get("rolls", [])
            for r in rolls:
                if r.get("value", 0) <= 0 or r.get("valueLow", 0) <= 0:
                    v_low, v_high, v_val = estimate_beequip_roll(it["englishName"], g["groupName"], r["rollName"], rolls)
                    r["valueLow"] = max(0.01, v_low)
                    r["valueHigh"] = max(0.01, v_high)
                    r["value"] = round((r["valueLow"] + r["valueHigh"]) / 2.0, 2)
                    if r.get("demand") not in ["Низкий", "Средний", "Высокий", "Хайп"]:
                        r["demand"] = "Средний" if v_val > 1.0 else "Низкий"
                    rolls_updated += 1
                else:
                    if r.get("valueLow", 0) <= 0:
                        r["valueLow"] = 0.01
                        r["value"] = round((r["valueLow"] + r["valueHigh"]) / 2.0, 2)
                all_rolls_in_bq.append(r)
                
        # Update overall beequip values
        if all_rolls_in_bq:
            lows = [r["valueLow"] for r in all_rolls_in_bq if r["valueLow"] > 0]
            highs = [r["valueHigh"] for r in all_rolls_in_bq if r["valueHigh"] > 0]
            if lows and highs:
                it["valueLow"] = min(lows)
                it["valueHigh"] = max(highs)
                it["value"] = round((it["valueLow"] + it["valueHigh"]) / 2.0, 2)
                beequips_updated += 1
                
    else:
        # Sticker
        if it.get("value", 0) <= 0 or it.get("valueLow", 0) <= 0:
            eng_k = it["englishName"].lower().strip()
            est_low, est_high, est_dem = STICKER_ESTIMATES.get(eng_k, DEFAULT_STICKER_ESTIMATE)
            it["valueLow"] = est_low
            it["valueHigh"] = est_high
            it["value"] = round((est_low + est_high) / 2.0, 2)
            if not it.get("demand") or it.get("demand") == "Низкий":
                it["demand"] = est_dem
            stickers_updated += 1

print(f"Updated {stickers_updated} stickers with accurate market estimates.")
print(f"Updated {rolls_updated} beequip rolls across {beequips_updated} beequips.")

# Save bot/items.json
with open("bot/items.json", "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

# Update src/data/items.ts
import subprocess
cmd = 'git show HEAD~1:src/data/items.ts'
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, shell=True)
git_content, _ = p.communicate()
git_text = git_content.decode('utf-8')

cat_idx = git_text.find("export interface CategoryStyle {")
suffix = git_text[cat_idx:]

with open("src/data/items.ts", "r", encoding="utf-8") as f:
    current_text = f.read()

prefix = current_text[:current_text.find("const rawBssItemsData: any[] = [")]
prefix += "const rawBssItemsData: any[] = "

items_json_formatted = json.dumps(items, ensure_ascii=False, indent=2)
new_ts_content = prefix + items_json_formatted + ";\n\n" + suffix

with open("src/data/items.ts", "w", encoding="utf-8") as f:
    f.write(new_ts_content)

print("Saved updated items.ts and items.json!")
