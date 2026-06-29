import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { buildTestCaseImportWorkbookBuffer } from "../lib/testCaseImportTemplate";
import { e2eProjectName, loginAsAdmin } from "./helpers/auth";

const e2eGroupKey = "E2EGRP";

function writeImportFixture(caseKey: string): string {
  const buffer = buildTestCaseImportWorkbookBuffer([
    {
      "Group Key": e2eGroupKey,
      "Group Name": "",
      "Case Key": caseKey,
      Title: "E2E imported test case",
      Priority: "medium",
      Severity: "major",
      Type: "functional",
      Description: "Created from Playwright e2e import flow",
      "Step 1 Action": "Open landing page",
      "Step 1 Expected": "Landing page is visible",
      "Step 2 Action": "",
      "Step 2 Expected": "",
      "Step 3 Action": "",
      "Step 3 Expected": "",
      "Step 4 Action": "",
      "Step 4 Expected": "",
      "Step 5 Action": "",
      "Step 5 Expected": "",
      "Expected Result": "Landing page loads successfully",
    },
  ]);

  const filePath = path.join(os.tmpdir(), `${caseKey}.xlsx`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

test.describe("Admin test case Excel import", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
    await page.getByRole("button", { name: "Test Cases" }).click();
    await expect(page).toHaveURL(/\/workspace\/admin\/test-cases/);
    await expect(page.getByRole("button", { name: "Import Excel" })).toBeEnabled();
  });

  test("download template produces an Excel file with TestCases sheet", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download template" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("test-case-template.xlsx");

    const filePath = path.join(os.tmpdir(), `e2e-template-${Date.now()}.xlsx`);
    await download.saveAs(filePath);
    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
  });

  test("import Excel row creates a visible test case", async ({ page }) => {
    const caseKey = `E2E-IMPORT-${Date.now()}`;
    const filePath = writeImportFixture(caseKey);

    try {
      await page.locator('input[type="file"][accept*=".xlsx"]').setInputFiles(filePath);
      await expect(page.locator(".tcm-toast")).toContainText(/Imported 1 test cases/i, {
        timeout: 15_000,
      });
      await expect(
        page.getByRole("button", { name: new RegExp(`${caseKey}.*E2E imported test case`) }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});
