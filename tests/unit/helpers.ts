import { applyComplete, applyDispatch, applyFabric, applyStart, newOrder } from "@/lib/mock/engine";
import type { Buyer, Embellishment, Order, UserRef } from "@/lib/types";

export const BUYER: Buyer = { id: "b-std", code: "STD", name: "STADIUM" };
export const MERCH: UserRef = { id: "u-merch", name: "Tanvir Hasan", email: "tanvir@threadflow.bd" };
/** Cutting supervisor (there is no "worker" role any more). */
export const CUTTER: UserRef = { id: "u-rahim", name: "Rahim Mia", email: "rahim.cutting@threadflow.bd" };
export const GPQ: UserRef = { id: "u-gpq", name: "Mizanur Rahman", email: "mizan.gpq@threadflow.bd" };

export const UNIT = "Sewing Unit 2 · Lines 05–08";
export const T0 = "2026-10-20T04:00:00.000Z"; // 10:00 AM Dhaka
export const at = (hours: number) => new Date(new Date(T0).getTime() + hours * 3_600_000).toISOString();

export function makeOrder(embellishment: Embellishment = "none", colors = ["Heather Grey"]): Order {
  return newOrder("o-test", { orderNumber: "STD-2026-9013", buyerId: BUYER.id, colors, embellishment }, BUYER, MERCH, T0).order;
}

/** Fabric delivered → the order is ready in Cutting. */
export function readyForCutting(order: Order) {
  applyFabric(order, { result: "delivered", deliveredAt: at(1), comment: "Checked and approved by QA" }, CUTTER, at(1));
  return order;
}

/** Runs a no-embellishment order through Fabric, Cutting, Sewing and GPQ — GPQ sets the PPM time. */
export function toPpm(order: Order, ppmAt = at(30)) {
  readyForCutting(order);
  applyDispatch(order, { sewing: { sentAt: at(2), unit: UNIT } }, CUTTER, at(2));
  applyStart(order, "sewing", CUTTER, at(3));
  applyComplete(order, "sewing", { doneAt: at(10) }, CUTTER, at(10));
  applyStart(order, "gpq", GPQ, at(11));
  applyComplete(order, "gpq", { doneAt: at(20), ppmAt }, GPQ, at(20));
  return order;
}
