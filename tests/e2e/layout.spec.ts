import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, primaryButtons, signIn, USERS } from "./helpers";

const PAGES: { path: string; user: string; heading: RegExp }[] = [
  { path: "/dashboard", user: USERS.manager, heading: /Production Overview/ },
  { path: "/orders", user: USERS.manager, heading: /Orders/ },
  { path: "/orders?view=board", user: USERS.manager, heading: /Orders/ },
  { path: "/orders/new?buyer=b-std", user: USERS.merchandiser, heading: /New Order Entry Form/ },
  { path: "/orders/o-1011", user: USERS.manager, heading: /STD-2026-9014/ },
  { path: "/my-work", user: USERS.cutting, heading: /Rahim/ },
  { path: "/departments/ppm", user: USERS.merchandiser, heading: /PP Meeting/ },
  { path: "/departments/sewing", user: USERS.sewing, heading: /Sewing/ },
  { path: "/departments/cutting", user: USERS.cuttingSupervisor, heading: /Cutting/ },
  { path: "/reports", user: USERS.manager, heading: /Reports/ },
  { path: "/settings", user: USERS.admin, heading: /Settings/ },
];

const WIDTHS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 1000 },
];

for (const vp of WIDTHS) {
  test.describe(`${vp.name} ${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const p of PAGES) {
      test(`${p.path} fits the screen and has at most one main (blue) button`, async ({ page, context }) => {
        await signIn(context, p.user);
        await page.goto(p.path);
        await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(p.heading);
        await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
        await expectNoHorizontalScroll(page);
        expect(await primaryButtons(page).count()).toBeLessThanOrEqual(1);
      });
    }

    test("navigation matches the breakpoint", async ({ page, context }) => {
      await signIn(context, USERS.manager);
      await page.goto("/dashboard");
      const sidebar = page.getByRole("complementary", { name: "Main navigation" });
      const bottomBar = page.locator("nav.fixed").filter({ has: page.getByText("Menu") });
      if (vp.width < 768) {
        await expect(sidebar).toBeHidden();
        await expect(bottomBar).toBeVisible();
        await bottomBar.getByRole("button", { name: "Menu" }).click();
        await expect(page.getByRole("dialog").getByRole("link", { name: "Orders" })).toBeVisible();
      } else {
        await expect(sidebar).toBeVisible();
        await expect(bottomBar).toBeHidden();
        const width = (await sidebar.boundingBox())!.width;
        expect(width).toBe(vp.width >= 1200 ? 240 : 72);
      }
    });
  });
}

test("touch targets on the floor are at least 44px (tablet)", async ({ page, context }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await signIn(context, USERS.cuttingSupervisor);
  await page.goto("/departments/cutting");
  const buttons = page.locator("article button[data-slot=button]");
  await expect(buttons.first()).toBeVisible();
  for (const box of await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(44);
  }
});

test("every status badge shows a word and an icon", async ({ page, context }) => {
  await signIn(context, USERS.manager);
  await page.goto("/orders");
  const badges = page.locator("tbody span.rounded-full:has(svg)");
  await expect(badges.first()).toBeVisible();
  for (const text of await badges.allInnerTexts()) expect(text.trim().length).toBeGreaterThan(0);
});
