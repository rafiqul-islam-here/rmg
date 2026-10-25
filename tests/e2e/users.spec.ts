import { expect, test } from "@playwright/test";
import { COMPANY, loginWithForm, signIn, uid, USERS } from "./helpers";

/** Change request steps 2–3: no Worker role; merchandisers and managers are super users who create users. */

test("a merchandiser creates a supervisor, who then signs in with company + username + password", async ({ page, context }) => {
  const username = `e2e.${uid().toLowerCase()}`;
  await signIn(context, USERS.merchandiser);
  await page.goto("/settings?tab=users");

  // Worker is gone from the role filters
  await expect(page.getByRole("group", { name: "Filter by role" }).getByRole("button", { name: /Worker/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Create user" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Create user" })).toBeVisible();

  // Validation
  await drawer.getByRole("button", { name: "Create user" }).click();
  await expect(drawer.getByText("Enter the full name.")).toBeVisible();
  await expect(drawer.getByText("Choose at least one department.")).toBeVisible();

  await drawer.getByLabel("Full name").fill("Shila Rani");
  await drawer.getByLabel("Username").fill(username);
  await drawer.getByRole("checkbox", { name: "Sewing" }).click();
  await drawer.getByRole("button", { name: "Generate" }).click();
  const password = await drawer.getByLabel(/Temporary password/).inputValue();
  expect(password).toMatch(/^tf-[a-z0-9]{6}$/);
  await expect(drawer.getByText("They will sign in with")).toBeVisible();
  await expect(drawer.getByText(COMPANY)).toBeVisible();

  // Merchandisers can't create admins
  await drawer.getByLabel("Role").click();
  await expect(page.getByRole("option", { name: /Admin/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await drawer.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("User Shila Rani created")).toBeVisible();
  await expect(page.getByText(`@${username}`)).toBeVisible();

  // The new supervisor signs in and only sees their department
  await context.clearCookies();
  await loginWithForm(page, username, password);
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Shila");
  await expect(page.getByText(/Sewing · Shift A/)).toBeVisible();
});

test("a manager resets a password; the old one stops working", async ({ page, context }) => {
  await signIn(context, USERS.manager);
  await page.goto("/settings?tab=users");
  const row = page.getByRole("listitem").filter({ hasText: "@mizanur.rahman" });
  await row.getByRole("button", { name: "Change" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel(/Reset password/).fill("gpq-2026");
  await drawer.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/New password set/)).toBeVisible();

  await context.clearCookies();
  await loginWithForm(page, "mizanur.rahman");
  await expect(page.getByText("Username / ID or password is not correct.")).toBeVisible();
  await loginWithForm(page, "mizanur.rahman", "gpq-2026");
  await expect(page).toHaveURL(/\/my-work$/);
});

test("super users can't edit their own account or (unless admin) an admin", async ({ page, context }) => {
  await signIn(context, USERS.merchandiser);
  await page.goto("/settings?tab=users");
  await expect(page.getByRole("listitem").filter({ hasText: "@tanvir.hasan" }).getByRole("button", { name: "Change" })).toBeDisabled();
  await expect(page.getByRole("listitem").filter({ hasText: "@karim.admin" }).getByRole("button", { name: "Change" })).toBeDisabled();
  await expect(page.getByRole("listitem").filter({ hasText: "@rahim.mia" }).getByRole("button", { name: "Change" })).toBeEnabled();
});
