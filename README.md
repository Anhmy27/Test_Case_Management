# Test Case Management System

Test Case Management System is a full-stack test management app with:

- an Express + MongoDB backend
- an active Next.js frontend in `frontendnext/`
- Playwright-based automation execution for automation test plans
- Jira-backed bug logging for failed run items

## Recent improvements (2026-06-11)

- **Auth rate limits (MongoDB-backed)**: login counts every attempt per IP + email; register counts only **successful account creation** (failed/duplicate attempts do not consume quota). Jira log-bug is not rate-limited. See [Auth rate limits](#auth-rate-limits) below.
- **Security**: JWT in httpOnly cookies + CSRF + `helmet`; JWT fail-fast, **8h** TTL, session revocation via `tokenVersion`; production error sanitization.
- **Execution history**: admin Test Cases History with `resultId`, Open run / screenshot / log bug actions; backend `executionHistory` API.
- **Backend architecture**: domain service split + Zod validation at route boundary.
- **Automation**: orphan run recovery on startup, artifact retention, SSRF guardrails.
- **CI**: GitHub Actions runs backend tests, frontend build/lint, and Playwright e2e smoke tests on push/PR to `main`/`master`.
- **Tests**: **64** backend tests (unit + integration, `npm run test:ci`; skips live Jira probes) + Playwright e2e smoke (`npm run test:e2e:ci` in `frontendnext/`).

## Repository Layout

- `backend/` - REST API, authentication, test management, automation runner
- `frontendnext/` - active Next.js UI for admin and employee workspaces
- `docker-compose.yml` - local MongoDB container only
- `.github/workflows/ci.yml` - CI pipeline (backend tests + frontend build/lint + e2e smoke)

## Requirements

- Node.js 18+ (CI uses Node 22)
- npm
- Docker and Docker Compose (local MongoDB)

## Quick Start

### 1) Start MongoDB

From the project root:

```bash
docker compose up -d
```

MongoDB runs in Docker on container port `27017` and is exposed to the host on `27018`.

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

Service layer is now split by domain:

- `backend/src/services/projectVersionServices.js` - project + version use cases
- `backend/src/services/issueTypeGroupServices.js` - issue type + test case group use cases
- `backend/src/services/testCaseServices.js` - test case CRUD/import/history use cases
- `backend/src/services/testPlanServices.js` - test plan CRUD/assignment/versioning use cases
- shared helpers in `backend/src/services/shared/` (`versioningCore.js`, `testManagementResolvers.js`)

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

Current unit test files (13):

- `validators.test.js` — Zod schemas and validation middleware
- `auth-security.test.js` — auth cookies, CSRF, error sanitization
- `auth-controller.test.js` — register/login/logout/me flows
- `auth-rate-limit.test.js` — login attempt + register success rate limits
- `audit-log.test.js` — audit log service helpers
- `jwt-auth.test.js` — JWT config, tokenVersion, session revocation
- `automation-url-policy.test.js` — automation URL/upload sandbox policy
- `jira-account.test.js` — Jira vault/profile helpers
- `jira-token.test.js` — Jira QuickCreate token parsing
- `run-automation-partition.test.js` — manual vs automation result partition
- `artifactKeys.test.js`, `localArtifactStorage.test.js` — artifact path helpers
- `jira-create-issue-probe.test.js`, `jira-log-bug-live.test.js` — optional live Jira probes (skipped in CI)

Integration tests (2 files, 6 cases):

- `integration/auth.integration.test.js` — register/login/logout cookies, CSRF guard, duplicate register quota
- `integration/audit-log.integration.test.js` — admin project create → audit entry; employee blocked from audit API

### E2E smoke tests (Playwright)

From `frontendnext/`:

```bash
npm run test:e2e      # local: reuses running servers when not in CI
npm run test:e2e:ci   # CI mode: starts backend e2e server + Next dev automatically
```

Playwright config (`playwright.config.ts`) boots `backend/scripts/e2eServer.js` (in-memory MongoDB + seeded admin) and `npm run dev` with matching CORS/API base URLs.

Specs in `frontendnext/e2e/`:

- `auth.spec.ts` — admin login → dashboard
- `admin-audit-log.spec.ts` — Audit Log tab visible in global scope

Default e2e admin credentials (override with `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`):

- Email: `e2e-admin@test.local`
- Password: `e2e-admin-password-123456`

### CI

On push or pull request to `main` / `master`, GitHub Actions (`.github/workflows/ci.yml`) runs:

1. **Backend** — `npm ci` + `npm run test:ci` in `backend/`
2. **Frontend** — `npm ci` + `npm run build` + `npm run lint:ci` in `frontendnext/`
3. **E2E smoke** — Playwright login + admin audit-log specs (Chromium only)

## Frontend Overview

The UI is a Next.js App Router workspace in `frontendnext/`.

Key points:

- admin and employee workspaces are routed under `/workspace/admin/*` and `/workspace/employee/*`
- the workspace shell is centralized in `AppShell.tsx` with role-specific nav (`adminNav.ts`, employee routes)
- admin screens handle CRUD and planning
- employee screens handle assigned plans, running tests, and execution
- the execution UI persists both `Actual result` and `Notes` for each run item
- admin dashboard adapts to project scope: cross-project overview when **All projects** is selected, project-specific metrics when one project is scoped
- project scope (`tcm_selected_project_id`) persists in `localStorage`; JWT session does not

## Roles

### Admin

- manage projects, versions, groups, test cases, test plans, users, and test runs
- create manual or automation test plans
- assign plan owners and assignees
- view dashboards and execution history

### Employee

- view assigned test plans
- run assigned plans
- execute manual or automation runs that are assigned to them
- view personal running tests and history

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
- **Artifact retention**: failure screenshots under `uploads/runs/` are cleaned up after `ARTIFACT_RETENTION_DAYS` (default 30); dry-run artifacts expire after `DRY_RUN_ARTIFACT_RETENTION_HOURS` (default 24).
- **SSRF guardrails**:
  - `goto` / navigation must stay on the run `baseUrl` origin unless the host is listed in `AUTOMATION_ALLOWED_HOSTS`.
  - Metadata hosts (e.g. `169.254.169.254`) are always blocked.
  - `upload` steps only accept files under `AUTOMATION_UPLOAD_DIR` (default `uploads/test-files/`).

Optional backend env vars:

```env
# AUTOMATION_ALLOWED_HOSTS=localhost,127.0.0.1,rd.cytech.ai,*.cytech.ai
# ARTIFACT_ROOT_DIR=uploads/runs
# AUTOMATION_UPLOAD_DIR=uploads/test-files
# ARTIFACT_RETENTION_DAYS=30
# DRY_RUN_ARTIFACT_RETENTION_HOURS=24
```

Place files for automation `upload` steps inside `backend/uploads/test-files/`.

### Jira bug logging

Failed run items can be logged to Jira from the execution screen.

- the project Jira `pid` comes from the backend `Project` record
- Jira credentials are resolved per authenticated user from the `JiraAccount` collection (`userId` reference) and fall back to the service account stored in `backend/.env`
- the current flow uses Jira's create-issue page instead of a custom REST-only integration
- Jira cookies/session state are cached in the database and refreshed when expired

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
- `/api`

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
- `PATCH /api/test-runs/:runId/end` - admin or employee
- `GET /api/test-runs/:runId/my-items`
- `PATCH /api/test-runs/:runId/results/:resultId`
- `POST /api/test-runs/:runId/automation-results` - automation ingestion endpoint

### Jira

- `POST /api/jira/log-bug`

### Dashboards

- `GET /api/dashboard`
- `GET /api/dashboard/projects`
- `GET /api/dashboard/versions`
- `GET /api/dashboard/test-plans`
- `GET /api/dashboard/test-plans/:testPlanId`

## Notes

- `frontendnext/.next/` is generated by Next.js and should not be committed.
- `frontendnext/node_modules/` is local dependency output and should stay out of source control.

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

```bash
docker compose up -d
docker compose down
docker compose down -v
```

## Troubleshooting

- If MongoDB authentication fails, make sure `authSource=admin` is present in `MONGO_URI`.
- If the backend cannot connect to MongoDB, confirm the Docker container is healthy on port `27018`.
- If automation runs are blocked with a Playwright message, reinstall backend dependencies and make sure Playwright browsers are available.
- If the UI points to the wrong backend, set `NEXT_PUBLIC_API_BASE` in the frontend environment.
- If API errors look too generic during local debugging, comment out `# NODE_ENV=production` in `backend/.env` to see stack traces again.
- If mutating API calls return 403 CSRF errors, ensure the browser sends cookies (`credentials: 'include'`) and that login ran successfully so `tcm_csrf` is set.
- If login/register returns **429 Too Many Requests**, auth rate limits were hit — check the `Retry-After` header or wait for the window to reset. Register limits count only successful account creation; login limits count every attempt.

## Notes

- `frontendnext/` is the active frontend.
- There is no separate legacy `frontend/` app in the current repository.
- `docker-compose.yml` only starts MongoDB; the backend and frontend are started separately.
- Production/security checklist: [REVIEW-2026-06-08.md](REVIEW-2026-06-08.md) is the authoritative review (`REVIEW.md` is an older snapshot).