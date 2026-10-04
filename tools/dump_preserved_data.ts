import { db } from "../src/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Dumping preserved tables: tasks, refrigerators, cron_settings, branches, users...");

  const tasks = await db.execute(sql`SELECT * FROM checklist_web_app.tasks ORDER BY id;`);
  const refrigerators = await db.execute(sql`SELECT * FROM checklist_web_app.refrigerators ORDER BY id;`);
  const cron_settings = await db.execute(sql`SELECT * FROM checklist_web_app.cron_settings ORDER BY id;`);
  const branches = await db.execute(sql`SELECT * FROM checklist_web_app.branches ORDER BY id;`);
  const users = await db.execute(sql`SELECT * FROM checklist_web_app.users ORDER BY id;`);

  const dump = {
    tasks,
    refrigerators,
    cron_settings,
    branches,
    users
  };

  const dumpPath = path.join(__dirname, "preserved_data_backup.json");
  fs.writeFileSync(dumpPath, JSON.stringify(dump, null, 2), "utf-8");
  console.log(`Saved backup to ${dumpPath}`);
  console.log(`Summary: tasks=${tasks.length}, refrigerators=${refrigerators.length}, cron_settings=${cron_settings.length}, branches=${branches.length}, users=${users.length}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Dump failed:", err);
  process.exit(1);
});
