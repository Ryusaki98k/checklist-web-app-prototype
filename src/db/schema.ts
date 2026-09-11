import { boolean, date, integer, pgEnum, pgTable, timestamp, varchar, time, uuid, text } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('role', ['committee', 'general_manager', 'manager', 'manager_assistant', 'employee']);
export const taskRoleEnum = pgEnum('task_role', ['manager_assistant', 'cashier', 'stock']);
export const shiftEnum = pgEnum('shift', ['morning', 'noon', 'morning_noon']);

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password: text("password").notNull(),
    role: roleEnum("role").notNull(),

    last_login: timestamp("last_login"),
})

export const tasks = pgTable("tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    shift: shiftEnum("shift").notNull(),
    name: text("name").notNull(),
    task_role: taskRoleEnum("task_role").notNull(),

    start: time("start_time").notNull(),
    end: time("end_time").notNull(),

    disabled: boolean("disabled").notNull().default(false),
})

export const shiftSession = pgTable("shift_session", {
    id: uuid("id").primaryKey().defaultRandom(),
    user: uuid("user_id").notNull().references(() => users.id),
    task_role: taskRoleEnum("task_role").notNull(),
    shift: shiftEnum("shift").notNull(),

    start: timestamp("start_timestamp").notNull(),
    end: timestamp("end_timestamp"),
})

export const taskWork = pgTable("task_work", {
    id: uuid("id").primaryKey().defaultRandom(),
    task: uuid("task_id").notNull().references(() => tasks.id),
    user: uuid("user_id").notNull().references(() => users.id),
    shift_session: uuid("shift_session_id").notNull().references(() => shiftSession.id),

    timestamp: timestamp("timestamp"),
    manager_assistance_approve_timestamp: timestamp("manager_assistance_approve_timestamp"),
    manager_approve_timestamp: timestamp("manager_approve_timestamp"),
})

export const branches = pgTable("branches", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    members: uuid("member_ids").array().notNull().default([]),
    tasks: uuid("task_ids").array().notNull().default([]),
    last_update: timestamp().notNull(),
});
