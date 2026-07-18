import os
import requests
import json

API_KEY = "rnd_7tTZNbinUpX85POpKcKRt0HBwvRd"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def main():
    print("Fetching owner ID...")
    res = requests.get("https://api.render.com/v1/owners", headers=HEADERS)
    if not res.ok:
        print("Error fetching owners:", res.text)
        return
    owners = res.json()
    if not owners:
        print("No owners found for this API key.")
        return
    owner_id = owners[0]['owner']['id']
    print(f"Using Owner ID: {owner_id}")

    payload = {
        "type": "web_service",
        "name": "tn-flood-ai-backend",
        "ownerId": owner_id,
        "repo": "https://github.com/Charanroyal418/ai-flood-prediction",
        "autoDeploy": "yes",
        "branch": "main",
        "serviceDetails": {
            "env": "docker",
            "envSpecificDetails": {
                "dockerfilePath": "./backend/Dockerfile"
            },
            "plan": "free",
            "region": "oregon",
            "envVars": [
                {
                    "key": "DATABASE_URL",
                    "value": "sqlite:///./flood_ai.db"
                },
                {
                    "key": "ENVIRONMENT",
                    "value": "production"
                }
            ]
        }
    }

    print("Creating service...")
    res = requests.post("https://api.render.com/v1/services", headers=HEADERS, json=payload)
    if res.ok:
        data = res.json()
        print("Success!")
        print(f"Service URL: {data.get('service', {}).get('serviceDetails', {}).get('url', 'N/A')}")
        print(f"Dashboard URL: {data.get('dashboardUrl', data.get('service', {}).get('dashboardUrl', 'N/A'))}")
    else:
        print("Error creating service:", res.text)

if __name__ == "__main__":
    main()
