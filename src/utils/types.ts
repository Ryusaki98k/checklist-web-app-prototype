import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
    branches,
    roleEnum,
    shiftEnum,
    shiftSession,
    tasks,
    taskRoleEnum,
    taskWork,
    users,
} from "../db/schema";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;

export type ShiftSession = InferSelectModel<typeof shiftSession>;
export type NewShiftSession = InferInsertModel<typeof shiftSession>;

export type TaskWork = InferSelectModel<typeof taskWork>;
export type NewTaskWork = InferInsertModel<typeof taskWork>;

export type Branch = InferSelectModel<typeof branches>;
export type NewBranch = InferInsertModel<typeof branches>;

export type Role = (typeof roleEnum.enumValues)[number];
export type TaskRole = (typeof taskRoleEnum.enumValues)[number];
export type Shift = (typeof shiftEnum.enumValues)[number];

interface Notification {
    taskWork: TaskWork
    read: Date | null;
}
