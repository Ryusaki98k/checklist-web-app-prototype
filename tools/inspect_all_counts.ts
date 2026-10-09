import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { getDatabaseSchema } from "../src/db/config";

async function main() {
  const schemaName = getDatabaseSchema();
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

  console.log(`=== ${schemaName.toUpperCase()} TABLE COUNTS ===`);
  for (const t of tables) {
    try {
      const res = await db.execute(sql.raw(`SELECT count(*)::int as c FROM "${schemaName}"."${t}"`));
      console.log(`${t.padEnd(25)}: ${(res as any)[0]?.c ?? 0}`);
    } catch (e: any) {
      console.log(`${t.padEnd(25)}: ERROR (${e.message})`);
    }
  }
  console.log("\n=== TASKS DISTRIBUTION ===");
  try {
    const taskDist = await db.execute(sql.raw(`
      SELECT task_role, shift, for_managers, count(*)::int as count 
      FROM "${schemaName}"."tasks" 
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
