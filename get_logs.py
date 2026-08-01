import requests

API_KEY = "rnd_7tTZNbinUpX85POpKcKRt0HBwvRd"
SERVICE_ID = "srv-d9d1euernols73clh690"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/json"
}

def get_logs():
    # 1. Get deploys
    res = requests.get(f"https://api.render.com/v1/services/{SERVICE_ID}/deploys?limit=1", headers=HEADERS)
    deploys = res.json()
    if not deploys:
        print("No deploys found.")
        return
    
    deploy = deploys[0]['deploy']
    deploy_id = deploy['id']
    status = deploy['status']
    print(f"Latest deploy ID: {deploy_id}, Status: {status}")
    
    # 2. Get logs for the deploy (only if needed, wait, Render API doesn't expose deploy logs directly via an endpoint without a special cursor, let's just use the service logs endpoint if there is one)
    # Actually, Render has an endpoint for service logs? No, wait. 
    # Let's check deploy details first.
    print(deploy)

get_logs()
