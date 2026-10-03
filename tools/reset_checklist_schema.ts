import { db } from "../src/db";
import { sql } from "drizzle-orm";
import * as readline from "readline";

/**
 * ==============================================================================
 *                     TABLE PRESERVATION CONFIGURATION
 * ==============================================================================
 * Define tables within the `checklist_web_app` schema that should NOT be wiped.
 * You can edit this array directly or override it via CLI flags:
 *
 *   --preserve=users,branches,tasks
 *   --preserve-core      (Preserves: users, branches, tasks, refrigerators, cron_settings)
 *   --wipe-all           (Wipes all tables in checklist_web_app, preserving none)
 *   --drop               (Drops tables instead of truncating data)
 *   --dry-run            (Preview tables and row counts without making any changes)
 *   -y, --yes, --force   (Bypass interactive confirmation prompt)
 *
 * Schema Architecture in checklist_web_app:
 *   [Core / Master Data - Frequently Preserved]
 *   - "users"               : Employee & manager accounts, login credentials, points
 *   - "branches"            : Branch definitions and member assignments
 *   - "tasks"               : Checklist task templates (opening, shift, closing)
 *   - "refrigerators"       : Refrigerator equipment definitions
 *   - "cron_settings"       : Automated maintenance schedule settings
 *
 *   [Operational / Transactional Data - Frequently Reset]
 *   - "shift_session"       : Active and historical employee shifts
 *   - "task_work"           : Completed task logs and employee comments
 *   - "refrigerator_tasks"  : Daily refrigerator temperature checks
 *   - "store_closing_tasks" : Daily branch closing checklist records
 *   - "notifications"       : System and shift notifications
 *   - "point_transactions"  : Points history ledger
 *   - "employee_leaves"     : Leave requests and leave records
 * ==============================================================================
 */

export const PRESERVED_TABLES: string[] = [
  // Uncomment or add table names here to preserve them by default:
  // "users",
  // "branches",
  "tasks",
  "refrigerators",
  "cron_settings",
];

const TARGET_SCHEMA = "checklist_web_app";

// Helper for CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let preserveList = [...PRESERVED_TABLES];
  let force = false;
  let dryRun = false;
  let dropMode = false;

  for (const arg of args) {
    if (arg === "-y" || arg === "--yes" || arg === "--force") {
      force = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--drop") {
      dropMode = true;
    } else if (arg === "--wipe-all" || arg === "--preserve-none") {
      preserveList = [];
    } else if (arg === "--preserve-core") {
      preserveList = ["users", "branches", "tasks", "refrigerators", "cron_settings"];
    } else if (arg.startsWith("--preserve=") || arg.startsWith("--keep=")) {
      const val = arg.split("=")[1];
      preserveList = val.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    }
  }

  // Also check environment variable PRESERVE_TABLES if not passed in CLI
  if (process.env.PRESERVE_TABLES && !args.some((a) => a.startsWith("--preserve=") || a.startsWith("--keep="))) {
    preserveList = process.env.PRESERVE_TABLES.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  return { preserveList: Array.from(new Set(preserveList)), force, dryRun, dropMode };
}

