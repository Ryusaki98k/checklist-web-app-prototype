import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Updating live PostgreSQL leave_type enum in checklist_web_app schema...");

  try {
    // 1. Normalize any legacy values in employee_leaves
    await db.execute(sql`
      UPDATE checklist_web_app.employee_leaves
      SET leave_type = 'paid'
      WHERE leave_type::text IN ('sick');
    `);

    await db.execute(sql`
      UPDATE checklist_web_app.employee_leaves
      SET leave_type = 'unpaid'
      WHERE leave_type::text IN ('personal', 'other');
    `);

    // 2. Temporarily switch column to text
    await db.execute(sql`
      ALTER TABLE checklist_web_app.employee_leaves
      ALTER COLUMN leave_type TYPE text;
    `);

    // 3. Drop old enum type
    await db.execute(sql`
      DROP TYPE IF EXISTS checklist_web_app.leave_type CASCADE;
    `);

    // 4. Create new clean enum type with only 'paid' and 'unpaid'
    await db.execute(sql`
      CREATE TYPE checklist_web_app.leave_type AS ENUM ('paid', 'unpaid');
    `);

    // 5. Cast column back to the new enum type
    await db.execute(sql`
      ALTER TABLE checklist_web_app.employee_leaves
      ALTER COLUMN leave_type TYPE checklist_web_app.leave_type
      USING leave_type::checklist_web_app.leave_type;
    `);

    console.log("Successfully updated checklist_web_app.leave_type enum to ('paid', 'unpaid')! 🎉");
  } catch (err) {
    console.error("Failed to update leave_type enum:", err);
    process.exit(1);
  }

  process.exit(0);
}

main();
