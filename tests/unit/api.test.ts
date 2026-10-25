import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET, PATCH, POST, PUT } from "@/app/api/mock/[...path]/route";
import type { DashboardSummary, Order, Paged, SessionUser, User } from "@/lib/types";

/** Contract tests for the mock REST API — the same paths the NestJS backend must serve. */

const handlers = { GET, POST, PUT, PATCH };

async function call<T = unknown>(
  method: keyof typeof handlers,
  path: string,
  opts: { user?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const url = new URL(`http://test/api/mock/${path}`);
  const headers: Record<string, string> = { "content-type": "application/json", ...opts.headers };
  if (opts.user) headers.cookie = `tf_session=${opts.user}`;
  const req = new NextRequest(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const segments = url.pathname.replace("/api/mock/", "").split("/");
  const res = await handlers[method](req, { params: Promise.resolve({ path: segments }) });
  return { status: res.status, body: (await res.json()) as T, cookie: res.headers.get("set-cookie") };
}

beforeEach(() => {
  // Fresh seeded database for every test.
  delete (globalThis as { __threadflowDb?: unknown }).__threadflowDb;
});

const COMPANY = "Demo Garments Ltd.";
const PASSWORD = "factory@2026";

describe("auth: company name → username or ID → password", () => {
  it("rejects requests without a session", async () => {
    expect((await call("GET", "orders")).status).toBe(401);
    expect((await call("GET", "auth/me")).status).toBe(401);
  });

  it("signs in with company + username + password and returns the company name", async () => {
    const res = await call<SessionUser>("POST", "auth/login", { body: { company: COMPANY, login: "rahim.mia", password: PASSWORD, remember: true } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "u-rahim", username: "rahim.mia", employeeId: "EMP-0013", companyName: COMPANY });
    expect(res.body).not.toHaveProperty("password");
    expect(res.cookie).toMatch(/tf_session=u-rahim/);
    expect(res.cookie).toMatch(/HttpOnly/i);
    expect(res.cookie).toMatch(/Max-Age=/);
  });

  it("accepts the employee ID instead of the username, and ignores case/spacing in the company name", async () => {
    const res = await call<SessionUser>("POST", "auth/login", { body: { company: "  demo garments LTD ", login: "emp-0013", password: PASSWORD } });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("u-rahim");
  });

  it('"Remember this device" off gives a browser-session cookie', async () => {
    const res = await call("POST", "auth/login", { body: { company: COMPANY, login: "rahim.mia", password: PASSWORD, remember: false } });
    expect(res.cookie).not.toMatch(/Max-Age=/);
  });

  it("rejects a missing or wrong company, wrong user, wrong password and turned-off accounts", async () => {
    expect((await call("POST", "auth/login", { body: { login: "rahim.mia", password: PASSWORD } })).status).toBe(400);
    const wrongCompany = await call<{ message: string }>("POST", "auth/login", { body: { company: "Other Ltd", login: "rahim.mia", password: PASSWORD } });
    expect(wrongCompany.status).toBe(401);
    expect(wrongCompany.body.message).toMatch(/Company not found/);
    expect((await call("POST", "auth/login", { body: { company: COMPANY, login: "nobody", password: PASSWORD } })).status).toBe(401);
    expect((await call("POST", "auth/login", { body: { company: COMPANY, login: "rahim.mia", password: "wrong" } })).status).toBe(401);
    expect((await call("POST", "auth/login", { body: { company: COMPANY, login: "shahin.alam", password: PASSWORD } })).status).toBe(403);
  });

  it("/auth/me includes the company name", async () => {
    const me = await call<SessionUser>("GET", "auth/me", { user: "u-merch" });
    expect(me.body.companyName).toBe(COMPANY);
  });
});

describe("orders", () => {
  it("lists the seeded orders and filters by stage", async () => {
    const all = await call<Paged<Order>>("GET", "orders", { user: "u-manager" });
    expect(all.status).toBe(200);
    expect(all.body.total).toBeGreaterThan(10);
    const fabric = await call<Paged<Order>>("GET", "orders?stage=fabric", { user: "u-manager" });
    expect(fabric.body.items.every((o) => ["waiting", "blocked"].includes(o.stages.fabric.state))).toBe(true);
  });

  it("searches by order number, buyer and color", async () => {
    const res = await call<Paged<Order>>("GET", "orders?q=heather", { user: "u-manager" });
    expect(res.body.items.map((o) => o.orderNumber)).toContain("STD-2026-9013");
  });

  it("creates an order that starts in Fabric (§3 → §4)", async () => {
    const body = { orderNumber: "STD-2026-9100", buyerId: "b-std", colors: ["Navy Blue", "Crimson Red"], embellishment: "none" };
    const res = await call<Order>("POST", "orders", { user: "u-merch", body });
    expect(res.status).toBe(201);
    expect(res.body.stages.fabric.state).toBe("waiting");
    const fabric = await call<Paged<Order>>("GET", "orders?stage=fabric", { user: "u-merch" });
    expect(fabric.body.items.some((o) => o.orderNumber === "STD-2026-9100")).toBe(true);
  });

  it("validates the entry form", async () => {
    const base = { orderNumber: "X-1", buyerId: "b-std", colors: ["Red"], embellishment: "none" };
    expect((await call("POST", "orders", { user: "u-merch", body: { ...base, orderNumber: " " } })).status).toBe(400);
    expect((await call("POST", "orders", { user: "u-merch", body: { ...base, colors: [" "] } })).status).toBe(400);
    expect((await call("POST", "orders", { user: "u-merch", body: { ...base, buyerId: "nope" } })).status).toBe(400);
    const dup = await call<{ message: string }>("POST", "orders", { user: "u-merch", body: { ...base, orderNumber: "std-2026-9013" } });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/already exists/);
  });

  it("only office roles can create orders", async () => {
    const body = { orderNumber: "W-1", buyerId: "b-std", colors: ["Red"], embellishment: "none" };
    expect((await call("POST", "orders", { user: "u-rahim", body })).status).toBe(403);
  });

  it("returns 404 for unknown orders", async () => {
    expect((await call("GET", "orders/nope", { user: "u-manager" })).status).toBe(404);
  });
});

async function findOrder(orderNumber: string) {
  const res = await call<Paged<Order>>("GET", `orders?q=${encodeURIComponent(orderNumber)}`, { user: "u-manager" });
  return res.body.items.find((o) => o.orderNumber === orderNumber)!;
}

describe("department actions and permissions", () => {
  async function create(emb: string) {
    const res = await call<Order>("POST", "orders", {
      user: "u-merch",
      body: { orderNumber: `T-${emb}`, buyerId: "b-std", colors: ["Grey"], embellishment: emb },
    });
    return res.body.id;
  }

  it("Fabric → Cutting → Emb through the API", async () => {
    const id = await create("emb");
    const fab = await call<Order>("POST", `orders/${id}/fabric`, { user: "u-sup-fab", body: { result: "delivered", deliveredAt: new Date().toISOString() } });
    expect(fab.body.stages.cutting.state).toBe("waiting");
    const cut = await call<Order>("POST", `orders/${id}/cutting/dispatch`, { user: "u-rahim", body: { emb: { sentAt: new Date().toISOString() } } });
    expect(cut.status).toBe(200);
    expect(cut.body.stages.emb.statusLabel).toBe("EMB to print");
    const activity = await call<Paged<{ text: string }>>("GET", `orders/${id}/activity`, { user: "u-manager" });
    expect(activity.body.items.map((e) => e.text)).toEqual(expect.arrayContaining(["EMB to print", "Fabric delivered · sent to Cutting"]));
  });

  it("a cutting supervisor cannot update Fabric", async () => {
    const id = await create("none");
    const res = await call("POST", `orders/${id}/fabric`, { user: "u-rahim", body: { result: "delivered" } });
    expect(res.status).toBe(403);
  });

  it("ignore embellishment is for super users only", async () => {
    const id = await create("print");
    expect((await call("POST", `orders/${id}/ignore-embellishment`, { user: "u-rahim" })).status).toBe(403);
    expect((await call("POST", `orders/${id}/ignore-embellishment`, { user: "u-manager" })).status).toBe(200);
  });

  it("GPQ must set the PPM time when it completes; the order moves to the PPM queue", async () => {
    const order = await findOrder("26STD70"); // seeded: GPQ in progress
    const missing = await call<{ message: string }>("POST", `orders/${order.id}/stages/gpq/complete`, { user: "u-gpq", body: { doneAt: new Date().toISOString() } });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toMatch(/PPM time/);
    const ppmAt = new Date(Date.now() + 3_600_000).toISOString();
    const ok = await call<Order>("POST", `orders/${order.id}/stages/gpq/complete`, { user: "u-gpq", body: { doneAt: new Date().toISOString(), ppmAt } });
    expect(ok.status).toBe(200);
    expect(ok.body.stages.ppm).toMatchObject({ state: "waiting", statusLabel: "Sent to PPM" });
    expect(ok.body.ppMeeting).toMatchObject({ ppmAt, setBy: { id: "u-gpq" }, findings: [] });
    const queue = await call<Paged<Order>>("GET", "orders?stage=ppm", { user: "u-manager" });
    expect(queue.body.items.map((o) => o.orderNumber)).toContain("26STD70");
  });

  it("PP Meeting: findings (numbered text or image), then complete → order completed", async () => {
    const order = await findOrder("26ZXY19"); // seeded: waiting in the PPM queue, no findings yet
    expect(order.stages.ppm.state).toBe("waiting");
    const base = `orders/${order.id}/ppm`;
    // GPQ can change the PPM time
    expect((await call("POST", `${base}/time`, { user: "u-gpq", body: { ppmAt: new Date().toISOString() } })).status).toBe(200);
    // Completing needs at least one finding
    expect((await call("POST", `${base}/complete`, { user: "u-merch", body: {} })).status).toBe(400);
    expect((await call("POST", `${base}/findings`, { user: "u-merch", body: { text: " " } })).status).toBe(400);
    const one = await call<Order>("POST", `${base}/findings`, { user: "u-merch", body: { text: "Pocket bag to be bartacked." } });
    const two = await call<Order>("POST", `${base}/findings`, { user: "u-manager", body: { imageUrl: "data:image/png;base64,AAAA" } });
    expect(two.body.ppMeeting?.findings.map((f) => f.no)).toEqual([1, 2]);
    expect(one.body.ppMeeting?.findings[0]).toMatchObject({ text: "Pocket bag to be bartacked.", by: { id: "u-merch" } });
    const done = await call<Order>("POST", `${base}/complete`, { user: "u-merch", body: { doneAt: new Date().toISOString() } });
    expect(done.status).toBe(200);
    expect(done.body.completedAt).toBeTruthy();
    expect(done.body.stages.ppm.statusLabel).toBe("PPM completed");
    // Locked after completion
    expect((await call("POST", `${base}/findings`, { user: "u-merch", body: { text: "late" } })).status).toBe(409);
    const activity = await call<Paged<{ text: string }>>("GET", `orders/${order.id}/activity`, { user: "u-manager" });
    expect(activity.body.items.map((e) => e.text)).toEqual(expect.arrayContaining(["Finding 1: Pocket bag to be bartacked.", "PP Meeting completed with 2 findings · order completed"]));
  });

  it("only super users / PP Meeting members add findings; only GPQ or PPM change the time", async () => {
    const order = await findOrder("26ZXY19");
    const base = `orders/${order.id}/ppm`;
    expect((await call("POST", `${base}/findings`, { user: "u-rahim", body: { text: "x" } })).status).toBe(403);
    expect((await call("POST", `${base}/time`, { user: "u-rahim", body: { ppmAt: new Date().toISOString() } })).status).toBe(403);
    expect((await call("POST", `${base}/complete`, { user: "u-gpq", body: {} })).status).toBe(403);
  });

  it("Cutting no longer waits for a PP Meeting", async () => {
    const id = await create("none");
    await call("POST", `orders/${id}/fabric`, { user: "u-sup-fab", body: { result: "delivered", deliveredAt: new Date().toISOString() } });
    expect((await call("POST", `orders/${id}/stages/cutting/start`, { user: "u-rahim" })).status).toBe(200);
  });

  it("workflow errors come back as 4xx with a readable message", async () => {
    const id = await create("none");
    await call("POST", `orders/${id}/fabric`, { user: "u-sup-fab", body: { result: "delivered", deliveredAt: new Date().toISOString() } });
    await call("POST", `orders/${id}/cutting/dispatch`, { user: "u-rahim", body: { sewing: { sentAt: new Date().toISOString(), unit: "U1" } } });
    const res = await call<{ message: string }>("POST", `orders/${id}/cutting/dispatch`, { user: "u-rahim", body: { sewing: { sentAt: new Date().toISOString(), unit: "U1" } } });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Cutting/);
  });

  it("comments need text and bump the count", async () => {
    const id = await create("none");
    expect((await call("POST", `orders/${id}/comments`, { user: "u-rahim", body: { text: "  " } })).status).toBe(400);
    expect((await call("POST", `orders/${id}/comments`, { user: "u-rahim", body: { text: "Spreading done" } })).status).toBe(201);
    expect((await call<Order>("GET", `orders/${id}`, { user: "u-rahim" })).body.commentCount).toBe(1);
  });
});

