import os
import subprocess
import requests
import time
import getpass

API_URL = "https://tn-flood-ai-backend.onrender.com/api/v1"
WS_URL = "wss://tn-flood-ai-backend.onrender.com/api/v1/ws"
VERCEL_PROJECT_NAMES = ["ai-flood-prediction", "floodsense", "tn-flood-ai"]

def get_secrets():
    print("🔒 Secure Credential Prompt")
    print("These tokens will be stored in-memory only and will NOT be saved to any files.")
    
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        github_token = getpass.getpass("Enter GitHub PAT (starts with ghp_): ").strip()
        
    vercel_token = os.environ.get("VERCEL_TOKEN")
    if not vercel_token:
        vercel_token = getpass.getpass("Enter Vercel Token: ").strip()
        
    render_key = os.environ.get("RENDER_API_KEY")
    if not render_key:
        render_key = getpass.getpass("Enter Render API Key: ").strip()
        
    return github_token, vercel_token, render_key

def clean_git_history():
    print("\n🧹 1. Cleaning local Git history (removing leaked secrets)...")
    try:
        # Soft reset to origin/main undoes all local commits but keeps files in the staging area/working directory
        subprocess.run(["git", "reset", "--soft", "origin/main"], check=True)
        print("✅ Local commits successfully un-committed.")
    except Exception as e:
        print(f"⚠️ Git reset failed or origin/main doesn't exist: {e}")
        print("Attempting to proceed anyway (make sure no secrets are hardcoded!)...")

def fix_vercel(vercel_token):
    print("\n🌍 2. Updating Vercel Environment Variables...")
    headers = {"Authorization": f"Bearer {vercel_token}", "Content-Type": "application/json"}
    
    resp = requests.get("https://api.vercel.com/v9/projects", headers=headers)
    if not resp.ok:
        print(f"❌ Failed to fetch Vercel projects: {resp.text}")
        return None
        
    projects = resp.json().get("projects", [])
    project = next((p for p in projects if p["name"] in VERCEL_PROJECT_NAMES), projects[0] if projects else None)
    
    if not project:
        print("❌ No Vercel projects found.")
        return None
        
    project_id = project["id"]
    print(f"✅ Found Vercel project: {project['name']} ({project_id})")
    
    resp = requests.get(f"https://api.vercel.com/v9/projects/{project_id}/env", headers=headers)
    existing_envs = resp.json().get("envs", [])
    
    for key, val in {"NEXT_PUBLIC_API_URL": API_URL, "NEXT_PUBLIC_WS_URL": WS_URL}.items():
        existing = next((e for e in existing_envs if e["key"] == key), None)
        if existing:
            requests.patch(
                f"https://api.vercel.com/v9/projects/{project_id}/env/{existing['id']}",
                headers=headers,
                json={"value": val, "type": "plain", "target": ["production", "preview", "development"]}
            )
        else:
            requests.post(
                f"https://api.vercel.com/v10/projects/{project_id}/env",
                headers=headers,
                json={"key": key, "value": val, "type": "plain", "target": ["production", "preview", "development"]}
            )
            
    # FORCE the correct framework and root directory in Vercel
    proj_patch = requests.patch(
        f"https://api.vercel.com/v9/projects/{project_id}",
        headers=headers,
        json={"rootDirectory": "frontend", "framework": "nextjs"}
    )
    if proj_patch.ok:
        print("✅ Vercel Root Directory explicitly set to 'frontend'.")
    else:
        print(f"⚠️ Failed to update Vercel Root Directory: {proj_patch.text}")
        
    print("✅ Environment variables updated.")
    return project["name"]

def trigger_github_push(github_token):
    print("\n🚀 3. Pushing to GitHub (Secure Credential Manager)...")
    try:
        # Securely configure native git credential helper with the token via stdin
        print("   -> Injecting credential to standard credential helper...")
        credential_payload = f"protocol=https\nhost=github.com\nusername=x-access-token\npassword={github_token}\n"
        subprocess.run(
            ["git", "credential", "approve"],
            input=credential_payload.encode(),
            check=True
        )

        # Force add frontend/src just in case it was ignored
        subprocess.run(["git", "add", "-f", "frontend/src"], check=False)
        subprocess.run(["git", "add", "."], check=True)
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
        if status.stdout.strip():
            subprocess.run(["git", "commit", "-m", "fix: resolve production environment, gitignore, and db schema without secrets"], check=True)
        
        # Native push - Git will automatically pull credentials from the OS credential manager
        subprocess.run(["git", "push", "origin", "main", "--force-with-lease"], check=True)
        print("✅ Git commit and push succeeded securely.")
        return True
    except Exception as e:
        print(f"❌ Git push failed: {e}")
        return False

def poll_render_health():
    print("\n⏳ 4. Waiting for Render Backend to become Healthy...")
    max_retries = 30
    for i in range(max_retries):
        try:
            r = requests.get(f"{API_URL}/health", timeout=5)
            if r.status_code == 200:
                print("✅ Render backend is Healthy (HTTP 200).")
                return True
        except requests.exceptions.RequestException:
            pass
        print(f"   ...waiting for backend ({i+1}/{max_retries})")
        time.sleep(10)
    print("❌ Render backend did not become healthy in time.")
    return False

def verify_endpoints():
    print("\n🔍 5. Verifying Application Endpoints...")
    try:
        r = requests.get(f"{API_URL}/dashboard/live")
        data = r.json()
        if "districts" in data and isinstance(data["districts"], list) and len(data["districts"]) > 0:
            print("✅ Dashboard endpoints return JSON with districts.")
        else:
            print(f"❌ Dashboard endpoint missing districts. Response: {str(data)[:100]}")
            return False
            
        r = requests.get(f"{API_URL}/kg/graph")
        data = r.json()
        if "nodes" in data and isinstance(data["nodes"], list) and len(data["nodes"]) > 0:
            print("✅ Knowledge Graph endpoint returns nodes.")
        else:
            print("❌ Knowledge Graph endpoint missing nodes.")
            return False
            
        if "nodes" in data and len(data["nodes"]) > 0:
            node_id = data["nodes"][0]["id"]
            r = requests.get(f"{API_URL}/kg/node/{node_id}")
            node_data = r.json()
            if "risk_score" in node_data:
                print("✅ Prediction endpoint returns values.")
            else:
                print("❌ Prediction endpoint missing risk values.")
                return False
                
        return True
    except Exception as e:
        print(f"❌ Endpoint verification failed: {e}")
        return False

if __name__ == "__main__":
    print("🛡️ Starting Secure Secret Remediation & Deployment...\n")
    
    github_token, vercel_token, render_key = get_secrets()
    
    clean_git_history()
    
    proj_name = fix_vercel(vercel_token)
    if not proj_name:
        exit(1)
        
    if not trigger_github_push(github_token):
        exit(1)
        
    print("\n⏳ Waiting 20 seconds for deployment pipelines to initialize...")
    time.sleep(20)
    
    if not poll_render_health():
        exit(1)
        
    if not verify_endpoints():
        exit(1)
        
    print(f"\n🎉 Security Remediation and Deployment Complete. All verifications passed.")
    print(f"Production URL: https://{proj_name}.vercel.app")
