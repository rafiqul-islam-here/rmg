/**
 * Production workflow rules (mock backend). The NestJS service should enforce the same rules.
 *
 * Fabric ─▶ Cutting ─┬─▶ Sewing ─▶ GPQ ─▶ PP Meeting ─▶ Completed   (embellishment: None / ignored)
 *                    ├─▶ Print ──┐
 *                    └─▶ Emb ────┴─▶ Sewing                          (Print, Emb or both at once)
 *
 * GPQ sets the PPM time when it completes. The PP Meeting records Findings (numbered notes or a
 * photo of hard-copy findings); completing it completes the order.
 */
import {
  embellishmentStages,
  STAGE_KEYS,
  STAGE_LABEL,
  STATUS_WORDS,
} from "@/lib/stages";
import type {
  ActivityEvent,
  Buyer,
  CreateOrderInput,
  CuttingDispatchInput,
  FabricUpdateInput,
  Order,
  PPMFindingInput,
  ProblemInput,
  StageCompleteInput,
  StageKey,
  StageRecord,
  UserRef,
} from "@/lib/types";

export class MockError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type NewEvent = Omit<ActivityEvent, "id">;

function event(order: Order, kind: ActivityEvent["kind"], text: string, actor: UserRef | undefined, at: string, stage?: StageKey): NewEvent {
  return { orderId: order.id, orderNumber: order.orderNumber, kind, text, actor, at, stage };
}

export function newOrder(id: string, input: CreateOrderInput, buyer: Buyer, actor: UserRef, at: string): { order: Order; events: NewEvent[] } {
  const stages = Object.fromEntries(
    STAGE_KEYS.map((k) => [k, { stage: k, state: "not_reached" } satisfies StageRecord]),
  ) as Record<StageKey, StageRecord>;
  stages.fabric = { stage: "fabric", state: "waiting", arrivedAt: at };
  const order: Order = {
    id,
    orderNumber: input.orderNumber.trim(),
    buyer: { id: buyer.id, code: buyer.code, name: buyer.name },
    colors: input.colors.map((c) => c.trim()).filter(Boolean),
    embellishment: input.embellishment,
    ignoreEmbellishment: false,
    comments: input.comments?.trim() || undefined,
    imageUrl: input.imageUrl,
    createdAt: at,
    createdBy: actor,
    stages,
    commentCount: 0,
  };
  return { order, events: [event(order, "created", "Order created · waiting in Fabric", actor, at, "fabric")] };
}

function requireState(rec: StageRecord, allowed: StageRecord["state"][], message: string) {
  if (!allowed.includes(rec.state)) throw new MockError(409, message);
}

export function applyFabric(order: Order, input: FabricUpdateInput, actor: UserRef, at: string): NewEvent[] {
  const rec = order.stages.fabric;
  requireState(rec, ["waiting", "blocked"], "Fabric is already delivered for this order.");
  if (input.result === "not_found") {
    order.stages.fabric = {
      ...rec,
      state: "blocked",
      statusLabel: STATUS_WORDS.fabricNotFound,
      problem: STATUS_WORDS.fabricNotFound,
      comment: input.comment,
      assignee: actor,
    };
    return [event(order, "problem", `Fabric not found${input.comment ? ` · ${input.comment}` : ""}`, actor, at, "fabric")];
  }
  const deliveredAt = input.deliveredAt ?? at;
  order.stages.fabric = {
    ...rec,
    state: "done",
    statusLabel: STATUS_WORDS.fabricDelivered,
    actionAt: deliveredAt,
    doneAt: at,
    comment: input.comment,
    problem: undefined,
    assignee: actor,
  };
  order.stages.cutting = { stage: "cutting", state: "waiting", arrivedAt: deliveredAt, statusLabel: STATUS_WORDS.fabricDelivered };
  return [event(order, "handoff", "Fabric delivered · sent to Cutting", actor, at, "fabric")];
}

export function applyStart(order: Order, stage: StageKey, actor: UserRef, at: string): NewEvent[] {
  if (stage === "fabric") throw new MockError(400, "Fabric is updated with Delivered or Not found.");
  if (stage === "ppm") throw new MockError(400, "The PP Meeting is completed with its Findings.");
  const rec = order.stages[stage];
  requireState(rec, ["waiting"], `${STAGE_LABEL[stage]} can only start when the order is ready.`);
  order.stages[stage] = { ...rec, state: "in_progress", startedAt: at, assignee: actor };
  return [event(order, "status", `${STAGE_LABEL[stage]} started`, actor, at, stage)];
}

