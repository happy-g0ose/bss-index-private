import json
import subprocess

# Read suffix from git HEAD
cmd = 'git show HEAD:src/data/items.ts'
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, shell=True)
git_content, _ = p.communicate()
git_text = git_content.decode('utf-8')

# Find CategoryStyle in git text
cat_idx = git_text.find("export interface CategoryStyle {")
suffix = git_text[cat_idx:]

with open("bot/items.json", "r", encoding="utf-8") as f:
    items = json.load(f)

# Read prefix from src/data/items.ts
with open("src/data/items.ts", "r", encoding="utf-8") as f:
    current_text = f.read()

prefix = current_text[:current_text.find("const rawBssItemsData: any[] = [")]
prefix += "const rawBssItemsData: any[] = "

items_json_formatted = json.dumps(items, ensure_ascii=False, indent=2)
new_ts_content = prefix + items_json_formatted + ";\n\n" + suffix

with open("src/data/items.ts", "w", encoding="utf-8") as f:
    f.write(new_ts_content)

print("Saved src/data/items.ts with CategoryStyle and getCategoryStyles intact!")