function printNotice(
  wipeList: { name: string; count: number }[],
  preservedDetails: { name: string; count: number }[]
) {
  console.log(`\n\x1b[41m\x1b[37m\x1b[1m ============================================================================== \x1b[0m`);
  console.log(`\x1b[41m\x1b[37m\x1b[1m                     ⚠️   NOTICE: DATABASE RESET OPERATION   ⚠️                  \x1b[0m`);
  console.log(`\x1b[41m\x1b[37m\x1b[1m ============================================================================== \x1b[0m`);
  console.log(`\x1b[33m\x1b[1m[SCOPE RESTRICTION]\x1b[0m`);
  console.log(`  • Target Schema: \x1b[36m"${TARGET_SCHEMA}"\x1b[0m ONLY`);
  console.log(`  • Other Schemas: "public", "auth", "storage", etc. are \x1b[32mSTRICTLY PROTECTED\x1b[0m and untouched.`);
  console.log(`\n\x1b[33m\x1b[1m[DATA LOSS WARNING]\x1b[0m`);
  console.log(`  • This action is \x1b[31mPERMANENT AND IRREVERSIBLE\x1b[0m.`);
  console.log(`  • Non-preserved tables in "${TARGET_SCHEMA}" will have their data completely wiped.`);

  console.log(`\n\x1b[32m\x1b[1m[🛡️  PRESERVED TABLES (${preservedDetails.length})]\x1b[0m - These tables will NOT be wiped:`);
  if (preservedDetails.length === 0) {
    console.log(`  \x1b[90m(None - All tables in "${TARGET_SCHEMA}" will be wiped!)\x1b[0m`);
  } else {
    for (const t of preservedDetails) {
      console.log(`  ✓ \x1b[32m${t.name}\x1b[0m (${t.count} rows)`);
    }
  }

  console.log(`\n\x1b[31m\x1b[1m[⚠️  TARGET TABLES TO BE WIPED (${wipeList.length})]\x1b[0m:`);
  if (wipeList.length === 0) {
    console.log(`  \x1b[90m(None - All existing tables are preserved!)\x1b[0m`);
  } else {
    for (const t of wipeList) {
      console.log(`  ✗ \x1b[31m${t.name}\x1b[0m (${t.count} rows will be deleted)`);
    }
  }
  console.log(`\x1b[41m\x1b[37m\x1b[1m ============================================================================== \x1b[0m\n`);
}

async function askConfirmation(promptText: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      const cleaned = answer.trim().toUpperCase();
      resolve(cleaned === "RESET" || cleaned === "YES" || cleaned === "CONFIRM");
    });
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface TableNameRow {
  table_name: string;
}

interface CountRow {
  count: number;
}

interface ForeignKeyRow {
  child_table: string;
  parent_table: string;
}

interface SchemaNameRow {
  schema_name: string;
}

