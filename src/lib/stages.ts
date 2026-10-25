import type {
  Embellishment,
  Order,
  StageKey,
  StageRecord,
  StageState,
  StatusTone,
} from "./types";

/**
 * Production stages in floor order. Print and Emb run side by side after Cutting.
 * GPQ sets the PPM time; the PP Meeting (PPM queue) records the Findings and completes the order.
 */
export const STAGE_KEYS: StageKey[] = ["fabric", "cutting", "print", "emb", "sewing", "gpq", "ppm"];

export const STAGE_LABEL: Record<StageKey, string> = {
  fabric: "Fabric",
  cutting: "Cutting",
  print: "Print",
  emb: "Emb",
  sewing: "Sewing",
  gpq: "GPQ",
  ppm: "PP Meeting",
};

export const EMBELLISHMENT_LABEL: Record<Embellishment, string> = {
  none: "None",
  print: "Print",
  emb: "Embroidery",
  print_emb: "Print and Emb",
};

/** Status words used by the departments (from the UI documentation). */
export const STATUS_WORDS = {
  created: "Created",
  fabricDelivered: "Fabric delivered",
  fabricNotFound: "Fabric not found",
  sentToSewing: "Sent to Sewing",
  sentToPrint: "Sent to Print",
  // Wording as given in the UI documentation for the Emb hand-off.
  sentToEmb: "EMB to print",
  sentToGpq: "Sent to GPQ",
  inProgress: "In progress",
  completed: "Completed",
  dispatched: "Dispatched",
  sentToPpm: "Sent to PPM",
  ppmCompleted: "PPM completed",
} as const;

/* ---------------------------------------------------------------- Sewing units */

export const SEWING_UNITS = [
  "Sewing Unit 1 · Lines 01–04",
  "Sewing Unit 2 · Lines 05–08",
  "Sewing Unit 3 · Lines 09–12",
];

/** "Sewing Unit 2 · Lines 05–08" → { unit: "Unit 2", lines: "Lines 05–08" } for the highlighted badge. */
export function sewingUnitParts(value: string) {
  const [name, ...rest] = value.split(" · ");
  return { unit: name.replace(/^Sewing\s+/i, ""), lines: rest.join(" · ") };
}

export const PROBLEM_REASONS = [
  "Fabric shortage",
  "Machine issue",
  "Quality issue",
  "Waiting for material",
  "Other",
];

/** An order is "at risk" when it has waited in one stage longer than this. */
export const WAITING_ALERT_DAYS = 2;

const ACTIVE: StageState[] = ["waiting", "in_progress", "blocked"];

export function isActiveState(state: StageState) {
  return ACTIVE.includes(state);
}

/** Embellishment stages this order must pass through. */
export function embellishmentStages(order: Pick<Order, "embellishment" | "ignoreEmbellishment">): StageKey[] {
  if (order.ignoreEmbellishment) return [];
  switch (order.embellishment) {
    case "print":
      return ["print"];
    case "emb":
      return ["emb"];
    case "print_emb":
      return ["print", "emb"];
    default:
      return [];
  }
}

/** Stages this order actually goes through, in order. */
export function requiredStages(order: Pick<Order, "embellishment" | "ignoreEmbellishment">): StageKey[] {
  return ["fabric", "cutting", ...embellishmentStages(order), "sewing", "gpq", "ppm"];
}

export function isCompleted(order: Order) {
  return Boolean(order.completedAt);
}

/** Stages the order is sitting in right now (two at once for Print and Emb). */
export function currentStages(order: Order): StageKey[] {
  return STAGE_KEYS.filter((k) => isActiveState(order.stages[k].state));
}

export interface StatusView {
  tone: StatusTone;
  label: string;
}

/** Badge for one stage record. */
export function stageStatus(rec: StageRecord): StatusView {
  switch (rec.state) {
    case "waiting":
      if (rec.stage === "fabric") return { tone: "pending", label: STATUS_WORDS.created };
      return { tone: "ready", label: rec.statusLabel ?? "Ready" };
    case "in_progress":
      return { tone: "progress", label: rec.statusLabel ?? STATUS_WORDS.inProgress };
    case "blocked":
      return { tone: "blocked", label: rec.statusLabel ?? "Blocked" };
    case "done":
      return { tone: "done", label: rec.statusLabel ?? STATUS_WORDS.completed };
    case "skipped":
      return { tone: "pending", label: "Not needed" };
    default:
      return { tone: "pending", label: "Pending" };
  }
}

