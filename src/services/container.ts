import { db } from "../db";
import { IServiceContainer } from "./types";
import { AuthService } from "./AuthService";
import { NotificationService } from "./NotificationService";
import { PointService } from "./PointService";
import { ChecklistService } from "./ChecklistService";
import { ManagerService } from "./ManagerService";
import { BranchService } from "./BranchService";
import { RefrigeratorService } from "./RefrigeratorService";
import { CronService } from "./CronService";

let defaultContainer: IServiceContainer | null = null;

export function createServiceContainer(customDb?: any, customSupabaseClient?: any): IServiceContainer {
  const database = customDb || db;

  const notifications = new NotificationService(database);
  const points = new PointService(database, notifications);
  const checklist = new ChecklistService(database, notifications);
  const manager = new ManagerService(database, points, notifications);
  const auth = new AuthService(database, customSupabaseClient);
  const branch = new BranchService(database);
  const refrigerator = new RefrigeratorService(database, notifications);
  const cron = new CronService(database, checklist, manager, refrigerator, points);

  return {
    auth,
    notifications,
    points,
    checklist,
    manager,
    branch,
    refrigerator,
    cron,
  };
}

export function getServices(customDb?: any, customSupabaseClient?: any): IServiceContainer {
  if (customDb || customSupabaseClient) {
    return createServiceContainer(customDb, customSupabaseClient);
  }
  if (!defaultContainer) {
    defaultContainer = createServiceContainer();
  }
  return defaultContainer;
}
