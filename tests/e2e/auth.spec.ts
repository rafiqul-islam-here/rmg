import { expect, test } from "@playwright/test";
import { COMPANY, loginWithForm, PASSWORD, signIn, USERS } from "./helpers";

test.describe("Login: Company name → Username or ID → Password", () => {
  test("signed-out visitors are sent to the login page; fields are in the right order", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login$/);
    const labels = await page.locator("form label").allInnerTexts();
    const order = ["Company name", "Username or ID", "Password"].map((l) => labels.findIndex((x) => x.startsWith(l)));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("shows errors next to each field and keeps what was typed", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your company name.")).toBeVisible();
    await expect(page.getByText("Enter your username or ID.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();

    await loginWithForm(page, "rahim.mia", PASSWORD, "Wrong Company Ltd");
    await expect(page.getByText("Company not found. Check the company name.")).toBeVisible();
    await expect(page.locator("#company")).toHaveValue("Wrong Company Ltd");

    await page.locator("#company").fill(COMPANY);
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Username / ID or password is not correct.")).toBeVisible();
  });

  test("password is hidden until Show password", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
  });

  test("a supervisor signs in with a username and lands on My Work", async ({ page }) => {
    await loginWithForm(page, "rahim.mia");
    await expect(page).toHaveURL(/\/my-work$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rahim");
  });

  test("an employee ID works instead of the username, and the company is remembered", async ({ page, context }) => {
    await loginWithForm(page, "EMP-0002");
    await expect(page).toHaveURL(/\/dashboard$/);
    await context.clearCookies({ name: "tf_session" });
    await page.goto("/login");
    await expect(page.locator("#company")).toHaveValue(COMPANY);
  });

  test("quick demo boxes are Merchandiser, Manager and Supervisor — no Worker", async ({ page }) => {
    await page.goto("/login");
    for (const role of ["Merchandiser", "Manager", "Supervisor"]) {
      await expect(page.getByRole("button", { name: new RegExp(role) })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /Worker/ })).toHaveCount(0);
    await page.getByRole("button", { name: /Merchandiser/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("sign out returns to login", async ({ page, context }) => {
    await signIn(context, USERS.manager);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("company name is shown in the app", () => {
  test("sidebar, top bar and account menu", async ({ page, context }) => {
    await signIn(context, USERS.manager);
    await page.goto("/dashboard");
    await expect(page.getByRole("complementary", { name: "Main navigation" }).getByText(COMPANY)).toBeVisible();
    await expect(page.getByTitle(`Company: ${COMPANY}`)).toBeVisible();
    await page.getByRole("button", { name: /Account menu/ }).click();
    await expect(page.getByRole("menu").getByText(COMPANY)).toBeVisible();
  });

  test("mobile menu", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(context, USERS.cutting);
    await page.goto("/my-work");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("dialog").getByText(COMPANY)).toBeVisible();
  });
});

test.describe("roles", () => {
  test("a supervisor cannot open Dashboard, Reports or Settings", async ({ page, context }) => {
    await signIn(context, USERS.cutting);
    for (const path of ["/dashboard", "/reports"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/my-work$/);
    }
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/settings/);
    const nav = page.getByRole("complementary", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  });

  test("merchandiser and manager are super users: they see Settings", async ({ page, context }) => {
    for (const user of [USERS.merchandiser, USERS.manager]) {
      await signIn(context, user);
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Create user" })).toBeVisible();
    }
  });
});
