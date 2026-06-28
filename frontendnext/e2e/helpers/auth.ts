import { expect, type Page } from "@playwright/test";

export const adminEmail = process.env.E2E_ADMIN_EMAIL || "e2e-admin@test.local";
export const adminPassword = process.env.E2E_ADMIN_PASSWORD || "e2e-admin-password-123456";
export const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL || "e2e-employee@test.local";
export const employeePassword =
  process.env.E2E_EMPLOYEE_PASSWORD || "e2e-employee-password-123456";
export const e2eProjectName = "E2E Execution Project";
export const e2eManualPlanName = process.env.E2E_MANUAL_PLAN_NAME || "E2E Manual Execution Plan";

export async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.locator("#email").fill(adminEmail);
  await page.locator("#password").fill(adminPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/admin\/dashboard/);
}

export async function loginAsEmployee(page: Page) {
  await page.goto("/");
  await page.locator("#email").fill(employeeEmail);
  await page.locator("#password").fill(employeePassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/employee\/my-test-plans/);
}

export async function logoutFromWorkspace(page: Page) {
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL("/");
}
