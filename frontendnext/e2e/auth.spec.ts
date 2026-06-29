import { expect, test } from "@playwright/test";
import { adminEmail, adminPassword } from "./helpers/auth";

test.describe("Auth smoke", () => {
  test("admin can log in and reach dashboard", async ({ page }) => {
    await page.goto("/");

    await page.locator("#email").fill(adminEmail);
    await page.locator("#password").fill(adminPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/workspace\/admin\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
  });
});
