import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Creating store_closing_tasks table in checklist_web_app schema...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS checklist_web_app.store_closing_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
        task_id UUID NOT NULL REFERENCES checklist_web_app.tasks(id) ON DELETE CASCADE,
        task_date TEXT NOT NULL,
        completed_by UUID REFERENCES checklist_web_app.users(id) ON DELETE SET NULL,
        completed_at TIMESTAMP WITHOUT TIME ZONE,
        shift_session_id UUID REFERENCES checklist_web_app.shift_session(id) ON DELETE SET NULL,
        comment TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT store_closing_tasks_branch_task_date_unique UNIQUE (branch_id, task_id, task_date)
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_store_closing_tasks_lookup 
    ON checklist_web_app.store_closing_tasks (branch_id, task_date);
  `);

  await db.execute(sql`
    GRANT ALL ON TABLE checklist_web_app.store_closing_tasks TO anon, authenticated, service_role;
  `);

  console.log("Migration for store_closing_tasks completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  });
