import { expect, type BrowserContext, type Page } from "@playwright/test";

export const COMPANY = "Demo Garments Ltd.";
export const PASSWORD = "factory@2026";

export const USERS = {
  admin: "u-admin",
  merchandiser: "u-merch",
  manager: "u-manager",
  fabric: "u-sup-fab",
  cuttingSupervisor: "u-sup-cut",
  /** Rahim Mia — cutting supervisor (Line B). There is no worker role. */
  cutting: "u-rahim",
  sewing: "u-sup-sew",
  gpq: "u-gpq",
} as const;

/** Signs the browser context in through the API (demo shortcut; the login form is tested separately). */
export async function signIn(context: BrowserContext, userId: string) {
  await context.clearCookies();
  const res = await context.request.post("/api/mock/auth/login", { data: { userId } });
  expect(res.ok()).toBeTruthy();
}

/** Fills the real login form: Company name → Username or ID → Password. */
export async function loginWithForm(page: Page, login: string, password = PASSWORD, company = COMPANY) {
  await page.goto("/login");
  await page.locator("#company").fill(company);
  await page.locator("#login").fill(login);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Looks up an order by its number through the API. */
export async function orderByNumber(context: BrowserContext, orderNumber: string) {
  const list = await (await context.request.get(`/api/mock/orders?q=${encodeURIComponent(orderNumber)}`)).json();
  return list.items.find((o: { orderNumber: string }) => o.orderNumber === orderNumber) as { id: string; orderNumber: string };
}

/** Unique per run: the mock database lives as long as the server. */
export const uid = () => `${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;

/** Fails when the page scrolls sideways (guideline: no horizontal scroll). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

/** Visible solid-blue (main) buttons on the page. */
export function primaryButtons(page: Page) {
  return page.locator("[data-slot=button][data-variant=default]:visible");
}

/** Clicks the confirm button inside the open confirmation dialog. */
export async function confirmDialog(page: Page, name: string | RegExp) {
  await page.locator("[data-slot=dialog-content]").getByRole("button", { name }).click();
}
