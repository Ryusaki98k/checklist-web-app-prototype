import { db } from "../src/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

function isSpecialClosingTask(name: string): boolean {
  const lower = (name || "").toLowerCase();
  return (
    lower.includes("turn off light") ||
    lower.includes("turn off refriderator") ||
    lower.includes("turn off refrigerator") ||
    lower.includes("turn off air conditioning") ||
    lower.includes("lock the store") ||
    lower.includes("ปิดไฟส่องสว่าง") ||
    lower.includes("ปิดไฟตู้แช่") ||
    lower.includes("ปิดเครื่องปรับอากาศ") ||
    lower.includes("ปิดแอร์") ||
    lower.includes("ล็อคประตูร้าน") ||
    lower.includes("ล็อคร้าน")
  );
}

async function main() {
  console.log("==========================================================");
  console.log("   RESET SCHEMA & REMIGRATE PRESERVED DATA (EATER EGG)    ");
  console.log("==========================================================");

  // 1. Load backup data
  const backupPath = path.join(__dirname, "preserved_data_backup.json");
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found at ${backupPath}. Run dump_preserved_data.ts first.`);
  }

  const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  console.log(`Loaded backup:`);
  console.log(`  - Tasks: ${backup.tasks.length}`);
  console.log(`  - Refrigerators: ${backup.refrigerators.length}`);
  console.log(`  - Cron Settings: ${backup.cron_settings.length}`);
  console.log(`  - Branches: ${backup.branches.length}`);
  console.log(`  - Users: ${backup.users.length}`);

  // 2. Drop existing tables in checklist_web_app in dependency order
  console.log("\nDropping existing tables in checklist_web_app schema...");
  await db.execute(sql`
    DROP TABLE IF EXISTS checklist_web_app.store_closing_tasks CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.task_work CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.refrigerator_tasks CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.shift_session CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.notifications CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.point_transactions CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.employee_leaves CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.refrigerators CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.tasks CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.users CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.branches CASCADE;
    DROP TABLE IF EXISTS checklist_web_app.cron_settings CASCADE;
  `);

  // Drop and recreate enums to clean up variants
  console.log("Re-creating types and enums...");
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE checklist_web_app.role AS ENUM ('admin', 'committee', 'general_manager', 'manager', 'manager_assistant', 'employee');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE checklist_web_app.task_role AS ENUM ('manager_assistant', 'cashier', 'stock');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE checklist_web_app.shift AS ENUM ('morning', 'afternoon', 'morning_afternoon');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE checklist_web_app.point_streak AS ENUM ('none', 'flawed', 'perfect');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DROP TYPE IF EXISTS checklist_web_app.leave_type CASCADE;
    CREATE TYPE checklist_web_app.leave_type AS ENUM ('paid', 'unpaid');
  `);

  // 3. Create tables with new relational structure
  console.log("Creating new schema tables...");

  await db.execute(sql`
    -- 1. Branches
    CREATE TABLE checklist_web_app.branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      leave_quota INTEGER NOT NULL DEFAULT 3,
      last_update TIMESTAMPTZ DEFAULT now()
    );

    -- 2. Users
    CREATE TABLE checklist_web_app.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      password TEXT,
      password_hash TEXT,
      role checklist_web_app.role NOT NULL,
      branch_id UUID REFERENCES checklist_web_app.branches(id) ON DELETE SET NULL,
      point_streak_type checklist_web_app.point_streak NOT NULL DEFAULT 'none',
      point_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      point INTEGER NOT NULL DEFAULT 0,
      last_login TIMESTAMPTZ,
      leave_quota INTEGER,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX idx_users_branch_id ON checklist_web_app.users(branch_id);
    CREATE INDEX idx_users_username ON checklist_web_app.users(username);

    -- 3. Tasks
    CREATE TABLE checklist_web_app.tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shift checklist_web_app.shift NOT NULL,
      name TEXT NOT NULL,
      task_role checklist_web_app.task_role NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      disabled BOOLEAN NOT NULL DEFAULT false,
      is_special BOOLEAN NOT NULL DEFAULT false,
      category TEXT
    );
    CREATE INDEX idx_tasks_role_shift ON checklist_web_app.tasks(task_role, shift);
    CREATE INDEX idx_tasks_special ON checklist_web_app.tasks(is_special);

    -- 4. Shift Session
    CREATE TABLE checklist_web_app.shift_session (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES checklist_web_app.users(id) ON DELETE CASCADE,
      branch_id UUID NOT NULL REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
      task_role checklist_web_app.task_role NOT NULL,
      shift checklist_web_app.shift NOT NULL,
      start_timestamp TIMESTAMPTZ NOT NULL,
      end_timestamp TIMESTAMPTZ,
      manager_assistance_approve_timestamp TIMESTAMPTZ,
      manager_approve_timestamp TIMESTAMPTZ,
      incomplete_reason TEXT,
      incomplete_status TEXT DEFAULT 'none',
      incomplete_action TEXT,
      incomplete_action_points INTEGER DEFAULT 0,
      incomplete_action_note TEXT,
      incomplete_reviewed_by UUID REFERENCES checklist_web_app.users(id) ON DELETE SET NULL,
      incomplete_reviewed_at TIMESTAMPTZ
    );
    CREATE INDEX idx_shift_session_user_start ON checklist_web_app.shift_session(user_id, start_timestamp DESC);
    CREATE INDEX idx_shift_session_branch_start ON checklist_web_app.shift_session(branch_id, start_timestamp DESC);

    -- 5. Task Work (Includes branch_id & task_date to absorb store_closing_tasks)
    CREATE TABLE checklist_web_app.task_work (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES checklist_web_app.tasks(id) ON DELETE CASCADE,
      shift_session_id UUID NOT NULL REFERENCES checklist_web_app.shift_session(id) ON DELETE CASCADE,
      branch_id UUID REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
      task_date TEXT,
      completed_by UUID REFERENCES checklist_web_app.users(id) ON DELETE SET NULL,
      comment TEXT,
      timestamp TIMESTAMPTZ
    );
    CREATE INDEX idx_task_work_session ON checklist_web_app.task_work(shift_session_id);
    CREATE INDEX idx_task_work_task ON checklist_web_app.task_work(task_id);
    CREATE INDEX idx_task_work_branch_date ON checklist_web_app.task_work(branch_id, task_date);

    -- 6. Refrigerators (Direct branch_id relation)
    CREATE TABLE checklist_web_app.refrigerators (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id UUID REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      min_temperature INTEGER NOT NULL DEFAULT 0,
      max_temperature INTEGER NOT NULL DEFAULT 4,
      disable_check BOOLEAN NOT NULL DEFAULT false
    );
    CREATE INDEX idx_refrigerators_branch_id ON checklist_web_app.refrigerators(branch_id);

    -- 7. Refrigerator Tasks
    CREATE TABLE checklist_web_app.refrigerator_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id UUID NOT NULL REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
      refrigerator_id UUID NOT NULL REFERENCES checklist_web_app.refrigerators(id) ON DELETE CASCADE,
      task_date TEXT NOT NULL,
      completed_by UUID REFERENCES checklist_web_app.users(id) ON DELETE SET NULL,
      completed_at TIMESTAMPTZ,
      shift_session_id UUID REFERENCES checklist_web_app.shift_session(id) ON DELETE SET NULL,
      shift checklist_web_app.shift,
      temperature INTEGER,
      is_okay BOOLEAN DEFAULT true,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_ref_tasks_branch_date ON checklist_web_app.refrigerator_tasks(branch_id, task_date);
    CREATE INDEX idx_ref_tasks_refrigerator ON checklist_web_app.refrigerator_tasks(refrigerator_id);

    -- 8. Notifications
    CREATE TABLE checklist_web_app.notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_id UUID REFERENCES checklist_web_app.users(id) ON DELETE CASCADE,
      recipient_role checklist_web_app.role,
      branch_id UUID REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      shift_session_id UUID REFERENCES checklist_web_app.shift_session(id) ON DELETE SET NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_notifications_recipient_read ON checklist_web_app.notifications(recipient_id, is_read);
    CREATE INDEX idx_notifications_branch ON checklist_web_app.notifications(branch_id);

    -- 9. Point Transactions
    CREATE TABLE checklist_web_app.point_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES checklist_web_app.users(id) ON DELETE CASCADE,
      points INTEGER NOT NULL,
      type TEXT NOT NULL,
      shift_session_id UUID REFERENCES checklist_web_app.shift_session(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_point_transactions_user ON checklist_web_app.point_transactions(user_id);

    -- 10. Employee Leaves
    CREATE TABLE checklist_web_app.employee_leaves (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES checklist_web_app.users(id) ON DELETE CASCADE,
      branch_id UUID NOT NULL REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
      leave_type checklist_web_app.leave_type NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      preserve_streak BOOLEAN NOT NULL DEFAULT true,
      previous_streak INTEGER,
      recorded_by UUID NOT NULL REFERENCES checklist_web_app.users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      approved_by UUID REFERENCES checklist_web_app.users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX idx_leaves_user_date ON checklist_web_app.employee_leaves(user_id, start_date, end_date);
    CREATE INDEX idx_leaves_branch ON checklist_web_app.employee_leaves(branch_id);

    -- 11. Cron Settings
    CREATE TABLE checklist_web_app.cron_settings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      schedule_cron TEXT NOT NULL,
      schedule_description TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_run_at TIMESTAMPTZ,
      last_run_status TEXT,
      last_run_message TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS & Grants
    ALTER TABLE checklist_web_app.branches ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.shift_session ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.task_work ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.refrigerators ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.refrigerator_tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.point_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.employee_leaves ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_web_app.cron_settings ENABLE ROW LEVEL SECURITY;

    GRANT ALL ON ALL TABLES IN SCHEMA checklist_web_app TO anon, authenticated, service_role;
  `);

  console.log("Tables and indexes created successfully!");

  // 4. Remigrate preserved data
  console.log("\nRemigrating preserved data...");

  // A. Remigrate Branches
  let primaryBranchId = "8d7d1214-ba5c-41b3-a09a-ebf3fe366f6c";
  if (backup.branches.length > 0) {
    for (const b of backup.branches) {
      primaryBranchId = b.id;
      await db.execute(sql`
        INSERT INTO checklist_web_app.branches (id, name, leave_quota, last_update)
        VALUES (${b.id}, ${b.name}, ${b.leave_quota || 3}, ${b.last_update || new Date()})
        ON CONFLICT (id) DO NOTHING;
      `);
    }
    console.log(`  ✓ Remigrated ${backup.branches.length} branches.`);
  } else {
    await db.execute(sql`
      INSERT INTO checklist_web_app.branches (id, name, leave_quota)
      VALUES (${primaryBranchId}, 'สาขาหลัก', 3);
    `);
    console.log("  ✓ Created default primary branch.");
  }

  // B. Remigrate Users (Attach branch_id to each user)
  if (backup.users.length > 0) {
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
    console.log(`  ✓ Remigrated ${backup.users.length} users with branch assignment.`);
  }

  // C. Remigrate Tasks (Preserve all 69 tasks + flag is_special)
  let specialCount = 0;
  for (const t of backup.tasks) {
    const isSpecial = isSpecialClosingTask(t.name);
    if (isSpecial) specialCount++;

    await db.execute(sql`
      INSERT INTO checklist_web_app.tasks (
        id, shift, name, task_role, start_time, end_time, disabled, is_special
      ) VALUES (
        ${t.id}, ${t.shift}, ${t.name}, ${t.task_role}, ${t.start_time || t.start}, ${t.end_time || t.end},
        ${t.disabled || false}, ${isSpecial}
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  console.log(`  ✓ Remigrated ${backup.tasks.length} tasks (${specialCount} flagged as special closing tasks).`);

  // D. Remigrate Refrigerators (Attach branch_id)
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
  console.log(`  ✓ Remigrated ${backup.refrigerators.length} refrigerators linked to branch ${primaryBranchId}.`);

  // E. Remigrate Cron Settings
  for (const c of backup.cron_settings) {
    await db.execute(sql`
      INSERT INTO checklist_web_app.cron_settings (
        id, name, description, schedule_cron, schedule_description, enabled, config,
        last_run_at, last_run_status, last_run_message, updated_at
      ) VALUES (
        ${c.id}, ${c.name}, ${c.description || ''}, ${c.schedule_cron}, ${c.schedule_description},
        ${c.enabled !== false}, ${JSON.stringify(c.config || {})}, ${c.last_run_at}, ${c.last_run_status},
        ${c.last_run_message}, ${c.updated_at || new Date()}
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  console.log(`  ✓ Remigrated ${backup.cron_settings.length} cron settings.`);

  console.log("\n==========================================================");
  console.log("   ✓ SCHEMA RESET & REMIGRATION COMPLETED SUCCESSFULLY!   ");
  console.log("==========================================================");

  process.exit(0);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
