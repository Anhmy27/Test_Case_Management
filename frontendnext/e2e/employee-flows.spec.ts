import { expect, test } from "@playwright/test";
import { e2eManualPlanName, loginAsEmployee } from "./helpers/auth";

test.describe("Employee workspace flows", () => {
  test("my test plans shows assigned E2E plan", async ({ page }) => {
    await loginAsEmployee(page);
    await expect(
      page.getByRole("button", { name: e2eManualPlanName, exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("running tests page loads", async ({ page }) => {
    await loginAsEmployee(page);
    await page.getByRole("button", { name: /Running Tests/i }).click();
    await expect(page).toHaveURL(/\/workspace\/employee\/running-tests/);
    await expect(page.getByText("Running Tests").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("history page loads", async ({ page }) => {
    await loginAsEmployee(page);
    await page.getByRole("button", { name: "History" }).click();
    await expect(page).toHaveURL(/\/workspace\/employee\/history/);
    await expect(page.getByText("History").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("jira profile page loads without live Jira call", async ({ page }) => {
    await loginAsEmployee(page);
    await page.getByRole("button", { name: /Jira Profile/i }).click();
    await expect(page).toHaveURL(/\/workspace\/employee\/jira-profile/);
    await expect(page.getByText("Jira Profile").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