export function applyIgnoreEmbellishment(order: Order, actor: UserRef, at: string): NewEvent[] {
  if (order.embellishment === "none") throw new MockError(400, "This order has no embellishment.");
  if (order.ignoreEmbellishment) throw new MockError(409, "Embellishment is already ignored.");
  const cut = order.stages.cutting.state;
  if (cut === "done" || cut === "skipped") throw new MockError(409, "Cutting has already dispatched this order.");
  order.ignoreEmbellishment = true;
  order.stages.print = { stage: "print", state: "skipped" };
  order.stages.emb = { stage: "emb", state: "skipped" };
  return [event(order, "status", "Embellishment ignored · Cutting will send straight to Sewing", actor, at, "cutting")];
}

export function applyDispatch(order: Order, input: CuttingDispatchInput, actor: UserRef, at: string): NewEvent[] {
  const rec = order.stages.cutting;
  requireState(rec, ["waiting", "in_progress"], "Cutting has already dispatched this order.");
  const route = embellishmentStages(order);
  const events: NewEvent[] = [];

  // Validate everything before changing the order, so a refused request leaves it untouched.
  if (route.length === 0) {
    if (!input.sewing?.sentAt) throw new MockError(400, "Enter the sewing sent time.");
    if (!input.sewing.unit) throw new MockError(400, "Choose a sewing unit.");
  }
  for (const k of route as ("print" | "emb")[]) {
    if (!input[k]?.sentAt) throw new MockError(400, `Enter the ${k === "print" ? "print" : "EMB"} sent time.`);
  }

  if (route.length === 0 && input.sewing) {
    order.stages.sewing = {
      stage: "sewing",
      state: "waiting",
      arrivedAt: input.sewing.sentAt,
      actionAt: input.sewing.sentAt,
      statusLabel: STATUS_WORDS.sentToSewing,
      sewingUnit: input.sewing.unit,
      comment: input.sewing.comment,
    };
    order.stages.print = { stage: "print", state: "skipped" };
    order.stages.emb = { stage: "emb", state: "skipped" };
    events.push(event(order, "handoff", `Sent to Sewing · ${input.sewing.unit}`, actor, at, "cutting"));
  } else {
    for (const k of ["print", "emb"] as const) {
      if (!route.includes(k)) {
        order.stages[k] = { stage: k, state: "skipped" };
        continue;
      }
      const part = input[k]!;
      const label = k === "print" ? STATUS_WORDS.sentToPrint : STATUS_WORDS.sentToEmb;
      order.stages[k] = {
        stage: k,
        state: "waiting",
        arrivedAt: part.sentAt,
        actionAt: part.sentAt,
        statusLabel: label,
        comment: part.comment,
      };
      events.push(event(order, "handoff", label, actor, at, "cutting"));
    }
  }

  order.stages.cutting = {
    ...rec,
    state: "done",
    startedAt: rec.startedAt ?? at,
    doneAt: at,
    statusLabel: STATUS_WORDS.dispatched,
    assignee: rec.assignee ?? actor,
  };
  return events;
}

export function applyComplete(order: Order, stage: StageKey, input: StageCompleteInput, actor: UserRef, at: string): NewEvent[] {
  if (stage === "fabric" || stage === "cutting") throw new MockError(400, `${STAGE_LABEL[stage]} uses its own hand-off form.`);
  if (stage === "ppm") throw new MockError(400, "Complete the PP Meeting with its Findings.");
  const rec = order.stages[stage];
  requireState(rec, ["in_progress"], `Start ${STAGE_LABEL[stage]} before completing it.`);
  const doneAt = input.doneAt ?? at;
  const isEmb = stage === "print" || stage === "emb";
  // Validate everything before changing the order, so a refused request leaves it untouched.
  const lastEmb = isEmb && embellishmentStages(order).every((k) => k === stage || order.stages[k].state === "done");
  if (lastEmb && !input.sewingUnit) throw new MockError(400, "Choose a sewing unit.");
  if (stage === "gpq" && !input.ppmAt) throw new MockError(400, "Set the PPM time.");

  order.stages[stage] = { ...rec, state: "done", doneAt, actionAt: doneAt, comment: input.comment ?? rec.comment, statusLabel: STATUS_WORDS.completed };

  if (isEmb) {
    if (!lastEmb) {
      return [event(order, "status", `${STAGE_LABEL[stage]} completed · waiting for the other embellishment`, actor, at, stage)];
    }
    order.stages.sewing = {
      stage: "sewing",
      state: "waiting",
      arrivedAt: doneAt,
      actionAt: doneAt,
      statusLabel: STATUS_WORDS.sentToSewing,
      sewingUnit: input.sewingUnit,
    };
    return [event(order, "handoff", `${STAGE_LABEL[stage]} completed · sent to Sewing (${input.sewingUnit})`, actor, at, stage)];
  }

  if (stage === "sewing") {
    order.stages.gpq = { stage: "gpq", state: "waiting", arrivedAt: doneAt, actionAt: doneAt, statusLabel: STATUS_WORDS.sentToGpq };
    return [event(order, "handoff", "Sewing completed · sent to GPQ", actor, at, stage)];
  }

  // GPQ completed → the order waits in the PPM queue at the PPM time GPQ set.
  order.ppMeeting = { ppmAt: input.ppmAt!, setBy: actor, setAt: at, findings: [] };
  order.stages.ppm = { stage: "ppm", state: "waiting", arrivedAt: doneAt, actionAt: input.ppmAt, statusLabel: STATUS_WORDS.sentToPpm };
  return [event(order, "handoff", "GPQ completed · sent to PP Meeting", actor, at, stage)];
}

