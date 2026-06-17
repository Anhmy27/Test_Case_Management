import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "e2e-admin@test.local";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "e2e-admin-password-123456";

test.describe("Admin audit log", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#email").fill(adminEmail);
    await page.locator("#password").fill(adminPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/dashboard/);
  });

  test("audit log tab is visible in global scope and loads entries", async ({ page }) => {
    await page.getByRole("button", { name: "Audit Log" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/audit-log/);

    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
    await expect(
      page.getByText("Global activity trail — visible only when project scope is All projects"),
    ).toBeVisible();

    await expect(page.getByText(/auth · login/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
