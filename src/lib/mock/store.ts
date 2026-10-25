/**
 * In-memory mock database. Lives on globalThis so it survives hot reloads in dev.
 * Resets when the server restarts — good enough until the NestJS API is ready.
 */
import { formatDuration, isToday } from "@/lib/format";
import {
  currentStages,
  EMBELLISHMENT_LABEL,
  isAtRisk,
  isCompleted,
  orderStatus,
  STAGE_KEYS,
  STAGE_LABEL,
  waitingDays,
  WAITING_ALERT_DAYS,
} from "@/lib/stages";
import type {
  ActivityEvent,
  Buyer,
  DashboardSummary,
  FactoryProfile,
  NotificationSettings,
  Order,
  ReportKey,
  ReportResult,
  SessionUser,
  StageKey,
  User,
  UserRef,
} from "@/lib/types";
import { SEED_PASSWORD, seedBuyers, seedFactory, seedNotifications, seedOrders, seedUsers } from "./seed";

interface Db {
  users: User[];
  buyers: Buyer[];
  orders: Order[];
  activity: ActivityEvent[];
  factory: FactoryProfile;
  notifications: NotificationSettings;
  /** userId → password. Kept apart from users so it never reaches an API response. */
  passwords: Record<string, string>;
  seq: number;
}

const g = globalThis as unknown as { __threadflowDb?: Db };

