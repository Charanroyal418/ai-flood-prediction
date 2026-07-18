const https = require('https');
const API_KEY = "rnd_7tTZNbinUpX85POpKcKRt0HBwvRd";

const options = {
  hostname: 'api.render.com',
  port: 443,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, path, method }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  try {
    const serviceId = "srv-d9d1euernols73clh690";
    
    // Set Env Vars
    console.log("Setting env vars for service...");
    const envVars = [
      { key: "ENVIRONMENT", value: "production" },
      { key: "DATABASE_URL", value: "postgresql+psycopg://postgres.eohziaiwuuyxxpkhdhoz:XG3zg%2F5*n58Um%2C5@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres" }
    ];
    const envResult = await request(`/v1/services/${serviceId}/env-vars`, 'PUT', envVars);
    console.log("Success! Updated Env Vars");
    
    // Trigger deploy
    console.log("Triggering deploy...");
    const deployResult = await request(`/v1/services/${serviceId}/deploys`, 'POST');
    console.log("Deploy Triggered:", JSON.stringify(deployResult, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}

main();
