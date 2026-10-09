import { boolean, integer, jsonb, pgSchema, timestamp, time, uuid, text, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

export const checklistSchema = pgSchema("checklist_web_app");

export const roleEnum = checklistSchema.enum('role', ['admin', 'committee', 'general_manager', 'manager', 'manager_assistant', 'employee']);
export const managerTypeEnum = checklistSchema.enum('manager_type', ['none', 'assistant', 'store']);
export const executiveTypeEnum = checklistSchema.enum('executive_type', ['none', 'committee', 'executive']);
export const taskRoleEnum = checklistSchema.enum('task_role', ['manager_assistant', 'cashier', 'stock']);
export const shiftEnum = checklistSchema.enum('shift', ['morning', 'afternoon', 'morning_afternoon', 'night']);
export const pointStreakEnum = checklistSchema.enum('point_streak', ['none', 'flawed', 'perfect']);
export const leaveTypeEnum = checklistSchema.enum('leave_type', [
    'paid',
    'unpaid',
]);
export const leaveStatusEnum = checklistSchema.enum('leave_status', [
    'pending',
    'approved',
    'rejected',
]);

export const branches = checklistSchema.table.withRLS("branches", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    leave_quota: integer("leave_quota").notNull().default(3),
    last_update: timestamp("last_update", { withTimezone: true }).defaultNow(),
});

export const users = checklistSchema.table.withRLS("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    username: text("username").notNull().default(""),
    password: text("password"),
    manager_type: managerTypeEnum("manager_type").notNull().default('none'),
    executive_type: executiveTypeEnum("executive_type").notNull().default('none'),
    is_admin: boolean("is_admin").notNull().default(false),
    branch_id: uuid("branch_id").references(() => branches.id, { onDelete: 'set null' }),

    point_streak_type: pointStreakEnum('point_streak_type').notNull().default('none'),
    point_streak: integer('point_streak').notNull().default(0),
    longest_streak: integer('longest_streak').notNull().default(0),
    point: integer("point").notNull().default(0),

    last_login: timestamp("last_login", { withTimezone: true }),
    leave_quota: integer("leave_quota"),
    profile_id: text("profile_id"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("idx_users_branch_id").on(table.branch_id),
    index("idx_users_username").on(table.username),
    index("idx_users_manager_type").on(table.manager_type),
    index("idx_users_executive_type").on(table.executive_type),
    index("idx_users_is_admin").on(table.is_admin),
]);

export const tasks = checklistSchema.table.withRLS("tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    branch_id: uuid("branch_id").references(() => branches.id, { onDelete: 'cascade' }),
    shift: shiftEnum("shift").notNull(),
    name: text("name").notNull(),
    task_role: taskRoleEnum("task_role").notNull(),

    start: time("start_time").notNull(),
    end: time("end_time").notNull(),

    disabled: boolean("disabled").notNull().default(false),
    for_managers: boolean("for_managers").notNull().default(false),
    is_joint: boolean("is_joint").notNull().default(false),
    selectable_roles: jsonb("selectable_roles").$type<string[]>().default([]),
    category: text("category"),
}, (table) => [
    index("idx_tasks_role_shift").on(table.task_role, table.shift),
    index("idx_tasks_for_managers").on(table.for_managers),
    index("idx_tasks_branch_id").on(table.branch_id),
    index("idx_tasks_is_joint").on(table.is_joint),
]);

