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

  let _notifications: NotificationService | null = null;
  let _points: PointService | null = null;
  let _checklist: ChecklistService | null = null;
  let _branch: BranchService | null = null;
  let _manager: ManagerService | null = null;
  let _auth: AuthService | null = null;
  let _refrigerator: RefrigeratorService | null = null;
  let _cron: CronService | null = null;

  return {
    get notifications() {
      if (!_notifications) {
        _notifications = new NotificationService(database);
      }
      return _notifications;
    },
    get points() {
      if (!_points) {
        _points = new PointService(database, this.notifications);
      }
      return _points;
    },
    get checklist() {
      if (!_checklist) {
        _checklist = new ChecklistService(database, this.notifications);
      }
      return _checklist;
    },
    get branch() {
      if (!_branch) {
        _branch = new BranchService(database);
      }
      return _branch;
    },
    get manager() {
      if (!_manager) {
        _manager = new ManagerService(database, this.points, this.notifications, this.branch);
      }
      return _manager;
    },
    get auth() {
      if (!_auth) {
        _auth = new AuthService(database, customSupabaseClient);
      }
      return _auth;
    },
    get refrigerator() {
      if (!_refrigerator) {
        _refrigerator = new RefrigeratorService(database, this.notifications);
      }
      return _refrigerator;
    },
    get cron() {
      if (!_cron) {
        _cron = new CronService(database, this.checklist, this.manager, this.refrigerator, this.points);
      }
      return _cron;
    },
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
