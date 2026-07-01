# Test Case Management System

Test Case Management System is a full-stack test management app with:

- an Express + MongoDB backend
- an active Next.js frontend in `frontendnext/`
- Playwright-based automation execution for automation test plans
- Jira-backed bug logging for failed run items

**Hướng dẫn sử dụng (tiếng Việt):** [docs/HUONG_DAN_SU_DUNG.md](docs/HUONG_DAN_SU_DUNG.md)

## Recent improvements (2026-06-30)

- **Jira Bug Log (admin)**: list/filter bug history per project; **Issue Key** links to Jira (`{JIRA_BASE_URL}/browse/{issueKey}`) — URL is computed at query time, not stored in MongoDB.
- **Jira Bug Log detail**: shows project **name** (from selected project scope), issue metadata, run/case context; removed unused `jiraLocation` field.
- **Scrollable admin lists**: large tables (test cases, plans, groups, execution panels, Jira bug log) scroll inside the list body with sticky headers; pagination stays fixed.
- **Execution UX**: **Open/View** on test runs scrolls to the workbench; **Next failed** cycles through failed cases; deep-link `resultId` applies once per navigation.
- **Test case priority**: enum `lowest | low | medium | high | highest` (legacy `critical` removed from priority only; severity still has `critical`).
- **Test case save validation**: empty optional step `expected` values are omitted instead of sending `null`.

## Recent improvements (2026-06-29)

- **Excel import**: download 2-tab template (`TestCases` + `Hướng dẫn`), import manual steps only; automation configured on web. Strict validation + error Excel export.
- **Execution History UX**: filter by group **and** search by case key/title; paginated history modal; deep-link via `?caseKey=`.
- **Client-side pagination**: large admin lists (test cases, test plans, execution history modal) use shared `useClientPagination`.
- **Run naming**: default run names use **Vietnam time** (`Asia/Ho_Chi_Minh`, `YYYY-MM-DD HH:mm`) — shown in Log Bug description.
- **Auth rate limits (MongoDB-backed)**: login counts every attempt per IP + email; register counts only **successful account creation**. Jira log-bug is not rate-limited.
- **Security**: JWT in httpOnly cookies + CSRF + `helmet`; JWT fail-fast, **8h** TTL, session revocation via `tokenVersion`; production error sanitization.
- **Automation**: Playwright runner, dry-run, orphan run recovery, artifact retention, SSRF guardrails, demo case seeds.
- **CI**: GitHub Actions — backend tests, frontend build/lint, Playwright e2e on push/PR to `main`/`master`.
- **Tests**: **163** backend tests (`npm run test:ci`; skips live Jira probes) + **9** Playwright e2e specs.

## Repository Layout

- `backend/` — REST API, authentication, test management, Playwright automation runner
- `frontendnext/` — active Next.js UI for admin and employee workspaces
- `docker-compose.yml` — optional full-stack containers (backend + frontend) or MongoDB via profile
- `.github/workflows/ci.yml` — CI pipeline (backend tests + frontend build/lint + e2e)
- `.ai/` — internal agent/dev rules (architecture, testing, security, deployment)

## Requirements

- Node.js 18+ (CI uses Node 22)
- npm
- Docker and Docker Compose (local MongoDB)

## Quick Start

### 1) Start MongoDB

From the project root (MongoDB uses Docker profile `local-mongo`):

```bash
docker compose --profile local-mongo up -d mongodb
```

MongoDB runs in Docker on container port `27017` and is exposed to the host on `27018`.

Alternatively, point `MONGO_URI` in `backend/.env` to MongoDB Atlas or another hosted instance.

### 2) Configure the backend

Create `backend/.env` with values similar to:

```env
PORT=5000
MONGO_URI=mongodb://admin:admin123@localhost:27018/Test_Case_Management?authSource=admin
JWT_SECRET=super-secret-change-me
# Default access-token lifetime is 8h when unset. Use shorter values in production.
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:3000
# Uncomment for production-style API errors (no stack / no raw Jira HTML in responses):
# NODE_ENV=production

ADMIN_NAME=Admin Root
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=12345678
# Optional because backend now defaults to https://rd.cytech.ai
JIRA_BASE_URL=https://rd.cytech.ai
JIRA_USERNAME=your-jira-username
JIRA_PASSWORD=your-jira-password

# Auth rate limits (stored in MongoDB, not in-memory)
#
# Login — counts every failed/successful attempt:
# AUTH_LOGIN_ATTEMPT_LIMIT_MAX_PER_IP=100
# AUTH_LOGIN_ATTEMPT_LIMIT_MAX_PER_EMAIL=10
# AUTH_LOGIN_ATTEMPT_LIMIT_WINDOW_MINUTES=15
#
# Register — counts only successful account creation:
# AUTH_REGISTER_SUCCESS_LIMIT_MAX_PER_IP=20
# AUTH_REGISTER_SUCCESS_LIMIT_MAX_PER_EMAIL=1
# AUTH_REGISTER_SUCCESS_LIMIT_WINDOW_MINUTES=60
#
# Set TRUST_PROXY=1 when running behind nginx/reverse proxy so client IP is read correctly
# TRUST_PROXY=1
```

