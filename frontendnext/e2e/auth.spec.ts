import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "e2e-admin@test.local";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "e2e-admin-password-123456";

test.describe("Auth smoke", () => {
  test("admin can log in and reach dashboard", async ({ page }) => {
    await page.goto("/");

    await page.locator("#email").fill(adminEmail);
    await page.locator("#password").fill(adminPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/workspace\/admin\/dashboard/);
    await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
  });
});
