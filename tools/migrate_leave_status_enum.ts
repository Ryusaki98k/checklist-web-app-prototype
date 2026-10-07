import 'dotenv/config';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("==========================================================");
  console.log("    MIGRATING EMPLOYEE_LEAVES.STATUS TO TYPED ENUM       ");
  console.log("==========================================================");

  console.log("\n[1/3] Creating enum type checklist_web_app.leave_status...");
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE checklist_web_app.leave_status AS ENUM ('pending', 'approved', 'rejected');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log("✓ Enum checklist_web_app.leave_status verified/created");

  console.log("\n[2/3] Converting employee_leaves.status column to leave_status enum...");
  await db.execute(sql`
    ALTER TABLE checklist_web_app.employee_leaves
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE checklist_web_app.leave_status 
      USING (
        CASE 
          WHEN status = 'pending' THEN 'pending'::checklist_web_app.leave_status
          WHEN status = 'rejected' THEN 'rejected'::checklist_web_app.leave_status
          ELSE 'approved'::checklist_web_app.leave_status
        END
      ),
    ALTER COLUMN status SET DEFAULT 'approved'::checklist_web_app.leave_status;
  `);
  console.log("✓ Column employee_leaves.status converted to typed leave_status enum!");

  console.log("\n[3/3] Verifying employee_leaves.status column in database...");
  const cols = await db.execute(sql`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = 'checklist_web_app' AND table_name = 'employee_leaves' AND column_name = 'status';
  `);
  console.log("Result:", cols);

  process.exit(0);
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
