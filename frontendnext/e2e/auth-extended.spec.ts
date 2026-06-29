import { expect, test } from "@playwright/test";
import { adminEmail, adminPassword, employeeEmail, employeePassword } from "./helpers/auth";

test.describe("Auth extended", () => {
  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/");
    await page.locator("#email").fill(adminEmail);
    await page.locator("#password").fill("wrong-password-value");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page.locator(".tcm-toast, [role='alert']").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL("/");
  });

  test("register creates employee account and redirects to employee workspace", async ({
    page,
  }) => {
    const uniqueEmail = `e2e-register-${Date.now()}@test.local`;

    await page.goto("/");
    await page.getByRole("button", { name: "Đăng ký ngay" }).click();
    await expect(page.getByRole("heading", { name: "Đăng ký tài khoản" })).toBeVisible();

    await page.locator("#name").fill("E2E Registered User");
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#password").fill("register-pass-123456");
    await page.getByRole("button", { name: "Đăng ký", exact: true }).click();

    await expect(page).toHaveURL(/\/workspace\/employee\/my-test-plans/, { timeout: 15_000 });
  });

  test("admin logout returns to login page", async ({ page }) => {
    await page.goto("/");
    await page.locator("#email").fill(adminEmail);
    await page.locator("#password").fill(adminPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/dashboard/, { timeout: 30_000 });

    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  });

  test("employee cannot open admin dashboard URL", async ({ page }) => {
    await page.goto("/");
    await page.locator("#email").fill(employeeEmail);
    await page.locator("#password").fill(employeePassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/employee\/my-test-plans/, { timeout: 30_000 });

    await page.goto("/workspace/admin/dashboard");
    await expect(page).not.toHaveURL(/\/workspace\/admin\/dashboard/, { timeout: 10_000 });
  });
});
