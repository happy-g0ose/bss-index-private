import json

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

for it in items:
    if it.get("category") == "Биквипы" or "beequipData" in it:
        has_tbd = False
        tbd_list = []
        for g in it.get("beequipData", []):
            for r in g.get("rolls", []):
                if r.get("value", 0) <= 0 or r.get("valueLow", 0) <= 0:
                    tbd_list.append((g["groupName"], r["rollName"], r.get("demand")))
        if tbd_list:
            # Also get non-tbd rolls in this beequip to see the scale
            valid_rolls = []
            for g in it.get("beequipData", []):
                for r in g.get("rolls", []):
                    if r.get("value", 0) > 0:
                        valid_rolls.append(r.get("value"))
            v_min = min(valid_rolls) if valid_rolls else 0
            v_max = max(valid_rolls) if valid_rolls else 0
            print(f"\nBeequip: {it['englishName']} ({len(tbd_list)} TBD rolls, valid range: {v_min} - {v_max}):")
            for g_name, r_name, dem in tbd_list[:6]:
                try:
                    print(f"   [{g_name}] {r_name} -> Demand: {dem}")
                except:
                    pass
            if len(tbd_list) > 6:
                print(f"   ... and {len(tbd_list)-6} more")
