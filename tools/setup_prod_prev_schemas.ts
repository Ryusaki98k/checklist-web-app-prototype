import 'dotenv/config';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';
import * as path from 'path';

const TABLES_IN_ORDER = [
  "branches",
  "users",
  "tasks",
  "branch_tasks",
  "shift_session",
  "task_work",
  "refrigerators",
  "refrigerator_tasks",
  "special_tasks",
  "notifications",
  "notification_reads",
  "point_transactions",
  "employee_leaves",
  "cron_settings",
];

async function setupSchema(schemaName: string) {
  console.log(`\n==========================================================`);
  console.log(`Setting up schema: "${schemaName}"`);
  console.log(`==========================================================`);

  // 1. Ensure Schema Exists
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`));
  console.log(`✓ Schema "${schemaName}" verified/created.`);

  // 2. Run drizzle_push for this schema in a fresh process so schema.ts loads with the right env
  console.log(`Applying Drizzle schema to "${schemaName}"...`);
  const pushScript = path.resolve(__dirname, 'drizzle_push.ts');
  execSync(`npx tsx "${pushScript}"`, {
    env: { ...process.env, DB_SCHEMA: schemaName },
    stdio: 'inherit',
  });

  // 3. Grant Permissions
  await db.execute(sql.raw(`
    GRANT USAGE ON SCHEMA "${schemaName}" TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;
    GRANT ALL ON ALL ROUTINES IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}"
      GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `));
  console.log(`✓ Granted schema permissions to anon, authenticated, and service_role.`);
}

async function copyDataFromSource(sourceSchema: string, targetSchema: string) {
  console.log(`\nCopying data from "${sourceSchema}" to "${targetSchema}"...`);

  // Check if source schema exists
  const sourceExists: any = await db.execute(sql.raw(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${sourceSchema}'
  `));

  if (!sourceExists || sourceExists.length === 0) {
    console.log(`Source schema "${sourceSchema}" does not exist, skipping data copy.`);
    return;
  }

  for (const table of TABLES_IN_ORDER) {
    try {
      const countRes: any = await db.execute(sql.raw(`
        SELECT count(*)::int as c FROM "${sourceSchema}"."${table}"
      `));
      const rowCount = countRes[0]?.c ?? 0;

      if (rowCount === 0) {
        console.log(`  - Table "${table}" has 0 rows in "${sourceSchema}", skipped.`);
        continue;
      }

      // Query columns in the target table
      const cols: any = await db.execute(sql.raw(`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_schema = '${targetSchema}' AND table_name = '${table}'
        ORDER BY ordinal_position
      `));

      if (!cols || cols.length === 0) {
        console.warn(`  ⚠️ Target table "${targetSchema}"."${table}" has no columns found.`);
        continue;
      }

      // Generate select expressions with enum casting
      const selectExpressions = cols.map((c: any) => {
        const colName = `"${c.column_name}"`;
        if (c.data_type === 'USER-DEFINED') {
          return `${colName}::text::"${targetSchema}"."${c.udt_name}" AS ${colName}`;
        }
        return colName;
      }).join(', ');

      const colList = cols.map((c: any) => `"${c.column_name}"`).join(', ');

      await db.execute(sql.raw(`
        INSERT INTO "${targetSchema}"."${table}" (${colList})
        SELECT ${selectExpressions} FROM "${sourceSchema}"."${table}"
        ON CONFLICT DO NOTHING
      `));
      console.log(`  ✓ Copied ${rowCount} rows for "${table}"`);
    } catch (err: any) {
      console.warn(`  ⚠️ Could not copy "${table}": ${err.message}`);
    }
  }
}

async function dropOldSchemas() {
  const oldSchemas = ["checklist_web_app", "checklist-prod", "checklist-prev"];
  console.log("\n==========================================================");
  console.log("             DROPPING OLD / OBSOLETE SCHEMAS              ");
  console.log("==========================================================");

  for (const schemaName of oldSchemas) {
    try {
      console.log(`Dropping schema "${schemaName}" CASCADE...`);
      await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`));
      console.log(`✓ Schema "${schemaName}" successfully dropped.`);
    } catch (err: any) {
      console.error(`❌ Failed to drop schema "${schemaName}":`, err.message);
    }
  }
}

async function main() {
  console.log("==========================================================");
  console.log("   INITIALIZING PROD & PREVIEW SCHEMAS (DUAL DATABASE)    ");
  console.log("==========================================================");

  // 1. Setup production schema "checklist_prod"
  await setupSchema("checklist_prod");

  // 2. Setup preview schema "checklist_prev"
  await setupSchema("checklist_prev");

  // 3. Migrate existing data from checklist-prod or checklist_web_app into checklist_prod
  const sourceSchema = "checklist-prod"; // We populated checklist-prod earlier with 100% of data
  await copyDataFromSource(sourceSchema, "checklist_prod");

  // 4. Seed preview schema from checklist_prod
  await copyDataFromSource("checklist_prod", "checklist_prev");

  // 5. Drop old schemas: checklist_web_app, checklist-prod, checklist-prev
  await dropOldSchemas();

  console.log("\n🎉 Successfully initialized 'checklist_prod' and 'checklist_prev', and removed old schemas!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Initialization failed:", err);
    process.exit(1);
  });
