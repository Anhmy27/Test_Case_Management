import { expect, test } from "@playwright/test";

const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL || "e2e-employee@test.local";
const employeePassword = process.env.E2E_EMPLOYEE_PASSWORD || "e2e-employee-password-123456";
const planName = process.env.E2E_MANUAL_PLAN_NAME || "E2E Manual Execution Plan";

test.describe("Employee manual execution", () => {
  test("employee starts run and marks a case as pass", async ({ page }) => {
    await page.goto("/");

    await page.locator("#email").fill(employeeEmail);
    await page.locator("#password").fill(employeePassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/workspace\/employee\/my-test-plans/);

    await page.goto("/workspace/employee/execution");

    await expect(page.getByRole("heading", { name: "Start Test Run" })).toBeVisible({
      timeout: 15_000,
    });

    const planSelect = page.getByRole("combobox", { name: "Test Plan" });
    const planOptionValue = await planSelect
      .locator("option")
      .filter({ hasText: planName })
      .first()
      .getAttribute("value");

    expect(planOptionValue).toBeTruthy();
    await planSelect.selectOption(planOptionValue!);

    const runName = `e2e-run-${Date.now()}`;
    await page
      .locator("label")
      .filter({ hasText: "Run name" })
      .locator("..")
      .locator("input")
      .fill(runName);

    await page.getByRole("button", { name: /Start test run/i }).click();

    await expect(page.getByRole("button", { name: "Pass (1)" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Pass (1)" }).click();

    await expect(page.locator("text=Passed").first()).toBeVisible({ timeout: 10_000 });
  });
});
