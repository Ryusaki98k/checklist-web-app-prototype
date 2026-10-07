import 'dotenv/config';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("==========================================================");
  console.log("       DROPPING LEGACY USERS.ROLE COLUMN FROM DB          ");
  console.log("==========================================================");

  console.log("\n[1/3] Checking current columns of checklist_web_app.users...");
  const cols = await db.execute(sql`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = 'checklist_web_app' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log("Current columns:", cols.map((r: any) => `${r.column_name} (${r.udt_name})`).join(", "));

  console.log("\n[2/3] Dropping column 'role' from checklist_web_app.users...");
  await db.execute(sql`
    ALTER TABLE checklist_web_app.users
    DROP COLUMN IF EXISTS role;
  `);
  console.log("✓ Column 'role' successfully dropped from checklist_web_app.users!");

  console.log("\n[3/3] Verifying remaining columns of checklist_web_app.users...");
  const verifyCols = await db.execute(sql`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = 'checklist_web_app' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log("Updated columns:", verifyCols.map((r: any) => `${r.column_name} (${r.udt_name})`).join(", "));

  const roleStillExists = verifyCols.some((r: any) => r.column_name === 'role');
  if (roleStillExists) {
    console.error("❌ FAILED: 'role' column still exists!");
    process.exit(1);
  } else {
    console.log("✅ SUCCESS: 'role' column is completely removed from checklist_web_app.users!");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error dropping role column:", err);
  process.exit(1);
});
