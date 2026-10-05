import { db } from "../src/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Restoring master data (branches, users, refrigerators, branch_tasks)...");

  const backupPath = path.join(__dirname, "preserved_data_backup.json");
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

  const primaryBranchId = "8d7d1214-ba5c-41b3-a09a-ebf3fe366f6c";

  // 1. Branches
  for (const b of backup.branches) {
    await db.execute(sql`
      INSERT INTO checklist_web_app.branches (id, name, leave_quota, last_update)
      VALUES (${b.id}, ${b.name}, ${b.leave_quota || 3}, ${b.last_update || new Date()})
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  console.log(`✓ Restored ${backup.branches.length} branch(es).`);

  // 2. Users
  for (const u of backup.users) {
    await db.execute(sql`
      INSERT INTO checklist_web_app.users (
        id, name, username, password, role, branch_id,
        point_streak_type, point_streak, longest_streak, point,
        last_login, leave_quota, created_at
      ) VALUES (
        ${u.id}, ${u.name}, ${u.username || u.name}, ${u.password}, ${u.role}, ${primaryBranchId},
        ${u.point_streak_type || 'none'}, ${u.point_streak || 0}, ${u.longest_streak || 0}, ${u.point || 0},
        ${u.last_login}, ${u.leave_quota}, ${u.created_at || new Date()}
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  // Ensure default assistant manager user exists
  const assistantUserId = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
  await db.execute(sql`
    INSERT INTO checklist_web_app.users (
      id, name, username, password, role, branch_id, point_streak_type, point_streak, longest_streak, point
    ) VALUES (
      ${assistantUserId}, 'ผู้ช่วย สมศรี', 'assistant', '1234', 'manager_assistant', ${primaryBranchId}, 'none', 0, 0, 0
    )
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log(`✓ Restored ${backup.users.length} users + 1 assistant manager.`);

  // 3. Refrigerators
  for (const r of backup.refrigerators) {
    await db.execute(sql`
      INSERT INTO checklist_web_app.refrigerators (
        id, branch_id, name, min_temperature, max_temperature, disable_check
      ) VALUES (
        ${r.id}, ${primaryBranchId}, ${r.name}, ${r.min_temperature || 0}, ${r.max_temperature || 4}, ${r.disable_check || false}
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  console.log(`✓ Restored ${backup.refrigerators.length} refrigerators.`);

  // 4. Update the 4 night tasks to ensure consistent category
  await db.execute(sql`
    UPDATE checklist_web_app.tasks
    SET category = 'ความปลอดภัยตอนปิดร้าน',
        for_managers = true,
        shift = 'night',
        task_role = 'manager_assistant',
        disabled = false
    WHERE shift = 'night' OR for_managers = true;
  `);
  console.log(`✓ Updated night closing tasks category to 'ความปลอดภัยตอนปิดร้าน'.`);

  // 5. Link all 69 tasks to primary branch in branch_tasks
  const allTasksResult: any = await db.execute(sql`SELECT id FROM checklist_web_app.tasks;`);
  for (const t of allTasksResult) {
    await db.execute(sql`
      INSERT INTO checklist_web_app.branch_tasks (branch_id, task_id)
      VALUES (${primaryBranchId}, ${t.id})
      ON CONFLICT (branch_id, task_id) DO NOTHING;
    `);
  }
  console.log(`✓ Linked ${allTasksResult.length} tasks to primary branch in branch_tasks.`);

  console.log("Restoration completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Restoration failed:", err);
    process.exit(1);
  });
