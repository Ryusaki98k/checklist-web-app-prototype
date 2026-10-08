import { ActiveRole, ManagerType, ExecutiveType } from "../types";

/**
 * Returns all roles that a user account has permission to operate as.
 * Rule: ALL users have base employee capability (can perform floor shifts/tasks).
 * In addition, users can possess managerType, executiveType, and/or isAdmin.
 */
export function getUserAvailableRoles(user: {
  managerType?: ManagerType | null;
  executiveType?: ExecutiveType | null;
  isAdmin?: boolean | null;
  role?: ActiveRole | null;
} | null | undefined): ActiveRole[] {
  if (!user) return ["employee"];

  const roles = new Set<ActiveRole>();

  // 1. All users can perform employee jobs
  roles.add("employee");

  // 2. Manager roles
  if (user.managerType === "store") {
    roles.add("manager");
  } else if (user.managerType === "assistant") {
    roles.add("manager_assistant");
  }

  // 3. Executive roles
  if (user.executiveType === "executive") {
    roles.add("general_manager");
  } else if (user.executiveType === "committee") {
    roles.add("committee");
  }

  // 4. Admin privileges (Admin has access to admin, and can oversee manager/GM workspaces)
  if (user.isAdmin) {
    roles.add("admin");
    roles.add("manager");
    roles.add("general_manager");
  }

  // Backward compatibility fallback if role exists
  if (user.role && !roles.has(user.role)) {
    roles.add(user.role);
  }

  return Array.from(roles);
}

/**
 * Checks if the user can act as a specific target role.
 */
export function canAccessRole(
  user: {
    managerType?: ManagerType | null;
    executiveType?: ExecutiveType | null;
    isAdmin?: boolean | null;
    role?: ActiveRole | null;
  } | null | undefined,
  targetRole: ActiveRole
): boolean {
  if (!user) return false;
  const available = getUserAvailableRoles(user);
  return available.includes(targetRole);
}

/**
 * Checks if user has permission to enter Store Management portal
 */
export function canAccessManagerPortal(user: {
  managerType?: ManagerType | null;
  isAdmin?: boolean | null;
  role?: ActiveRole | null;
  branchId?: string | null;
  branchName?: string | null;
  executiveType?: ExecutiveType | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (!user.isAdmin && user.executiveType !== "executive" && user.executiveType !== "committee") {
    if (!user.branchId && !user.branchName) return false;
  }
  return (
    Boolean(user.isAdmin) ||
    user.managerType === "store" ||
    user.managerType === "assistant" ||
    user.role === "manager" ||
    user.role === "manager_assistant"
  );
}

/**
 * Checks if user has permission to enter Executive/Committee portal
 */
export function canAccessExecutivePortal(user: {
  executiveType?: ExecutiveType | null;
  isAdmin?: boolean | null;
  role?: ActiveRole | null;
} | null | undefined): boolean {
  if (!user) return false;
  return (
    Boolean(user.isAdmin) ||
    user.executiveType === "executive" ||
    user.executiveType === "committee" ||
    user.role === "committee" ||
    user.role === "general_manager"
  );
}

/**
 * Checks if user has permission to enter Central Admin portal
 */
export function canAccessAdminPortal(user: {
  isAdmin?: boolean | null;
  role?: ActiveRole | null;
} | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isAdmin) || user.role === "admin";
}

/**
 * Checks whether a user participates in the general employee/assistant scoreboard.
 * Store managers (managerType = 'store'), executives, committee members, and admins do not participate.
 */
export function isScoreboardEligible(user: {
  managerType?: ManagerType | null;
  executiveType?: ExecutiveType | null;
  isAdmin?: boolean | null;
  role?: ActiveRole | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin) return false;
  if (user.executiveType && user.executiveType !== "none") return false;
  if (user.managerType === "store") return false;
  return true;
}

/**
 * Computes the primary (highest privilege) role from permissions
 */
export function computePrimaryRole(
  managerTypeOrUser?: ManagerType | { managerType?: ManagerType | null; executiveType?: ExecutiveType | null; isAdmin?: boolean | null } | null,
  executiveType: ExecutiveType = "none",
  isAdmin = false
): ActiveRole {
  let mType: ManagerType = "none";
  let eType: ExecutiveType = "none";
  let admin = false;

  if (typeof managerTypeOrUser === "object" && managerTypeOrUser !== null) {
    mType = (managerTypeOrUser.managerType as ManagerType) || "none";
    eType = (managerTypeOrUser.executiveType as ExecutiveType) || "none";
    admin = Boolean(managerTypeOrUser.isAdmin);
  } else if (typeof managerTypeOrUser === "string") {
    mType = managerTypeOrUser;
    eType = executiveType;
    admin = isAdmin;
  }

  if (admin) return "admin";
  if (eType === "executive") return "general_manager";
  if (eType === "committee") return "committee";
  if (mType === "store") return "manager";
  if (mType === "assistant") return "manager_assistant";
  return "employee";
}

/**
 * Returns formatted Thai display title for a given role
 */
export function getRoleDisplayTitle(role: ActiveRole | string): string {
  switch (role) {
    case "admin":
      return "ผู้ดูแลระบบส่วนกลาง (Admin)";
    case "general_manager":
      return "ผู้จัดการทั่วไป / ผู้บริหาร (GM)";
    case "committee":
      return "กรรมการบริหาร (Committee)";
    case "manager":
      return "ผู้จัดการร้าน (Store Manager)";
    case "manager_assistant":
      return "ผู้ช่วยผู้จัดการร้าน (Assistant Manager)";
    case "employee":
    default:
      return "พนักงานประจำสาขา (Floor Staff)";
  }
}

/**
 * Returns short badge label
 */
export function getRoleShortTitle(role: ActiveRole | string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "general_manager":
      return "ผู้จัดการทั่วไป";
    case "committee":
      return "กรรมการ";
    case "manager":
      return "ผู้จัดการร้าน";
    case "manager_assistant":
      return "ผู้ช่วย ผจก.";
    case "employee":
    default:
      return "พนักงานสาขา";
  }
}

/**
 * Returns route URL for a role
 */
export function getRoleDefaultRoute(role: ActiveRole): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "general_manager":
    case "committee":
    case "manager":
    case "manager_assistant":
      return "/manager/dashboard";
    case "employee":
    default:
      return "/position";
  }
}

/**
 * Returns badge color and icon theme for role switcher / display
 */
export function getRoleTheme(role: ActiveRole): {
  color: string;
  bg: string;
  border: string;
  icon: string;
} {
  switch (role) {
    case "admin":
      return {
        color: "text-purple-700 dark:text-purple-300",
        bg: "bg-purple-100 dark:bg-purple-950/60",
        border: "border-purple-300 dark:border-purple-800",
        icon: "ShieldCheck",
      };
    case "general_manager":
    case "committee":
      return {
        color: "text-blue-700 dark:text-blue-300",
        bg: "bg-blue-100 dark:bg-blue-950/60",
        border: "border-blue-300 dark:border-blue-800",
        icon: "Landmark",
      };
    case "manager":
    case "manager_assistant":
      return {
        color: "text-emerald-700 dark:text-emerald-300",
        bg: "bg-emerald-100 dark:bg-emerald-950/60",
        border: "border-emerald-300 dark:border-emerald-800",
        icon: "Briefcase",
      };
    case "employee":
    default:
      return {
        color: "text-amber-800 dark:text-amber-300",
        bg: "bg-amber-100 dark:bg-amber-950/60",
        border: "border-amber-300 dark:border-amber-800",
        icon: "Users",
      };
  }
}
