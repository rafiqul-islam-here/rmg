import { expect, test, type Page } from "@playwright/test";
import { confirmDialog, signIn, uid, USERS } from "./helpers";

/**
 * The flow in Ui/ui documentations.pdf, steps 3 → 6, driven through the real UI.
 */

async function createOrder(page: Page, orderNumber: string, embellishment: RegExp, colors: string[]) {
  await page.goto("/orders/new");
  // Buyer management: choose the buyer first
  await page.getByRole("link", { name: /STADIUM/ }).click();
  await expect(page.getByText("Buyer:", { exact: false })).toContainText("STADIUM");
  await expect(page.getByLabel("Buyer Designation")).toHaveValue("STADIUM");
  await expect(page.getByLabel("Buyer Designation")).toHaveAttribute("readonly", "");

  await page.locator("#orderNumber").fill(orderNumber);
  for (const [i, c] of colors.entries()) {
    if (i >= 2) await page.getByRole("button", { name: "Add Color Option" }).click();
    await page.locator(`#color-${i}`).fill(c);
  }
  await page.getByText(embellishment).click();
  await page.getByLabel("4. Comments / Special Instructions").fill("Left chest logo.");
  await page.getByRole("button", { name: "Create order" }).click();
  // Wait for the save to finish before the test switches users (switching clears the session cookie).
  await expect(page).toHaveURL(/\/departments\/fabric\?highlight=/);
}

test.describe.configure({ mode: "serial" });

test("§3 entry form: None is selected initially, two color rows, validation", async ({ page, context }) => {
  await signIn(context, USERS.merchandiser);
  await page.goto("/orders/new");
  await page.getByRole("link", { name: /STADIUM/ }).click();
  await expect(page.getByRole("radio", { name: "d) None" })).toBeChecked();
  await expect(page.locator("#color-0")).toBeVisible();
  await expect(page.locator("#color-1")).toBeVisible();
  await expect(page.getByText(/Created Time:/)).toContainText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);

  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText("Enter the order number.")).toBeVisible();
  await expect(page.getByText("At least one color option is required.")).toHaveAttribute("role", "alert");

  // Duplicate order numbers are refused and the form keeps its values
  await page.locator("#orderNumber").fill("STD-2026-9013");
  await page.locator("#color-0").fill("Navy Blue");
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText(/already exists/)).toBeVisible();
  await expect(page.locator("#color-0")).toHaveValue("Navy Blue");
});

test("§3 → §6 Embroidery order: Fabric → Cutting → EMB to print", async ({ page, context }) => {
  const no = `STD-E2E-${uid()}`;
  const title = `${no} [Heather Grey, Crimson Red]`;

  // §3 — merchandiser creates the order
  await signIn(context, USERS.merchandiser);
  await createOrder(page, no, /^b\) Embroidery$/, ["Heather Grey", "Crimson Red"]);

  // §4 — it lands in the Fabric tab, highlighted, as status Created
  await expect(page).toHaveURL(/\/departments\/fabric\?highlight=/);
  const fabricCard = page.locator("article", { hasText: title });
  await expect(fabricCard).toBeVisible();
  await expect(fabricCard).toHaveClass(/ring-primary/);
  await expect(fabricCard).toContainText("Created:");
  await expect(fabricCard).toContainText(/\d{2} \w{3}, \d{4} \d{2}:\d{2} (AM|PM)/);
  await expect(fabricCard).toContainText("Created");

  // §4 — Fabric opens the card, sees the entry form data, marks Fabric delivered
  await signIn(context, USERS.fabric);
  await page.goto("/departments/fabric");
  await page.getByRole("button", { name: title }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText(`Fabric Processing: ${no}`)).toBeVisible();
  await expect(drawer).toContainText("a) Heather Grey, b) Crimson Red");
  await expect(drawer).toContainText("Left chest logo.");
  await expect(drawer.getByRole("radio", { name: /Fabric delivered/ })).toBeChecked();
  await drawer.getByLabel("Comments (Optional)").fill("Checked and approved by QA");
  await drawer.getByRole("button", { name: /Save · send to Cutting/ }).click();
  await confirmDialog(page, "Send to Cutting");
  await expect(page.getByText(`${no} · fabric delivered. Cutting has been notified.`)).toBeVisible();

  // §5 — Cutting sees the card with "Fabric Delivered time"
  await signIn(context, USERS.cutting);
  await page.goto("/departments/cutting");
  const cuttingCard = page.locator("article", { hasText: title });
  await expect(cuttingCard).toContainText("Fabric Delivered time");
  await expect(cuttingCard).toContainText("Fabric delivered");

  // §6 Option 3 — only Emb: EMB sent time + status "EMB to print" + comment
  await page.getByRole("button", { name: title }).click();
  await expect(drawer.getByText(`Cutting Processing: ${no}`)).toBeVisible();
  await expect(drawer).toContainText("Fabric Comments:");
  await expect(drawer).toContainText("Checked and approved by QA");
  await expect(drawer).toContainText("Embellishment action route:");
  await expect(drawer.getByText("Embroidery Action")).toBeVisible();
  await expect(drawer.getByText("EMB to print")).toBeVisible();
  // Supervisors do not get the super-user button
  await expect(drawer.getByRole("button", { name: "Ignore embellishment" })).toHaveCount(0);
  await drawer.getByLabel("Comments (Optional)").fill("Sent to Tajima multi-head EMB machine");
  await drawer.getByRole("button", { name: "Send to Emb" }).click();
  await confirmDialog(page, "Send to Emb");
  await expect(page.getByText(`${no} · Cutting dispatched. Emb has been notified.`)).toBeVisible();

  // The order now waits in Emb with the status the cutter set
  await signIn(context, USERS.manager);
  await page.goto("/departments/emb");
  const embCard = page.locator("article", { hasText: title });
  await expect(embCard).toContainText("EMB to print");
  await expect(embCard).toContainText("EMB sent time");
});