Jira logging is proxied through the backend. It signs in with the credentials above, reuses the Jira session, and posts bugs through Jira's create-issue flow.

`JIRA_BASE_URL` is also used to build browse links for logged issues (`{JIRA_BASE_URL}/browse/{issueKey}`) shown in the admin **Jira Bug Log** screen. Links are computed when listing logs — not persisted as a separate URL field in the database.

Then start the backend:

```bash
cd backend
npm install
npm start
```

### 3) Configure the frontend

The frontend lives in `frontendnext/`.

There is no legacy `frontend/` app in the current repository anymore.

Optional environment variable:

```env
NEXT_PUBLIC_API_BASE=http://localhost:5000
```

Start the frontend:

```bash
cd frontendnext
npm install
npm run dev
```

Open the app at `http://localhost:3000`.

The execution screen keeps `Actual result` and `Notes` persisted on run items, and the Log Bug modal sends bug reports through the backend Jira proxy.

## Backend Overview

The backend exposes REST endpoints under `/api` and includes:

- cookie-based JWT authentication (httpOnly session cookie + CSRF, default **8h** TTL, revocable via `tokenVersion`)
- **MongoDB-backed auth rate limits** on login/register (not in-memory; see [Auth rate limits](#auth-rate-limits))
- Zod request validation at the route boundary
- project, version, group, test case, test plan, and test run management
- admin user seeding on first startup
- Playwright automation execution for automation-mode test plans
- production-safe error responses when `NODE_ENV=production`

Service layer is split by domain (controllers → services → models):

- `backend/src/services/projectVersionServices.js` — project + version
- `backend/src/services/issueTypeGroupServices.js` — issue types + test case groups
- `backend/src/services/testCaseServices.js` / `testCaseService.js` — test case CRUD, import, execution history
- `backend/src/services/testPlanServices.js` / `testPlanService.js` — test plan CRUD, assignment, versioning
- `backend/src/services/testRunLifecycleService.js` — run start/update/end, export, retry
- `backend/src/services/testRunDashboardService.js` — dashboards and analytics
- `backend/src/services/jiraService.js` / `jiraManagementService.js` — Jira session + log bug
- `backend/src/services/auditLogService.js` — admin audit trail
- shared helpers in `backend/src/services/shared/` and `backend/src/utils/`

The backend starts from [backend/index.js](backend/index.js) and connects to MongoDB before starting Express.

### Auth rate limits

Counters are stored in MongoDB (`AuthRateLimit` collection), not in RAM. IP and email buckets are checked independently — a request is blocked if **either** bucket is full.

| Endpoint | What is counted | Default limits |
|----------|-----------------|----------------|
| `POST /api/auth/login` | Every attempt (wrong password counts) | 100 / IP / 15 min; 10 / email / 15 min |
| `POST /api/auth/register` | Only **successful** account creation | 20 / IP / 60 min; 1 / email / 60 min |
| `POST /api/jira/log-bug` | Not rate-limited | — |

Register behaviour in detail:

- Duplicate email (409) and validation errors do **not** consume register quota.
- Quota is reserved atomically before `User.create` and refunded if create fails unexpectedly.
- Middleware pre-checks quota; `registerService` reserves on the success path.

Environment variables (names reflect behaviour):

```env
# Login — every attempt
# AUTH_LOGIN_ATTEMPT_LIMIT_MAX_PER_IP=100
# AUTH_LOGIN_ATTEMPT_LIMIT_MAX_PER_EMAIL=10
# AUTH_LOGIN_ATTEMPT_LIMIT_WINDOW_MINUTES=15

# Register — successful creations only
# AUTH_REGISTER_SUCCESS_LIMIT_MAX_PER_IP=20
# AUTH_REGISTER_SUCCESS_LIMIT_MAX_PER_EMAIL=1
# AUTH_REGISTER_SUCCESS_LIMIT_WINDOW_MINUTES=60

# TRUST_PROXY=1   # behind nginx/reverse proxy
```

Implementation: `backend/src/config/authRateLimitConfig.js`, `backend/src/services/authRateLimitService.js`, `backend/src/middlewares/authRateLimitMiddleware.js`.

### Running backend tests

```bash
cd backend
npm test              # unit + integration tests (includes optional live Jira probes)
npm run test:ci       # CI suite; skips live probes; runs serially
npm run test:integration  # integration tests only (in-memory MongoDB + supertest)
```

This runs `node --test`. Unit tests live under `backend/test/*.test.js`; integration tests under `backend/test/integration/*.integration.test.js` (Express + MongoDB Memory Server + cookie/CSRF flow).

**Current suite (2026-06-29): 163 tests / 35 files** (`npm run test:ci` skips live Jira probes).

Unit tests cover: Zod validators, cookie auth, CSRF, JWT revocation, auth rate limits, automation URL policy, Playwright step helpers (goto/wait, assertText, locator strictness, retry), Excel import parsing, Jira token/vault helpers, artifact keys/storage, run name timestamps (`Asia/Ho_Chi_Minh`).

Integration tests cover: auth flows, admin user/project management, full test-management chain, manual + automation runs, Excel import API, dashboard, Jira log-bug (mocked), audit log, soft-delete/restore, automation ingest.

Optional live probes (skipped in CI): `jira-create-issue-probe.test.js`, `jira-log-bug-live.test.js`.

E2e seed (`backend/scripts/seedE2eExecution.js`) creates employee + manual plan for execution flows.

### E2E smoke tests (Playwright)

From `frontendnext/`:

```bash
npm run test:e2e      # local: reuses running servers when not in CI
npm run test:e2e:ci   # CI mode: starts backend e2e server + Next dev automatically
```

Playwright config (`playwright.config.ts`) boots `backend/scripts/e2eServer.js` (in-memory MongoDB + seeded admin) and `npm run dev` with matching CORS/API base URLs.

Specs in `frontendnext/e2e/` (9 files):

- `auth.spec.ts` — admin login → dashboard
- `auth-extended.spec.ts` — register + logout flows
- `admin-audit-log.spec.ts` — Audit Log tab in global scope
- `admin-crud.spec.ts` — create project, version, group
- `admin-dashboard.spec.ts` — dashboard + execution history navigation
- `admin-execution.spec.ts` — admin start manual run
- `admin-test-case-import.spec.ts` — download template + import Excel
- `employee-execution.spec.ts` — employee manual run → mark pass
- `employee-flows.spec.ts` — employee navigation smoke

Default e2e admin credentials (override with `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`):

- Email: `e2e-admin@test.local`
- Password: `e2e-admin-password-123456`

Default e2e employee credentials (override with `E2E_EMPLOYEE_EMAIL` / `E2E_EMPLOYEE_PASSWORD`):

- Email: `e2e-employee@test.local`
- Password: `e2e-employee-password-123456`

### CI

On push or pull request to `main` / `master`, GitHub Actions (`.github/workflows/ci.yml`) runs:

1. **Backend** — `npm ci` + `npm run test:ci` in `backend/`
2. **Frontend** — `npm ci` + `npm run build` + `npm run lint:ci` in `frontendnext/`
3. **E2E** — Playwright (all specs, Chromium) via `npm run test:e2e:ci`

## Frontend Overview

The UI is a Next.js App Router workspace in `frontendnext/`.

Key points:

- admin and employee workspaces under `/workspace/admin/*` and `/workspace/employee/*`
- workspace shell in `WorkspaceShell.tsx` with role-specific nav (`adminNav.ts`, employee routes)
- **project scope** in topbar (`tcm_selected_project_id` in `localStorage`) — global vs project-scoped sidebar tabs
- light/dark theme (`tcm_theme`)
- admin: CRUD, planning, execution, execution history, Jira bug log, audit log, users
- employee: assigned plans, execution, running tests, history, Jira profile
- execution UI persists `Actual result` and `Notes`; Log Bug prefills Jira description from run + case + steps
- default run names: `{plan} - YYYY-MM-DD HH:mm` in **Vietnam timezone** (`formatRunNameTimestamp` in `frontendnext/lib/api.ts`)

## Roles

### Admin

- manage projects, issue types, versions, groups, test cases, test plans, users
- import test cases from Excel; configure automation steps in the web UI
- create manual or automation test plans; assign owners and assignees
- run tests, view execution history (filter by group, search by key/title)
- view dashboards, Jira bug log, and audit log

### Employee

- view assigned test plans and start runs
- execute manual or automation runs assigned to them
- view personal running tests and history
- manage personal Jira profile for log-bug

## Automation Test Plans

Automation test cases store step definitions directly inside the test case record and are executed by Playwright when the parent test plan is set to `automation`.

Supported automation actions currently include:

- `goto`
- `click`
- `type`
- `select`
- `waitFor`
- `assertText`
- `assertVisible`
- `assertUrl`
- `assertTitle`
- `assertHidden`
- `assertEnabled`
- `assertChecked`
- `hover`
- `press`
- `upload`
- `dragTo`

Supported target types include:

- `css`
- `id`
- `placeholder`
- `text`
- `label`
- `testid`
- `url`

### Session reuse for automation

The automation runner reuses Playwright storage state files stored under `backend/.sessions/`.

- `webKey` is derived from the target site or base URL
- `userKey` selects the session profile for that site
- if a session exists, Playwright opens the site with the saved login state
- if no session exists, the run starts from a fresh context

This lets automation runs access logged-in pages without typing username and password every time.

### Automation security and recovery

- **Orphaned run recovery**: on backend startup, automation runs stuck in `running` are resumed for pending cases.
- **Artifact retention**: failure screenshots under `uploads/run/`; dry-run under `uploads/dry-run/`. Cleaned after `ARTIFACT_RETENTION_DAYS` (default 30) and `DRY_RUN_ARTIFACT_RETENTION_HOURS` (default 24). Legacy paths `uploads/artifacts/` and `uploads/runs/` still readable.
- **SSRF guardrails**:
  - `goto` / navigation must stay on the run `baseUrl` origin unless the host is listed in `AUTOMATION_ALLOWED_HOSTS`.
  - Metadata hosts (e.g. `169.254.169.254`) are always blocked.
  - `upload` steps only accept files under `AUTOMATION_UPLOAD_DIR` (default `uploads/test-files/`).

Optional backend env vars:

```env
# AUTOMATION_ALLOWED_HOSTS=localhost,127.0.0.1,rd.cytech.ai,*.cytech.ai
# ARTIFACT_ROOT_DIR=uploads
# AUTOMATION_UPLOAD_DIR=uploads/test-files
# ARTIFACT_RETENTION_DAYS=30
# DRY_RUN_ARTIFACT_RETENTION_HOURS=24
```

Place files for automation `upload` steps inside `backend/uploads/test-files/`.

Demo automation cases (stable public sites):

```bash
cd backend
npm run automation:seed-demos
npm run automation:stability-probe -- --caseKeys DEMO-EX01,DEMO-TODO --runs 3
```

### Excel import (manual test cases)

Admin **Test Cases** screen: **Download template** → fill → **Import Excel**.

- Workbook has two sheets: **`TestCases`** (data) and **`Hướng dẫn`** (instructions). Import reads `TestCases` by name.
- **Group Key** or **Group Name** (one required per row); **Case Key** + **Title** required.
- Manual steps via `Step N Action` / `Step N Expected` columns (default template: 5 step pairs).
- **Automation is not imported from Excel** — configure automation on the web edit form.
- Strict mode validates priority/severity/type enums; failed rows returned as downloadable error Excel.

Implementation: `frontendnext/lib/testCaseImportTemplate.ts`, `backend/src/utils/testCaseImportTemplate.js`, `POST /api/test-cases/import`.

### Jira bug logging

Failed run items can be logged to Jira from the execution screen.

- the project Jira `pid` comes from the backend `Project` record
- Jira credentials are resolved per authenticated user from the `JiraAccount` collection (`userId` reference) and fall back to the service account stored in `backend/.env`
- the current flow uses Jira's create-issue page instead of a custom REST-only integration
- Jira cookies/session state are cached in the database and refreshed when expired
- each successful log stores `issueKeyJira` and run/case metadata in the `LogBug` collection

**Admin Jira Bug Log** (`GET /api/jira/log-bugs`, UI: `/workspace/admin/jira-bug-log`):

- scoped to the selected project; supports search (issue key, summary, case), priority, and issue-type filters
- each list item includes `issueKeyJira` and a computed `jiraBrowseUrl` when `JIRA_BASE_URL` is configured
- detail modal shows project name, issue fields, test run/case context, and a clickable issue key (opens Jira in a new tab)
- browse URLs are **not** stored in MongoDB — they are derived from `JIRA_BASE_URL` + `/browse/` + `issueKeyJira` on every list response so env changes stay in sync

Example list item fields:

```json
{
  "issueKeyJira": "CED-1607",
  "jiraBrowseUrl": "https://rd.cytech.ai/browse/CED-1607",
  "summary": "[EG_008] ...",
  "testRun": { "_id": "...", "name": "..." }
}
```

### Jira profiles

Authenticated users can manage their Jira profile through the API:

- `GET /api/jira/profile`
- `PUT /api/jira/profile`

The Jira profile stores the Jira username/password separately from the app `User` record, so different users can keep independent Jira credentials without uniqueness checks on Jira usernames/passwords.

Optional environment secret:

```env
# JIRA_VAULT_SECRET=change-me
```

## Local Storage Keys

The frontend stores a few client-side keys in `localStorage`:

- `tcm_selected_project_id` - selected project scope
- `tcm_theme` - light/dark theme preference

JWT is **not** stored in `localStorage`; session is kept in httpOnly cookies set by the backend.

## API Highlights

The backend mounts routes as:

- `/api/auth`
- `/api/users`
- `/api/audit-logs`
- `/api/jira`
- `/api` (test management, dashboard, automation dry-run)

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Auth uses **httpOnly cookies** (`tcm_access_token`) instead of storing JWT in `localStorage`.
Mutating API calls from the browser must send `X-CSRF-Token` matching the `tcm_csrf` cookie.
All browser API requests use `credentials: 'include'`.
The backend reads the session JWT from the cookie only (no `Authorization: Bearer` fallback).

Security middleware enabled on the API:

- `helmet` — baseline HTTP security headers
- `cookie-parser` — session + CSRF cookies
- CSRF double-submit check on mutating `/api/*` routes (login/register/logout and automation ingest are excluded)
- **Auth rate limits** — MongoDB-backed; login attempt limits + register success limits (see [Auth rate limits](#auth-rate-limits))

### Users

- `GET /api/users` - admin only
- `POST /api/users` - admin only
- `PUT /api/users/:id` - admin only
- `DELETE /api/users/:id` - admin only

### Projects

- `GET /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects` - admin only
- `PUT /api/projects/:projectId` - admin only
- `DELETE /api/projects/:projectId` - admin only
- `PATCH /api/projects/:projectId/restore` - admin only

### Versions

- `GET /api/versions`
- `GET /api/versions/:versionId`
- `POST /api/versions` - admin only
- `PUT /api/versions/:versionId` - admin only
- `DELETE /api/versions/:versionId` - admin only
- `PATCH /api/versions/:versionId/restore` - admin only

### Issue types

- `GET /api/issue-types`
- `POST /api/issue-types` - admin only
- `GET /api/issue-types/:issueTypeId`
- `PUT /api/issue-types/:issueTypeId` - admin only
- `DELETE /api/issue-types/:issueTypeId` - admin only

### Test case groups

- `GET /api/test-case-groups`
- `GET /api/test-case-groups/:groupId`
- `GET /api/test-case-groups/:groupId/versions`
- `POST /api/test-case-groups` - admin only
- `PUT /api/test-case-groups/:groupId` - admin only
- `DELETE /api/test-case-groups/:groupId` - admin only
- `PATCH /api/test-case-groups/:groupId/restore` - admin only

### Test cases

- `GET /api/test-cases`
- `GET /api/test-cases/history`
- `GET /api/test-cases/:testCaseId`
- `GET /api/test-cases/:testCaseId/versions`
- `POST /api/test-cases` - admin only
- `POST /api/test-cases/import` - admin only
- `PUT /api/test-cases/:testCaseId` - admin only
- `DELETE /api/test-cases/:testCaseId` - admin only
- `PATCH /api/test-cases/:testCaseId/restore` - admin only

### Test plans

- `GET /api/test-plans`
- `GET /api/test-plans/:testPlanId`
- `GET /api/test-plans/:testPlanId/versions`
- `POST /api/test-plans` - admin only
- `PUT /api/test-plans/:testPlanId/assign` - admin only
- `PUT /api/test-plans/:testPlanId` - admin only
- `DELETE /api/test-plans/:testPlanId` - admin only
- `PATCH /api/test-plans/:testPlanId/restore` - admin only

### Test runs

- `GET /api/test-runs`
- `POST /api/test-runs` - admin or employee
- `PATCH /api/test-runs/:runId` - admin or employee
- `PATCH /api/test-runs/:runId/end` - admin or employee
- `POST /api/test-runs/:runId/cancel` - cancel automation run
- `POST /api/test-runs/:runId/retry-failed` - retry failed automation cases
- `GET /api/test-runs/:runId/export` - export run results (Excel)
- `GET /api/test-runs/:runId/my-items`
- `PATCH /api/test-runs/:runId/results/:resultId`
- `GET|POST /api/test-runs/:runId/results/:resultId/failure-screenshot`
- `POST /api/test-runs/:runId/automation-results` - automation ingestion (secret header)

### Automation dry-run

- `POST /api/automation/dry-run` - admin only
- `GET /api/automation/dry-runs/:dryRunId/failure-screenshot`

### Jira

- `GET /api/jira/profile`
- `PUT /api/jira/profile`
- `GET /api/jira/assignable-users`
- `GET /api/jira/label-suggestions`
- `GET /api/jira/version-suggestions`
- `GET /api/jira/log-bugs` - admin bug log history (`issueKeyJira`, computed `jiraBrowseUrl`, filters: `search`, `priority`, `issueType`, pagination)
- `POST /api/jira/log-bug` - returns `issueKey`, `jiraBrowseUrl`, `logBugId`

### Audit logs

- `GET /api/audit-logs` - admin only (server-side pagination)

### Dashboards

- `GET /api/dashboard`
- `GET /api/dashboard/projects`
- `GET /api/dashboard/versions`
- `GET /api/dashboard/test-plans`
- `GET /api/dashboard/test-plans/:testPlanId`

## Useful Commands

### Backend

```bash
cd backend
npm install
npm start
npm test              # unit + integration tests
npm run test:ci       # skips live Jira probe tests (same as CI)
npm run test:integration
npm run e2e:server    # API + in-memory Mongo for Playwright
npm run automation:seed-demos
npm run automation:stability-probe
```

### Frontend

```bash
cd frontendnext
npm install
npm run dev
npm run test:e2e      # Playwright smoke (starts backend e2e server + Next dev in CI)
npm run test:e2e:ci
```

### Docker

**MongoDB only (typical local dev):**

```bash
docker compose --profile local-mongo up -d mongodb
docker compose --profile local-mongo down
```

**Full stack in containers** (backend + frontend; set `MONGO_URI` in `backend/.env` to Atlas or start Mongo separately):

```bash
docker compose up -d --build
docker compose down
docker compose down -v   # removes volumes including Mongo data
```

Set `NEXT_PUBLIC_API_BASE` build arg in `docker-compose.yml` when frontend must reach backend on a LAN IP.

## Troubleshooting

- If MongoDB authentication fails, make sure `authSource=admin` is present in `MONGO_URI`.
- If the backend cannot connect to MongoDB, confirm the Docker container is healthy on port `27018`.
- If automation runs are blocked with a Playwright message, reinstall backend dependencies and make sure Playwright browsers are available.
- If the UI points to the wrong backend, set `NEXT_PUBLIC_API_BASE` in the frontend environment.
- If API errors look too generic during local debugging, comment out `# NODE_ENV=production` in `backend/.env` to see stack traces again.
- If mutating API calls return 403 CSRF errors, ensure the browser sends cookies (`credentials: 'include'`) and that login ran successfully so `tcm_csrf` is set.
- If login/register returns **429 Too Many Requests**, auth rate limits were hit — check the `Retry-After` header or wait for the window to reset. Register limits count only successful account creation; login limits count every attempt.
- If `npm run build` fails fetching Google Fonts (`fonts.gstatic.com`), the network blocked font download during build — retry with internet/VPN or build on CI.
- Never commit `backend/.env`; use strong `JWT_SECRET` in production. Rotate secrets if they were ever committed to git history.

## Additional notes

- `frontendnext/` is the only frontend app (no legacy `frontend/`).
- `frontendnext/.next/` and `node_modules/` are generated — do not commit.
- Internal review snapshot: [REVIEW-2026-06-08.md](REVIEW-2026-06-08.md) (partially outdated; README reflects current code).
- Agent/dev conventions: `.ai/00-core-rules.md` and related rule files.