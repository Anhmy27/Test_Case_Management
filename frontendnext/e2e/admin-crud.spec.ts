import { expect, test } from "@playwright/test";
import { adminCreateForm, adminEmail, e2eProjectName, loginAsAdmin, mainContent } from "./helpers/auth";

test.describe("Admin CRUD smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("create project appears in projects table", async ({ page }) => {
    const code = `E2E${Date.now().toString().slice(-6)}`;
    const name = `E2E Project ${code}`;

    await page.getByRole("button", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/projects/);
    await expect(page.getByRole("button", { name: /Create project/i })).toBeVisible({
      timeout: 20_000,
    });

    const form = adminCreateForm(page);
    await form.getByLabel("Name").fill(name);
    await form.getByLabel("Code").fill(code);
    await page.getByRole("button", { name: /Create project/i }).click();

    await expect(mainContent(page).getByText(name, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(mainContent(page).getByText(code, { exact: true })).toBeVisible();
  });

  test("create version under project scope", async ({ page }) => {
    const versionName = `E2E Version ${Date.now()}`;

    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
    await page.getByRole("button", { name: "Versions" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/versions/);
    await expect(page.getByRole("button", { name: /Create version/i })).toBeVisible({
      timeout: 20_000,
    });

    await adminCreateForm(page).getByLabel("Name").fill(versionName);
    await page.getByRole("button", { name: /Create version/i }).click();

    await expect(mainContent(page).getByText(versionName, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("create group under project scope", async ({ page }) => {
    const groupName = `E2E Group ${Date.now()}`;

    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
    await page.getByRole("button", { name: "Groups" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/groups/);
    await expect(page.getByRole("button", { name: /Create group/i })).toBeVisible({
      timeout: 20_000,
    });

    await adminCreateForm(page).getByLabel("Name").fill(groupName);
    await page.getByRole("button", { name: /Create group/i }).click();

    await expect(mainContent(page).getByText(groupName, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("users page lists admin account", async ({ page }) => {
    await page.getByRole("button", { name: "Users" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/users/);
    await expect(mainContent(page).getByText(adminEmail, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("issue types page loads and allows create", async ({ page }) => {
    const typeName = `E2E Bug ${Date.now()}`;

    await page.getByRole("button", { name: "Issue Types" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/issue-types/);
    await expect(page.getByRole("button", { name: /Create issue type/i })).toBeVisible({
      timeout: 20_000,
    });

    const form = adminCreateForm(page);
    await form.getByLabel("Name").fill(typeName);
    await form.getByLabel("Jira ID").fill("10001");
    await page.getByRole("button", { name: /Create issue type/i }).click();

    await expect(mainContent(page).getByText(typeName, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
