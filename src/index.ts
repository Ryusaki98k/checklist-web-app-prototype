import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import 'dotenv/config';

enum TaskStatus { InCompleted, Completed, Late }

const queryClient = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle({ client: queryClient });
