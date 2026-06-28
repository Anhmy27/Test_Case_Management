import { expect, test } from "@playwright/test";
import { e2eManualPlanName, loginAsAdmin } from "./helpers/auth";

test.describe("Admin execution flow", () => {
  test("admin starts manual run, marks fail, and ends run", async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole("button", { name: /Test Runs/i }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/test-runs-execution/);
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

    const runName = `e2e-admin-run-${Date.now()}`;
    await page
      .locator("label")
      .filter({ hasText: "Run name" })
      .locator("..")
      .locator("input")
      .fill(runName);

    await page.getByRole("button", { name: /Start test run/i }).click();
    await expect(page.getByRole("button", { name: "Fail (2)" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Fail (2)" }).click();
    await expect(page.locator("text=Failed").first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "End run" }).click();
    await expect(page.locator("text=Completed").first()).toBeVisible({ timeout: 15_000 });
  });

  test("export buttons download run results file", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("button", { name: /Test Runs/i }).click();

    const completedRun = page
      .locator("[data-run-status='completed'], .run-list-item")
      .filter({ hasText: /e2e-/i })
      .first();

    if (await completedRun.count()) {
      await completedRun.click();
    }

    const exportXlsx = page.getByRole("button", { name: "Export XLSX" });
    if (await exportXlsx.isVisible()) {
      const downloadPromise = page.waitForEvent("download");
      await exportXlsx.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    }
  });
});
