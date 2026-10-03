import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Adding username column and migrating users to username/password system...");

  // 1. Add username column if not exists
  await db.execute(sql`
    ALTER TABLE checklist_web_app.users ADD COLUMN IF NOT EXISTS username TEXT;
  `);

  // 2. Drop NOT NULL constraint on email so email is optional / removed
  await db.execute(sql`
    ALTER TABLE checklist_web_app.users ALTER COLUMN email DROP NOT NULL;
  `);

  // 3. Backfill username for existing rows from email prefix or name
  await db.execute(sql`
    UPDATE checklist_web_app.users 
    SET username = LOWER(
      COALESCE(
        NULLIF(SPLIT_PART(email, '@', 1), ''),
        NULLIF(REPLACE(name, ' ', ''), ''),
        'user_' || SUBSTRING(id::text, 1, 6)
      )
    )
    WHERE username IS NULL OR username = '';
  `);

  // Ensure all rows have a non-null username
  await db.execute(sql`
    UPDATE checklist_web_app.users 
    SET username = 'user_' || SUBSTRING(id::text, 1, 6)
    WHERE username IS NULL OR username = '';
  `);

  // 4. Set NOT NULL on username
  await db.execute(sql`
    ALTER TABLE checklist_web_app.users ALTER COLUMN username SET NOT NULL;
  `);

  // 5. Create unique index on lower(username)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower 
    ON checklist_web_app.users (LOWER(username));
  `);

  console.log("Migration completed successfully!");

  // Verify users
  const userRows = await db.execute(sql`
    SELECT id, name, username, email, role FROM checklist_web_app.users LIMIT 15;
  `);
  console.log("Users in DB:", userRows);
}

runMigration()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  });
