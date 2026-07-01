import { expect, test } from "@playwright/test";
import { e2eProjectName, loginAsAdmin } from "./helpers/auth";

test.describe("Admin Jira bug log", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
  });

  test("detail modal links issue key to jiraBrowseUrl from API", async ({ page }) => {
    await page.route("**/api/jira/log-bugs?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          logBugs: [
            {
              _id: "6a437068ade63f49fa42be99",
              project: "6a2a2f7ad548c9d2c0a82c42",
              issueKeyJira: "CED-E2E-1",
              jiraBrowseUrl: "https://jira.example.test/browse/CED-E2E-1",
              summary: "[TC-E2E] Sample failed case",
              priority: "3",
              testRun: { _id: "6a437068ade63f49fa42be73", name: "E2E Run" },
              runResult: "6a437068ade63f49fa42bcb0",
              loggedBy: { name: "E2E Admin", email: "e2e-admin@test.local", role: "admin" },
              createdAt: "2026-06-30T08:00:00.000Z",
            },
          ],
          pagination: { page: 1, limit: 50, total: 1, pages: 1 },
        }),
      });
    });

    await page.getByRole("button", { name: "Jira Bug Log" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/jira-bug-log/);
    await expect(page.getByRole("heading", { name: "Jira Bug Log" })).toBeVisible();

    const tableLink = page.getByRole("link", { name: "CED-E2E-1" });
    await expect(tableLink).toHaveAttribute("href", "https://jira.example.test/browse/CED-E2E-1");

    await page.getByRole("button", { name: "View detail" }).click();
    const detailLink = page
      .getByRole("dialog")
      .getByRole("link", { name: "CED-E2E-1" });
    await expect(detailLink).toHaveAttribute("href", "https://jira.example.test/browse/CED-E2E-1");
    await expect(detailLink).toHaveAttribute("target", "_blank");
  });
});
