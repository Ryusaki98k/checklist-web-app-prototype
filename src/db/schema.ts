import { integer, pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('Role', ['Admin', 'Manager', 'Employee']);

export const users = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    password: varchar({ length: 255 }).notNull(),
    role: roleEnum(),
});
