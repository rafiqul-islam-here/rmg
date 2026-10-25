import type { Role, StageKey, User } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  merchandiser: "Merchandiser",
  manager: "Production Manager",
  supervisor: "Supervisor",
};

/** Plain-language summary per role, shown in Settings → Users & roles. */
export const ROLE_SUMMARY: Record<Role, { can: string[]; cannot: string[] }> = {
  admin: {
    can: ["Super user: everything in ThreadFlow", "Create users, including other admins", "Change factory settings"],
    cannot: [],
  },
  merchandiser: {
    can: ["Super user: create orders and buyers", "Create users and reset passwords", "Run PP Meetings, ignore embellishment", "Update any department, see reports"],
    cannot: ["Create admin accounts"],
  },
  manager: {
    can: ["Super user: create orders and buyers", "Create users and reset passwords", "Run PP Meetings, ignore embellishment", "Update any department, see reports"],
    cannot: ["Create admin accounts"],
  },
  supervisor: {
    can: ["Update orders in their own departments", "Report problems", "Comment on orders"],
    cannot: ["Create orders or users", "See dashboard or reports"],
  },
};

/** Admin, Merchandiser and Production Manager are super users. */
const SUPER: Role[] = ["admin", "merchandiser", "manager"];

export function isSuperUser(user: Pick<User, "role">) {
  return SUPER.includes(user.role);
}

export const can = {
  viewDashboard: (u: Pick<User, "role">) => isSuperUser(u),
  viewReports: (u: Pick<User, "role">) => isSuperUser(u),
  viewSettings: (u: Pick<User, "role">) => isSuperUser(u),
  manageUsers: (u: Pick<User, "role">) => isSuperUser(u),
  createOrder: (u: Pick<User, "role">) => isSuperUser(u),
  ignoreEmbellishment: (u: Pick<User, "role">) => isSuperUser(u),
  /** Super users act on every department; supervisors only on their own. */
  actInStage: (u: Pick<User, "role" | "departments">, stage: StageKey) =>
    isSuperUser(u) || u.departments.includes(stage),
  /** Only an admin can create or change admin accounts. */
  assignRole: (u: Pick<User, "role">, role: Role) => isSuperUser(u) && (role !== "admin" || u.role === "admin"),
  editUser: (u: Pick<User, "role" | "id">, target: Pick<User, "role" | "id">) =>
    isSuperUser(u) && u.id !== target.id && (target.role !== "admin" || u.role === "admin"),
};

/** Super users land on the Dashboard; supervisors on My Work. */
export function homePathFor(u: Pick<User, "role">) {
  return isSuperUser(u) ? "/dashboard" : "/my-work";
}
