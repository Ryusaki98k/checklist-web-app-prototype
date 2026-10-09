import 'dotenv/config';
import * as schema from '../src/db/schema';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';
import { getDatabaseSchema } from '../src/db/config';

async function main() {
  const targetSchema = getDatabaseSchema();
  console.log("==========================================================");
  console.log(`            DRIZZLE PUSH (${targetSchema.toUpperCase()})              `);
  console.log("==========================================================");

  // Ensure target schema exists
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`));

  const { pushSchema } = require('drizzle-kit/api-postgres');

  // Wrap db adapter to handle postgres-js result format
  const wrappedDb = {
    ...db,
    execute: async (query: any) => {
      const res = await db.execute(query);
      const rows = Array.isArray(res) ? res : (res as any).rows ?? res;
      return { rows };
    }
  };

  console.log("\n[1/3] Pulling schema from database and computing diff...");
  console.time("Analysis time");
  const result = await pushSchema(
    schema,
    wrappedDb,
    {
      schemas: [targetSchema]
    }
  );
  console.timeEnd("Analysis time");

  if (result.sqlStatements.length === 0) {
    console.log(`\n[i] No changes detected. Database schema "${targetSchema}" is 100% in sync with Drizzle ORM!`);
  } else {
    console.log(`\n[2/3] Applying ${result.sqlStatements.length} statement(s) to database...`);
    for (let i = 0; i < result.sqlStatements.length; i++) {
      const stmt = result.sqlStatements[i];
      process.stdout.write(`  [${i + 1}/${result.sqlStatements.length}] ${stmt.trim().slice(0, 70)}... `);
      await db.execute(sql.raw(stmt));
      console.log("✓");
    }

    console.log("\n[3/3] Verifying schema sync...");
    const verifyResult = await pushSchema(
      schema,
      wrappedDb,
      {
        schemas: [targetSchema]
      }
    );

    if (verifyResult.sqlStatements.length === 0) {
      console.log(`✓ All schema changes successfully applied and verified for "${targetSchema}"!`);
    } else {
      console.warn("⚠️ Remaining statements:", verifyResult.sqlStatements);
    }
  }

  // Ensure permissions
  await db.execute(sql.raw(`
    GRANT USAGE ON SCHEMA "${targetSchema}" TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA "${targetSchema}" TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA "${targetSchema}" TO anon, authenticated, service_role;
    GRANT ALL ON ALL ROUTINES IN SCHEMA "${targetSchema}" TO anon, authenticated, service_role;
  `));
}

main()
  .then(() => {
    console.log("\nPush finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nPush failed:", err);
    process.exit(1);
  });
