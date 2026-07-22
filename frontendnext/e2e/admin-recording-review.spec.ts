import { expect, test } from "@playwright/test";
import {
  createReadyRecordingSession,
  fetchRecordingSessionViaBrowser,
  getFirstProject,
} from "./helpers/recording";
import { loginAsAdmin, mainContent, e2eProjectName } from "./helpers/auth";

test.describe.configure({ mode: "serial" });

test.describe("SR-4.4 Admin recording review (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
  });

  test("loads draft steps, intent blocks, and auto-wait hints read-only", async ({ page }) => {
    await page.goto("/workspace/admin/dashboard");

    const project = await getFirstProject(page);
    const sessionId = await createReadyRecordingSession(page, { projectId: project.id });

    const sessionPayload = await fetchRecordingSessionViaBrowser(page, sessionId) as {
      session: {
        status: string;
        draftSteps: Array<{ inferredAction: string; autoWaitSuggestion?: string }>;
        intentBlocks: Array<{ label: string }>;
      };
    };

    expect(sessionPayload.session.status).toBe("ready_for_review");
    expect(sessionPayload.session.draftSteps.length).toBeGreaterThanOrEqual(2);
    expect(sessionPayload.session.intentBlocks.length).toBeGreaterThanOrEqual(1);

    await page.goto(`/workspace/admin/recording-review?sessionId=${encodeURIComponent(sessionId)}`);
    await expect(page).toHaveURL(new RegExp(`/workspace/admin/recording-review\\?sessionId=${sessionId}`));

    const main = mainContent(page);
    await expect(main.getByText("Phiên ghi", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText("ready for review", { exact: true })).toBeVisible();
    await expect(main.getByText(sessionId, { exact: true })).toBeVisible();
    await expect(main.getByText("Intent blocks", { exact: true })).toBeVisible();
    await expect(main.getByText("Draft steps", { exact: true })).toBeVisible();
    await expect(main.getByText("Đăng nhập", { exact: true })).toBeVisible();

    await expect(main.getByRole("cell", { name: "goto", exact: true })).toBeVisible();
    await expect(main.getByRole("cell", { name: "type", exact: true })).toBeVisible();
    await expect(main.getByRole("cell", { name: "click", exact: true })).toBeVisible();
    await expect(main.getByText("Chờ duyệt", { exact: true }).first()).toBeVisible();

    const autoWaitStep = sessionPayload.session.draftSteps.find(
      (step) => String(step.autoWaitSuggestion || "").trim(),
    );
    if (autoWaitStep?.autoWaitSuggestion) {
      await expect(main.getByText(autoWaitStep.autoWaitSuggestion, { exact: true })).toBeVisible();
    }

    await expect(main.getByRole("button", { name: "Lưu" })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Chạy thử" })).toHaveCount(0);
  });

  test("loads session from topbar input without query param", async ({ page }) => {
    await page.goto("/workspace/admin/dashboard");

    const project = await getFirstProject(page);
    const sessionId = await createReadyRecordingSession(page, { projectId: project.id });

    await page.goto("/workspace/admin/recording-review");
    await expect(page).toHaveURL(/\/workspace\/admin\/recording-review/);
    await expect(page.getByPlaceholder("Recording session ID")).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Recording session ID").fill(sessionId);
    await page.getByRole("button", { name: "Tải nháp", exact: true }).click();

    await expect(mainContent(page).getByText(sessionId, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(new RegExp(`sessionId=${sessionId}`));
  });
});

test.describe("SR-4.4 recording review access", () => {
  test("employee cannot open admin recording review screen", async ({ page }) => {
    const uniqueEmail = `e2e-rec-review-${Date.now()}@test.local`;

    await page.goto("/");
    await page.getByRole("button", { name: "Đăng ký ngay" }).click();
    await page.locator("#name").fill("E2E Recording Review Employee");
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#password").fill("register-pass-123456");
    await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/employee\/my-test-plans/, { timeout: 30_000 });

    await page.goto("/workspace/admin/recording-review");
    await expect(page).not.toHaveURL(/\/workspace\/admin\/recording-review/, {
      timeout: 15_000,
    });
  });
});