describe("summaries", () => {
  it("dashboard summary has one workload row per stage", async () => {
    const res = await call<DashboardSummary>("GET", "dashboard/summary", { user: "u-manager" });
    expect(res.body.workload.map((w) => w.stage)).toEqual(["fabric", "cutting", "print", "emb", "sewing", "gpq", "ppm"]);
    expect(res.body.activeOrders).toBeGreaterThan(0);
  });

  it("My Work only shows the worker's departments", async () => {
    const res = await call<{ departments: string[]; todo: { stage: string }[] }>("GET", "my-work", { user: "u-rahim" });
    expect(res.body.departments).toEqual(["cutting"]);  // Rahim Mia, cutting supervisor
    expect(res.body.todo.every((t) => t.stage === "cutting")).toBe(true);
  });

  it("reports are office-only", async () => {
    expect((await call("GET", "reports/by-stage", { user: "u-rahim" })).status).toBe(403);
    for (const key of ["by-stage", "stage-time", "embellishment", "fabric-issues", "completed"]) {
      expect((await call("GET", `reports/${key}`, { user: "u-manager" })).status).toBe(200);
    }
  });
});

describe("users (super users create users)", () => {
  const person = (over: Record<string, unknown> = {}) => ({
    name: "Shila Rani",
    username: "shila.rani",
    role: "supervisor",
    title: "Sewing Supervisor · Line 7",
    departments: ["sewing"],
    password: "start123",
    ...over,
  });

  it("merchandiser and manager can create users; supervisors cannot", async () => {
    expect((await call("POST", "users", { user: "u-rahim", body: person() })).status).toBe(403);
    const created = await call<User>("POST", "users", { user: "u-merch", body: person() });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ username: "shila.rani", role: "supervisor", departments: ["sewing"], employeeId: "EMP-0019" });
    expect(created.body).not.toHaveProperty("password");
    expect((await call("POST", "users", { user: "u-manager", body: person({ username: "new.manager", role: "manager", departments: [] }) })).status).toBe(201);
  });

  it("the new user can sign in with company + username (or ID) + the temporary password", async () => {
    await call("POST", "users", { user: "u-merch", body: person() });
    const byName = await call<SessionUser>("POST", "auth/login", { body: { company: "Demo Garments Ltd.", login: "shila.rani", password: "start123" } });
    expect(byName.status).toBe(200);
    const byId = await call("POST", "auth/login", { body: { company: "Demo Garments Ltd.", login: "EMP-0019", password: "start123" } });
    expect(byId.status).toBe(200);
  });

  it("validates username, password, departments and uniqueness", async () => {
    expect((await call("POST", "users", { user: "u-merch", body: person({ username: "Has Space" }) })).status).toBe(400);
    expect((await call("POST", "users", { user: "u-merch", body: person({ password: "123" }) })).status).toBe(400);
    expect((await call("POST", "users", { user: "u-merch", body: person({ departments: [] }) })).status).toBe(400);
    expect((await call("POST", "users", { user: "u-merch", body: person({ username: "rahim.mia" }) })).status).toBe(409);
    expect((await call("POST", "users", { user: "u-merch", body: person({ employeeId: "EMP-0013" }) })).status).toBe(409);
  });

  it("only an admin can create admins or change an admin", async () => {
    expect((await call("POST", "users", { user: "u-merch", body: person({ role: "admin", departments: [] }) })).status).toBe(403);
    expect((await call("POST", "users", { user: "u-admin", body: person({ role: "admin", departments: [] }) })).status).toBe(201);
    expect((await call("PATCH", "users/u-admin", { user: "u-manager", body: { title: "X" } })).status).toBe(403);
  });

  it("super users can reset a password and turn an account off", async () => {
    expect((await call("PATCH", "users/u-rahim", { user: "u-manager", body: { password: "newpass1" } })).status).toBe(200);
    expect((await call("POST", "auth/login", { body: { company: "Demo Garments Ltd.", login: "rahim.mia", password: "factory@2026" } })).status).toBe(401);
    expect((await call("POST", "auth/login", { body: { company: "Demo Garments Ltd.", login: "rahim.mia", password: "newpass1" } })).status).toBe(200);
    await call("PATCH", "users/u-rahim", { user: "u-manager", body: { active: false } });
    expect((await call("POST", "auth/login", { body: { company: "Demo Garments Ltd.", login: "rahim.mia", password: "newpass1" } })).status).toBe(403);
  });

  it("nobody changes their own account from Users", async () => {
    expect((await call("PATCH", "users/u-merch", { user: "u-merch", body: { role: "admin" } })).status).toBe(403);
  });
});

