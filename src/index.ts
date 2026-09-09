import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from './db/schema'
import { eq } from 'drizzle-orm';
import 'dotenv/config';

const queryClient = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle({ client: queryClient });

export async function getUserById(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
}
