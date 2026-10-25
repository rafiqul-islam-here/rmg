import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./helpers";

/** Every page has loading, empty and error states (preview with ?state=… against the mock API). */

test.beforeEach(async ({ context }) => {
  await signIn(context, USERS.manager);
});

test("empty: Orders explains and offers the next step", async ({ page }) => {
  await page.goto("/orders?state=empty");
  await expect(page.getByText("No orders yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "New order" }).last()).toBeVisible();
});

test("empty: department queue", async ({ page }) => {
  await page.goto("/departments/cutting?state=empty");
  await expect(page.getByText("No pending work in Cutting.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View all orders" })).toBeVisible();
});

test("error: Dashboard shows a banner with Try again and no misleading content", async ({ page }) => {
  await page.goto("/dashboard?state=error");
  const alert = page.getByRole("alert").first();
  await expect(alert).toContainText("Couldn't load the dashboard.");
  await expect(alert.getByRole("button", { name: /Try again/ })).toBeVisible();
  await expect(page.getByText("Nothing is waiting.")).toHaveCount(0);
});

test("error: Orders and My Work", async ({ page }) => {
  // (Next.js also renders an empty role="alert" route announcer, so match by text.)
  await page.goto("/orders?state=error");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load orders." })).toBeVisible();
  await page.goto("/my-work?state=error");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load your work." })).toBeVisible();
});

test("loading: skeletons in the shape of the content, no spinner page", async ({ page }) => {
  await page.goto("/departments/cutting?state=loading");
  await expect(page.locator("[aria-hidden=true] .animate-pulse").first()).toBeVisible();
  await expect(page.locator("[aria-hidden=true] .animate-pulse")).not.toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Cutting" })).toBeVisible();
});

test("not found order", async ({ page }) => {
  await page.goto("/orders/does-not-exist");
  await expect(page.getByText("Order not found.")).toBeVisible();
});

test("Bangla: labels switch, order codes stay in Latin", async ({ page, context }) => {
  await context.addCookies([{ name: "tf_lang", value: "bn", url: test.info().project.use.baseURL! }]);
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("অর্ডার");
  await expect(page.getByText("STD-2026-9013").first()).toBeVisible();
});
