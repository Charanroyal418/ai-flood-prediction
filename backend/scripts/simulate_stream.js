const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.eohziaiwuuyxxpkhdhoz:XG3zg%2F5*n58Um%2C5@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log("Connected. Simulating real-time sensor updates...");

    // Find a district to update (e.g., Chennai, district_id = 1)
    let score = 40;
    let direction = 1;

    setInterval(async () => {
      score += direction * Math.floor(Math.random() * 5);
      if (score > 90) direction = -1;
      if (score < 20) direction = 1;

      try {
        await client.query(
          "UPDATE district_predictions SET risk_score = $1, updated_at = NOW() WHERE district_id = 1",
          [score]
        );
        console.log(`Pushed real-time update: Chennai risk score = ${score}`);
      } catch (err) {
        console.error("Update failed:", err.message);
      }
    }, 2000); // Push update every 2 seconds

  } catch (err) {
    console.error("Connection error:", err);
  }
}

main();
