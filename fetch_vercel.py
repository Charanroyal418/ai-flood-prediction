import urllib.request
import json
import os

TOKEN = os.getenv("VERCEL_TOKEN", "")

def get_latest_deployment():
    url = "https://api.vercel.com/v6/deployments?limit=1"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if not data.get("deployments"):
                print("No deployments found.")
                return None
            return data["deployments"][0]["uid"]
    except Exception as e:
        print(f"Error fetching deployments: {e}")
        return None

def get_deployment_logs(uid):
    url = f"https://api.vercel.com/v2/deployments/{uid}/events"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req) as response:
            events = json.loads(response.read().decode())
            with open("vercel_logs.txt", "w", encoding="utf-8") as f:
                for event in events:
                    if event.get("type") == "command":
                        f.write(event["payload"]["text"] + "\n")
            print(f"Saved logs to vercel_logs.txt for deployment {uid}")
    except Exception as e:
        print(f"Error fetching logs: {e}")

if __name__ == "__main__":
    uid = get_latest_deployment()
    if uid:
        get_deployment_logs(uid)