function createDb(): Db {
  const now = Date.now();
  const users = seedUsers(now);
  const buyers = seedBuyers();
  const { orders, events } = seedOrders(now, users, buyers);
  const activity = events
    .map((e, i) => ({ ...e, id: `a-${i + 1}` }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    users,
    buyers,
    orders,
    activity,
    factory: { ...seedFactory },
    notifications: { ...seedNotifications },
    passwords: Object.fromEntries(users.map((u) => [u.id, SEED_PASSWORD])),
    seq: activity.length + 1,
  };
}

export function db(): Db {
  if (!g.__threadflowDb) g.__threadflowDb = createDb();
  return g.__threadflowDb;
}

export function nextId(prefix: string) {
  const d = db();
  d.seq += 1;
  return `${prefix}-${d.seq}`;
}

export function toRef(u: User): UserRef {
  return { id: u.id, name: u.name, email: u.email };
}

/** "Demo Garments Ltd." ≈ "demo garments ltd" — case, spacing and punctuation don't matter. */
export function normalizeCompany(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function companyMatches(name: string | undefined) {
  return !!name && normalizeCompany(name) === normalizeCompany(db().factory.name);
}

/** Finds a user by username or employee ID (case-insensitive); email and phone also work. */
export function findLoginUser(login: string) {
  const key = login.trim().toLowerCase();
  const digits = key.replace(/\D/g, "");
  return db().users.find(
    (u) =>
      u.username.toLowerCase() === key ||
      u.employeeId.toLowerCase() === key ||
      u.email.toLowerCase() === key ||
      (digits.length >= 8 && u.phone.replace(/\D/g, "") === digits),
  );
}

/** User as returned to the signed-in browser: with the company name. */
export function sessionUser(u: User): SessionUser {
  return { ...u, companyName: db().factory.name };
}

/** Next free employee ID, e.g. "EMP-0019". */
export function nextEmployeeId() {
  const max = Math.max(0, ...db().users.map((u) => Number(u.employeeId.replace(/\D/g, "")) || 0));
  return `EMP-${String(max + 1).padStart(4, "0")}`;
}

export function logEvents(events: Omit<ActivityEvent, "id">[]) {
  const d = db();
  const withIds = events.map((e) => ({ ...e, id: nextId("a") }));
  d.activity = [...withIds.reverse(), ...d.activity];
}

/* ---------- queries ---------- */

export interface OrderQuery {
  q?: string;
  buyer?: string;
  stage?: StageKey;
  status?: string;
  embellishment?: string;
  tab?: "all" | "active" | "blocked" | "completed";
  atRisk?: boolean;
  /** With stage: "queue" (default) = orders in that stage now, "done_today" = finished there today. */
  scope?: "queue" | "done_today";
}

export function queryOrders(query: OrderQuery): Order[] {
  const now = Date.now();
  const q = query.q?.trim().toLowerCase();
  let list = db().orders;

  if (query.stage) {
    const stage = query.stage;
    list =
      query.scope === "done_today"
        ? list.filter((o) => o.stages[stage].state === "done" && o.stages[stage].doneAt && isToday(o.stages[stage].doneAt!, now))
        : list.filter((o) => currentStages(o).includes(stage));
  }
  if (query.tab === "active") list = list.filter((o) => !isCompleted(o));
  if (query.tab === "blocked") list = list.filter((o) => isAtRisk(o, now));
  if (query.tab === "completed") list = list.filter(isCompleted);
  if (query.atRisk) list = list.filter((o) => isAtRisk(o, now));
  if (query.buyer) list = list.filter((o) => o.buyer.id === query.buyer);
  if (query.embellishment) list = list.filter((o) => o.embellishment === query.embellishment);
  if (query.status) list = list.filter((o) => orderStatus(o).tone === query.status);
  if (q) {
    list = list.filter((o) =>
      [o.orderNumber, o.buyer.name, o.buyer.code, ...o.colors].some((v) => v.toLowerCase().includes(q)),
    );
  }
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findOrder(id: string) {
  return db().orders.find((o) => o.id === id || o.orderNumber.toLowerCase() === id.toLowerCase());
}

export function dashboardSummary(): DashboardSummary {
  const now = Date.now();
  const orders = db().orders;
  const active = orders.filter((o) => !isCompleted(o));
  const monthKey = new Date(now).toISOString().slice(0, 7);

  const workload = STAGE_KEYS.map((stage) => {
    const recs = active.map((o) => o.stages[stage]);
    return {
      stage,
      waiting: recs.filter((r) => r.state === "waiting").length,
      inProgress: recs.filter((r) => r.state === "in_progress").length,
      blocked: recs.filter((r) => r.state === "blocked").length,
    };
  });

  const longestWaiting = active
    .flatMap((order) =>
      currentStages(order).map((stage) => ({ order, stage, days: waitingDays(order.stages[stage], now) })),
    )
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  const bottlenecks = STAGE_KEYS.map((stage) => {
    const stuck = active.filter((o) => {
      const r = o.stages[stage];
      return r.state === "blocked" || (r.state === "waiting" && waitingDays(r, now) > WAITING_ALERT_DAYS);
    });
    return { stage, count: stuck.length, days: Math.max(0, ...stuck.map((o) => waitingDays(o.stages[stage], now))) };
  })
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    activeOrders: active.length,
    waitingOrders: active.filter((o) => currentStages(o).some((k) => o.stages[k].state === "waiting")).length,
    completedThisMonth: orders.filter((o) => o.completedAt?.startsWith(monthKey)).length,
    atRisk: active.filter((o) => isAtRisk(o, now)).length,
    blocked: active.filter((o) => currentStages(o).some((k) => o.stages[k].state === "blocked")).length,
    workload,
    longestWaiting,
    bottlenecks,
  };
}

export function myWork(user: User) {
  const now = Date.now();
  const depts = user.departments.length ? user.departments : STAGE_KEYS;
  const orders = db().orders;
  const pairs = orders.flatMap((order) => depts.map((stage) => ({ order, stage })));
  const byPriority = (a: { order: Order; stage: StageKey }, b: { order: Order; stage: StageKey }) =>
    waitingDays(b.order.stages[b.stage], now) - waitingDays(a.order.stages[a.stage], now) ||
    (a.order.stages[a.stage].arrivedAt ?? "").localeCompare(b.order.stages[b.stage].arrivedAt ?? "");
  return {
    departments: depts,
    todo: pairs.filter((p) => ["waiting", "blocked"].includes(p.order.stages[p.stage].state)).sort(byPriority),
    inProgress: pairs.filter((p) => p.order.stages[p.stage].state === "in_progress").sort(byPriority),
    doneToday: pairs.filter((p) => {
      const r = p.order.stages[p.stage];
      return r.state === "done" && r.doneAt && isToday(r.doneAt, now);
    }),
  };
}

export function report(key: ReportKey): ReportResult {
  const now = Date.now();
  const orders = db().orders;
  switch (key) {
    case "by-stage": {
      const rows = STAGE_KEYS.map((stage) => {
        const recs = orders.map((o) => o.stages[stage]);
        return {
          stage: STAGE_LABEL[stage],
          waiting: recs.filter((r) => r.state === "waiting").length,
          inProgress: recs.filter((r) => r.state === "in_progress").length,
          blocked: recs.filter((r) => r.state === "blocked").length,
          total: recs.filter((r) => ["waiting", "in_progress", "blocked"].includes(r.state)).length,
        };
      });
      rows.push({
        stage: "Completed",
        waiting: 0,
        inProgress: 0,
        blocked: 0,
        total: orders.filter(isCompleted).length,
      });
      return {
        key,
        chartUnit: "orders",
        chart: rows.map((r) => ({ label: r.stage, value: r.total })),
        columns: [
          { key: "stage", label: "Stage" },
          { key: "waiting", label: "Waiting", numeric: true },
          { key: "inProgress", label: "In progress", numeric: true },
          { key: "blocked", label: "Blocked", numeric: true },
          { key: "total", label: "Total", numeric: true },
        ],
        rows,
      };
    }
    case "stage-time": {
      const rows = STAGE_KEYS.map((stage) => {
        const done = orders.map((o) => o.stages[stage]).filter((r) => r.state === "done" && r.arrivedAt && r.doneAt);
        const avgMs = done.length
          ? done.reduce((s, r) => s + (new Date(r.doneAt!).getTime() - new Date(r.arrivedAt!).getTime()), 0) / done.length
          : 0;
        return { stage: STAGE_LABEL[stage], orders: done.length, avgHours: Math.round(avgMs / 3_600_000), average: done.length ? formatDuration(avgMs) : "—" };
      });
      return {
        key,
        chartUnit: "hours",
        chart: rows.map((r) => ({ label: r.stage, value: r.avgHours })),
        columns: [
          { key: "stage", label: "Stage" },
          { key: "orders", label: "Orders finished", numeric: true },
          { key: "average", label: "Average time", numeric: true },
        ],
        rows: rows.map(({ stage, orders: n, average }) => ({ stage, orders: n, average })),
      };
    }
    case "embellishment": {
      const kinds = ["none", "print", "emb", "print_emb"] as const;
      const rows = kinds.map((k) => {
        const list = orders.filter((o) => o.embellishment === k);
        return {
          type: EMBELLISHMENT_LABEL[k],
          orders: list.length,
          ignored: list.filter((o) => o.ignoreEmbellishment).length,
          completed: list.filter(isCompleted).length,
        };
      });
      return {
        key,
        chartUnit: "orders",
        chart: rows.map((r) => ({ label: r.type, value: r.orders })),
        columns: [
          { key: "type", label: "Embellishment" },
          { key: "orders", label: "Orders", numeric: true },
          { key: "ignored", label: "Ignored", numeric: true },
          { key: "completed", label: "Completed", numeric: true },
        ],
        rows,
      };
    }
    case "fabric-issues": {
      const list = orders.filter((o) => o.stages.fabric.state === "blocked" || o.stages.fabric.state === "waiting");
      const rows = list.map((o) => ({
        order: o.orderNumber,
        buyer: o.buyer.name,
        status: o.stages.fabric.state === "blocked" ? "Fabric not found" : "Waiting for fabric",
        days: waitingDays(o.stages.fabric, now),
        comment: o.stages.fabric.comment ?? "—",
      }));
      return {
        key,
        chartUnit: "orders",
        chart: [
          { label: "Fabric not found", value: rows.filter((r) => r.status === "Fabric not found").length },
          { label: "Waiting for fabric", value: rows.filter((r) => r.status !== "Fabric not found").length },
        ],
        columns: [
          { key: "order", label: "Order" },
          { key: "buyer", label: "Buyer" },
          { key: "status", label: "Status" },
          { key: "days", label: "Days waiting", numeric: true },
          { key: "comment", label: "Comment" },
        ],
        rows,
      };
    }
    case "completed": {
      const list = orders.filter(isCompleted).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
      const byBuyer = new Map<string, number>();
      list.forEach((o) => byBuyer.set(o.buyer.name, (byBuyer.get(o.buyer.name) ?? 0) + 1));
      return {
        key,
        chartUnit: "orders",
        chart: [...byBuyer.entries()].map(([label, value]) => ({ label, value })),
        columns: [
          { key: "order", label: "Order" },
          { key: "buyer", label: "Buyer" },
          { key: "embellishment", label: "Embellishment" },
          { key: "leadTime", label: "Lead time", numeric: true },
        ],
        rows: list.map((o) => ({
          order: o.orderNumber,
          buyer: o.buyer.name,
          embellishment: EMBELLISHMENT_LABEL[o.embellishment],
          leadTime: formatDuration(new Date(o.completedAt!).getTime() - new Date(o.createdAt).getTime()),
        })),
      };
    }
  }
}

export function buyersWithCounts(): Buyer[] {
  const orders = db().orders;
  return db().buyers.map((b) => ({ ...b, orderCount: orders.filter((o) => o.buyer.id === b.id).length }));
}

/** Notification feed for a user: activity in their departments (or everything for office roles). */
export function notificationsFor(user: User) {
  const depts = user.departments;
  return db()
    .activity.filter((e) => e.kind !== "comment" || e.actor?.id !== user.id)
    .filter((e) => depts.length === 0 || (e.stage && depts.includes(e.stage)) || e.kind === "problem")
    .slice(0, 15);
}

