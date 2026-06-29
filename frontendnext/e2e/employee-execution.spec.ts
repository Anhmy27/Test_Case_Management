import { expect, test } from "@playwright/test";
import { e2eManualPlanName, loginAsEmployee } from "./helpers/auth";

test.describe("Employee manual execution", () => {
  test("employee starts run and marks a case as pass", async ({ page }) => {
    await loginAsEmployee(page);

    await page.goto("/workspace/employee/execution");

    await expect(page.getByRole("heading", { name: "Start Test Run" })).toBeVisible({
      timeout: 15_000,
    });

    const planSelect = page.getByRole("combobox", { name: "Test Plan" });
    const planOptionValue = await planSelect
      .locator("option")
      .filter({ hasText: e2eManualPlanName })
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
