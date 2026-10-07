import { 
  getUserAvailableRoles, 
  canAccessRole, 
  canAccessManagerPortal, 
  canAccessExecutivePortal, 
  canAccessAdminPortal, 
  computePrimaryRole,
  isScoreboardEligible 
} from "../src/utils/roles";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

// 1. Regular employee
const emp = { id: "1", username: "emp", managerType: "none" as const, executiveType: "none" as const, isAdmin: false };
assert(JSON.stringify(getUserAvailableRoles(emp)) === JSON.stringify(["employee"]), "Regular employee only has employee role");
assert(canAccessRole(emp, "employee"), "Employee can access employee");
assert(!canAccessRole(emp, "manager"), "Employee cannot access manager");
assert(!canAccessManagerPortal(emp), "Employee cannot access manager portal");

// 2. Assistant Manager
const asst = { id: "2", username: "asst", managerType: "assistant" as const, executiveType: "none" as const, isAdmin: false };
assert(canAccessRole(asst, "employee"), "Assistant can do employee job");
assert(canAccessRole(asst, "manager_assistant"), "Assistant can do manager_assistant job");
assert(canAccessManagerPortal(asst), "Assistant can access manager portal");
assert(!canAccessRole(asst, "manager"), "Assistant is not store manager");

// 3. Store Manager
const mgr = { id: "3", username: "mgr", managerType: "store" as const, executiveType: "none" as const, isAdmin: false };
assert(canAccessRole(mgr, "employee"), "Store manager can do employee job");
assert(canAccessRole(mgr, "manager"), "Store manager can do manager job");
assert(canAccessManagerPortal(mgr), "Store manager can access manager portal");

// 4. Executive
const exec = { id: "4", username: "exec", managerType: "none" as const, executiveType: "executive" as const, isAdmin: false };
assert(canAccessRole(exec, "employee"), "Executive can do employee job");
assert(canAccessRole(exec, "general_manager"), "Executive can do general_manager job");
assert(canAccessExecutivePortal(exec), "Executive can access executive portal");

// 5. Multi-role user (Admin + Store Manager + Executive)
const superUser = { id: "5", username: "super", managerType: "store" as const, executiveType: "executive" as const, isAdmin: true };
const superRoles = getUserAvailableRoles(superUser);
assert(superRoles.includes("admin"), "Super user has admin");
assert(superRoles.includes("manager"), "Super user has manager");
assert(superRoles.includes("general_manager"), "Super user has general_manager");
assert(superRoles.includes("employee"), "Super user has employee");
assert(computePrimaryRole(superUser) === "admin", "Primary role of superUser is admin");
assert(isScoreboardEligible(emp) === true, "Employee participates in scoreboard");
assert(isScoreboardEligible(asst) === true, "Assistant manager participates in scoreboard");
assert(isScoreboardEligible(mgr) === false, "Store manager does NOT participate in scoreboard");
assert(isScoreboardEligible(exec) === false, "Executive does NOT participate in scoreboard");
const committeeUser = { id: "6", username: "comm", managerType: "none" as const, executiveType: "committee" as const, isAdmin: false };
assert(isScoreboardEligible(committeeUser) === false, "Committee does NOT participate in scoreboard");
const adminUser = { id: "7", username: "admin", managerType: "none" as const, executiveType: "none" as const, isAdmin: true };
assert(isScoreboardEligible(adminUser) === false, "Admin does NOT participate in scoreboard");

console.log("\nAll 21 role capability and scoreboard assertions passed successfully!");
