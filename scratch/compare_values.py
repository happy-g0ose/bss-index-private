import json

with open("values.json", "r", encoding="utf-8") as f:
    old_vals = json.load(f)

with open("values_live.json", "r", encoding="utf-8") as f:
    new_vals = json.load(f)

print("Old keys:", old_vals.keys())
print("New keys:", new_vals.keys())

# Compare stickers groups
old_groups = list(old_vals["Sticker"]["groups"].keys())
new_groups = list(new_vals["Sticker"]["groups"].keys())
print(f"Old sticker groups ({len(old_groups)}):", old_groups)
print(f"New sticker groups ({len(new_groups)}):", new_groups)

# Compare beequips groups
old_bq_groups = list(old_vals["Beequip"]["groups"].keys())
new_bq_groups = list(new_vals["Beequip"]["groups"].keys())
print(f"Old beequip groups ({len(old_bq_groups)}):", old_bq_groups)
print(f"New beequip groups ({len(new_bq_groups)}):", new_bq_groups)

# Count items
old_stickers_count = sum(len(g["items"]) for g in old_vals["Sticker"]["groups"].values())
new_stickers_count = sum(len(g["items"]) for g in new_vals["Sticker"]["groups"].values())
print(f"Stickers count: old={old_stickers_count}, new={new_stickers_count}")

old_bq_count = sum(len(g["items"]) for g in old_vals["Beequip"]["groups"].values())
new_bq_count = sum(len(g["items"]) for g in new_vals["Beequip"]["groups"].values())
print(f"Beequips count: old={old_bq_count}, new={new_bq_count}")

# Check sample sticker item
sample_name = "Bee Cub"
print("\nOld Bee Cub:")
print(json.dumps(old_vals["Sticker"]["groups"]["Cub Skins"]["items"][sample_name], indent=2))
print("\nNew Bee Cub:")
print(json.dumps(new_vals["Sticker"]["groups"]["Cub Skins"]["items"][sample_name], indent=2))
