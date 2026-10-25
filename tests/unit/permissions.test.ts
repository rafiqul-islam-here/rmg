import { describe, expect, it } from "vitest";
import { navFor } from "@/components/shell/nav";
import { can, homePathFor, isSuperUser, ROLE_LABEL } from "@/lib/permissions";
import type { Role, StageKey } from "@/lib/types";

const user = (role: Role, departments: StageKey[] = []) => ({ role, departments });

describe("permissions", () => {
  it("admin, merchandiser and manager are super users; supervisors are not", () => {
    for (const r of ["admin", "merchandiser", "manager"] as Role[]) {
      expect(isSuperUser(user(r))).toBe(true);
      expect(can.manageUsers(user(r))).toBe(true);
      expect(can.viewSettings(user(r))).toBe(true);
      expect(can.ignoreEmbellishment(user(r))).toBe(true);
      expect(can.createOrder(user(r))).toBe(true);
    }
    const sup = user("supervisor", ["cutting"]);
    expect(isSuperUser(sup)).toBe(false);
    expect(can.manageUsers(sup)).toBe(false);
    expect(can.ignoreEmbellishment(sup)).toBe(false);
  });

  it("there is no worker role any more", () => {
    expect(Object.keys(ROLE_LABEL)).toEqual(["admin", "merchandiser", "manager", "supervisor"]);
  });

  it("only an admin can create or edit admins; nobody edits themselves", () => {
    expect(can.assignRole(user("merchandiser"), "manager")).toBe(true);
    expect(can.assignRole(user("merchandiser"), "admin")).toBe(false);
    expect(can.assignRole(user("admin"), "admin")).toBe(true);
    expect(can.assignRole(user("supervisor"), "supervisor")).toBe(false);
    expect(can.editUser({ id: "a", role: "manager" }, { id: "b", role: "admin" })).toBe(false);
    expect(can.editUser({ id: "a", role: "manager" }, { id: "b", role: "supervisor" })).toBe(true);
    expect(can.editUser({ id: "a", role: "manager" }, { id: "a", role: "manager" })).toBe(false);
  });

  it("supervisors act only in their own departments", () => {
    const cutter = user("supervisor", ["cutting"]);
    expect(can.actInStage(cutter, "cutting")).toBe(true);
    expect(can.actInStage(cutter, "fabric")).toBe(false);
    expect(can.actInStage(user("manager"), "ppm")).toBe(true);
  });

  it("super users land on Dashboard, supervisors on My Work", () => {
    expect(homePathFor(user("merchandiser"))).toBe("/dashboard");
    expect(homePathFor(user("supervisor", ["cutting"]))).toBe("/my-work");
  });
});

describe("sidebar per role (guideline 4.2)", () => {
  const labels = (role: Role) => navFor(user(role)).map((i) => i.label);
  it("super users see everything", () => {
    for (const r of ["admin", "merchandiser", "manager"] as Role[]) {
      expect(labels(r)).toEqual(["Dashboard", "Orders", "My Work", "Departments", "Reports", "Settings"]);
    }
  });
  it("supervisors see Orders, My Work and Departments", () => {
    expect(labels("supervisor")).toEqual(["Orders", "My Work", "Departments"]);
  });
  it("departments sub-list follows the floor order, with PP Meeting last (after GPQ)", () => {
    const dept = navFor(user("manager")).find((i) => i.label === "Departments");
    expect(dept?.children?.map((c) => c.label)).toEqual(["Fabric", "Cutting", "Print", "Emb", "Sewing", "GPQ", "PP Meeting"]);
  });
});
