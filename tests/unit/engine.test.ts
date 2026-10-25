import { describe, expect, it } from "vitest";
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
import { currentStages, isCompleted } from "@/lib/stages";
import { at, BUYER, CUTTER, GPQ, makeOrder, MERCH, readyForCutting, T0, toPpm } from "./helpers";

const UNIT = "Sewing Unit 1 · Lines 01–04";

/** Fabric delivered → Cutting may start. */
const delivered = readyForCutting;

function expectError(fn: () => unknown, status: number, message?: RegExp) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(MockError);
    expect((e as MockError).status).toBe(status);
    if (message) expect((e as MockError).message).toMatch(message);
    return;
  }
  throw new Error("Expected the action to be refused");
}

describe("§3 New order entry", () => {
  it("starts in Fabric with status Created and trims inputs", () => {
    const { order, events } = newOrder(
      "o-1",
      { orderNumber: "  STD-2026-9013 ", buyerId: BUYER.id, colors: [" Navy Blue ", "", "Crimson Red"], embellishment: "none", comments: "  " },
      BUYER,
      MERCH,
      T0,
    );
    expect(order.orderNumber).toBe("STD-2026-9013");
    expect(order.colors).toEqual(["Navy Blue", "Crimson Red"]);
    expect(order.comments).toBeUndefined();
    expect(order.stages.fabric).toMatchObject({ state: "waiting", arrivedAt: T0 });
    expect(order.stages.ppm.state).toBe("not_reached");
    expect(currentStages(order)).toEqual(["fabric"]);
    expect(order.createdBy).toEqual(MERCH);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("created");
  });
});

