import { ChartColumn, ClipboardCheck, Factory, LayoutDashboard, Package, Settings, type LucideIcon } from "lucide-react";
import { can } from "@/lib/permissions";
import { STAGE_KEYS, STAGE_LABEL } from "@/lib/stages";
import type { Role, StageKey, User } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Departments item shows a sub-list of stages. */
  children?: { href: string; label: string; stage: StageKey }[];
}

const DEPARTMENT_ROLES: Role[] = ["admin", "merchandiser", "manager", "supervisor"];

/** Sidebar items per role (UI guideline §4.2). */
export function navFor(user: Pick<User, "role">): NavItem[] {
  const items: (NavItem | false)[] = [
    can.viewDashboard(user) && { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/my-work", label: "My Work", icon: ClipboardCheck },
    DEPARTMENT_ROLES.includes(user.role) && {
      href: "/departments",
      label: "Departments",
      icon: Factory,
      children: STAGE_KEYS.map((k) => ({ href: `/departments/${k}`, label: STAGE_LABEL[k], stage: k })),
    },
    can.viewReports(user) && { href: "/reports", label: "Reports", icon: ChartColumn },
    can.viewSettings(user) && { href: "/settings", label: "Settings", icon: Settings },
  ];
  return items.filter((i): i is NavItem => Boolean(i));
}

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Breadcrumb for the top bar. */
export function crumbsFor(pathname: string): string[] {
  const [, first, second] = pathname.split("/");
  switch (first) {
    case "dashboard":
      return ["Dashboard"];
    case "orders":
      if (second === "new") return ["Orders", "New order"];
      return second ? ["Orders", "Order detail"] : ["Orders"];
    case "my-work":
      return ["My Work"];
    case "departments":
      return second && second in STAGE_LABEL ? ["Departments", STAGE_LABEL[second as StageKey]] : ["Departments"];
    case "reports":
      return ["Reports"];
    case "settings":
      return ["Settings"];
    default:
      return [];
  }
}
