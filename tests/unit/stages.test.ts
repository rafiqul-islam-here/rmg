import { describe, expect, it } from "vitest";
import { applyDispatch, applyFabric, applyIgnoreEmbellishment, applyProblem, applyStart } from "@/lib/mock/engine";
import {
  embellishmentStages,
  sewingUnitParts,
  isAtRisk,
  maxWaitingDays,
  nextActionFor,
  nextStageName,
  orderStatus,
  orderTitle,
  progressOf,
  requiredStages,
  stageStatus,
  timelineRows,
  waitingDays,
} from "@/lib/stages";
import { at, CUTTER, makeOrder, MERCH, toPpm } from "./helpers";

const DAY = 86_400_000;

describe("routes", () => {
  it.each([
    ["none", []],
    ["print", ["print"]],
    ["emb", ["emb"]],
    ["print_emb", ["print", "emb"]],
  ] as const)("embellishment %s → %j", (emb, expected) => {
    expect(embellishmentStages({ embellishment: emb, ignoreEmbellishment: false })).toEqual(expected);
  });

  it("ignored embellishment has no embellishment stages", () => {
    expect(embellishmentStages({ embellishment: "print_emb", ignoreEmbellishment: true })).toEqual([]);
    expect(requiredStages({ embellishment: "print_emb", ignoreEmbellishment: true })).toEqual(["fabric", "cutting", "sewing", "gpq", "ppm"]);
  });

  it("next stage names follow the route", () => {
    expect(nextStageName(makeOrder("none"), "cutting")).toBe("Sewing");
    expect(nextStageName(makeOrder("print_emb"), "cutting")).toBe("Print & Emb");
    expect(nextStageName(makeOrder("emb"), "emb")).toBe("Sewing");
    expect(nextStageName(makeOrder(), "gpq")).toBe("PP Meeting");
  });
});

