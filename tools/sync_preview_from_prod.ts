import 'dotenv/config';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

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

async function main() {
  console.log("==========================================================");
  console.log("     SYNC PREVIEW FROM PROD (checklist_prod -> checklist_prev)     ");
  console.log("==========================================================");

  // 1. Wipe preview tables in cascade
  console.log("Truncating preview tables...");
  const tableList = TABLES_IN_ORDER.map(t => `"checklist_prev"."${t}"`).join(", ");
  try {
    await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));
    console.log("✓ Cleaned existing tables in checklist_prev.");
  } catch (err: any) {
    console.warn(`Truncate warning: ${err.message}`);
  }

  // 2. Copy all data from checklist_prod to checklist_prev with proper enum casting
  console.log("\nCopying production data into preview...");
  for (const table of TABLES_IN_ORDER) {
    try {
      const countRes: any = await db.execute(sql.raw(`
        SELECT count(*)::int as c FROM "checklist_prod"."${table}"
      `));
      const rowCount = countRes[0]?.c ?? 0;

      if (rowCount === 0) {
        console.log(`  - Table "${table}" has 0 rows, skipped.`);
        continue;
      }

      const cols: any = await db.execute(sql.raw(`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_schema = 'checklist_prev' AND table_name = '${table}'
        ORDER BY ordinal_position
      `));

      const selectExpressions = cols.map((c: any) => {
        const colName = `"${c.column_name}"`;
        if (c.data_type === 'USER-DEFINED') {
          return `${colName}::text::"checklist_prev"."${c.udt_name}" AS ${colName}`;
        }
        return colName;
      }).join(', ');

      const colList = cols.map((c: any) => `"${c.column_name}"`).join(', ');

      await db.execute(sql.raw(`
        INSERT INTO "checklist_prev"."${table}" (${colList})
        SELECT ${selectExpressions} FROM "checklist_prod"."${table}"
      `));

      const res: any = await db.execute(sql.raw(`SELECT count(*)::int as c FROM "checklist_prev"."${table}"`));
      console.log(`  ✓ Synced ${res[0]?.c ?? 0} rows for "${table}"`);
    } catch (err: any) {
      console.error(`  ❌ Failed to copy "${table}": ${err.message}`);
    }
  }

  console.log("\n🎉 Preview database ('checklist_prev') successfully synchronized with production ('checklist_prod')!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
