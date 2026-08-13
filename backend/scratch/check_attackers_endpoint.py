import urllib.request
import json

url = "http://127.0.0.1:8000/attackers"
try:
    with urllib.request.urlopen(url, timeout=5) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"Total attacker items returned: {len(data)}")
        if len(data) > 0:
            print("\nSample Attacker Profile Object from GET /attackers:")
            print(json.dumps(data[0], indent=2))
        else:
            print("Response array is empty []")
except Exception as e:
    print("Error querying GET /attackers:", e)
