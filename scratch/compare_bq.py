import json

with open("values.json", "r", encoding="utf-8") as f:
    old_vals = json.load(f)

with open("values_live.json", "r", encoding="utf-8") as f:
    new_vals = json.load(f)

print("Old Beequip keys:", list(old_vals["Beequip"].keys())[:10])
print("New Beequip keys:", list(new_vals["Beequip"].keys())[:10])

# Inspect sample Beequip in old and new
first_bq_key = list(new_vals["Beequip"].keys())[0]
print(f"Sample Beequip '{first_bq_key}':")
print("Old:", json.dumps(old_vals["Beequip"].get(first_bq_key), indent=2)[:300])
print("New:", json.dumps(new_vals["Beequip"].get(first_bq_key), indent=2)[:300])