export function applyProblem(order: Order, stage: StageKey, input: ProblemInput, actor: UserRef, at: string): NewEvent[] {
  if (stage === "ppm") throw new MockError(400, "Change the PPM time instead.");
  const rec = order.stages[stage];
  requireState(rec, ["waiting", "in_progress"], "Problems can only be reported on active work.");
  order.stages[stage] = { ...rec, state: "blocked", statusLabel: input.reason, problem: input.reason, comment: input.note ?? rec.comment, startedAt: rec.startedAt };
  return [event(order, "problem", `${STAGE_LABEL[stage]} blocked · ${input.reason}${input.note ? ` — ${input.note}` : ""}`, actor, at, stage)];
}

export function applyResume(order: Order, stage: StageKey, actor: UserRef, at: string): NewEvent[] {
  if (stage === "ppm") throw new MockError(400, "The PP Meeting can't be blocked.");
  if (stage === "fabric") throw new MockError(400, "Update fabric with Delivered once it is found.");
  const rec = order.stages[stage];
  requireState(rec, ["blocked"], `${STAGE_LABEL[stage]} is not blocked.`);
  order.stages[stage] = { ...rec, state: rec.startedAt ? "in_progress" : "waiting", statusLabel: undefined, problem: undefined };
  return [event(order, "status", `${STAGE_LABEL[stage]} resumed`, actor, at, stage)];
}

/* ---------------------------------------------------------------- PP Meeting */

function requirePpmOpen(order: Order) {
  if (order.stages.ppm.state !== "waiting" || !order.ppMeeting) {
    throw new MockError(409, order.stages.ppm.state === "done" ? "The PP Meeting is already completed." : "The order has not reached the PP Meeting yet.");
  }
  return order.ppMeeting;
}

/** GPQ (or a super user) changes the PPM time. */
export function applyPpmTime(order: Order, ppmAt: string, actor: UserRef, at: string): NewEvent[] {
  const meeting = requirePpmOpen(order);
  if (!ppmAt) throw new MockError(400, "Set the PPM time.");
  order.ppMeeting = { ...meeting, ppmAt, setBy: actor, setAt: at };
  order.stages.ppm = { ...order.stages.ppm, actionAt: ppmAt };
  return [event(order, "status", "PPM time changed", actor, at, "ppm")];
}

/** Adds one numbered finding: a note, a photo of hard-copy findings, or both. */
export function applyPpmFinding(order: Order, id: string, input: PPMFindingInput, actor: UserRef, at: string): NewEvent[] {
  const meeting = requirePpmOpen(order);
  const text = input.text?.trim() || undefined;
  if (!text && !input.imageUrl) throw new MockError(400, "Write a finding or upload an image of the findings.");
  const no = meeting.findings.length + 1;
  meeting.findings = [...meeting.findings, { id, no, text, imageUrl: input.imageUrl, by: actor, at }];
  return [event(order, "comment", `Finding ${no}: ${text ?? "image of findings uploaded"}`, actor, at, "ppm")];
}

/** Completes the PP Meeting — the final step — which completes the order. Needs at least one finding. */
export function applyPpmComplete(order: Order, doneAt: string, actor: UserRef, at: string): NewEvent[] {
  const meeting = requirePpmOpen(order);
  if (meeting.findings.length === 0) throw new MockError(400, "Add at least one finding before completing the PP Meeting.");
  const when = doneAt || at;
  order.stages.ppm = { ...order.stages.ppm, state: "done", doneAt: when, statusLabel: STATUS_WORDS.ppmCompleted, assignee: actor };
  order.completedAt = when;
  return [event(order, "handoff", `PP Meeting completed with ${meeting.findings.length} finding${meeting.findings.length === 1 ? "" : "s"} · order completed`, actor, at, "ppm")];
}
