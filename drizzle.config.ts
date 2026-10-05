import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const dbUrl = new URL(process.env.DATABASE_URL!);

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
    schemaFilter: ['checklist_web_app'],
});