describe("§4 Fabric", () => {
  it("Option 1: Fabric delivered (time + comment) sends the order to Cutting", () => {
    const order = makeOrder();
    const events = applyFabric(order, { result: "delivered", deliveredAt: at(2), comment: "OK" }, CUTTER, at(3));
    expect(order.stages.fabric).toMatchObject({ state: "done", statusLabel: "Fabric delivered", actionAt: at(2), comment: "OK" });
    expect(order.stages.cutting).toMatchObject({ state: "waiting", arrivedAt: at(2) });
    expect(currentStages(order)).toEqual(["cutting"]);
    expect(events[0].kind).toBe("handoff");
  });

  it("Option 2: Fabric not found keeps the order in Fabric, flagged", () => {
    const order = makeOrder();
    applyFabric(order, { result: "not_found", comment: "Supplier delayed" }, CUTTER, at(1));
    expect(order.stages.fabric).toMatchObject({ state: "blocked", statusLabel: "Fabric not found", comment: "Supplier delayed" });
    expect(order.stages.cutting.state).toBe("not_reached");
  });

  it("comment is optional", () => {
    const order = makeOrder();
    applyFabric(order, { result: "not_found" }, CUTTER, at(1));
    expect(order.stages.fabric.comment).toBeUndefined();
  });

  it("a not-found order can be delivered later", () => {
    const order = makeOrder();
    applyFabric(order, { result: "not_found" }, CUTTER, at(1));
    applyFabric(order, { result: "delivered", deliveredAt: at(20) }, CUTTER, at(20));
    expect(order.stages.fabric.state).toBe("done");
    expect(order.stages.fabric.problem).toBeUndefined();
    expect(order.stages.cutting.state).toBe("waiting");
  });

  it("refuses a second delivery", () => {
    const order = makeOrder();
    applyFabric(order, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    expectError(() => applyFabric(order, { result: "delivered" }, CUTTER, at(5)), 409);
  });
});

describe("§6 Cutting dispatch", () => {
  it("Option 1 (None): sewing sent time + one sewing unit → Sent to Sewing; Print/Emb skipped", () => {
    const order = delivered(makeOrder("none"));
    applyDispatch(order, { sewing: { sentAt: at(5), unit: UNIT, comment: "42 bundles" } }, CUTTER, at(5));
    expect(order.stages.cutting).toMatchObject({ state: "done", statusLabel: "Dispatched" });
    expect(order.stages.sewing).toMatchObject({ state: "waiting", statusLabel: "Sent to Sewing", sewingUnit: UNIT, actionAt: at(5), comment: "42 bundles" });
    expect(order.stages.print.state).toBe("skipped");
    expect(order.stages.emb.state).toBe("skipped");
  });

  it("Option 1 requires a sewing unit", () => {
    const order = delivered(makeOrder("none"));
    expectError(() => applyDispatch(order, { sewing: { sentAt: at(5), unit: "" } }, CUTTER, at(5)), 400, /sewing unit/i);
    expect(order.stages.cutting.state).toBe("waiting");
  });

  it("Option 2 (only Print): print sent time → Sent to Print", () => {
    const order = delivered(makeOrder("print"));
    applyDispatch(order, { print: { sentAt: at(5), comment: "6 colours" } }, CUTTER, at(5));
    expect(order.stages.print).toMatchObject({ state: "waiting", statusLabel: "Sent to Print", actionAt: at(5), comment: "6 colours" });
    expect(order.stages.emb.state).toBe("skipped");
    expect(order.stages.sewing.state).toBe("not_reached");
  });

  it('Option 3 (only Emb): EMB sent time → status "EMB to print"', () => {
    const order = delivered(makeOrder("emb"));
    applyDispatch(order, { emb: { sentAt: at(5) } }, CUTTER, at(5));
    expect(order.stages.emb).toMatchObject({ state: "waiting", statusLabel: "EMB to print" });
    expect(order.stages.print.state).toBe("skipped");
  });

  it("Option 4 (Print and Emb): both run at the same time", () => {
    const order = delivered(makeOrder("print_emb"));
    applyDispatch(order, { print: { sentAt: at(5) }, emb: { sentAt: at(5) } }, CUTTER, at(5));
    expect(currentStages(order)).toEqual(["print", "emb"]);
  });

  it("Option 4 needs both sent times", () => {
    const order = delivered(makeOrder("print_emb"));
    expectError(() => applyDispatch(order, { print: { sentAt: at(5) } }, CUTTER, at(5)), 400, /EMB/);
  });

  it("can dispatch straight from Ready (start is optional) and only once", () => {
    const order = delivered(makeOrder("none"));
    applyDispatch(order, { sewing: { sentAt: at(5), unit: UNIT } }, CUTTER, at(5));
    expectError(() => applyDispatch(order, { sewing: { sentAt: at(6), unit: UNIT } }, CUTTER, at(6)), 409);
  });

  it("refuses dispatch before fabric is delivered", () => {
    const order = makeOrder("none");
    expectError(() => applyDispatch(order, { sewing: { sentAt: at(5), unit: UNIT } }, CUTTER, at(5)), 409);
  });
});

describe("§6 Ignore embellishment (admin / merchandiser)", () => {
  it("skips Print/Emb so Cutting sends straight to Sewing", () => {
    const order = delivered(makeOrder("print_emb"));
    applyIgnoreEmbellishment(order, MERCH, at(2));
    expect(order.ignoreEmbellishment).toBe(true);
    expect(order.stages.print.state).toBe("skipped");
    expect(order.stages.emb.state).toBe("skipped");
    applyDispatch(order, { sewing: { sentAt: at(5), unit: UNIT } }, CUTTER, at(5));
    expect(order.stages.sewing.statusLabel).toBe("Sent to Sewing");
  });

  it("is refused for orders without embellishment, twice, or after dispatch", () => {
    expectError(() => applyIgnoreEmbellishment(delivered(makeOrder("none")), MERCH, at(2)), 400);
    const twice = delivered(makeOrder("emb"));
    applyIgnoreEmbellishment(twice, MERCH, at(2));
    expectError(() => applyIgnoreEmbellishment(twice, MERCH, at(3)), 409);
    const sent = delivered(makeOrder("emb"));
    applyDispatch(sent, { emb: { sentAt: at(4) } }, CUTTER, at(4));
    expectError(() => applyIgnoreEmbellishment(sent, MERCH, at(5)), 409);
  });
});

describe("After Cutting: Print / Emb / Sewing / GPQ", () => {
  it("Print + Emb: Sewing only receives the order when BOTH are done", () => {
    const order = delivered(makeOrder("print_emb"));
    applyDispatch(order, { print: { sentAt: at(5) }, emb: { sentAt: at(5) } }, CUTTER, at(5));
    applyStart(order, "print", CUTTER, at(6));
    applyStart(order, "emb", CUTTER, at(6));
    applyComplete(order, "print", { doneAt: at(8) }, CUTTER, at(8));
    expect(order.stages.sewing.state).toBe("not_reached");
    expectError(() => applyComplete(order, "emb", { doneAt: at(9) }, CUTTER, at(9)), 400, /sewing unit/i);
    applyComplete(order, "emb", { doneAt: at(9), sewingUnit: UNIT }, CUTTER, at(9));
    expect(order.stages.sewing).toMatchObject({ state: "waiting", sewingUnit: UNIT, arrivedAt: at(9) });
  });

  it("runs all the way to Completed", () => {
    const order = delivered(makeOrder("print"));
    applyDispatch(order, { print: { sentAt: at(5) } }, CUTTER, at(5));
    applyStart(order, "print", CUTTER, at(6));
    applyComplete(order, "print", { doneAt: at(7), sewingUnit: UNIT }, CUTTER, at(7));
    applyStart(order, "sewing", CUTTER, at(8));
    applyComplete(order, "sewing", { doneAt: at(20) }, CUTTER, at(20));
    expect(order.stages.gpq).toMatchObject({ state: "waiting", statusLabel: "Sent to GPQ" });
    applyStart(order, "gpq", GPQ, at(21));
    applyComplete(order, "gpq", { doneAt: at(25), ppmAt: at(28) }, GPQ, at(25));
    expect(isCompleted(order)).toBe(false);
    expect(order.stages.ppm).toMatchObject({ state: "waiting", statusLabel: "Sent to PPM" });
    applyPpmFinding(order, "f1", { text: "All OK." }, MERCH, at(28));
    applyPpmComplete(order, at(29), MERCH, at(29));
    expect(isCompleted(order)).toBe(true);
    expect(order.completedAt).toBe(at(29));
    expect(currentStages(order)).toEqual([]);
  });

  it("refuses to complete a stage that was not started, or to start one twice", () => {
    const order = delivered(makeOrder("none"));
    applyDispatch(order, { sewing: { sentAt: at(5), unit: UNIT } }, CUTTER, at(5));
    expectError(() => applyComplete(order, "sewing", { doneAt: at(6) }, CUTTER, at(6)), 409);
    applyStart(order, "sewing", CUTTER, at(6));
    expectError(() => applyStart(order, "sewing", CUTTER, at(7)), 409);
  });

  it("Fabric and Cutting cannot use the generic start/complete", () => {
    const order = delivered(makeOrder("none"));
    expectError(() => applyStart(order, "fabric", CUTTER, at(2)), 400);
    expectError(() => applyComplete(order, "cutting", { doneAt: at(2) }, CUTTER, at(2)), 400);
  });
});

describe("refused requests leave the order untouched", () => {
  it("dispatch with Print and Emb but no EMB time changes nothing", () => {
    const order = delivered(makeOrder("print_emb"));
    const before = structuredClone(order);
    expectError(() => applyDispatch(order, { print: { sentAt: at(5) } }, CUTTER, at(5)), 400);
    expect(order).toEqual(before);
  });

  it("completing the last embellishment without a sewing unit changes nothing, and can be retried", () => {
    const order = delivered(makeOrder("emb"));
    applyDispatch(order, { emb: { sentAt: at(5) } }, CUTTER, at(5));
    applyStart(order, "emb", CUTTER, at(6));
    const before = structuredClone(order);
    expectError(() => applyComplete(order, "emb", { doneAt: at(7) }, CUTTER, at(7)), 400);
    expect(order).toEqual(before);
    applyComplete(order, "emb", { doneAt: at(7), sewingUnit: UNIT }, CUTTER, at(7));
    expect(order.stages.sewing.state).toBe("waiting");
  });

  it("dispatch to Sewing without a sent time changes nothing", () => {
    const order = delivered(makeOrder("none"));
    const before = structuredClone(order);
    expectError(() => applyDispatch(order, { sewing: { sentAt: "", unit: UNIT } }, CUTTER, at(5)), 400);
    expect(order).toEqual(before);
  });
});

describe("Problems", () => {
  it("blocks active work with a reason and resumes to where it was", () => {
    const order = delivered(makeOrder("none"));
    applyStart(order, "cutting", CUTTER, at(2));
    applyProblem(order, "cutting", { reason: "Machine issue", note: "Cutter down" }, CUTTER, at(3));
    expect(order.stages.cutting).toMatchObject({ state: "blocked", problem: "Machine issue", statusLabel: "Machine issue" });
    applyResume(order, "cutting", CUTTER, at(4));
    expect(order.stages.cutting.state).toBe("in_progress");
    expect(order.stages.cutting.problem).toBeUndefined();
  });

  it("a problem on Ready work resumes back to Ready", () => {
    const order = delivered(makeOrder("none"));
    applyProblem(order, "cutting", { reason: "Waiting for material" }, CUTTER, at(2));
    applyResume(order, "cutting", CUTTER, at(3));
    expect(order.stages.cutting.state).toBe("waiting");
  });

  it("refuses resume when nothing is blocked", () => {
    const order = delivered(makeOrder("none"));
    expectError(() => applyResume(order, "cutting", CUTTER, at(2)), 409);
  });
});

describe("PP Meeting (PPM queue) — client spec", () => {
  it("GPQ must set the PPM time; the order then waits in the PPM queue", () => {
    const order = makeOrder("none");
    readyForCutting(order);
    applyDispatch(order, { sewing: { sentAt: at(2), unit: "Unit 1" } }, CUTTER, at(2));
    applyStart(order, "sewing", CUTTER, at(3));
    applyComplete(order, "sewing", { doneAt: at(10) }, CUTTER, at(10));
    applyStart(order, "gpq", GPQ, at(11));
    const before = structuredClone(order);
    expectError(() => applyComplete(order, "gpq", { doneAt: at(20) }, GPQ, at(20)), 400, /PPM time/);
    expect(order).toEqual(before);
    applyComplete(order, "gpq", { doneAt: at(20), ppmAt: at(30) }, GPQ, at(20));
    expect(currentStages(order)).toEqual(["ppm"]);
    expect(order.ppMeeting).toMatchObject({ ppmAt: at(30), setBy: GPQ, findings: [] });
    expect(order.stages.ppm).toMatchObject({ state: "waiting", statusLabel: "Sent to PPM", actionAt: at(30) });
  });

  it("the PPM time can be changed while the meeting is open", () => {
    const order = toPpm(makeOrder());
    applyPpmTime(order, at(40), GPQ, at(21));
    expect(order.ppMeeting?.ppmAt).toBe(at(40));
    expectError(() => applyPpmTime(order, "", GPQ, at(21)), 400);
  });

  it("findings are numbered 1, 2, 3… and can be text or an image of hard-copy findings", () => {
    const order = toPpm(makeOrder());
    applyPpmFinding(order, "f1", { text: "  Pocket bag to be bartacked. " }, MERCH, at(31));
    applyPpmFinding(order, "f2", { imageUrl: "data:image/png;base64,AAAA" }, MERCH, at(32));
    applyPpmFinding(order, "f3", { text: "Zip puller colour", imageUrl: "data:image/png;base64,BBBB" }, MERCH, at(33));
    const f = order.ppMeeting!.findings;
    expect(f.map((x) => x.no)).toEqual([1, 2, 3]);
    expect(f[0]).toMatchObject({ text: "Pocket bag to be bartacked.", by: MERCH });
    expect(f[1].text).toBeUndefined();
    expect(f[1].imageUrl).toMatch(/^data:image/);
  });

  it("an empty finding is refused", () => {
    const order = toPpm(makeOrder());
    expectError(() => applyPpmFinding(order, "f1", { text: "   " }, MERCH, at(31)), 400, /finding/);
  });

  it("completing needs at least one finding, completes the order, and locks the findings", () => {
    const order = toPpm(makeOrder());
    expectError(() => applyPpmComplete(order, at(31), MERCH, at(31)), 400, /at least one finding/);
    applyPpmFinding(order, "f1", { text: "OK for bulk." }, MERCH, at(31));
    applyPpmComplete(order, at(32), MERCH, at(32));
    expect(order.stages.ppm).toMatchObject({ state: "done", statusLabel: "PPM completed" });
    expect(order.completedAt).toBe(at(32));
    expectError(() => applyPpmFinding(order, "f2", { text: "late" }, MERCH, at(33)), 409, /already completed/);
    expectError(() => applyPpmTime(order, at(50), GPQ, at(33)), 409);
  });

  it("findings can't be added before the order reaches the PP Meeting", () => {
    const order = makeOrder();
    expectError(() => applyPpmFinding(order, "f1", { text: "x" }, MERCH, at(1)), 409, /not reached/);
  });

  it("the generic start/complete/problem/resume actions are refused for the PP Meeting", () => {
    const order = toPpm(makeOrder());
    expectError(() => applyStart(order, "ppm", MERCH, at(31)), 400);
    expectError(() => applyComplete(order, "ppm", { doneAt: at(31) }, MERCH, at(31)), 400);
    expectError(() => applyProblem(order, "ppm", { reason: "Other" }, MERCH, at(31)), 400);
    expectError(() => applyResume(order, "ppm", MERCH, at(31)), 400);
  });

  it("Cutting no longer waits for the PP Meeting", () => {
    const order = readyForCutting(makeOrder("none"));
    applyStart(order, "cutting", CUTTER, at(2));
    expect(order.stages.cutting.state).toBe("in_progress");
  });
});
