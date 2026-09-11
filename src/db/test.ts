import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import 'dotenv/config';

enum TaskStatus { InCompleted, Completed, Late }

const queryClient = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle({ client: queryClient });

import { tasks } from './schema';

async function main() {
    console.log("Connecting to database...");
    const sampleTasks = await db.select().from(tasks).limit(3);
    console.log(`Success! Found ${sampleTasks.length} sample tasks:`);
    console.log(JSON.stringify(sampleTasks, null, 2));
    process.exit(0);
}

main().catch((err) => {
    console.error("Database test failed:", err);
    process.exit(1);
});

