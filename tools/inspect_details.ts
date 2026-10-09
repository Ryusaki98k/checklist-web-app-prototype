import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  const nightTasks = await db.execute(
    sql`SELECT id, name, task_role, shift, for_managers, is_joint, category 
        FROM checklist_web_app.tasks 
        WHERE shift = 'night' OR for_managers = true;`
  );
  console.log("Night / Manager tasks:");
  console.table(nightTasks);

  const refs = await db.execute(
    sql`SELECT id, name, branch_id, min_temperature, max_temperature, disable_check 
        FROM checklist_web_app.refrigerators LIMIT 5;`
  );
  console.log("Sample Refrigerators:");
  console.table(refs);

  const existingJoint = await db.execute(
    sql`SELECT id, name, is_joint, shift, category 
        FROM checklist_web_app.tasks 
        WHERE is_joint = true;`
  );
  console.log("Existing Joint tasks in tasks table:");
  console.table(existingJoint);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
