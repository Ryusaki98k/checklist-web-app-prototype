"use server";

import { getServices } from "../services/container";
import { RefrigeratorConfig, clampTemperature } from "../services/RefrigeratorService";
import { ShiftType } from "../types";

export type { RefrigeratorConfig };
export type { RefrigeratorTaskItem } from "../services/types";

export async function getRefrigeratorsAction(
  userId: string
): Promise<{ success: boolean; data?: RefrigeratorConfig[]; error?: string }> {
  const services = getServices();
  return await services.refrigerator.getRefrigerators(userId);
}

export async function getRefrigeratorsByBranchAction(
  branchId: string
): Promise<{ success: boolean; data?: RefrigeratorConfig[]; error?: string }> {
  const services = getServices();
  return await services.refrigerator.getRefrigeratorsByBranch(branchId);
}

export async function createRefrigeratorAction(params: {
  userId: string;
  name: string;
  minTemperature: number;
  maxTemperature: number;
  disableCheck: boolean;
}): Promise<{ success: boolean; data?: RefrigeratorConfig; error?: string }> {
  const services = getServices();
  return await services.refrigerator.createRefrigerator({
    ...params,
    minTemperature: clampTemperature(params.minTemperature),
    maxTemperature: clampTemperature(params.maxTemperature),
  });
}

export async function createBranchRefrigeratorAction(params: {
  branchId: string;
  name: string;
  minTemperature: number;
  maxTemperature: number;
  disableCheck?: boolean;
}): Promise<{ success: boolean; data?: RefrigeratorConfig; error?: string }> {
  const services = getServices();
  return await services.refrigerator.createBranchRefrigerator({
    ...params,
    minTemperature: clampTemperature(params.minTemperature),
    maxTemperature: clampTemperature(params.maxTemperature),
  });
}

export async function updateRefrigeratorAction(params: {
  id: string;
  name: string;
  minTemperature: number;
  maxTemperature: number;
  disableCheck: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.refrigerator.updateRefrigerator({
    ...params,
    minTemperature: clampTemperature(params.minTemperature),
    maxTemperature: clampTemperature(params.maxTemperature),
  });
}

export async function deleteRefrigeratorAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.refrigerator.deleteRefrigerator(id);
}

export async function transferRefrigeratorAction(params: {
  refrigeratorId: string;
  targetBranchId: string;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.refrigerator.transferRefrigerator(params);
}

export async function batchToggleRefrigeratorDisableCheckAction(params: {
  refrigeratorIds: string[];
  disableCheck: boolean;
  branchId?: string;
}): Promise<{ success: boolean; count?: number; error?: string }> {
  const services = getServices();
  return await services.refrigerator.batchToggleRefrigeratorDisableCheck(params);
}

export async function batchUpdateRefrigeratorsAction(params: {
  refrigeratorIds: string[];
  name?: string;
  minTemperature: number;
  maxTemperature: number;
  disableCheck: boolean;
  branchId?: string;
}): Promise<{ success: boolean; count?: number; error?: string }> {
  const services = getServices();
  return await services.refrigerator.batchUpdateRefrigerators({
    ...params,
    minTemperature: clampTemperature(params.minTemperature),
    maxTemperature: clampTemperature(params.maxTemperature),
  });
}

export async function getBranchRefrigeratorTasksAction(params: {
  userId?: string;
  branchId?: string;
  dateStr?: string;
  shift?: ShiftType;
}) {
  const services = getServices();
  return await services.refrigerator.getBranchRefrigeratorTasks(params);
}

export async function updateRefrigeratorTaskAction(params: {
  taskId: string;
  userId: string;
  completed: boolean;
  temperature?: number;
  isOkay?: boolean;
  comment?: string;
  shiftSessionId?: string;
  shift?: ShiftType;
}) {
  const services = getServices();
  return await services.refrigerator.updateRefrigeratorTask({
    ...params,
    temperature: params.temperature !== undefined ? clampTemperature(params.temperature) : undefined,
  });
}

export async function batchUpdateRefrigeratorTasksAction(items: Array<{
  taskId: string;
  userId: string;
  completed: boolean;
  temperature?: number;
  isOkay?: boolean;
  comment?: string;
  shiftSessionId?: string;
  shift?: ShiftType;
}>) {
  const services = getServices();
  const sanitizedItems = items.map((item) => ({
    ...item,
    temperature: item.temperature !== undefined ? clampTemperature(item.temperature) : undefined,
  }));
  return await services.refrigerator.batchUpdateRefrigeratorTasks(sanitizedItems);
}

export async function ensureDailyRefrigeratorTasksAction(branchId: string, dateStr?: string) {
  const services = getServices();
  return await services.refrigerator.ensureDailyRefrigeratorTasks(branchId, dateStr);
}

export async function processDailyRefrigeratorTasksAction(params?: {
  targetDate?: string;
  yesterdayDate?: string;
}) {
  const services = getServices();
  return await services.refrigerator.processDailyRefrigeratorTasks(params);
}
