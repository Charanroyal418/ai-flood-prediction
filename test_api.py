import urllib.request
import urllib.error

endpoints = [
    "/api/v1/dashboard",
    "/api/v1/predictions",
    "/api/v1/kg",
    "/api/v1/weather",
    "/api/v1/rivers",
    "/api/v1/districts",
    "/api/v1/alerts"
]

for ep in endpoints:
    url = f"http://127.0.0.1:8000{ep}"
    try:
        res = urllib.request.urlopen(url)
        print(f"{ep}: {res.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"{ep}: {e.code}")
    except Exception as e:
        print(f"{ep}: {e}")
