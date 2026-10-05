import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  const tables = [
    "branches",
    "users",
    "tasks",
    "branch_tasks",
    "shift_session",
    "task_work",
    "refrigerators",
    "refrigerator_tasks",
    "notifications",
    "notification_reads",
    "point_transactions",
    "employee_leaves",
    "cron_settings",
  ];

  console.log("=== CHECKLIST_WEB_APP TABLE COUNTS ===");
  for (const t of tables) {
    try {
      const res = await db.execute(sql.raw(`SELECT count(*)::int as c FROM checklist_web_app.${t}`));
      console.log(`${t.padEnd(25)}: ${(res as any)[0]?.c ?? 0}`);
    } catch (e: any) {
      console.log(`${t.padEnd(25)}: ERROR (${e.message})`);
    }
  }
  console.log("\n=== TASKS DISTRIBUTION ===");
  try {
    const taskDist = await db.execute(sql.raw(`
      SELECT task_role, shift, for_managers, count(*)::int as count 
      FROM checklist_web_app.tasks 
      GROUP BY task_role, shift, for_managers 
      ORDER BY task_role, shift, for_managers;
    `));
    console.table(taskDist);
  } catch (e: any) {
    console.log("Error querying tasks:", e.message);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
