import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Admin audit log", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("audit log tab is visible in global scope and loads entries", async ({ page }) => {
    await page.getByRole("button", { name: "Audit Log" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/audit-log/);

    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
    await expect(
      page.getByText("Global activity trail — visible only when project scope is All projects"),
    ).toBeVisible();

    await expect(page.getByText(/auth · login/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
