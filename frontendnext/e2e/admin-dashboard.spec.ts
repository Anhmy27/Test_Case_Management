import { expect, test } from "@playwright/test";
import { e2eProjectName, loginAsAdmin } from "./helpers/auth";

test.describe("Admin dashboard", () => {
  test("global dashboard shows KPI cards and charts", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Pass rate|Completion|Running runs/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("project-scoped dashboard updates when project selected", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
    await expect(page.getByText(e2eProjectName).first()).toBeVisible({ timeout: 10_000 });
  });

  test("execution history page loads under project scope", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
    await page.getByRole("button", { name: /Execution History/i }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/test-cases-history/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Execution History/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("test plans page loads under project scope", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
    await page.getByRole("button", { name: "Test Plans" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/test-plans/);
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible({ timeout: 15_000 });
  });
});