async function getTablesInSchema(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'checklist_web_app' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `);

  return (result as unknown as TableNameRow[]).map((r) => r.table_name);
}

async function getTableRowCount(tableName: string): Promise<number> {
  try {
    const res = await db.execute(sql.raw(`SELECT count(*)::int as count FROM "${TARGET_SCHEMA}"."${tableName}"`));
    return (res as unknown as CountRow[])[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

async function getForeignKeys(): Promise<{ childTable: string; parentTable: string }[]> {
  const result = await db.execute(sql`
    SELECT
      tc.table_name AS child_table, 
      ccu.table_name AS parent_table
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'checklist_web_app';
  `);

  return (result as unknown as ForeignKeyRow[]).map((r) => ({
    childTable: r.child_table,
    parentTable: r.parent_table,
  }));
}

async function resetDatabase() {
  const { preserveList, force, dryRun, dropMode } = parseArgs();

  // 1. Verify schema exists
  const schemaCheck = await db.execute(sql`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name = 'checklist_web_app';
  `);

  if ((schemaCheck as unknown as SchemaNameRow[]).length === 0) {
    console.error(`\x1b[31mError: Schema "${TARGET_SCHEMA}" does not exist in this database.\x1b[0m`);
    process.exit(1);
  }

  // 2. Fetch all tables in schema
  const allTables = await getTablesInSchema();
  if (allTables.length === 0) {
    console.log(`\x1b[33mNo tables found in schema "${TARGET_SCHEMA}". Nothing to reset.\x1b[0m`);
    process.exit(0);
  }

  // 3. Separate into preserved and target tables
  const preservedSet = new Set(preserveList.map((t) => t.toLowerCase()));
  const tablesToPreserve: string[] = [];
  const tablesToWipe: string[] = [];

  for (const t of allTables) {
    if (preservedSet.has(t.toLowerCase())) {
      tablesToPreserve.push(t);
    } else {
      tablesToWipe.push(t);
    }
  }

  // 4. Retrieve current row counts sequentially (to preserve connection stability)
  const preservedDetails: { name: string; count: number }[] = [];
  for (const t of tablesToPreserve) {
    const count = await getTableRowCount(t);
    preservedDetails.push({ name: t, count });
  }

  const wipeDetails: { name: string; count: number }[] = [];
  for (const t of tablesToWipe) {
    const count = await getTableRowCount(t);
    wipeDetails.push({ name: t, count });
  }

  // 5. Check foreign key conflicts:
  // If a PRESERVED table references a table that is SLATED TO BE WIPED,
  // truncating or dropping the parent would invalidate the preserved child table!
  const foreignKeys = await getForeignKeys();
  const wipedSet = new Set(tablesToWipe.map((t) => t.toLowerCase()));
  for (const fk of foreignKeys) {
    if (preservedSet.has(fk.childTable.toLowerCase()) && wipedSet.has(fk.parentTable.toLowerCase())) {
      console.warn(
        `\x1b[33m⚠️  Warning: Preserved table "${fk.childTable}" references table "${fk.parentTable}" which is set to be wiped.\x1b[0m`
      );
      console.warn(`   Consider also preserving "${fk.parentTable}" to maintain referential integrity.\n`);
    }
  }

  // 6. Display high-visibility notice
  printNotice(wipeDetails, preservedDetails);

  if (wipeDetails.length === 0) {
    console.log(`\x1b[32mAll tables in "${TARGET_SCHEMA}" are preserved. No changes made.\x1b[0m\n`);
    process.exit(0);
  }

  if (dryRun) {
    console.log(`\x1b[33m[DRY RUN MODE] No changes were made to the database.\x1b[0m\n`);
    process.exit(0);
  }

  // 7. Interactive Confirmation
  if (!force) {
    const promptMessage = `\x1b[1mType \x1b[31mRESET\x1b[0m\x1b[1m to confirm wiping ${wipeDetails.length} table(s) in "${TARGET_SCHEMA}": \x1b[0m`;
    const confirmed = await askConfirmation(promptMessage);
    if (!confirmed) {
      console.log(`\n\x1b[33mReset aborted by user. No data was modified.\x1b[0m\n`);
      process.exit(0);
    }
  }

  console.log(`\n\x1b[33mStarting reset in 3 seconds... (Press Ctrl+C to abort)\x1b[0m`);
  await sleep(3000);

  // 8. Perform the reset operation
  console.log(`\x1b[36mExecuting reset on schema "${TARGET_SCHEMA}"...\x1b[0m`);

  try {
    if (dropMode) {
      // DROP MODE: Drops the tables
      for (const t of tablesToWipe) {
        console.log(`  Dropping table "${TARGET_SCHEMA}"."${t}"...`);
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${TARGET_SCHEMA}"."${t}" CASCADE;`));
      }
      console.log(`\n\x1b[32m✓ Successfully dropped ${tablesToWipe.length} table(s).\x1b[0m`);
    } else {
      // TRUNCATE / WIPE MODE:
      // We truncate the target tables in a single statement.
      // If none of the preserved tables reference the target tables, CASCADE cleanly
      // wipes dependent target tables without touching preserved parents.
      const tableIdentifiers = tablesToWipe.map((t) => `"${TARGET_SCHEMA}"."${t}"`).join(", ");
      await db.execute(sql.raw(`TRUNCATE TABLE ${tableIdentifiers} RESTART IDENTITY CASCADE;`));

      console.log(`\n\x1b[32m✓ Successfully wiped data in ${tablesToWipe.length} table(s).\x1b[0m`);
    }

    // 9. Verify post-reset state
    console.log(`\n\x1b[1m[POST-RESET STATUS VERIFICATION]\x1b[0m`);
    for (const t of preservedDetails) {
      const currentCount = await getTableRowCount(t.name);
      console.log(`  🛡️  Preserved: \x1b[32m${t.name}\x1b[0m - ${currentCount} rows (unaltered)`);
    }

    for (const t of tablesToWipe) {
      if (!dropMode) {
        const currentCount = await getTableRowCount(t);
        console.log(`  ✓ Cleared:   \x1b[36m${t}\x1b[0m - ${currentCount} rows`);
      } else {
        console.log(`  ✓ Dropped:   \x1b[36m${t}\x1b[0m`);
      }
    }

    console.log(`\n\x1b[32m\x1b[1m✓ Database reset in schema "${TARGET_SCHEMA}" completed successfully!\x1b[0m\n`);
  } catch (error) {
    console.error(`\n\x1b[31mReset failed with error:\x1b[0m`, error);
    process.exit(1);
  }
}

resetDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
