import { db } from "../src/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { getDatabaseSchema } from "../src/db/config";

async function main() {
  const schema = getDatabaseSchema();
  console.log(`Restoring master data to "${schema}" (branches, users, refrigerators, branch_tasks)...`);

  const backupPath = path.join(__dirname, "preserved_data_backup.json");
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

  const primaryBranchId = "8d7d1214-ba5c-41b3-a09a-ebf3fe366f6c";

  // 1. Branches
  for (const b of backup.branches) {
    await db.execute(sql.raw(`
      INSERT INTO "${schema}".branches (id, name, leave_quota, last_update)
      VALUES ('${b.id}', '${b.name.replace(/'/g, "''")}', ${b.leave_quota || 3}, NOW())
      ON CONFLICT (id) DO NOTHING;
    `));
  }
  console.log(`✓ Restored ${backup.branches.length} branch(es).`);

  // 2. Users
  for (const u of backup.users) {
    const roleVal = u.role || 'employee';
    await db.execute(sql.raw(`
      INSERT INTO "${schema}".users (
        id, name, username, password, branch_id,
        point_streak_type, point_streak, longest_streak, point,
        last_login, leave_quota, created_at
      ) VALUES (
        '${u.id}', '${u.name.replace(/'/g, "''")}', '${(u.username || u.name).replace(/'/g, "''")}', '${u.password}', '${primaryBranchId}',
        '${u.point_streak_type || 'none'}', ${u.point_streak || 0}, ${u.longest_streak || 0}, ${u.point || 0},
        ${u.last_login ? `'${u.last_login}'` : 'NULL'}, ${u.leave_quota || 'NULL'}, NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `));
  }
  // Ensure default assistant manager user exists
  const assistantUserId = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
  await db.execute(sql.raw(`
    INSERT INTO "${schema}".users (
      id, name, username, password, branch_id, point_streak_type, point_streak, longest_streak, point
    ) VALUES (
      '${assistantUserId}', 'ผู้ช่วย สมศรี', 'assistant', '1234', '${primaryBranchId}', 'none', 0, 0, 0
    )
    ON CONFLICT (id) DO NOTHING;
  `));

  console.log(`✓ Restored ${backup.users.length} users + 1 assistant manager.`);

  // 3. Refrigerators
  for (const r of backup.refrigerators) {
    await db.execute(sql.raw(`
      INSERT INTO "${schema}".refrigerators (
        id, branch_id, name, min_temperature, max_temperature, disable_check
      ) VALUES (
        '${r.id}', '${primaryBranchId}', '${r.name.replace(/'/g, "''")}', ${r.min_temperature || 0}, ${r.max_temperature || 4}, ${r.disable_check || false}
      )
      ON CONFLICT (id) DO NOTHING;
    `));
  }
  console.log(`✓ Restored ${backup.refrigerators.length} refrigerators.`);

  // 4. Update the 4 night tasks to ensure consistent category
  await db.execute(sql.raw(`
    UPDATE "${schema}".tasks
    SET category = 'ความปลอดภัยตอนปิดร้าน',
        for_managers = true,
        shift = 'night',
        task_role = 'manager_assistant',
        disabled = false
    WHERE shift = 'night' OR for_managers = true;
  `));
  console.log(`✓ Updated night closing tasks category to 'ความปลอดภัยตอนปิดร้าน'.`);

  // 5. Link all 69 tasks to primary branch in branch_tasks
  const allTasksResult: any = await db.execute(sql.raw(`SELECT id FROM "${schema}".tasks;`));
  for (const t of allTasksResult) {
    await db.execute(sql.raw(`
      INSERT INTO "${schema}".branch_tasks (branch_id, task_id)
      VALUES ('${primaryBranchId}', '${t.id}')
      ON CONFLICT (branch_id, task_id) DO NOTHING;
    `));
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
