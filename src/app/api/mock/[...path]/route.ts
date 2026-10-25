/**
 * Mock REST API. Paths match the planned NestJS controllers, so switching to the real backend
 * only means setting NEXT_PUBLIC_API_BASE_URL.
 *
 * Dev helper: send header `x-mock-state: loading | empty | error` to preview UI states.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { can } from "@/lib/permissions";
import { STAGE_KEYS } from "@/lib/stages";
import type {
  CreateOrderInput,
  CreateUserInput,
  PPMFindingInput,
  UpdateUserInput,
  CuttingDispatchInput,
  FabricUpdateInput,
  NotificationSettings,
  FactoryProfile,
  ProblemInput,
  ReportKey,
  StageCompleteInput,
  StageKey,
  User,
} from "@/lib/types";
import {
  applyComplete,
  applyDispatch,
  applyFabric,
  applyIgnoreEmbellishment,
  applyPpmComplete,
  applyPpmFinding,
  applyPpmTime,
  applyProblem,
  applyResume,
  applyStart,
  MockError,
  newOrder,
} from "@/lib/mock/engine";
import {
  buyersWithCounts,
  companyMatches,
  dashboardSummary,
  db,
  findLoginUser,
  findOrder,
  nextEmployeeId,
  sessionUser,
  logEvents,
  myWork,
  nextId,
  notificationsFor,
  queryOrders,
  report,
  toRef,
  type OrderQuery,
} from "@/lib/mock/store";

type Ctx = { params: Promise<{ path: string[] }> };

const LIST_ENDPOINTS = new Set(["orders", "activity", "my-work", "buyers", "users", "notifications"]);

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function fail(status: number, message: string) {
  return json({ message }, status);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function currentUser(req: NextRequest): User | undefined {
  const id = req.cookies.get(SESSION_COOKIE)?.value;
  return id ? db().users.find((u) => u.id === id && u.active) : undefined;
}

function isStage(v: string | undefined): v is StageKey {
  return !!v && (STAGE_KEYS as string[]).includes(v);
}

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const method = req.method;
  const [root, id, sub, subId, action] = path;

  const mockState = req.headers.get("x-mock-state");
  if (mockState === "loading") await sleep(60_000);
  else await sleep(process.env.MOCK_LATENCY_MS ? Number(process.env.MOCK_LATENCY_MS) : 250 + Math.random() * 250);
  if (mockState === "error") return fail(500, "The server could not load this data.");
  if (mockState === "empty" && method === "GET" && LIST_ENDPOINTS.has(root) && !id) {
    return json(root === "my-work" ? { departments: [], todo: [], inProgress: [], doneToday: [] } : { items: [], total: 0 });
  }

  /* ---------- auth ---------- */
  if (root === "auth") {
    if (id === "login" && method === "POST") {
      const body = (await req.json()) as { company?: string; login?: string; password?: string; userId?: string; remember?: boolean };
      // Demo shortcut (mock only): sign in by user id without a password.
      const demo = Boolean(body.userId);
      if (!demo && !body.company?.trim()) return fail(400, "Enter your company name.");
      if (!demo && !companyMatches(body.company)) return fail(401, "Company not found. Check the company name.");
      const user = demo ? db().users.find((u) => u.id === body.userId) : findLoginUser(body.login ?? "");
      if (!user || (!demo && db().passwords[user.id] !== body.password)) return fail(401, "Username / ID or password is not correct.");
      if (!user.active) return fail(403, "This account is turned off. Ask your admin.");
      user.lastActiveAt = new Date().toISOString();
      const res = json(sessionUser(user));
      // "Remember this device" keeps the session 30 days; otherwise it ends with the browser session.
      res.cookies.set(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/", ...(body.remember === false ? {} : { maxAge: 60 * 60 * 24 * 30 }) });
      return res;
    }
    if (id === "logout" && method === "POST") {
      const res = json({ ok: true });
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
    if (id === "me" && method === "GET") {
      const user = currentUser(req);
      return user ? json(sessionUser(user)) : fail(401, "Not signed in.");
    }
  }

  const user = currentUser(req);
  if (!user) return fail(401, "Please sign in again.");
  const actor = toRef(user);
  const now = new Date().toISOString();

  try {
    /* ---------- orders ---------- */
    if (root === "orders") {
      if (!id && method === "GET") {
        const sp = req.nextUrl.searchParams;
        const stage = sp.get("stage") ?? undefined;
        const query: OrderQuery = {
          q: sp.get("q") ?? undefined,
          buyer: sp.get("buyer") ?? undefined,
          stage: isStage(stage) ? stage : undefined,
          status: sp.get("status") ?? undefined,
          embellishment: sp.get("embellishment") ?? undefined,
          tab: (sp.get("tab") as OrderQuery["tab"]) ?? undefined,
          atRisk: sp.get("atRisk") === "true",
          scope: (sp.get("scope") as OrderQuery["scope"]) ?? undefined,
        };
        const items = queryOrders(query);
        return json({ items, total: items.length });
      }

      if (!id && method === "POST") {
        if (!can.createOrder(user)) return fail(403, "Only admin, merchandiser or manager can create orders.");
        const body = (await req.json()) as CreateOrderInput;
        const buyer = db().buyers.find((b) => b.id === body.buyerId);
        if (!buyer) return fail(400, "Choose a buyer.");
        if (!body.orderNumber?.trim()) return fail(400, "Enter the order number.");
        if (db().orders.some((o) => o.orderNumber.toLowerCase() === body.orderNumber.trim().toLowerCase())) {
          return fail(409, `Order number ${body.orderNumber.trim()} already exists.`);
        }
        if (!body.colors?.some((c) => c.trim())) return fail(400, "Add at least one color.");
        const { order, events } = newOrder(nextId("o"), body, buyer, actor, now);
        db().orders.unshift(order);
        logEvents(events);
        return json(order, 201);
      }

      const order = id ? findOrder(id) : undefined;
      if (!order) return fail(404, "Order not found.");

      if (!sub && method === "GET") return json(order);

      if (sub === "activity" && method === "GET") {
        const items = db().activity.filter((e) => e.orderId === order.id);
        return json({ items, total: items.length });
      }

      if (sub === "comments" && method === "POST") {
        const body = (await req.json()) as { text?: string; attachmentName?: string };
        if (!body.text?.trim()) return fail(400, "Write a comment first.");
        order.commentCount += 1;
        logEvents([{ orderId: order.id, orderNumber: order.orderNumber, kind: "comment", actor, text: body.text.trim(), at: now, attachmentName: body.attachmentName }]);
        return json({ ok: true }, 201);
      }

      if (sub === "image" && method === "POST") {
        const body = (await req.json()) as { imageUrl?: string };
        order.imageUrl = body.imageUrl;
        return json(order);
      }

      const deny = (stage: StageKey) =>
        can.actInStage(user, stage) ? null : fail(403, "You can only update orders in your own department.");

      if (sub === "fabric" && method === "POST") {
        const denied = deny("fabric");
        if (denied) return denied;
        logEvents(applyFabric(order, (await req.json()) as FabricUpdateInput, actor, now));
        return json(order);
      }

      if (sub === "ignore-embellishment" && method === "POST") {
        if (!can.ignoreEmbellishment(user)) return fail(403, "Only admin or merchandiser can ignore embellishment.");
        logEvents(applyIgnoreEmbellishment(order, actor, now));
        return json(order);
      }

      if (sub === "cutting" && subId === "dispatch" && method === "POST") {
        const denied = deny("cutting");
        if (denied) return denied;
        logEvents(applyDispatch(order, (await req.json()) as CuttingDispatchInput, actor, now));
        return json(order);
      }

      if (sub === "ppm" && method === "POST") {
        if (subId === "time") {
          // GPQ sets the PPM time; super users and PP Meeting members may change it.
          if (!can.actInStage(user, "gpq") && !can.actInStage(user, "ppm")) return fail(403, "Only GPQ or the PP Meeting team can change the PPM time.");
          const body = (await req.json()) as { ppmAt?: string };
          logEvents(applyPpmTime(order, body.ppmAt ?? "", actor, now));
          return json(order);
        }
        const denied = deny("ppm");
        if (denied) return denied;
        if (subId === "findings") {
          const body = (await req.json()) as PPMFindingInput;
          if (body.imageUrl && body.imageUrl.length > 3_000_000) return fail(400, "Image must be 2 MB or smaller.");
          logEvents(applyPpmFinding(order, nextId("f"), body, actor, now));
          // Findings show in the order's activity like comments.
          order.commentCount += 1;
        } else if (subId === "complete") {
          const body = (await req.json()) as { doneAt?: string };
          logEvents(applyPpmComplete(order, body.doneAt ?? now, actor, now));
        } else return fail(404, "Unknown action.");
        return json(order);
      }

      if (sub === "stages" && isStage(subId) && method === "POST") {
        const denied = deny(subId);
        if (denied) return denied;
        if (action === "start") logEvents(applyStart(order, subId, actor, now));
        else if (action === "complete") logEvents(applyComplete(order, subId, (await req.json()) as StageCompleteInput, actor, now));
        else if (action === "problem") logEvents(applyProblem(order, subId, (await req.json()) as ProblemInput, actor, now));
        else if (action === "resume") logEvents(applyResume(order, subId, actor, now));
        else return fail(404, "Unknown action.");
        return json(order);
      }
    }

    /* ---------- everything else ---------- */
    if (root === "dashboard" && id === "summary" && method === "GET") return json(dashboardSummary());

    if (root === "activity" && method === "GET") {
      const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
      const items = db().activity.slice(0, limit);
      return json({ items, total: db().activity.length });
    }

    if (root === "notifications" && method === "GET") {
      const items = notificationsFor(user);
      return json({ items, total: items.length });
    }

    if (root === "my-work" && method === "GET") return json(myWork(user));

    if (root === "reports" && id && method === "GET") {
      if (!can.viewReports(user)) return fail(403, "Reports are for office roles.");
      return json(report(id as ReportKey));
    }

    if (root === "buyers") {
      if (method === "GET") {
        const items = buyersWithCounts();
        return json({ items, total: items.length });
      }
      if (method === "POST") {
        if (!can.createOrder(user)) return fail(403, "You cannot add buyers.");
        const body = (await req.json()) as { code?: string; name?: string };
        const code = body.code?.trim().toUpperCase();
        if (!code || !body.name?.trim()) return fail(400, "Enter buyer code and name.");
        if (db().buyers.some((b) => b.code === code)) return fail(409, `Buyer code ${code} already exists.`);
        const buyer = { id: nextId("b"), code, name: body.name.trim() };
        db().buyers.push(buyer);
        return json(buyer, 201);
      }
    }

    if (root === "users") {
      if (method === "GET") return json({ items: db().users, total: db().users.length });
      if (!can.manageUsers(user)) return fail(403, "Only super users (admin, merchandiser, manager) can manage users.");

      if (method === "POST") {
        const body = (await req.json()) as CreateUserInput;
        const username = body.username?.trim().toLowerCase() ?? "";
        const employeeId = body.employeeId?.trim().toUpperCase() || nextEmployeeId();
        if (!body.name?.trim()) return fail(400, "Enter the full name.");
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) return fail(400, "Username: 3–30 letters, numbers, dots or dashes.");
        if (!body.role || !can.assignRole(user, body.role)) return fail(403, "You can't create this role.");
        if (body.role === "supervisor" && !body.departments?.length) return fail(400, "Choose at least one department.");
        if ((body.password ?? "").length < 6) return fail(400, "Password must be at least 6 characters.");
        if (db().users.some((u) => u.username.toLowerCase() === username)) return fail(409, `Username ${username} is already taken.`);
        if (db().users.some((u) => u.employeeId.toUpperCase() === employeeId)) return fail(409, `Employee ID ${employeeId} is already used.`);
        if (body.email?.trim() && db().users.some((u) => u.email.toLowerCase() === body.email!.trim().toLowerCase())) return fail(409, "Someone already uses this email.");
        const created: User = {
          id: nextId("u"),
          name: body.name.trim(),
          username,
          employeeId,
          email: body.email?.trim() ?? "",
          phone: body.phone?.trim() ?? "",
          role: body.role,
          title: body.title?.trim() || "",
          departments: body.role === "supervisor" ? body.departments : [],
          lastActiveAt: now,
          active: true,
        };
        db().users.push(created);
        db().passwords[created.id] = body.password;
        return json(created, 201);
      }

      if (id && method === "PATCH") {
        const target = db().users.find((u) => u.id === id);
        if (!target) return fail(404, "Person not found.");
        if (!can.editUser(user, target)) return fail(403, target.id === user.id ? "You can't change your own account here." : "Only an admin can change an admin account.");
        const body = (await req.json()) as UpdateUserInput;
        if (body.role && !can.assignRole(user, body.role)) return fail(403, "You can't give this role.");
        if (body.password !== undefined && body.password.length < 6) return fail(400, "Password must be at least 6 characters.");
        const role = body.role ?? target.role;
        const departments = role === "supervisor" ? (body.departments ?? target.departments) : [];
        if (role === "supervisor" && departments.length === 0) return fail(400, "Choose at least one department.");
        Object.assign(target, {
          name: body.name?.trim() || target.name,
          role,
          title: body.title ?? target.title,
          departments,
          active: body.active ?? target.active,
        });
        if (body.password) db().passwords[target.id] = body.password;
        return json(target);
      }
    }

    if (root === "settings") {
      if (id === "factory") {
        if (method === "GET") return json(db().factory);
        if (method === "PUT") {
          if (!can.viewSettings(user)) return fail(403, "Only super users can change factory settings.");
          const next = { ...db().factory, ...((await req.json()) as Partial<FactoryProfile>) };
          if (!next.name?.trim()) return fail(400, "Enter the company name.");
          db().factory = { ...next, name: next.name.trim() };
          return json(db().factory);
        }
      }
      if (id === "notifications") {
        if (method === "GET") return json(db().notifications);
        if (method === "PUT") {
          db().notifications = { ...db().notifications, ...((await req.json()) as Partial<NotificationSettings>) };
          return json(db().notifications);
        }
      }
    }

    return fail(404, "Not found.");
  } catch (err) {
    if (err instanceof MockError) return fail(err.status, err.message);
    throw err;
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
