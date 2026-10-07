import 'dotenv/config';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("==========================================================");
  console.log("       MIGRATING USERS ROLE OVERHAUL SCHEMA               ");
  console.log("==========================================================");

  console.log("\n[1/5] Creating enum types in checklist_web_app schema...");
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE checklist_web_app.manager_type AS ENUM ('none', 'assistant', 'store');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE checklist_web_app.executive_type AS ENUM ('none', 'committee', 'executive');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log("✓ Enums verified/created");

  console.log("\n[2/5] Adding columns to users table...");
  await db.execute(sql`
    ALTER TABLE checklist_web_app.users
    ADD COLUMN IF NOT EXISTS manager_type checklist_web_app.manager_type NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS executive_type checklist_web_app.executive_type NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
  `);
  console.log("✓ Columns added");

  console.log("\n[3/5] Backfilling existing user records based on existing role...");
  await db.execute(sql`
    UPDATE checklist_web_app.users
    SET 
      is_admin = CASE 
        WHEN role = 'admin' THEN true 
        ELSE is_admin 
      END,
      manager_type = CASE 
        WHEN role = 'manager' THEN 'store'::checklist_web_app.manager_type
        WHEN role = 'manager_assistant' THEN 'assistant'::checklist_web_app.manager_type
        ELSE manager_type 
      END,
      executive_type = CASE 
        WHEN role = 'committee' THEN 'committee'::checklist_web_app.executive_type
        WHEN role = 'general_manager' THEN 'executive'::checklist_web_app.executive_type
        ELSE executive_type 
      END
    WHERE manager_type = 'none' AND executive_type = 'none' AND is_admin = false;
  `);
  console.log("✓ Backfill completed");

  console.log("\n[4/5] Creating indexes for high-performance role queries...");
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_manager_type ON checklist_web_app.users (manager_type);
    CREATE INDEX IF NOT EXISTS idx_users_executive_type ON checklist_web_app.users (executive_type);
    CREATE INDEX IF NOT EXISTS idx_users_is_admin ON checklist_web_app.users (is_admin);
  `);
  console.log("✓ Indexes created");

  console.log("\n[5/5] Granting permissions...");
  await db.execute(sql`
    GRANT USAGE ON SCHEMA checklist_web_app TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA checklist_web_app TO anon, authenticated, service_role;
  `);
  console.log("✓ Permissions granted");

  // Verify resulting rows
  const verifyUsers = await db.execute(sql`
    SELECT id, username, role, manager_type, executive_type, is_admin FROM checklist_web_app.users;
  `);
  console.log("\nUpdated users in database:");
  console.table((verifyUsers as any).rows || verifyUsers);
}

main()
  .then(() => {
    console.log("\nMigration completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nMigration failed:", err);
    process.exit(1);
  });
