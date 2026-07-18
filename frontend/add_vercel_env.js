const { exec } = require('child_process');

const url = "https://tn-flood-ai-backend.onrender.com/api/v1";
const child = exec("npx vercel env add NEXT_PUBLIC_API_URL production", (error, stdout, stderr) => {
    if (error) {
        console.error(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`stderr: ${stderr}`);
    }
    console.log(`stdout: ${stdout}`);
});

child.stdin.write(url + '\n');
child.stdin.end();
