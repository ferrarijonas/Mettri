import sys, json
pages = json.load(sys.stdin)
for p in pages:
    print(f"{p['id'][:8]} | {p['type']:12s} | {p['title'][:70]}")
