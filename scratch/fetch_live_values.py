import urllib.request
import json
import os

url = "https://bssmvalues.com/api/values"
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    print("Top level keys:", list(data.keys()))
    
    with open("values_live.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Saved values_live.json successfully!")
except Exception as e:
    print("Error:", e)
