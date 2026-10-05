import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Running migration: create branch_tasks and notification_reads tables...");

  // 1. Create branch_tasks table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS checklist_web_app.branch_tasks (
      branch_id UUID NOT NULL REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
      task_id UUID NOT NULL REFERENCES checklist_web_app.tasks(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (branch_id, task_id)
    );
  `);
  console.log("Table checklist_web_app.branch_tasks created or already exists.");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_branch_tasks_branch ON checklist_web_app.branch_tasks(branch_id);
    CREATE INDEX IF NOT EXISTS idx_branch_tasks_task ON checklist_web_app.branch_tasks(task_id);
    ALTER TABLE checklist_web_app.branch_tasks ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON checklist_web_app.branch_tasks TO anon, authenticated, service_role;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'checklist_web_app' 
          AND tablename = 'branch_tasks' 
          AND policyname = 'Allow read access to branch_tasks'
      ) THEN
        CREATE POLICY "Allow read access to branch_tasks" 
        ON checklist_web_app.branch_tasks 
        FOR SELECT 
        TO authenticated, anon, service_role 
        USING (true);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'checklist_web_app' 
          AND tablename = 'branch_tasks' 
          AND policyname = 'Allow all access to branch_tasks'
      ) THEN
        CREATE POLICY "Allow all access to branch_tasks" 
        ON checklist_web_app.branch_tasks 
        FOR ALL 
        TO authenticated, anon, service_role 
        USING (true)
        WITH CHECK (true);
      END IF;
    END $$;
  `);

  // 2. Create notification_reads table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS checklist_web_app.notification_reads (
      notification_id UUID NOT NULL REFERENCES checklist_web_app.notifications(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES checklist_web_app.users(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (notification_id, user_id)
    );
  `);
  console.log("Table checklist_web_app.notification_reads created or already exists.");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON checklist_web_app.notification_reads(user_id);
    CREATE INDEX IF NOT EXISTS idx_notification_reads_notification ON checklist_web_app.notification_reads(notification_id);
    ALTER TABLE checklist_web_app.notification_reads ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON checklist_web_app.notification_reads TO anon, authenticated, service_role;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'checklist_web_app' 
          AND tablename = 'notification_reads' 
          AND policyname = 'Allow read access to notification_reads'
      ) THEN
        CREATE POLICY "Allow read access to notification_reads" 
        ON checklist_web_app.notification_reads 
        FOR SELECT 
        TO authenticated, anon, service_role 
        USING (true);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'checklist_web_app' 
          AND tablename = 'notification_reads' 
          AND policyname = 'Allow all access to notification_reads'
      ) THEN
        CREATE POLICY "Allow all access to notification_reads" 
        ON checklist_web_app.notification_reads 
        FOR ALL 
        TO authenticated, anon, service_role 
        USING (true)
        WITH CHECK (true);
      END IF;
    END $$;
  `);

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
