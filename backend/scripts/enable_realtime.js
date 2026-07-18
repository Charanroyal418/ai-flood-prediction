const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.eohziaiwuuyxxpkhdhoz:XG3zg%2F5*n58Um%2C5@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log("Connected to database.");

    const res = await client.query("SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'");
    if (res.rows.length === 0) {
      console.log("Creating publication supabase_realtime...");
      await client.query("CREATE PUBLICATION supabase_realtime;");
    }

    const tables = [
      "district_predictions", "alerts", 
      "prediction_history", "knowledge_graph_events", "model_inference"
    ];
    for (const table of tables) {
      try {
        await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table};`);
        console.log(`Added ${table} to realtime.`);
      } catch (e) {
        if (e.code === '42710') {
          console.log(`${table} is already in realtime publication.`);
        } else {
          console.error(`Error adding ${table}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    await client.end();
  }
}

main();
