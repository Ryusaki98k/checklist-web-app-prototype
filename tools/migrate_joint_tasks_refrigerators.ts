import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("=== Starting Migration: Refrigerator Tasks & Night Closing as Joint Tasks ===");

  // 1. Alter checklist_web_app.tasks table
  console.log("1. Adding is_daily, shift_types, and refrigerator_id columns to tasks table...");
  await db.execute(sql`
    ALTER TABLE checklist_web_app.tasks 
    ADD COLUMN IF NOT EXISTS is_daily BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS shift_types JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS refrigerator_id UUID REFERENCES checklist_web_app.refrigerators(id) ON DELETE CASCADE;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tasks_refrigerator_id ON checklist_web_app.tasks(refrigerator_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_is_daily ON checklist_web_app.tasks(is_daily);
  `);
  console.log("Columns and indices added successfully.");

  // 2. Migrate existing night closing tasks to joint tasks
  console.log("2. Updating Night Closing Tasks to Joint Tasks...");
  const nightTasksUpdated = await db.execute(sql`
    UPDATE checklist_web_app.tasks
    SET 
      is_joint = true,
      is_daily = true,
      shift_types = '["night"]'::jsonb,
      selectable_roles = '["manager_assistant", "manager"]'::jsonb,
      category = COALESCE(category, 'ความปลอดภัยตอนปิดร้าน')
    WHERE shift = 'night' OR for_managers = true
    RETURNING id, name;
  `);
  console.log(`Updated ${nightTasksUpdated.length} night closing tasks to joint tasks:`);
  console.table(nightTasksUpdated);

  // 3. Migrate refrigerators into tasks table as Joint Daily Tasks for morning and afternoon
  console.log("3. Migrating refrigerators into tasks table as Joint Daily Tasks...");
  const allRefs = (await db.execute(sql`
    SELECT id, name, branch_id, disable_check, min_temperature, max_temperature 
    FROM checklist_web_app.refrigerators;
  `)) as any[];

  console.log(`Found ${allRefs.length} refrigerators to process.`);

  let morningCreated = 0;
  let afternoonCreated = 0;

  for (const ref of allRefs) {
    if (!ref.branch_id) continue;

    // Check if morning task already exists for this refrigerator
    const existingMorning = (await db.execute(sql`
      SELECT id FROM checklist_web_app.tasks 
      WHERE refrigerator_id = ${ref.id} AND shift = 'morning';
    `)) as any[];

    if (existingMorning.length === 0) {
      const morningName = `ตรวจเช็คอุณหภูมิตู้แช่: ${ref.name} (รอบเช้า)`;
      const morningRes = (await db.execute(sql`
        INSERT INTO checklist_web_app.tasks (
          id, branch_id, shift, name, task_role, start_time, end_time,
          disabled, for_managers, is_joint, is_daily, shift_types,
          selectable_roles, category, refrigerator_id
        ) VALUES (
          gen_random_uuid(),
          ${ref.branch_id},
          'morning',
          ${morningName},
          'stock',
          '06:00:00',
          '14:00:00',
          ${Boolean(ref.disable_check)},
          false,
          true,
          true,
          '["morning"]'::jsonb,
          '["stock", "manager_assistant"]'::jsonb,
          'ตู้แช่',
          ${ref.id}
        )
        RETURNING id;
      `)) as any[];

      if (morningRes[0]?.id) {
        await db.execute(sql`
          INSERT INTO checklist_web_app.branch_tasks (branch_id, task_id)
          VALUES (${ref.branch_id}, ${morningRes[0].id})
          ON CONFLICT (branch_id, task_id) DO NOTHING;
        `);
        morningCreated++;
      }
    }

    // Check if afternoon task already exists for this refrigerator
    const existingAfternoon = (await db.execute(sql`
      SELECT id FROM checklist_web_app.tasks 
      WHERE refrigerator_id = ${ref.id} AND shift = 'afternoon';
    `)) as any[];

    if (existingAfternoon.length === 0) {
      const afternoonName = `ตรวจเช็คอุณหภูมิตู้แช่: ${ref.name} (รอบบ่าย)`;
      const afternoonRes = (await db.execute(sql`
        INSERT INTO checklist_web_app.tasks (
          id, branch_id, shift, name, task_role, start_time, end_time,
          disabled, for_managers, is_joint, is_daily, shift_types,
          selectable_roles, category, refrigerator_id
        ) VALUES (
          gen_random_uuid(),
          ${ref.branch_id},
          'afternoon',
          ${afternoonName},
          'stock',
          '14:00:00',
          '22:00:00',
          ${Boolean(ref.disable_check)},
          false,
          true,
          true,
          '["afternoon"]'::jsonb,
          '["stock", "manager_assistant"]'::jsonb,
          'ตู้แช่',
          ${ref.id}
        )
        RETURNING id;
      `)) as any[];

      if (afternoonRes[0]?.id) {
        await db.execute(sql`
          INSERT INTO checklist_web_app.branch_tasks (branch_id, task_id)
          VALUES (${ref.branch_id}, ${afternoonRes[0].id})
          ON CONFLICT (branch_id, task_id) DO NOTHING;
        `);
        afternoonCreated++;
      }
    }
  }

  console.log(`Created ${morningCreated} morning refrigerator tasks and ${afternoonCreated} afternoon refrigerator tasks.`);
  console.log("=== Migration Completed Successfully ===");
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
