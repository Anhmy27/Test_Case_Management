import { expect, test } from "@playwright/test";
import {
  createReadyRecordingSession,
  fetchRecordingSessionViaBrowser,
  getFirstProject,
  getFirstTestCase,
} from "./helpers/recording";
import { loginAsAdmin, mainContent, e2eProjectName } from "./helpers/auth";

test.describe.configure({ mode: "serial" });

test.describe("SR-4.4 Admin recording review (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
  });

  test("loads draft steps with inline group headers and auto-wait hints read-only", async ({ page }) => {
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
    await expect(main.getByText("Intent blocks", { exact: true })).toHaveCount(0);
    await expect(main.getByText("Draft steps", { exact: true })).toBeVisible();
    await expect(main.getByTestId("draft-step-group").first()).toBeVisible();
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

    // SR-4.5 adds "Lưu nháp" edit/save; SR-4.6 adds "Chạy thử" preview + "Lưu vào test case" merge.
    await expect(main.getByRole("button", { name: /^Lưu nháp/ })).toBeVisible();
    await expect(main.getByRole("button", { name: "Chạy thử" })).toBeVisible();
    await expect(main.getByRole("button", { name: "Lưu vào test case" })).toBeVisible();
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

test.describe("SR-4.5 Admin recording review (edit draft)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
  });

  test("edits a draft step value and saves the patch", async ({ page }) => {
    await page.goto("/workspace/admin/dashboard");

    const project = await getFirstProject(page);
    const sessionId = await createReadyRecordingSession(page, { projectId: project.id });

    await page.goto(`/workspace/admin/recording-review?sessionId=${encodeURIComponent(sessionId)}`);
    const main = mainContent(page);
    await expect(main.getByText("Draft steps", { exact: true })).toBeVisible({ timeout: 15_000 });

    const typeRow = main.locator("tbody tr").filter({ has: page.getByRole("cell", { name: "type", exact: true }) });
    const valueInput = typeRow.locator("input").first();
    await expect(valueInput).toHaveValue("admin");

    const saveButton = main.getByRole("button", { name: /^Lưu nháp/ });
    await expect(saveButton).toBeDisabled();

    await valueInput.fill("admin-edited");
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page.getByText("Đã lưu thay đổi nháp", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(valueInput).toHaveValue("admin-edited");
    await expect(saveButton).toBeDisabled();

    const persisted = await fetchRecordingSessionViaBrowser(page, sessionId) as {
      session: { draftSteps: Array<{ inferredAction: string; value: string; reviewStatus: string }> };
    };
    const patchedTypeStep = persisted.session.draftSteps.find((step) => step.inferredAction === "type");
    expect(patchedTypeStep?.value).toBe("admin-edited");
    expect(patchedTypeStep?.reviewStatus).toBe("edited");
  });

  test("marks a draft step as rejected and saves", async ({ page }) => {
    await page.goto("/workspace/admin/dashboard");

    const project = await getFirstProject(page);
    const sessionId = await createReadyRecordingSession(page, { projectId: project.id });

    await page.goto(`/workspace/admin/recording-review?sessionId=${encodeURIComponent(sessionId)}`);
    const main = mainContent(page);
    await expect(main.getByText("Draft steps", { exact: true })).toBeVisible({ timeout: 15_000 });

    const clickRow = main.locator("tbody tr").filter({ has: page.getByRole("cell", { name: "click", exact: true }) });
    await clickRow.getByRole("button", { name: "Bỏ", exact: true }).click();

    await main.getByRole("button", { name: /^Lưu nháp/ }).click();
    await expect(page.getByText("Đã lưu thay đổi nháp", { exact: true })).toBeVisible({ timeout: 10_000 });

    const persisted = await fetchRecordingSessionViaBrowser(page, sessionId) as {
      session: { draftSteps: Array<{ inferredAction: string; reviewStatus: string }> };
    };
    const patchedClickStep = persisted.session.draftSteps.find((step) => step.inferredAction === "click");
    expect(patchedClickStep?.reviewStatus).toBe("rejected");
  });

  test("discards unsaved edits when clicking Hủy sửa", async ({ page }) => {
    await page.goto("/workspace/admin/dashboard");

    const project = await getFirstProject(page);
    const sessionId = await createReadyRecordingSession(page, { projectId: project.id });

    await page.goto(`/workspace/admin/recording-review?sessionId=${encodeURIComponent(sessionId)}`);
    const main = mainContent(page);
    await expect(main.getByText("Draft steps", { exact: true })).toBeVisible({ timeout: 15_000 });

    const typeRow = main.locator("tbody tr").filter({ has: page.getByRole("cell", { name: "type", exact: true }) });
    const valueInput = typeRow.locator("input").first();
    await valueInput.fill("temp-value-should-not-persist");

    await main.getByRole("button", { name: "Hủy sửa", exact: true }).click();
    await expect(valueInput).toHaveValue("admin");
    await expect(main.getByRole("button", { name: /^Lưu nháp/ })).toBeDisabled();
  });

  test("inserts a manual hover step and it persists on the session", async ({ page }) => {
    await page.goto("/workspace/admin/dashboard");

    const project = await getFirstProject(page);
    const sessionId = await createReadyRecordingSession(page, { projectId: project.id });

    await page.goto(`/workspace/admin/recording-review?sessionId=${encodeURIComponent(sessionId)}`);
    const main = mainContent(page);
    await expect(main.getByText("Draft steps", { exact: true })).toBeVisible({ timeout: 15_000 });

    await main.getByRole("button", { name: "+ Thêm bước", exact: true }).click();
    await main.getByLabel("Hành động").selectOption("hover");
    await main.getByLabel("Loại selector").selectOption("text");
    await main.getByLabel("Selector / text").fill("Chương trình học");
    await main.getByRole("button", { name: "Thêm bước", exact: true }).click();

    await expect(page.getByText("Đã thêm bước vào nháp", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByRole("cell", { name: "hover", exact: true })).toBeVisible();

    const persisted = await fetchRecordingSessionViaBrowser(page, sessionId) as {
      session: { draftSteps: Array<{ inferredAction: string; targetType: string; target: string; reviewStatus: string }> };
    };
    const hoverStep = persisted.session.draftSteps.find((step) => step.inferredAction === "hover");
    expect(hoverStep?.targetType).toBe("text");
    expect(hoverStep?.target).toBe("Chương trình học");
    expect(hoverStep?.reviewStatus).toBe("edited");
  });
});

test.describe("SR-4.6 Admin recording review (preview + merge)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByLabel("Project scope").selectOption({ label: e2eProjectName });
  });

  test("disables preview/merge while a draft edit is unsaved", async ({ page }) => {
    await page.goto("/workspace/admin/dashboard");

    const project = await getFirstProject(page);
    const testCase = await getFirstTestCase(page, { projectId: project.id });
    const sessionId = await createReadyRecordingSession(page, { projectId: project.id });

    await page.goto(`/workspace/admin/recording-review?sessionId=${encodeURIComponent(sessionId)}`);
    const main = mainContent(page);
    await expect(main.getByText("Xem thử & Lưu", { exact: true })).toBeVisible({ timeout: 15_000 });

    // Merge also needs a target test case entity ID — fill it so gating below only reflects pending edits.
    const testCaseSelect = main
      .locator("label")
      .filter({ has: page.locator("span", { hasText: /^Test case$/ }) })
      .locator("select");
    await expect(testCaseSelect).toBeEnabled({ timeout: 15_000 });
    await testCaseSelect.selectOption(testCase.id);

    const previewButton = main.getByRole("button", { name: "Chạy thử" });
    const mergeButton = main.getByRole("button", { name: "Lưu vào test case" });
    await expect(previewButton).toBeEnabled();
    await expect(mergeButton).toBeEnabled();

    const typeRow = main.locator("tbody tr").filter({ has: page.getByRole("cell", { name: "type", exact: true }) });
    await typeRow.locator("input").first().fill("admin-pending-edit");

    await expect(previewButton).toBeDisabled();
    await expect(mergeButton).toBeDisabled();

    await main.getByRole("button", { name: "Hủy sửa", exact: true }).click();
    await expect(previewButton).toBeEnabled();
    await expect(mergeButton).toBeEnabled();
  });

  test("merges draft steps into the target test case and closes the session", async ({ page }) => {
    await page.goto("/workspace/admin/dashboard");

    const project = await getFirstProject(page);
    const testCase = await getFirstTestCase(page, { projectId: project.id });
    const sessionId = await createReadyRecordingSession(page, { projectId: project.id });

    await page.goto(`/workspace/admin/recording-review?sessionId=${encodeURIComponent(sessionId)}`);
    const main = mainContent(page);
    await expect(main.getByText("Xem thử & Lưu", { exact: true })).toBeVisible({ timeout: 15_000 });

    const testCaseSelect = main
      .locator("label")
      .filter({ has: page.locator("span", { hasText: /^Test case$/ }) })
      .locator("select");
    await expect(testCaseSelect).toBeEnabled({ timeout: 15_000 });
    await testCaseSelect.selectOption(testCase.id);
    await main.getByRole("button", { name: "Lưu vào test case" }).click();

    await expect(page.getByText(/Đã lưu \d+ bước vào test case/)).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText("Đã lưu vào test case", { exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: /^Lưu nháp/ })).toHaveCount(0);

    const persisted = await fetchRecordingSessionViaBrowser(page, sessionId) as {
      session: { status: string; testCaseEntityId: string };
    };
    expect(persisted.session.status).toBe("merged");
    expect(persisted.session.testCaseEntityId).toBe(testCase.id);
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
