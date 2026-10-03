"use server";

import { getServices } from "../services/container";
import { CronSetting } from "../services/types";
import { revalidatePath } from "next/cache";

export async function getCronSettingsAction(): Promise<{
  success: boolean;
  settings?: CronSetting[];
  error?: string;
}> {
  try {
    const services = getServices();
    const settings = await services.cron.getAllSettings();
    return { success: true, settings };
  } catch (err: unknown) {
    console.error("getCronSettingsAction error:", err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า Cron";
    return { success: false, error: message };
  }
}

export async function updateCronSettingAction(
  id: string,
  updates: { enabled?: boolean; config?: Record<string, unknown> }
): Promise<{ success: boolean; setting?: CronSetting; error?: string }> {
  try {
    const services = getServices();
    const result = await services.cron.updateSetting(id, updates);
    if (result.success) {
      revalidatePath("/admin/dashboard");
    }
    return result;
  } catch (err: unknown) {
    console.error(`updateCronSettingAction(${id}) error:`, err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า Cron";
    return { success: false, error: message };
  }
}

export async function runCronJobManualAction(
  id: string,
  overrides?: Record<string, unknown>
): Promise<{
  success: boolean;
  skipped?: boolean;
  message?: string;
  result?: unknown;
  error?: string;
}> {
  try {
    const services = getServices();
    // Manual trigger allows running even if disabled if user requested test run, but by default respect setting unless force is explicitly set
    const result = await services.cron.runCronJob(id, overrides);
    revalidatePath("/admin/dashboard");
    return result;
  } catch (err: unknown) {
    console.error(`runCronJobManualAction(${id}) error:`, err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสั่งประมวลผลงานระบบ";
    return { success: false, error: message };
  }
}
