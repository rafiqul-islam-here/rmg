import path from "node:path";
import { expect, test } from "@playwright/test";
import { confirmDialog, orderByNumber, signIn, USERS } from "./helpers";

/**
 * Ui/PPM_ In the card_.pdf
 * Card: 1. Image · 2. Order number · 3. Buyer · 4. Unit · 5. PPM time (added by GPQ).
 * Card click: all previous data, PPM time as the main heading under the order number,
 * and "Findings" — a numbered list, or an uploaded image of hard-copy findings.
 */

test.describe.configure({ mode: "serial" });

test("GPQ sets the PPM time when it completes; the order moves to the PPM queue", async ({ page, context }) => {
  await signIn(context, USERS.gpq);
  await page.goto("/departments/gpq");
  const title = "26STD70 [Burgundy]"; // seeded: GPQ in progress
  await page.getByRole("button", { name: title }).click();
  const drawer = page.getByRole("dialog");
  const ppmField = drawer.getByLabel("PPM time");
  await expect(ppmField).toBeVisible();
  await ppmField.fill("2026-12-01T15:30");
  await drawer.getByRole("button", { name: /Complete & send to PP Meeting/ }).click();
  await confirmDialog(page, /Complete & send to PP Meeting/);
  await expect(page.getByText("26STD70 · GPQ completed. PP Meeting has been notified.")).toBeVisible();

  await signIn(context, USERS.merchandiser);
  await page.goto("/departments/ppm");
  const card = page.locator("article", { hasText: title });
  await expect(card).toContainText("PPM time:");
  await expect(card).toContainText("01 Dec, 2026 03:30 PM");
});

test("PPM card shows Image, Order number, Buyer, Unit, PPM time — in that order", async ({ page, context }) => {
  await signIn(context, USERS.merchandiser);
  await page.goto("/departments/ppm");
  await expect(page.getByRole("heading", { name: "PP Meeting" })).toBeVisible();
  const card = page.locator("article", { hasText: "26ZXY19 [Lime]" });
  await expect(card).toBeVisible();
  // 1. image first
  await expect(card.locator("> :first-child")).toHaveAttribute("aria-hidden", "true");
  const text = await card.innerText();
  const order = ["26ZXY19 [Lime]", "Buyer: ZXY Apparel", "UNIT", "PPM time:"].map((t) => text.indexOf(t));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  // No creation header on PPM cards
  await expect(card).not.toContainText("Created:");
});

test("PPM drawer: PPM time heading, previous data, numbered findings, image upload, complete", async ({ page, context }) => {
  await signIn(context, USERS.merchandiser);
  await page.goto("/departments/ppm");
  await page.getByRole("button", { name: "26ZXY19 [Lime]" }).click();
  const drawer = page.getByRole("dialog");

  // Order number, then PPM time as the main heading right under it
  await expect(drawer.getByRole("heading", { name: "26ZXY19" })).toBeVisible();
  await expect(drawer.getByText(/^PPM time: /).first()).toBeVisible();
  // The card sequence + all previous data
  await expect(drawer.getByText("Order number", { exact: true })).toBeVisible();
  await expect(drawer.getByLabel(/^Sewing Unit/).first()).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Production history" })).toBeVisible();
  for (const row of ["Fabric Delivered time", "EMB sent time", "Sewing sent time", "Sent to GPQ", "GPQ completed"]) {
    await expect(drawer.getByText(row, { exact: true })).toBeVisible();
  }

  // Complete is disabled until there is at least one finding
  await expect(drawer.getByRole("button", { name: "Complete PP Meeting" })).toBeDisabled();

  // Finding 1 — text
  await drawer.getByRole("button", { name: "Add finding" }).click();
  await expect(drawer.getByText("Write the finding, or upload an image of the findings.")).toBeVisible();
  await drawer.getByLabel("Finding 1").fill("Collar rib tension to be checked every 2 hours.");
  await drawer.getByRole("button", { name: "Add finding" }).click();
  await expect(page.getByText("26ZXY19 · finding 1 added.")).toBeVisible();

  // Finding 2 — image of hard-copy findings (the text box is cleared and ready for the next finding)
  await expect(drawer.getByLabel("Finding 2")).toHaveValue("");
  await drawer.getByLabel("Findings image file").setInputFiles(path.join(process.cwd(), "public/brand/threadflow-mark.png"));
  await expect(page.getByText("26ZXY19 · image of findings added (finding 2).")).toBeVisible();

  const list = drawer.getByRole("list", { name: "Findings" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem").nth(0)).toContainText("Collar rib tension");
  await expect(list.getByRole("img", { name: "Findings image 2" })).toBeVisible();
  // The image finding does not repeat the text of finding 1
  await expect(list.getByRole("listitem").nth(1)).not.toContainText("Collar rib tension");

  // Complete the PP Meeting → order completed
  await drawer.getByRole("button", { name: "Complete PP Meeting" }).click();
  await confirmDialog(page, "Complete PP Meeting");
  await expect(page.getByText("26ZXY19 · PP Meeting completed. The order is completed.")).toBeVisible();

  const order = await orderByNumber(context, "26ZXY19");
  await page.goto(`/orders/${order.id}`);
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.getByRole("heading", { name: "PP Meeting findings" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Findings" }).getByRole("listitem")).toHaveCount(2);
});

test("a supervisor outside the PP Meeting can't add findings", async ({ page, context }) => {
  await signIn(context, USERS.cutting);
  await page.goto("/departments/ppm");
  const button = page.getByRole("button", { name: /Open PP Meeting|Add findings/ }).first();
  await expect(button).toBeDisabled();
});

test("seeded completed order shows hard-copy findings image in Details", async ({ page, context }) => {
  await signIn(context, USERS.manager);
  const order = await orderByNumber(context, "26TET190");
  await page.goto(`/orders/${order.id}`);
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.getByRole("list", { name: "Findings" }).getByRole("img", { name: "Findings image 1" })).toBeVisible();
});
