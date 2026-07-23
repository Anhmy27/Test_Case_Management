import type { Page } from "@playwright/test";

const backendPort = Number(process.env.E2E_PORT || 5000);
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || `http://localhost:${backendPort}`;

export async function getFirstProject(page: Page): Promise<{ id: string; name: string }> {
  return page.evaluate(
    async (apiBase) => {
      const response = await fetch(`${apiBase}/api/projects`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`GET /api/projects failed (${response.status})`);
      }

      const data = await response.json() as { projects?: Array<Record<string, unknown>> };
      const project = (data.projects || [])[0];
      if (!project) {
        throw new Error("No projects available for recording e2e");
      }

      return {
        id: String(project.entityId || project.id || project._id || ""),
        name: String(project.name || ""),
      };
    },
    API_BASE,
  );
}

/** Returns the first test case entity ID in the project (merge target for SR-4.6 e2e). */
export async function getFirstTestCase(page: Page, { projectId }: { projectId: string }): Promise<{ id: string }> {
  return page.evaluate(
    async ({ scopedProjectId, apiBase }) => {
      const response = await fetch(`${apiBase}/api/test-cases?projectId=${encodeURIComponent(scopedProjectId)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`GET /api/test-cases failed (${response.status})`);
      }

      const data = await response.json() as { testCases?: Array<Record<string, unknown>> };
      const testCase = (data.testCases || [])[0];
      if (!testCase) {
        throw new Error("No test cases available for recording e2e");
      }

      return {
        id: String(testCase.entityId || testCase.id || testCase._id || ""),
      };
    },
    { scopedProjectId: projectId, apiBase: API_BASE },
  );
}

/** Seeds a ready_for_review session with login-flow events (intent blocks + draft steps). */
export async function createReadyRecordingSession(
  page: Page,
  { projectId }: { projectId: string },
): Promise<string> {
  return page.evaluate(
    async ({ projectId: scopedProjectId, apiBase }) => {
      function readCookie(cookieName: string) {
        const match = document.cookie.match(
          new RegExp(`(?:^|; )${cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
        );
        return match ? decodeURIComponent(match[1]) : "";
      }

      async function post(path: string, body: unknown) {
        const csrf = readCookie("tcm_csrf");
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (csrf) {
          headers["X-CSRF-Token"] = csrf;
        }

        const response = await fetch(`${apiBase}${path}`, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`POST ${path} failed (${response.status}): ${text}`);
        }

        return response.json();
      }

      const startBody = await post("/api/recording/sessions", {
        projectId: scopedProjectId,
        baseUrl: "http://localhost:3000/login",
      }) as { session: { id: string } };

      const sessionId = startBody.session.id;

      await post(`/api/recording/sessions/${sessionId}/events`, {
        events: [
          {
            rawType: "input",
            pageUrl: "http://localhost:3000/login",
            payload: { name: "username", value: "admin" },
          },
          {
            rawType: "click",
            pageUrl: "http://localhost:3000/login",
            payload: { testid: "login-btn", role: "button", roleName: "Đăng nhập" },
          },
        ],
      });

      await post(`/api/recording/sessions/${sessionId}/stop`, {});

      return sessionId;
    },
    { projectId, apiBase: API_BASE },
  );
}

export async function fetchRecordingSessionViaBrowser(page: Page, sessionId: string) {
  return page.evaluate(
    async ({ id, apiBase }) => {
      const response = await fetch(`${apiBase}/api/recording/sessions/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`GET session failed (${response.status})`);
      }
      return response.json();
    },
    { id: sessionId, apiBase: API_BASE },
  );
}
