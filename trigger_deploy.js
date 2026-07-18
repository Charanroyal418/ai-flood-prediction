const https = require('https');
const API_KEY = "rnd_7tTZNbinUpX85POpKcKRt0HBwvRd";

const options = {
  hostname: 'api.render.com',
  port: 443,
  path: '/v1/services/srv-d9d1euernols73clh690/deploys',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(body);
  });
});
req.on('error', console.error);
req.end();
