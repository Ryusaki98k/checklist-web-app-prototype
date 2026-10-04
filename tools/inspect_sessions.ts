import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db.execute(
    sql`SELECT s.id, u.name, u.username, s.shift, s.start_timestamp, s.end_timestamp 
        FROM checklist_web_app.shift_session s 
        JOIN checklist_web_app.users u ON s.user_id = u.id 
        ORDER BY s.start_timestamp DESC;`
  );
  console.log("Sessions count:", rows.length);
  console.log("Sessions:", JSON.stringify(rows, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
