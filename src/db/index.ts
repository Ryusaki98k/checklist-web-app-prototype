import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

declare global {
  // eslint-disable-next-line no-var
  var _postgresClient: ReturnType<typeof postgres> | undefined;
}

const client = globalThis._postgresClient ?? postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== 'production') {
  globalThis._postgresClient = client;
}

export const db = drizzle({ client });
export * from './schema';