/** Single headline status for an order. Blocked wins, then in progress, then waiting. */
export function orderStatus(order: Order): StatusView {
  if (isCompleted(order)) return { tone: "done", label: STATUS_WORDS.completed };
  const recs = currentStages(order).map((k) => order.stages[k]);
  const pick =
    recs.find((r) => r.state === "blocked") ??
    recs.find((r) => r.state === "in_progress") ??
    recs[0];
  return pick ? stageStatus(pick) : { tone: "pending", label: STATUS_WORDS.created };
}

/** Status badge as seen from a department's queue. */
export function statusInStage(order: Order, stage: StageKey): StatusView {
  return stageStatus(order.stages[stage]);
}

export function progressOf(order: Order) {
  const req = requiredStages(order);
  const done = req.filter((k) => order.stages[k].state === "done").length;
  return { done, total: req.length, percent: Math.round((done / req.length) * 100) };
}

export function daysBetween(fromIso: string, to = Date.now()) {
  return Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / 86_400_000));
}

/** Days the order has been waiting in a stage, or 0 when it is moving / not there. */
export function waitingDays(rec: StageRecord, now = Date.now()) {
  if (!isActiveState(rec.state) || !rec.arrivedAt) return 0;
  return daysBetween(rec.arrivedAt, now);
}

export function maxWaitingDays(order: Order, now = Date.now()) {
  return Math.max(0, ...currentStages(order).map((k) => waitingDays(order.stages[k], now)));
}

export function isAtRisk(order: Order, now = Date.now()) {
  if (isCompleted(order)) return false;
  return (
    currentStages(order).some((k) => order.stages[k].state === "blocked") ||
    maxWaitingDays(order, now) > WAITING_ALERT_DAYS
  );
}

export interface TimelineRow {
  key: string;
  label: string;
  at: string;
  detail?: string;
}

/**
 * Timeline rows shown on order cards. Only rows that have a value are returned,
 * so cards never show empty "—" lines.
 */
export function timelineRows(order: Order): TimelineRow[] {
  const s = order.stages;
  // Labels follow the UI documentation ("Fabric Delivered time: [the time]").
  const rows: (TimelineRow | null)[] = [
    { key: "created", label: "Created", at: order.createdAt },
    s.fabric.state === "done" && s.fabric.actionAt
      ? { key: "fabric", label: "Fabric Delivered time", at: s.fabric.actionAt }
      : null,
    s.print.actionAt && s.print.state !== "skipped"
      ? { key: "print", label: "Print sent time", at: s.print.actionAt }
      : null,
    s.emb.actionAt && s.emb.state !== "skipped"
      ? { key: "emb", label: "EMB sent time", at: s.emb.actionAt }
      : null,
    s.sewing.arrivedAt
      ? { key: "sewing", label: "Sewing sent time", at: s.sewing.arrivedAt, detail: s.sewing.sewingUnit }
      : null,
    s.gpq.arrivedAt ? { key: "gpq", label: "Sent to GPQ", at: s.gpq.arrivedAt } : null,
    order.ppMeeting ? { key: "ppm", label: "PPM time", at: order.ppMeeting.ppmAt } : null,
    order.completedAt ? { key: "completed", label: "Completed", at: order.completedAt } : null,
  ];
  return rows.filter((r): r is TimelineRow => r !== null);
}

/** "26STD91 [Navy, Khaki]" — the card title format used on the floor. */
export function orderTitle(order: Pick<Order, "orderNumber" | "colors">) {
  return `${order.orderNumber} [${order.colors.join(", ")}]`;
}

/** What the main button on a queue card does for this stage. */
export type StageAction = "update_fabric" | "ppm" | "start" | "dispatch" | "complete" | "resume" | "none";

export function nextActionFor(order: Order, stage: StageKey): StageAction {
  const rec = order.stages[stage];
  if (stage === "fabric") return rec.state === "waiting" || rec.state === "blocked" ? "update_fabric" : "none";
  if (stage === "ppm") return isActiveState(rec.state) ? "ppm" : "none";
  if (rec.state === "waiting") return "start";
  if (rec.state === "blocked") return "resume";
  if (rec.state === "in_progress") return stage === "cutting" ? "dispatch" : "complete";
  return "none";
}

/** Where an order goes after this stage completes (used in hand-off wording). */
export function nextStageName(order: Order, stage: StageKey): string {
  if (stage === "fabric") return STAGE_LABEL.cutting;
  if (stage === "cutting") {
    const emb = embellishmentStages(order);
    return emb.length ? emb.map((k) => STAGE_LABEL[k]).join(" & ") : STAGE_LABEL.sewing;
  }
  if (stage === "print" || stage === "emb") return STAGE_LABEL.sewing;
  if (stage === "sewing") return STAGE_LABEL.gpq;
  if (stage === "gpq") return STAGE_LABEL.ppm;
  return "Completed";
}