export const branchTasks = checklistSchema.table.withRLS("branch_tasks", {
    branch_id: uuid("branch_id").notNull().references(() => branches.id, { onDelete: 'cascade' }),
    task_id: uuid("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    primaryKey({ columns: [table.branch_id, table.task_id] }),
    index("idx_branch_tasks_branch").on(table.branch_id),
    index("idx_branch_tasks_task").on(table.task_id),
]);

export const shiftSession = checklistSchema.table.withRLS("shift_session", {
    id: uuid("id").primaryKey().defaultRandom(),
    user: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    branch: uuid("branch_id").notNull().references(() => branches.id, { onDelete: 'cascade' }),
    task_role: taskRoleEnum("task_role").notNull(),
    shift: shiftEnum("shift").notNull(),

    start: timestamp("start_timestamp", { withTimezone: true }).notNull(),
    end: timestamp("end_timestamp", { withTimezone: true }),
    manager_assistance_approve_timestamp: timestamp("manager_assistance_approve_timestamp", { withTimezone: true }),
    manager_approve_timestamp: timestamp("manager_approve_timestamp", { withTimezone: true }),

    incomplete_reason: text("incomplete_reason"),
    incomplete_status: text("incomplete_status").default("none"),
    incomplete_action: text("incomplete_action"),
    incomplete_action_points: integer("incomplete_action_points").default(0),
    incomplete_action_note: text("incomplete_action_note"),
    incomplete_reviewed_by: uuid("incomplete_reviewed_by").references(() => users.id, { onDelete: 'set null' }),
    incomplete_reviewed_at: timestamp("incomplete_reviewed_at", { withTimezone: true }),
}, (table) => [
    index("idx_shift_session_user_start").on(table.user, table.start),
    index("idx_shift_session_branch_start").on(table.branch, table.start),
    index("idx_shift_session_branch_shift_start").on(table.branch, table.shift, table.start),
]);

export const taskWork = checklistSchema.table.withRLS("task_work", {
    id: uuid("id").primaryKey().defaultRandom(),
    task: uuid("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    shift_session: uuid("shift_session_id").notNull().references(() => shiftSession.id, { onDelete: 'cascade' }),
    branch_id: uuid("branch_id").references(() => branches.id, { onDelete: 'cascade' }),
    task_date: text("task_date"),
    completed_by: uuid("completed_by").references(() => users.id, { onDelete: 'set null' }),
    comment: text("comment"),

    timestamp: timestamp("timestamp", { withTimezone: true }),
}, (table) => [
    index("idx_task_work_session").on(table.shift_session),
    index("idx_task_work_task").on(table.task),
    index("idx_task_work_branch_date").on(table.branch_id, table.task_date),
    index("idx_task_work_session_task").on(table.shift_session, table.task),
]);

export const refrigerators = checklistSchema.table.withRLS("refrigerators", {
    id: uuid("id").primaryKey().defaultRandom(),
    branch_id: uuid("branch_id").references(() => branches.id, { onDelete: 'cascade' }),
    name: text("name").notNull().default(""),
    min_temperature: integer("min_temperature").notNull().default(0),
    max_temperature: integer("max_temperature").notNull().default(4),
    disable_check: boolean("disable_check").notNull().default(false),
}, (table) => [
    index("idx_refrigerators_branch_id").on(table.branch_id),
]);

export const refrigeratorTasks = checklistSchema.table.withRLS("refrigerator_tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    branch_id: uuid("branch_id").notNull().references(() => branches.id, { onDelete: 'cascade' }),
    refrigerator_id: uuid("refrigerator_id").notNull().references(() => refrigerators.id, { onDelete: 'cascade' }),
    task_date: text("task_date").notNull(),
    completed_by: uuid("completed_by").references(() => users.id, { onDelete: 'set null' }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    shift_session_id: uuid("shift_session_id").references(() => shiftSession.id, { onDelete: 'set null' }),
    shift: shiftEnum("shift"),
    temperature: integer("temperature"),
    is_okay: boolean("is_okay").default(true),
    comment: text("comment"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("idx_ref_tasks_branch_date").on(table.branch_id, table.task_date),
    index("idx_ref_tasks_branch_date_shift").on(table.branch_id, table.task_date, table.shift),
    index("idx_ref_tasks_refrigerator").on(table.refrigerator_id),
]);

export const jointTaskWork = checklistSchema.table.withRLS("joint_task_work", {
    id: uuid("id").primaryKey().defaultRandom(),
    task_id: uuid("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    branch_id: uuid("branch_id").notNull().references(() => branches.id, { onDelete: 'cascade' }),
    task_date: text("task_date").notNull(),
    shift: shiftEnum("shift"),
    completed_by: uuid("completed_by").references(() => users.id, { onDelete: 'set null' }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    comment: text("comment"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex("uq_joint_task_work_task_date").on(table.task_id, table.branch_id, table.task_date),
    index("idx_joint_task_work_branch_date").on(table.branch_id, table.task_date),
    index("idx_joint_task_work_task_date").on(table.task_id, table.task_date),
    index("idx_joint_task_work_branch_date_shift").on(table.branch_id, table.task_date, table.shift),
]);

export const specialTasks = checklistSchema.table.withRLS("special_tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    branch_id: uuid("branch_id").notNull().references(() => branches.id, { onDelete: 'cascade' }),
    title: text("title").notNull(),
    description: text("description"),
    issued_by: uuid("issued_by").notNull().references(() => users.id, { onDelete: 'set null' }),
    target_type: text("target_type").notNull(), // 'user' | 'role' | 'group'
    assigned_user_id: uuid("assigned_user_id").references(() => users.id, { onDelete: 'set null' }),
    assigned_role: text("assigned_role"), // 'cashier' | 'stock' | 'manager_assistant'
    assigned_user_ids: jsonb("assigned_user_ids").$type<string[]>().default([]),
    start_date: text("start_date").notNull(), // YYYY-MM-DD
    end_date: text("end_date").notNull(),     // YYYY-MM-DD
    points_reward: integer("points_reward").notNull().default(10),
    penalty_streak: boolean("penalty_streak").notNull().default(false), // true = flawed streak if unfinished
    status: text("status").notNull().default("pending"), // 'pending' | 'submitted' | 'approved' | 'declined'
    submitted_by: uuid("submitted_by").references(() => users.id, { onDelete: 'set null' }),
    submitted_at: timestamp("submitted_at", { withTimezone: true }),
    submission_comment: text("submission_comment"),
    participated_user_ids: jsonb("participated_user_ids").$type<string[]>().default([]),
    assistant_approved_by: uuid("assistant_approved_by").references(() => users.id, { onDelete: 'set null' }),
    assistant_approved_at: timestamp("assistant_approved_at", { withTimezone: true }),
    manager_approved_by: uuid("manager_approved_by").references(() => users.id, { onDelete: 'set null' }),
    manager_approved_at: timestamp("manager_approved_at", { withTimezone: true }),
    decline_reason: text("decline_reason"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("idx_special_tasks_branch").on(table.branch_id),
    index("idx_special_tasks_status").on(table.status),
    index("idx_special_tasks_assigned_user").on(table.assigned_user_id),
    index("idx_special_tasks_dates").on(table.branch_id, table.start_date, table.end_date),
]);

export const notifications = checklistSchema.table.withRLS("notifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    recipient_id: uuid("recipient_id").references(() => users.id, { onDelete: 'cascade' }),
    recipient_role: roleEnum("recipient_role"),
    branch_id: uuid("branch_id").references(() => branches.id, { onDelete: 'cascade' }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("info"),
    shift_session_id: uuid("shift_session_id").references(() => shiftSession.id, { onDelete: 'set null' }),
    is_read: boolean("is_read").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_notifications_recipient_read").on(table.recipient_id, table.is_read),
    index("idx_notifications_branch").on(table.branch_id),
]);

export const notificationReads = checklistSchema.table.withRLS("notification_reads", {
    notification_id: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: 'cascade' }),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    read_at: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    primaryKey({ columns: [table.notification_id, table.user_id] }),
    index("idx_notification_reads_user").on(table.user_id),
]);

export const pointTransactions = checklistSchema.table.withRLS("point_transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    points: integer("points").notNull(),
    type: text("type").notNull(),
    shift_session_id: uuid("shift_session_id").references(() => shiftSession.id, { onDelete: 'set null' }),
    description: text("description").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_point_transactions_user").on(table.user_id),
]);

export const employeeLeaves = checklistSchema.table.withRLS("employee_leaves", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    branch_id: uuid("branch_id").notNull().references(() => branches.id, { onDelete: 'cascade' }),
    leave_type: leaveTypeEnum("leave_type").notNull(),
    start_date: text("start_date").notNull(),
    end_date: text("end_date").notNull(),
    reason: text("reason").notNull(),
    preserve_streak: boolean("preserve_streak").notNull().default(true),
    previous_streak: integer("previous_streak"),
    recorded_by: uuid("recorded_by").notNull().references(() => users.id, { onDelete: 'set null' }),
    status: leaveStatusEnum("status").notNull().default("approved"),
    approved_by: uuid("approved_by").references(() => users.id, { onDelete: 'set null' }),
    approved_at: timestamp("approved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    index("idx_leaves_user_date").on(table.user_id, table.start_date, table.end_date),
    index("idx_leaves_branch").on(table.branch_id),
]);

export const cronSettings = checklistSchema.table.withRLS("cron_settings", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    schedule_cron: text("schedule_cron").notNull(),
    schedule_description: text("schedule_description").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    last_run_at: timestamp("last_run_at", { withTimezone: true }),
    last_run_status: text("last_run_status"),
    last_run_message: text("last_run_message"),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});