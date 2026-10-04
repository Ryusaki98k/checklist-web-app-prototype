import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking current table counts and data in checklist_web_app...");

  const tables = [
    "tasks",
    "refrigerators",
    "cron_settings",
    "branches",
    "users",
    "shift_session",
    "task_work",
    "refrigerator_tasks",
    "store_closing_tasks",
    "employee_leaves",
    "notifications",
    "point_transactions"
  ];

  for (const t of tables) {
    try {
      const res: any = await db.execute(sql.raw(`SELECT count(*)::int as count FROM checklist_web_app."${t}"`));
      console.log(`Table "${t}": ${res[0]?.count ?? 0} rows`);
    } catch (e: any) {
      console.log(`Table "${t}": does not exist or error (${e?.message?.slice(0, 50)})`);
    }
  }

  const tasksData = await db.execute(sql`SELECT count(*)::int FROM checklist_web_app.tasks;`);
  const refData = await db.execute(sql`SELECT count(*)::int FROM checklist_web_app.refrigerators;`);
  const cronData = await db.execute(sql`SELECT count(*)::int FROM checklist_web_app.cron_settings;`);
  const branchData = await db.execute(sql`SELECT id, name FROM checklist_web_app.branches;`);
  
  console.log("\nBranches currently in DB:", branchData);
  console.log("Tasks count:", tasksData[0]);
  console.log("Refrigerators count:", refData[0]);
  console.log("Cron settings count:", cronData[0]);

  process.exit(0);
}

main().catch(err => {
  console.error("Backup & inspect failed:", err);
  process.exit(1);
});
