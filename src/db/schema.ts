import { boolean, integer, jsonb, pgSchema, timestamp, time, uuid, text } from "drizzle-orm/pg-core";

export const checklistSchema = pgSchema("checklist_web_app");

export const roleEnum = checklistSchema.enum('role', ['admin', 'committee', 'general_manager', 'manager', 'manager_assistant', 'employee']);
export const taskRoleEnum = checklistSchema.enum('task_role', ['manager_assistant', 'cashier', 'stock']);
export const shiftEnum = checklistSchema.enum('shift', ['morning', 'afternoon', 'morning_afternoon']);
export const pointStreakEnum = checklistSchema.enum('point_streak', ['none', 'flawed', 'perfect']);
export const leaveTypeEnum = checklistSchema.enum('leave_type', [
    'paid',
    'unpaid',
    'ลาเเบบได้เงิน',
    'ลาเเบบไม่ได้รับเงิน',
    'ลาแบบได้เงิน',
    'ลาแบบไม่ได้รับเงิน',
    'sick',
    'personal',
    'other',
]);

export const users = checklistSchema.table.withRLS("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    username: text("username").notNull().default(""),
    password: text("password"),
    role: roleEnum("role").notNull(),

    point_streak_type: pointStreakEnum('point_streak_type').notNull().default('none'),
    point_streak: integer('point_streak').notNull().default(0),
    longest_streak: integer('longest_streak').notNull().default(0),
    point: integer("point").notNull().default(0),

    last_login: timestamp("last_login"),
    leave_quota: integer("leave_quota"),
    created_at: timestamp("created_at").defaultNow(),
});

export const branches = checklistSchema.table.withRLS("branches", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    members: uuid("member_ids").array().notNull().default([]),
    tasks: uuid("task_ids").array().notNull().default([]),
    refrigerators: uuid("refrigerators").array().notNull().default([]),
    leave_quota: integer("leave_quota").notNull().default(3),

    last_update: timestamp("last_update").defaultNow(),
});

export const tasks = checklistSchema.table.withRLS("tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    shift: shiftEnum("shift").notNull(),
    name: text("name").notNull(),
    task_role: taskRoleEnum("task_role").notNull(),

    start: time("start_time").notNull(),
    end: time("end_time").notNull(),

    disabled: boolean("disabled").notNull().default(false),
});

export const shiftSession = checklistSchema.table.withRLS("shift_session", {
    id: uuid("id").primaryKey().defaultRandom(),
    user: uuid("user_id").notNull().references(() => users.id),
    branch: uuid("branch_id").notNull().references(() => branches.id),
    task_role: taskRoleEnum("task_role").notNull(),
    shift: shiftEnum("shift").notNull(),

    start: timestamp("start_timestamp").notNull(),
    end: timestamp("end_timestamp"),
    manager_assistance_approve_timestamp: timestamp("manager_assistance_approve_timestamp"),
    manager_approve_timestamp: timestamp("manager_approve_timestamp"),

    incomplete_reason: text("incomplete_reason"),
    incomplete_status: text("incomplete_status").default("none"),
    incomplete_action: text("incomplete_action"),
    incomplete_action_points: integer("incomplete_action_points").default(0),
    incomplete_action_note: text("incomplete_action_note"),
    incomplete_reviewed_by: uuid("incomplete_reviewed_by").references(() => users.id),
    incomplete_reviewed_at: timestamp("incomplete_reviewed_at"),
});

export const taskWork = checklistSchema.table.withRLS("task_work", {
    id: uuid("id").primaryKey().defaultRandom(),
    task: uuid("task_id").notNull().references(() => tasks.id),
    shift_session: uuid("shift_session_id").notNull().references(() => shiftSession.id),
    comment: text("comment"),

    timestamp: timestamp("timestamp"),
});

export const refrigerators = checklistSchema.table.withRLS("refrigerators", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().default(""),
    min_temperature: integer("min_temperature").notNull().default(0),
    max_temperature: integer("max_temperature").notNull().default(4),
    disable_check: boolean("disable_check").notNull().default(false),
});

export const refrigeratorTasks = checklistSchema.table.withRLS("refrigerator_tasks", {
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

export const storeClosingTasks = checklistSchema.table.withRLS("store_closing_tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    branch_id: uuid("branch_id").notNull().references(() => branches.id),
    task_id: uuid("task_id").notNull().references(() => tasks.id),
    task_date: text("task_date").notNull(),
    completed_by: uuid("completed_by").references(() => users.id),
    completed_at: timestamp("completed_at"),
    shift_session_id: uuid("shift_session_id").references(() => shiftSession.id),
    comment: text("comment"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = checklistSchema.table.withRLS("notifications", {
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

export const pointTransactions = checklistSchema.table.withRLS("point_transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id),
    points: integer("points").notNull(),
    type: text("type").notNull(), // 'shift_completion' | 'on_time_bonus' | 'streak_bonus' | 'manager_award'
    shift_session_id: uuid("shift_session_id").references(() => shiftSession.id),
    description: text("description").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
});

export const employeeLeaves = checklistSchema.table.withRLS("employee_leaves", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id),
    branch_id: uuid("branch_id").notNull().references(() => branches.id),
    leave_type: leaveTypeEnum("leave_type").notNull(), // 'sick' | 'personal' | 'other'
    start_date: text("start_date").notNull(), // 'YYYY-MM-DD'
    end_date: text("end_date").notNull(), // 'YYYY-MM-DD'
    reason: text("reason").notNull(),
    preserve_streak: boolean("preserve_streak").notNull().default(true),
    previous_streak: integer("previous_streak"),
    recorded_by: uuid("recorded_by").notNull().references(() => users.id),
    status: text("status").notNull().default("approved"), // 'pending' | 'approved' | 'rejected'
    approved_by: uuid("approved_by").references(() => users.id),
    approved_at: timestamp("approved_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
});

export const cronSettings = checklistSchema.table.withRLS("cron_settings", {
    id: text("id").primaryKey(), // 'cleanup-data' | 'end-shifts' | 'daily-refrigerators'
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    schedule_cron: text("schedule_cron").notNull(),
    schedule_description: text("schedule_description").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    last_run_at: timestamp("last_run_at"),
    last_run_status: text("last_run_status"), // 'success' | 'failed' | 'skipped'
    last_run_message: text("last_run_message"),
    updated_at: timestamp("updated_at").defaultNow(),
});