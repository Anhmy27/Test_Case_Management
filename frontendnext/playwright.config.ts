import { defineConfig, devices } from "@playwright/test";

const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 3000);
const backendPort = Number(process.env.E2E_PORT || 5000);
const frontendBase = `http://localhost:${frontendPort}`;
const backendBase = `http://localhost:${backendPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  use: {
    baseURL: frontendBase,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node scripts/e2eServer.js",
      cwd: "../backend",
      url: `${backendBase}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        E2E_PORT: String(backendPort),
        PORT: String(backendPort),
      },
    },
    {
      command: "npm run dev",
      url: frontendBase,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_BASE: backendBase,
        PORT: String(frontendPort),
      },
    },
  ],
});
