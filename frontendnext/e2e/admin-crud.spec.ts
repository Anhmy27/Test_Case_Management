import { expect, test } from "@playwright/test";
import { e2eProjectName, loginAsAdmin } from "./helpers/auth";

test.describe("Admin CRUD smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("create project appears in projects table", async ({ page }) => {
    const code = `E2E${Date.now().toString().slice(-6)}`;
    const name = `E2E Project ${code}`;

    await page.getByRole("button", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/projects/);

    await page.getByLabel("Project name").fill(name);
    await page.getByLabel("Project code").fill(code);
    await page.getByRole("button", { name: "＋ Create project" }).click();

    await expect(page.getByRole("table").getByText(name)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("table").getByText(code)).toBeVisible();
  });

  test("create version under project scope", async ({ page }) => {
    const versionName = `E2E Version ${Date.now()}`;

    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
    await page.getByRole("button", { name: "Versions" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/versions/);

    await page.getByLabel("Version name").fill(versionName);
    await page.getByRole("button", { name: /Create version/i }).click();

    await expect(page.getByRole("table").getByText(versionName)).toBeVisible({ timeout: 15_000 });
  });

  test("create group under project scope", async ({ page }) => {
    const groupKey = `EG${Date.now().toString().slice(-4)}`;

    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
    await page.getByRole("button", { name: "Groups" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/groups/);

    await page.getByLabel("Group key").fill(groupKey);
    await page.getByLabel("Group name").fill(`E2E Group ${groupKey}`);
    await page.getByRole("button", { name: /Create group/i }).click();

    await expect(page.getByRole("table").getByText(groupKey)).toBeVisible({ timeout: 15_000 });
  });

  test("users page lists admin account", async ({ page }) => {
    await page.getByRole("button", { name: "Users" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/users/);
    await expect(page.getByRole("table").getByText(/e2e-admin@test\.local/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("issue types page loads and allows create", async ({ page }) => {
    const typeName = `E2E Bug ${Date.now()}`;

    await page.getByRole("button", { name: "Issue Types" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/issue-types/);

    await page.getByLabel("Issue type name").fill(typeName);
    await page.getByLabel("Jira issue type id").fill("10001");
    await page.getByRole("button", { name: /Create issue type/i }).click();

    await expect(page.getByRole("table").getByText(typeName)).toBeVisible({ timeout: 15_000 });
  });
});
