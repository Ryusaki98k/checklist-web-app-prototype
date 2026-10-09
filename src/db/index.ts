import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';
import { getDatabaseUrl } from './config';

const connectionString = getDatabaseUrl();

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

declare global {
  // eslint-disable-next-line no-var
  var _postgresClient: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var _drizzleDb: ReturnType<typeof drizzle> | undefined;
}

const client =
  globalThis._postgresClient ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

globalThis._postgresClient = client;

export const db = globalThis._drizzleDb ?? drizzle({ client });
globalThis._drizzleDb = db;
export * from './schema';
