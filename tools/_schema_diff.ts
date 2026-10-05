/**
 * Compare every table declared in src/db/schema.ts against the live DB.
 * Read-only. Prints exactly which columns the code needs but the DB lacks.
 */
import { sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { db } from "../src/db/index";
import * as schema from "../src/db/schema";

async function main() {
  const actual = await db.execute(sql`
    select table_name, column_name from information_schema.columns
    where table_schema = 'checklist_web_app' order by table_name, ordinal_position`);
  const live = new Map<string, Set<string>>();
  for (const r of actual as any as any[]) {
    if (!live.has(r.table_name)) live.set(r.table_name, new Set());
    live.get(r.table_name)!.add(r.column_name);
  }

  const missing: string[] = [];
  const skipped: string[] = [];
  const checked: string[] = [];

  for (const [exportName, t] of Object.entries(schema)) {
    if (!t || typeof t !== "object") continue;
    let cfg: any;
    try { cfg = getTableConfig(t as any); } catch { skipped.push(exportName); continue; }
    const cols: Record<string, any> = cfg?.columns ?? {};
    const entries = Object.entries(cols);
    if (entries.length === 0) { skipped.push(exportName); continue; }

    const tableName = cfg.name;
    const dbCols = live.get(tableName);
    if (!dbCols) {
      missing.push(`${tableName}: ตารางไม่มีใน DB เลย (ทั้งตาราง)`);
      continue;
    }
    checked.push(`${tableName} (${entries.length} คอลัมน์)`);
    for (const [, col] of entries) {
      const colName = (col as any).name;
      if (!dbCols.has(colName)) {
        missing.push(
          `${tableName}.${colName}` +
          `${(col as any).notNull ? " NOT NULL" : ""} (${(col as any).getSQLType?.() ?? "?"})`
        );
      }
    }
  }

  console.log(`ตรวจได้จริง ${checked.length} ตาราง:`);
  checked.forEach((c) => console.log(`  ${c}`));
  if (skipped.length) console.log(`\nข้ามเพราะอ่านโครงสร้างไม่ได้: ${skipped.join(", ")}`);

  console.log("\n=== คอลัมน์ที่ schema.ts ต้องการ แต่ DB ไม่มี ===\n");
  if (missing.length === 0) console.log("  ไม่มี");
  else missing.forEach((m) => console.log(`  ❌ ${m}`));
}
main().then(() => process.exit(0));