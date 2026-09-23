import { boolean, integer, pgEnum, pgTable, timestamp, time, uuid, text } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('role', ['admin', 'committee', 'general_manager', 'manager', 'manager_assistant', 'employee']);
export const taskRoleEnum = pgEnum('task_role', ['manager_assistant', 'cashier', 'stock']);
export const shiftEnum = pgEnum('shift', ['morning', 'afternoon', 'morning_afternoon']);
export const pointStreakEnum = pgEnum('point_streak', ['none', 'flawed', 'perfect']);

export const users = pgTable.withRLS("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password: text("password"),
    role: roleEnum("role").notNull(),

    point_streak_type: pointStreakEnum('point_streak_type').notNull().default('none'),
    point_streak: integer('point_streak').notNull().default(0),
    longest_streak: integer('longest_streak').notNull().default(0),
    point: integer("point").notNull().default(0),

    last_login: timestamp("last_login"),
    created_at: timestamp("created_at").defaultNow(),
});

export const branches = pgTable.withRLS("branches", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    members: uuid("member_ids").array().notNull().default([]),
    tasks: uuid("task_ids").array().notNull().default([]),
    refrigerators: uuid("refrigerators").array().notNull().default([]),

    last_update: timestamp("last_update").defaultNow(),
});

export const tasks = pgTable.withRLS("tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    shift: shiftEnum("shift").notNull(),
    name: text("name").notNull(),
    task_role: taskRoleEnum("task_role").notNull(),

    start: time("start_time").notNull(),
    end: time("end_time").notNull(),

    disabled: boolean("disabled").notNull().default(false),
});

export const shiftSession = pgTable.withRLS("shift_session", {
    id: uuid("id").primaryKey().defaultRandom(),
    user: uuid("user_id").notNull().references(() => users.id),
    branch: uuid("branch_id").notNull().references(() => branches.id),
    task_role: taskRoleEnum("task_role").notNull(),
    shift: shiftEnum("shift").notNull(),

    start: timestamp("start_timestamp").notNull(),
    end: timestamp("end_timestamp"),
    manager_assistance_approve_timestamp: timestamp("manager_assistance_approve_timestamp"),
    manager_approve_timestamp: timestamp("manager_approve_timestamp"),
});

export const taskWork = pgTable.withRLS("task_work", {
    id: uuid("id").primaryKey().defaultRandom(),
    task: uuid("task_id").notNull().references(() => tasks.id),
    shift_session: uuid("shift_session_id").notNull().references(() => shiftSession.id),
    comment: text("comment"),

    timestamp: timestamp("timestamp"),
});

export const refrigerators = pgTable.withRLS("refrigerators", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().default(""),
    min_temperature: integer("min_temperature").notNull().default(0),
    max_temperature: integer("max_temperature").notNull().default(4),
    disable_check: boolean("disable_check").notNull().default(false),
});

export const refrigeratorTasks = pgTable.withRLS("refrigerator_tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    branch_id: uuid("branch_id").notNull().references(() => branches.id),
    refrigerator_id: uuid("refrigerator_id").notNull().references(() => refrigerators.id),
    task_date: text("task_date").notNull(),
    completed_by: uuid("completed_by").references(() => users.id),
    completed_at: timestamp("completed_at"),
    shift_session_id: uuid("shift_session_id").references(() => shiftSession.id),
    shift: shiftEnum("shift"),
    temperature: integer("temperature"),
    is_okay: boolean("is_okay").default(true),
    comment: text("comment"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable.withRLS("notifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    recipient_id: uuid("recipient_id").references(() => users.id),
    recipient_role: roleEnum("recipient_role"),
    branch_id: uuid("branch_id").references(() => branches.id),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("info"), // 'shift_submitted' | 'shift_approved' | 'point_awarded' | 'refrigerator_alert' | 'system'
    shift_session_id: uuid("shift_session_id").references(() => shiftSession.id),
    is_read: boolean("is_read").notNull().default(false),
    read_by: uuid("read_by").array().notNull().default([]),
    created_at: timestamp("created_at").notNull().defaultNow(),
});

export const pointTransactions = pgTable.withRLS("point_transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id),
    points: integer("points").notNull(),
    type: text("type").notNull(), // 'shift_completion' | 'on_time_bonus' | 'streak_bonus' | 'manager_award'
    shift_session_id: uuid("shift_session_id").references(() => shiftSession.id),
    description: text("description").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
});