import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';
import { getDatabaseSchema, getDatabaseUrl } from './src/db/config';

const connectionUrl = getDatabaseUrl();
const dbUrl = new URL(connectionUrl);
const activeSchema = getDatabaseSchema();

export default defineConfig({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        host: dbUrl.hostname,
        port: Number(dbUrl.port) || 5432,
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname.replace(/^\//, ''),
        ssl: 'require',
        prepare: false,
    } as any,
    schemaFilter: [activeSchema],
});
