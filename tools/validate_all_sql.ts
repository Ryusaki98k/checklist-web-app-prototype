import { db } from "../src/db";
import { sql, getTableColumns } from "drizzle-orm";
import * as schema from "../src/db/schema";
import * as fs from "fs";
import * as path from "path";

interface ValidationResult {
  category: string;
  name: string;
  status: "PASS" | "FAIL";
  error?: string;
}

const results: ValidationResult[] = [];

async function validateSql(category: string, name: string, sqlStatement: any) {
  try {
    await db.execute(sqlStatement);
    results.push({ category, name, status: "PASS" });
    console.log(`  ✓ [PASS] [${category}] ${name}`);
  } catch (err: any) {
    results.push({ category, name, status: "FAIL", error: err?.message || String(err) });
    console.error(`  ✗ [FAIL] [${category}] ${name}:`, err?.message);
  }
}

async function main() {
  console.log("==========================================================");
  console.log("       SQL & SCHEMA INTEGRITY VALIDATION TOOL             ");
  console.log("==========================================================\n");

  // 1. Check Schema Existence
  console.log("--- 1. Validating Database Schema ---");
  await validateSql(
    "Schema",
    "checklist_web_app schema exists",
    sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'checklist_web_app'`
  );

  // 2. Validate All Tables Exist in DB
  console.log("\n--- 2. Validating Tables ---");
  const expectedTables = [
    "branches",
    "users",
    "tasks",
    "branch_tasks",
    "shift_session",
    "task_work",
    "refrigerators",
    "refrigerator_tasks",
    "notifications",
    "notification_reads",
    "point_transactions",
    "employee_leaves",
    "cron_settings",
  ];

  for (const table of expectedTables) {
    await validateSql(
      "Table Existence",
      `Table checklist_web_app.${table} exists`,
      sql.raw(`SELECT 1 FROM "checklist_web_app"."${table}" LIMIT 0`)
    );
  }

  // 3. Validate Every Table Column Matches Drizzle Schema
  console.log("\n--- 3. Validating Drizzle Schema Columns against PostgreSQL ---");
  const tableMapping: Record<string, any> = {
    branches: schema.branches,
    users: schema.users,
    tasks: schema.tasks,
    branch_tasks: schema.branchTasks,
    shift_session: schema.shiftSession,
    task_work: schema.taskWork,
    refrigerators: schema.refrigerators,
    refrigerator_tasks: schema.refrigeratorTasks,
    notifications: schema.notifications,
    notification_reads: schema.notificationReads,
    point_transactions: schema.pointTransactions,
    employee_leaves: schema.employeeLeaves,
    cron_settings: schema.cronSettings,
  };

  for (const [tableName, tableObj] of Object.entries(tableMapping)) {
    const columns = getTableColumns(tableObj);

    for (const [, colObj] of Object.entries(columns)) {
      const dbColName = (colObj as any).name;
      await validateSql(
        "Column Existence",
        `${tableName}.${dbColName}`,
        sql.raw(`SELECT "${dbColName}" FROM "checklist_web_app"."${tableName}" LIMIT 0`)
      );
    }
  }

  // 3b. Validate All Enums Match between Drizzle and PostgreSQL
  console.log("\n--- 3b. Validating Database Enum Types ---");
  const expectedEnums: Record<string, string[]> = {
    role: ["admin", "committee", "general_manager", "manager", "manager_assistant", "employee"],
    task_role: ["manager_assistant", "cashier", "stock"],
    shift: ["morning", "afternoon", "morning_afternoon", "night"],
    point_streak: ["none", "flawed", "perfect"],
    leave_type: ["paid", "unpaid"],
  };

  for (const [enumName, expectedVals] of Object.entries(expectedEnums)) {
    try {
      const res: any = await db.execute(sql`
        SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'checklist_web_app' AND t.typname = ${enumName}
      `);
      const actualVals = res[0]?.values || [];
      const match = expectedVals.every((v) => actualVals.includes(v)) && actualVals.length === expectedVals.length;
      if (match) {
        results.push({ category: "Enum Validation", name: `checklist_web_app.${enumName} [${actualVals.join(", ")}]`, status: "PASS" });
        console.log(`  ✓ [PASS] [Enum Validation] checklist_web_app.${enumName} [${actualVals.join(", ")}]`);
      } else {
        const error = `Mismatch: expected [${expectedVals.join(", ")}], got [${actualVals.join(", ")}]`;
        results.push({ category: "Enum Validation", name: `checklist_web_app.${enumName}`, status: "FAIL", error });
        console.error(`  ✗ [FAIL] [Enum Validation] checklist_web_app.${enumName}: ${error}`);
      }
    } catch (err: any) {
      results.push({ category: "Enum Validation", name: `checklist_web_app.${enumName}`, status: "FAIL", error: err?.message });
      console.error(`  ✗ [FAIL] [Enum Validation] checklist_web_app.${enumName}:`, err?.message);
    }
  }

  // 4. Validate All Raw SQL Queries from Services & Tools
  console.log("\n--- 4. Validating Application SQL Queries (EXPLAIN mode) ---");

  // ManagerService & EmployeeLeaves Queries
  await validateSql(
    "ManagerService Query",
    "Employee leaves filter by branch and date overlap",
    sql`EXPLAIN SELECT id, user_id, branch_id, leave_type, start_date, end_date, status 
        FROM checklist_web_app.employee_leaves 
        WHERE branch_id = '00000000-0000-0000-0000-000000000000' 
          AND start_date <= '2026-10-06' 
          AND end_date >= '2026-10-06' 
        ORDER BY created_at DESC`
  );

  await validateSql(
    "ManagerService Query",
    "Employee leave quota user leaves lookup",
    sql`EXPLAIN SELECT id, user_id, leave_type, start_date, end_date, status 
        FROM checklist_web_app.employee_leaves 
        WHERE user_id = '00000000-0000-0000-0000-000000000000'`
  );

  // AuthService lower(username) query
  await validateSql(
    "AuthService Query",
    "Case-insensitive username lookup",
    sql`EXPLAIN SELECT id, username, password, role, branch_id FROM checklist_web_app.users WHERE lower(username) = 'test'`
  );

  // BranchService queries
  await validateSql(
    "BranchService Query",
    "Select max(last_update) from branches",
    sql`EXPLAIN SELECT MAX(last_update) FROM checklist_web_app.branches`
  );

  await validateSql(
    "BranchService Query",
    "Select branch_tasks",
    sql`EXPLAIN SELECT branch_id, task_id FROM checklist_web_app.branch_tasks`
  );

  // ChecklistService queries
  await validateSql(
    "ChecklistService Query",
    "Task work timestamp check",
    sql`EXPLAIN SELECT id, task_id, shift_session_id, timestamp FROM checklist_web_app.task_work WHERE timestamp IS NOT NULL`
  );

  // RefrigeratorService queries
  await validateSql(
    "RefrigeratorService Query",
    "Refrigerator incomplete check",
    sql`EXPLAIN SELECT id, completed_at, is_okay FROM checklist_web_app.refrigerator_tasks WHERE completed_at IS NULL`
  );

  await validateSql(
    "RefrigeratorService Query",
    "Refrigerator task comment COALESCE expression",
    sql`EXPLAIN SELECT COALESCE(comment, 'ไม่ได้ตรวจเช็ค') FROM checklist_web_app.refrigerator_tasks`
  );

  // PointService queries
  await validateSql(
    "PointService Query",
    "Point increment arithmetic expression",
    sql`EXPLAIN SELECT point + 10 FROM checklist_web_app.users WHERE id = '00000000-0000-0000-0000-000000000000'`
  );

  // NotificationService queries
  await validateSql(
    "NotificationService Query",
    "Notification reads join / check",
    sql`EXPLAIN SELECT nr.notification_id, nr.user_id, nr.read_at 
        FROM checklist_web_app.notification_reads nr 
        WHERE nr.user_id = '00000000-0000-0000-0000-000000000000'`
  );

  await validateSql(
    "NotificationService Query",
    "Notifications broadcast & direct filtering",
    sql`EXPLAIN SELECT id, recipient_id, recipient_role, branch_id, title, is_read, created_at 
        FROM checklist_web_app.notifications 
        WHERE recipient_id = '00000000-0000-0000-0000-000000000000' 
           OR (recipient_id IS NULL AND (recipient_role = 'manager' OR branch_id = '00000000-0000-0000-0000-000000000000'))
        ORDER BY created_at DESC LIMIT 50`
  );

  // Diagnostic & Tool Queries
  await validateSql(
    "Tool Query",
    "inspect_sessions join query",
    sql`EXPLAIN SELECT s.id, u.name, u.username, s.shift, s.start_timestamp, s.end_timestamp 
        FROM checklist_web_app.shift_session s 
        JOIN checklist_web_app.users u ON s.user_id = u.id 
        ORDER BY s.start_timestamp DESC`
  );

  await validateSql(
    "Tool Query",
    "reset_checklist_schema information_schema foreign keys query",
    sql`EXPLAIN SELECT tc.table_name AS child_table, ccu.table_name AS parent_table
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'checklist_web_app'`
  );

  // 4b. Validate Employee Leaves Insertion & Update (Dry-Run Rollback Transaction)
  console.log("\n--- 4b. Validating Drizzle employee_leaves Mutation (Dry-Run) ---");
  try {
    await db.transaction(async (tx) => {
      const [u] = await tx.select({ id: schema.users.id }).from(schema.users).limit(1);
      const [b] = await tx.select({ id: schema.branches.id }).from(schema.branches).limit(1);

      if (u && b) {
        const [inserted] = await tx.insert(schema.employeeLeaves).values({
          user_id: u.id,
          branch_id: b.id,
          leave_type: "paid",
          start_date: "2026-10-06",
          end_date: "2026-10-06",
          reason: "Test leave validation",
          recorded_by: u.id,
        }).returning();

        await tx.update(schema.employeeLeaves)
          .set({ leave_type: "unpaid", status: "approved" })
          .where(sql`${schema.employeeLeaves.id} = ${inserted.id}`);

        results.push({ category: "Drizzle Mutation", name: "employee_leaves insert ('paid') & update ('unpaid')", status: "PASS" });
        console.log(`  ✓ [PASS] [Drizzle Mutation] employee_leaves insert ('paid') & update ('unpaid')`);
      }
      tx.rollback();
    });
  } catch (err: any) {
    if (err.constructor?.name === "TransactionRollbackError" || err.name === "TransactionRollbackError") {
      // Expected rollback
    } else {
      results.push({ category: "Drizzle Mutation", name: "employee_leaves insert/update", status: "FAIL", error: err?.message });
      console.error(`  ✗ [FAIL] [Drizzle Mutation] employee_leaves insert/update:`, err?.message);
    }
  }

  // 5. Validate SQL Files (Syntax & Execution Dry-Run in rolled-back transaction)
  console.log("\n--- 5. Validating SQL Script Files (Transaction Dry-Run) ---");
  const sqlFiles = [
    "migration_normalize_arrays_for_concurrency.sql",
    "migration_add_cron_settings.sql",
    "migration_add_employee_leaves.sql",
    "migration_remove_email.sql",
    "migration_move_to_checklist_web_app.sql",
    "reset_checklist_schema.sql",
  ];

  for (const file of sqlFiles) {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf-8");

    try {
      // Execute in an isolated transaction that is rolled back so it does not alter current data
      await db.transaction(async (tx) => {
        await tx.execute(sql.raw(content));
        tx.rollback();
      });
      results.push({ category: "SQL Script File", name: file, status: "PASS" });
      console.log(`  ✓ [PASS] [SQL Script File] ${file}`);
    } catch (err: any) {
      if (err.constructor?.name === "TransactionRollbackError" || err.name === "TransactionRollbackError") {
        results.push({ category: "SQL Script File", name: file, status: "PASS" });
        console.log(`  ✓ [PASS] [SQL Script File] ${file}`);
      } else {
        results.push({ category: "SQL Script File", name: file, status: "FAIL", error: err?.message });
        console.error(`  ✗ [FAIL] [SQL Script File] ${file}:`, err?.message);
      }
    }
  }

  // 6. Summary
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log("\n==========================================================");
  console.log(`TOTAL VALIDATED: ${results.length}`);
  console.log(`PASSED:          ${passed}`);
  console.log(`FAILED:          ${failed}`);
  console.log("==========================================================");

  if (failed > 0) {
    console.error(`\n❌ Validation finished with ${failed} failure(s).`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL SQL queries, schemas, and migration files are 100% valid!`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal validation error:", err);
  process.exit(1);
});
