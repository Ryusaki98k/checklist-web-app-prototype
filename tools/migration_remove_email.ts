import { db } from "../src/db";
import { sql } from "drizzle-orm";

interface ColumnRow {
  column_name: string;
  data_type: string;
}

interface TableRow {
  table_name: string;
  column_name: string;
}

async function runMigration() {
  console.log("=== Migration: Remove email field entirely from DB ===");

  // 1. Check all columns named 'email' across all tables in checklist_web_app
  const emailCols = (await db.execute(sql`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'checklist_web_app' AND column_name = 'email';
  `)) as unknown as TableRow[];

  console.log("Found tables with email column in checklist_web_app:", emailCols);

  for (const row of emailCols) {
    console.log(`Dropping email column from checklist_web_app.${row.table_name}...`);
    await db.execute(sql.raw(`
      ALTER TABLE "checklist_web_app"."${row.table_name}" DROP COLUMN IF EXISTS "email" CASCADE;
    `));
    console.log(`✓ Column 'email' dropped from checklist_web_app.${row.table_name}`);
  }

  // 2. Drop any indexes or constraints related to email in checklist_web_app
  await db.execute(sql`
    DROP INDEX IF EXISTS checklist_web_app.users_email_unique;
    DROP INDEX IF EXISTS checklist_web_app.idx_users_email;
    DROP INDEX IF EXISTS checklist_web_app.idx_users_email_lower;
  `);

  console.log("✓ Dropped any residual email indexes if they existed.");

  // 3. Verify columns on checklist_web_app.users
  const userCols = (await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'checklist_web_app' AND table_name = 'users'
    ORDER BY ordinal_position ASC;
  `)) as unknown as ColumnRow[];

  console.log("Current columns in checklist_web_app.users:");
  for (const c of userCols) {
    console.log(` - ${c.column_name} (${c.data_type})`);
  }

  const stillHasEmail = userCols.some((c) => c.column_name === "email");
  if (stillHasEmail) {
    throw new Error("Column 'email' is still present in checklist_web_app.users!");
  }

  console.log("\nSample users from DB:");
  const sampleUsers = await db.execute(sql`
    SELECT id, name, username, role FROM checklist_web_app.users LIMIT 5;
  `);
  console.log(sampleUsers);

  console.log("\n=== Migration completed successfully! ===");
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