test("§6 Option 1 via Ignore embellishment (merchandiser) → Sewing with a sewing unit", async ({ page, context }) => {
  const no = `STD-E2E-${uid()}`;
  const title = `${no} [Olive Green]`;
  await signIn(context, USERS.merchandiser);
  await createOrder(page, no, /^c\) Print and Emb$/, ["Olive Green"]);
  await expect(page).toHaveURL(/\/departments\/fabric/);

  await signIn(context, USERS.fabric);
  await page.goto("/departments/fabric");
  await page.getByRole("button", { name: title }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Save · send to Cutting/ }).click();
  await confirmDialog(page, "Send to Cutting");
  await expect(page.getByText(`${no} · fabric delivered. Cutting has been notified.`)).toBeVisible();

  // Merchandiser opens it in Cutting: Option 4 shows both operations at once…
  await signIn(context, USERS.merchandiser);
  await page.goto("/departments/cutting");
  await page.getByRole("button", { name: title }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("a) Print Operation")).toBeVisible();
  await expect(drawer.getByText("b) Embroidery Operation")).toBeVisible();
  await expect(drawer).toContainText("both operations can be performed simultaneously");

  // …then ignores embellishment, which turns it into Option 1 (Sewing)
  await drawer.getByRole("button", { name: "Ignore embellishment" }).click();
  await confirmDialog(page, "Ignore embellishment");
  await expect(drawer).toContainText("None (ignored)");
  await expect(drawer.getByText("Sewing Action")).toBeVisible();
  await expect(drawer.getByText("Sent to Sewing")).toBeVisible();

  // Sewing unit is required
  await drawer.getByRole("button", { name: "Send to Sewing" }).click();
  await expect(drawer.getByText("Choose a sewing unit.")).toBeVisible();
  await drawer.getByLabel("Sewing Unit").click();
  await page.getByRole("option", { name: /Sewing Unit 2/ }).click();
  await drawer.getByRole("button", { name: "Send to Sewing" }).click();
  await confirmDialog(page, "Send to Sewing");
  await expect(page.getByText(`${no} · Cutting dispatched. Sewing has been notified.`)).toBeVisible();

  // Step 5 of the change request: every Sewing card carries the unit, highlighted
  await page.goto("/departments/sewing");
  const card = page.locator("article", { hasText: title });
  await expect(card).toContainText("Sent to Sewing");
  await expect(card.getByLabel("Sewing Unit 2, Lines 05–08")).toBeVisible();

  // …and the Sewing page filters by unit
  await page.getByRole("combobox", { name: "Units" }).click();
  await page.getByRole("option", { name: "Unit 1 · Lines 01–04" }).click();
  await expect(page.locator("article", { hasText: title })).toHaveCount(0);
});

test("§4 Option 2: Fabric not found keeps the order in Fabric with the comment", async ({ page, context }) => {
  const no = `STD-E2E-${uid()}`;
  const title = `${no} [Navy Blue]`;
  await signIn(context, USERS.merchandiser);
  await createOrder(page, no, /^d\) None$/, ["Navy Blue"]);

  await signIn(context, USERS.fabric);
  await page.goto("/departments/fabric");
  await page.getByRole("button", { name: title }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio", { name: /Fabric not found/ }).click();
  await expect(drawer.getByLabel("Fabric Delivered Time")).toHaveCount(0);
  await drawer.getByLabel("Comments (Optional)").fill("Supplier truck delayed");
  await drawer.getByRole("button", { name: /Save · fabric not found/ }).click();
  await expect(page.getByText(`${no} · marked "Fabric not found".`)).toBeVisible();

  await page.keyboard.press("Escape");
  const card = page.locator("article", { hasText: title });
  await expect(card).toContainText("Fabric not found");
  await expect(card).toContainText("Supplier truck delayed");
});

test("a cutting supervisor cannot update Fabric (disabled with a reason)", async ({ page, context }) => {
  await signIn(context, USERS.cuttingSupervisor);
  await page.goto("/departments/fabric");
  const button = page.getByRole("button", { name: "Update fabric" }).first();
  await expect(button).toBeDisabled();
});
