import urllib.request
import json

try:
    req = urllib.request.urlopen("http://127.0.0.1:8000/api/v1/dashboard/live")
    print(req.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    print("Response Body:")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Other Error: {e}")