describe("status = color tone + word", () => {
  it("a new order shows Created (pending tone) in Fabric", () => {
    expect(orderStatus(makeOrder())).toEqual({ tone: "pending", label: "Created" });
  });

  it("arrived work shows the hand-off word in the ready tone", () => {
    const o = makeOrder("emb");
    applyFabric(o, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    expect(orderStatus(o)).toEqual({ tone: "ready", label: "Fabric delivered" });
    applyDispatch(o, { emb: { sentAt: at(2) } }, CUTTER, at(2));
    expect(orderStatus(o)).toEqual({ tone: "ready", label: "EMB to print" });
  });

  it("blocked wins over everything else", () => {
    const o = makeOrder("print_emb");
    applyFabric(o, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    applyDispatch(o, { print: { sentAt: at(2) }, emb: { sentAt: at(2) } }, CUTTER, at(2));
    applyStart(o, "print", CUTTER, at(3));
    applyProblem(o, "emb", { reason: "Machine issue" }, CUTTER, at(3));
    expect(orderStatus(o)).toEqual({ tone: "blocked", label: "Machine issue" });
  });

  it("skipped and not reached stages", () => {
    expect(stageStatus({ stage: "print", state: "skipped" })).toEqual({ tone: "pending", label: "Not needed" });
    expect(stageStatus({ stage: "gpq", state: "not_reached" })).toEqual({ tone: "pending", label: "Pending" });
  });
});

describe("order card timeline (hide rows with no value)", () => {
  it("a new order has only the Created row", () => {
    expect(timelineRows(makeOrder()).map((r) => r.key)).toEqual(["created"]);
  });

  it('adds "Fabric Delivered time" after Fabric, and only the sent rows that happened', () => {
    const o = makeOrder("emb");
    applyFabric(o, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    expect(timelineRows(o).map((r) => r.label)).toEqual(["Created", "Fabric Delivered time"]);
    applyDispatch(o, { emb: { sentAt: at(2) } }, CUTTER, at(2));
    const rows = timelineRows(o);
    expect(rows.map((r) => r.key)).toEqual(["created", "fabric", "emb"]);
    expect(rows.some((r) => r.key === "print")).toBe(false);
    expect(rows.every((r) => Boolean(r.at))).toBe(true);
  });

  it("Fabric not found does not add a delivered row", () => {
    const o = makeOrder();
    applyFabric(o, { result: "not_found" }, CUTTER, at(1));
    expect(timelineRows(o).map((r) => r.key)).toEqual(["created"]);
  });

  it("sewing row carries the sewing unit", () => {
    const o = makeOrder("none");
    applyFabric(o, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    applyDispatch(o, { sewing: { sentAt: at(2), unit: "Unit 2" } }, CUTTER, at(2));
    expect(timelineRows(o).find((r) => r.key === "sewing")).toMatchObject({ label: "Sewing sent time", detail: "Unit 2" });
  });
});

describe("queue button", () => {
  it("picks the right action per stage and state", () => {
    const o = makeOrder("none");
    expect(nextActionFor(o, "fabric")).toBe("update_fabric");
    applyFabric(o, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    expect(nextActionFor(o, "fabric")).toBe("none");
    expect(nextActionFor(o, "ppm")).toBe("none");
    expect(nextActionFor(o, "cutting")).toBe("start");
    applyStart(o, "cutting", CUTTER, at(2));
    expect(nextActionFor(o, "cutting")).toBe("dispatch");
    applyProblem(o, "cutting", { reason: "Other" }, CUTTER, at(3));
    expect(nextActionFor(o, "cutting")).toBe("resume");
  });
});

describe("waiting time and risk", () => {
  it("counts whole days in the current stage", () => {
    const o = makeOrder();
    const arrived = new Date(o.stages.fabric.arrivedAt!).getTime();
    expect(waitingDays(o.stages.fabric, arrived + 1.5 * DAY)).toBe(1);
    expect(maxWaitingDays(o, arrived + 3.2 * DAY)).toBe(3);
  });

  it("is at risk after more than 2 days, or when blocked", () => {
    const o = makeOrder();
    const arrived = new Date(o.stages.fabric.arrivedAt!).getTime();
    expect(isAtRisk(o, arrived + 2.5 * DAY)).toBe(false);
    expect(isAtRisk(o, arrived + 3.1 * DAY)).toBe(true);
    applyFabric(o, { result: "not_found" }, CUTTER, at(1));
    expect(isAtRisk(o, arrived)).toBe(true);
  });
});

describe("progress and title", () => {
  it("counts only stages this order goes through", () => {
    const o = makeOrder("print_emb");
    expect(progressOf(o)).toEqual({ done: 0, total: 7, percent: 0 });
    applyIgnoreEmbellishment(o, MERCH, at(1));
    applyFabric(o, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    expect(progressOf(o)).toEqual({ done: 1, total: 5, percent: 20 });
  });

  it('formats "ORDER [colors]" like the floor cards', () => {
    expect(orderTitle({ orderNumber: "26ELC78", colors: ["Azul", "Verde", "Antracita"] })).toBe("26ELC78 [Azul, Verde, Antracita]");
  });
});

describe("PP Meeting is the last stage", () => {
  it("GPQ hands over to the PP Meeting, which completes the order", () => {
    expect(nextStageName(makeOrder(), "gpq")).toBe("PP Meeting");
    expect(nextStageName(makeOrder(), "ppm")).toBe("Completed");
  });

  it("the PPM queue shows the PPM time and a PP Meeting action", () => {
    const o = toPpm(makeOrder(), at(30));
    expect(orderStatus(o)).toEqual({ tone: "ready", label: "Sent to PPM" });
    expect(nextActionFor(o, "ppm")).toBe("ppm");
    expect(timelineRows(o).find((r) => r.key === "ppm")).toMatchObject({ label: "PPM time", at: at(30) });
  });
});

describe("sewing unit badge", () => {
  it("splits the unit and its lines", () => {
    expect(sewingUnitParts("Sewing Unit 2 · Lines 05–08")).toEqual({ unit: "Unit 2", lines: "Lines 05–08" });
    expect(sewingUnitParts("Unit 7")).toEqual({ unit: "Unit 7", lines: "" });
  });
});