describe("settings", () => {
  it("super users change the company profile; the new name is required at sign-in", async () => {
    expect((await call("PUT", "settings/factory", { user: "u-rahim", body: { name: "X" } })).status).toBe(403);
    expect((await call("PUT", "settings/factory", { user: "u-manager", body: { name: " " } })).status).toBe(400);
    expect((await call("PUT", "settings/factory", { user: "u-manager", body: { name: "Logic Knit Ltd." } })).status).toBe(200);
    expect((await call("POST", "auth/login", { body: { company: "Demo Garments Ltd.", login: "rahim.mia", password: "factory@2026" } })).status).toBe(401);
    expect((await call("POST", "auth/login", { body: { company: "Logic Knit Ltd.", login: "rahim.mia", password: "factory@2026" } })).status).toBe(200);
  });

  it("buyer codes are unique and upper-cased", async () => {
    const res = await call<{ code: string }>("POST", "buyers", { user: "u-merch", body: { code: "abc", name: "ABC Ltd" } });
    expect(res.body.code).toBe("ABC");
    expect((await call("POST", "buyers", { user: "u-merch", body: { code: "ABC", name: "Again" } })).status).toBe(409);
  });
});

describe("dev UI-state preview header", () => {
  it("empty and error states", async () => {
    const empty = await call<Paged<Order>>("GET", "orders", { user: "u-manager", headers: { "x-mock-state": "empty" } });
    expect(empty.body).toEqual({ items: [], total: 0 });
    const error = await call("GET", "dashboard/summary", { user: "u-manager", headers: { "x-mock-state": "error" } });
    expect(error.status).toBe(500);
  });
});
