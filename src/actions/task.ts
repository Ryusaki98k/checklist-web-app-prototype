"use server";

import { db } from "../db";
import { tasks, branches } from "../db/schema";
import { asc, eq, sql } from "drizzle-orm";

export async function getAllTasksAction(): Promise<{ success: boolean; tasks?: any[]; error?: string }> {
    try {
        const allTasks = await db.select().from(tasks).orderBy(asc(tasks.name));
        return { success: true, tasks: allTasks };
    } catch (err: any) {
        console.error("getAllTasksAction error:", err);
        return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลงาน" };
    }
}

export interface CreateTaskParams {
    name: string;
    task_role: "manager_assistant" | "cashier" | "stock";
    shift: "morning" | "afternoon" | "night" | "morning_afternoon";
    start: string;
    end: string;
    disabled?: boolean;
    for_managers?: boolean;
}

export async function createTaskAction(params: CreateTaskParams): Promise<{ success: boolean; error?: string }> {
    try {
        await db.insert(tasks).values({
            name: params.name,
            task_role: params.task_role,
            shift: params.shift,
            start: params.start || "00:00:00",
            end: params.end || "00:00:00",
            disabled: params.disabled ?? false,
            for_managers: params.for_managers ?? false,
        });
        return { success: true };
    } catch (err: any) {
        console.error("createTaskAction error:", err);
        return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการสร้างงานใหม่" };
    }
}

export async function toggleTaskDisabledAction(
    taskId: string,
    disabled: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        await db
            .update(tasks)
            .set({ disabled })
            .where(eq(tasks.id, taskId));

        // Touch last_update for all branches
        await db
            .update(branches)
            .set({ last_update: new Date() });

        return { success: true };
    } catch (err: any) {
        console.error("toggleTaskDisabledAction error:", err);
        return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการปรับปรุงสถานะงาน" };
    }
}

import { getServices } from "../services/container";
import { ShiftType, BranchDailyTask } from "../types";

export async function getBranchDailyTasksAction(branchId?: string): Promise<{
    success: boolean;
    tasks?: BranchDailyTask[];
    error?: string;
}> {
    const services = getServices();
    return await services.checklist.getBranchDailyTasks(branchId);
}

export async function createBranchDailyTaskAction(params: {
    branchId?: string | null;
    name: string;
    taskRole: "cashier" | "stock" | "manager_assistant";
    shift?: ShiftType | null;
    startTime: string;
    endTime: string;
    disabled?: boolean;
    forManagers?: boolean;
    isJoint?: boolean;
    isDaily?: boolean;
    refrigeratorId?: string | null;
    custom?: Record<string, any>;
    selectableRoles?: string[];
    category?: string | null;
}): Promise<{ success: boolean; task?: BranchDailyTask; error?: string }> {
    const services = getServices();
    return await services.checklist.createBranchDailyTask(params);
}

export async function updateBranchDailyTaskAction(params: {
    id: string;
    branchId?: string | null;
    name?: string;
    taskRole?: "cashier" | "stock" | "manager_assistant";
    shift?: ShiftType | null;
    startTime?: string;
    endTime?: string;
    disabled?: boolean;
    forManagers?: boolean;
    isJoint?: boolean;
    isDaily?: boolean;
    refrigeratorId?: string | null;
    custom?: Record<string, any>;
    selectableRoles?: string[];
    category?: string | null;
}): Promise<{ success: boolean; task?: BranchDailyTask; error?: string }> {
    const services = getServices();
    return await services.checklist.updateBranchDailyTask(params);
}

export async function deleteBranchDailyTaskAction(
    taskId: string,
    branchId?: string
): Promise<{ success: boolean; error?: string }> {
    const services = getServices();
    return await services.checklist.deleteBranchDailyTask(taskId, branchId);
}

export async function syncBranchRefrigeratorJointTasksAction(
    branchId?: string
): Promise<{ success: boolean; count?: number; error?: string }> {
    const services = getServices();
    return await services.checklist.syncBranchRefrigeratorJointTasks(branchId);
}


