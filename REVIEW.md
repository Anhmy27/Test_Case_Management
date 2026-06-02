# Senior Code Review — Test Case Management

Author: Senior reviewer
Audience: Original developer (treating this as a fresher submission)
Scope: Backend (`backend/`) + Frontend (`frontendnext/`) + Infra (`docker-compose.yml`)
Repo state reviewed: `main` @ `6a963f1`

This document is structured for someone learning. Each finding follows:

> **What I see → Why it matters → What to do.**

Severity legend:
- 🔴 **Critical** — fix immediately (security, data loss, broken contract)
- 🟠 **High** — fix before next release (correctness, maintainability)
- 🟡 **Medium** — improve when touching the area
- 🟢 **Low** — nice to have / polish
- 💡 **Suggested feature** — not a bug, idea to grow the product

---

## 1. Executive Summary

The project shows good ambition: a full-stack QA workspace with versioned entities, role-based UI, Playwright automation, and Jira integration. The data model is thoughtful (soft-delete + entity versioning is non-trivial).

However, the codebase is held back by:

1. **Real secrets committed to git.** `backend/.env` is tracked and contains real Jira credentials and the default admin password. This is the single most important thing to fix.
2. **One mega-component on the frontend.** `TestCaseManagementApp.tsx` is **2,657 lines** with **86 hook calls** and 14 page routes that all render the same component. State, fetching, routing, and UI live in one file.
3. **Controller / service boundary is blurred.** Both `controllers/testManagementController.js` (1,928 lines) and `services/testManagementService.js` (2,440 lines) call `req`/`res` directly and use `asyncHandler`. The service layer is not really a service — it is a second controller.
4. **Authorization is inconsistent.** Some routes use middleware, the automation-ingest endpoint uses a shared secret implemented manually, and Jira `/assignable-users` is unauthenticated.
5. **No tests, no linter config worth running, no type safety on the backend.** `npm test` prints `"No tests yet"`.

The product can ship internally if you accept the risk, but cleaning items 1–3 above will pay back within a sprint.

---

## 2. 🔴 Critical issues — fix this week

### 2.1 `.env` with real secrets is committed to git

**What I see** (`backend/.env`, tracked by git, `backend/.gitignore` only excludes `node_modules/`):

```env
JIRA_USERNAME=Anhmy
JIRA_PASSWORD=Adieu2709
ADMIN_PASSWORD=12345678
JWT_SECRET=super-secret-change-me
```

**Why it matters**
- Anyone with repo read access gets a live Jira account.
- The default admin seeds on first boot with that password — any production deploy that forgets to override starts with a known admin login.
- `JWT_SECRET` is shared across environments and is the literal string `super-secret-change-me`. If you ever shipped this, every JWT in the wild can be forged.
- Git history keeps the secret even after deletion — `git log --all backend/.env` shows it has been in many commits.

**What to do**
1. **Rotate immediately**: change the Jira password, change the admin password, generate a new random `JWT_SECRET` (e.g., `openssl rand -hex 32`).
2. Add to `backend/.gitignore`:
   ```
   node_modules/
   .env
   .env.*
   !.env.example
   .sessions/
   ```
3. Replace the tracked file with `backend/.env.example` containing **placeholders only**.
4. Purge the old `.env` from history using `git filter-repo` (preferred) or BFG. Force-push and tell collaborators to re-clone. The README's "Quick Start" already documents how to recreate `.env`, so deletion is safe.
5. Make missing critical env vars fatal at boot. Today `JWT_SECRET` silently falls back to `'replace-me-secret'` (see `backend/src/middlewares/authMiddleware.js:6`). That fallback should `throw` in production:
   ```js
   const JWT_SECRET = process.env.JWT_SECRET;
   if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
   ```

### 2.2 Public, unauthenticated Jira proxy

**What I see** (`backend/src/routes/jiraRoutes.js:8`):

```js
router.get('/assignable-users', getAssignableUsers); // before authenticate
```

The handler then calls `searchAssignableUsers({ projectKeys, username, maxResults })`, which performs a real Jira login using the shared service credentials and returns the user list.

**Why it matters**
- Anyone on the internet (CORS is permissive on dev) can hit `/api/jira/assignable-users?projectKeys=ANY&maxResults=1000` and enumerate Jira users through your server.
- The Jira account is shared — quota, audit log, and rate-limit consequences all land on it.
- The "// public route" comment suggests this was intentional. It should not be.

**What to do**
- Move the route **below** `router.use(authenticate)`.
- If the frontend genuinely needs it before login, expose a thin server action that only the trusted frontend can reach (e.g., same-origin only) — but the current screen flow doesn't actually need that. Login first, then load assignees.

### 2.3 Automation results endpoint is mounted before auth, and the secret check has a hole

**What I see** (`backend/src/routes/testManagementRoutes.js:64`):

```js
// Allow automation systems to POST results using a secret header without normal auth
router.post('/test-runs/:runId/automation-results', applyAutomationResults);
router.use(authenticate);
```

And inside `applyAutomationResults` (`controllers/testManagementController.js:961-967`):

```js
const secret = req.headers['x-automation-secret'];
const allowedBySecret = process.env.AUTOMATION_SECRET && secret === process.env.AUTOMATION_SECRET;
const isAdmin = req.user && req.user.role === 'admin';
if (!isAdmin && !allowedBySecret) {
  throw httpError(403, 'Not authorized to submit automation results');
}
```

**Why it matters**
- `req.user` is **never set** here because `authenticate` is mounted after this route. The `isAdmin` branch is dead code.
- If you forget to set `AUTOMATION_SECRET`, the check becomes `'' === undefined` which is `false`, so it would block — that part is OK — but a typo like `secret === process.env.AUTOAMTION_SECRET` (typo) would silently allow everything.
- The endpoint allows ending a run, mutating tester/status, and setting `endedBy`. Spoofable.

**What to do**
- Implement a small middleware so the secret-check is explicit:
  ```js
  function authenticateAutomation(req, res, next) {
    const secret = req.headers['x-automation-secret'];
    if (!process.env.AUTOMATION_SECRET || secret !== process.env.AUTOMATION_SECRET) {
      return next(httpError(401, 'Invalid automation secret'));
    }
    next();
  }
  router.post('/test-runs/:runId/automation-results', authenticateAutomation, applyAutomationResults);
  ```
- Or, better long-term: issue a per-runner API token stored in the DB so you can rotate/revoke without restarting the server.

### 2.4 CORS allows credentials by default and origin is hard-coded

`backend/src/app.js:11-15` sets `origin: process.env.CORS_ORIGIN || 'http://localhost:3000'`. For prod you should:

- Require `CORS_ORIGIN` to be set (no localhost fallback in production).
- Support a comma-separated list and validate against it (today only one origin works).
- Decide explicitly about `credentials: true`. Today you rely on Bearer tokens in localStorage — fine — but document it.

> Storing JWT in `localStorage` (see `app/page.tsx`) is the simplest path but is vulnerable to XSS exfiltration. If you ever inline user-controlled HTML, that token is gone. A safer pattern is httpOnly secure cookies + CSRF token, but it requires backend changes. Track it as a follow-up.

---

## 3. 🟠 High-priority architectural issues

### 3.1 The frontend is one giant component

`frontendnext/components/TestCaseManagementApp.tsx` — **2,657 lines, 86 hook calls**.

**What I see**
- Every page under `app/workspace/admin/*` and `app/workspace/employee/*` renders the same `TestCaseManagementApp` component (verified across 14 `page.tsx` files — all just `return <TestCaseManagementApp />`).
- The component owns every piece of state — projects, versions, groups, test cases, plans, runs, users, dashboard, multiple forms, dialog state, Jira bug dialog, automation form, run timer, refresh controllers — and decides which screen to render by reading the URL via `window.location.pathname`.
- A `RoleWorkspace.tsx` (896 lines) exists and seems intended to be the per-role shell with sub-screens, but `TestCaseManagementApp` is what is actually mounted.
- `refreshAll` re-fetches **eight endpoints in one go on every refresh** (`projects`, `versions`, `groups`, `test-cases`, `test-plans`, `test-runs`, `issue-types`, `dashboard` + `users` for admins). This runs on tab change, project change, and after most mutations.

**Why it matters**
- Re-renders are O(everything-on-screen). Typing in a form causes the dashboard to recompute.
- Code review of any change is painful — the file is too big to reason about.
- Memory leaks: there are five module-level/window-level globals (`__tcm_refreshController`, `__tcm_navigationPending`, `__tcm_initialRefreshToken`, etc.) used to coordinate the refresh logic. They survive HMR and cross-tab in dev.
- Defeats Next.js App Router. With route segments you could fetch only the data a screen needs and stream it. Right now every page bundle is the same monolith.

**What to do** (incremental, no big-bang rewrite required)
1. **Route-driven data fetching**: replace `getWorkspaceRoute(pathname)` with `useParams()` / `usePathname()` from `next/navigation`, and let each page own its data. Start with `/workspace/admin/dashboard/page.tsx` — fetch only `/api/dashboard` there.
2. **Lift shared state into a context** (`WorkspaceContext`) for the few things that genuinely need to be cross-page: current user, selected project. Stop passing 100+ props through `RoleWorkspace`.
3. **One responsibility per screen file**: `workspaceScreens/*.tsx` already exists — make the page files import those screens directly, not the mega-component.
4. **Move forms into their own hooks**: e.g., `useProjectForm`, `useTestCaseForm`. Each hook returns `{ values, setValues, submit, errors }`. The screen renders. The form hook handles state.
5. **Use SWR or TanStack Query** instead of hand-rolled inflight/cache/dedupe in `lib/api.ts`. The current cache is correct on a happy path but has subtle bugs (auth key includes the token but the same logged-in user across tabs gets confused state) and reinvents the wheel.

### 3.2 Controller / service layering is inverted

**What I see**
- `controllers/testManagementController.js` contains `listProjects`, `getDashboard`, `applyAutomationResults`, …
- `services/testManagementService.js` contains `createProject`, `updateProject`, `importTestCases`, … and **also takes `req, res, next`** through `asyncHandler`.

So "service" here is just "another controller". The route file imports half its handlers from one and half from the other:

```js
const { createProject, /* ... */ } = require('../services/testManagementService');
const { listTestRuns, getDashboard, /* ... */ } = require('../controllers/testManagementController');
```

**Why it matters**
- A real service layer should be HTTP-agnostic — pure functions you can unit test and reuse from a CLI, a worker, or another endpoint.
- Today, every business rule is wedded to Express. Want to seed test data via a script? You have to fake `req` and `res`.
- The two files diverge in coding style (`findOne` filter patterns, error messages) because they grew in parallel.

**What to do**
- Define what each layer does and write it once:
  - `models/` — Mongoose schemas only.
  - `services/` — pure business logic. Functions take plain JS objects, return plain JS objects, throw `httpError`.
  - `controllers/` — translate `req` → service args → JSON response.
  - `routes/` — wire controllers, auth, validation middleware.
- Start by moving `createProject` from the service file into the controller file, and extract the actual reusable bit (`async function createProject({ name, code, description, ..., createdBy })`) into `services/`. Repeat across one entity at a time.

### 3.3 Soft-delete and versioning are implemented inline everywhere

**What I see** — this same fragment appears literally **dozens** of times across both backend files:

```js
$and: [
  { $or: [{ entityId: objectId }, { _id: objectId }] },
  { deletedAt: null },
  { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
],
```

It is in `findTestPlanByReference`, `findProjectByReference`, `findVersionByReference`, `findLatestTestCaseByReference`, plus inline in `updateProject`, `listVersions`, `createTestCaseGroup`, `getDashboard`, and so on.

**Why it matters**
- A typo in any one location silently shows deleted records or hides live ones.
- Adding a new "soft-delete-aware" entity means copying the pattern again.
- It is the source of subtle bugs like `query.project = projectDoc._id` (uses `_id`) while the test-case sometimes stores `entityId` (`testCase.project = projectRef = project.entityId || project._id`) — that mismatch is why you see `{ $in: [project._id, project.entityId].filter(Boolean) }` patterns everywhere.

**What to do**
- Promote `utils/versioning.js` to a real repository pattern. Add:
  ```js
  // utils/versioning.js
  const latestActive = () => ({ deletedAt: null, $or: [{ isLatest: true }, { isLatest: { $exists: false } }] });
  const byEntityOrId = (id) => ({ $or: [{ entityId: id }, { _id: id }] });
  Model.findLatest = function(id) {
    return this.findOne({ $and: [byEntityOrId(id), latestActive()] });
  };
  ```
  Then every call site becomes `Project.findLatest(objectId)`.
- Decide **one canonical reference**. Either `project` foreign keys always point at `entityId` or always at `_id`. The `{ $in: [a, b].filter(Boolean) }` hack is a code smell — it means the data is inconsistent and queries have to fish for matches. Run a one-off migration to normalize then enforce on write.

### 3.4 No validation library, no input schemas

Every controller does its own `if (!a || !b) throw httpError(400, ...)`. That works for required-string checks but won't catch:
- arrays of wrong shape
- enums with extra values
- type coercion bugs (compare `executionMode` validation in `updateTestPlan` vs. the form payload that the frontend sends)
- inconsistent body keys — `createProject` accepts both `jiraProductKey` and `Jiraproduckeys` and `JiraProductKey` (line 178) as fallbacks. That belongs in a migration, not in a hot path.

**What to do**
- Adopt **Zod** (or Joi/Yup) on the backend. One `schemas/` module per entity. Wrap handlers with a `validate(schema)` middleware that produces a 400 with field-level errors before the controller runs.
- On the frontend share types via Zod inference. Right now `lib/tcmTypes.ts` partially duplicates the Mongoose schemas and drifts (e.g. `TestCaseRecord` is missing the `automation` and `expected` fields the backend stores).

### 3.5 Error handling leaks stack traces by default

`backend/src/middlewares/errorMiddleware.js:51`:

```js
res.status(statusCode).json({
  message,
  stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
});
```

If `NODE_ENV` is unset (the default on many deploys), this serves stack traces. Make the check `=== 'development'` (allowlist) instead of `!== 'production'` (denylist).

### 3.6 No request logging or structured logs

`console.log` is sprinkled in `jiraService.js` and `jiraController.js`, but most endpoints log nothing. Add `pino-http` or similar so you can correlate a failure to a request id. Drop the ad-hoc `console.log('[Jira] ...')` once that's in.

---

## 4. 🟠 Backend — concrete bugs and risks

### 4.1 `jiraController.js` has two `module.exports`

`backend/src/controllers/jiraController.js`:

```js
// line 86
module.exports = { logBug };
...
// line 90 — declared AFTER the first export
const getAssignableUsers = asyncHandler(...);
...
// line 108
module.exports = { logBug, getAssignableUsers };
```

It currently works only because the file is read top-to-bottom and the second assignment wins. It is fragile and confusing. Move both declarations above a single `module.exports`.

### 4.2 `applyAutomationResults` runs two identical queries

Lines 947 and 952 both do `findTestPlanByReference(testRun.testPlan)`. Result assigned to `parentPlan` then `testPlan`. Use one variable.

### 4.3 Duplicate-key detection runs twice

Every create handler hand-rolls a uniqueness check (`existingProject = await Project.findOne(...)`) and the schema's unique index then triggers the duplicate-key path in `errorMiddleware.js`. Pick one: rely on the index + friendly error mapping (which you already have), and delete the pre-flight checks. They are racy anyway — two concurrent requests can both pass the check then both insert.

### 4.4 `startTestRun` does N sequential round-trips per test case

`controllers/testManagementController.js:842-862` resolves the latest test case **and** group **per item** in a `Promise.all` that nests another `Promise.all`. For a plan with 200 items, you'll do 400 round-trips. Use one `find({ _id: { $in: [...] } })` per collection and join in memory.

### 4.5 `assignTestPlanItems` overwrites the owner with the caller

```js
testPlan.owner = toObjectId(req.user.id, 'ownerId');
```

That means every time an admin re-assigns assignees, the **owner becomes that admin**, regardless of intent. The route doesn't accept an owner param. Either accept `ownerId` in the body or stop overwriting `owner` here.

### 4.6 Hard-coded fallback Jira host

`jiraService.js:8` defaults `JIRA_BASE_URL` to `https://rd.cytech.ai`. That ties this repo to one customer. Make the env var required, document it in README, drop the fallback.

### 4.7 No file-size limit or MIME check on Excel import

`testManagementRoutes.js:62`:

```js
const upload = multer({ storage: multer.memoryStorage() });
```

Memory storage with no limit + admin-only route is still a footgun. A 200 MB Excel will OOM the server. Add `limits: { fileSize: 5 * 1024 * 1024 }` and validate `mimetype`/extension.

### 4.8 Mongoose 9 + Express 5 are bleeding-edge

`backend/package.json` pins `express ^5.2.1` and `mongoose ^9.6.2`. Express 5 changed async error handling (which is fine because of `asyncHandler`) but be aware some middleware in the wild still assumes v4 semantics. Pin exact versions for production and add a lockfile-aware CI.

### 4.9 `deleteProject` hard-deletes; `deleteTestPlan` soft-deletes

`controllers/testManagementController.js:245`: `findByIdAndDelete`.
`services/testManagementService.js:2383`: `softDeleteVersionSeries(...)`.

Pick one semantics for the whole app. Soft-delete is the right choice given the versioning system, and you already added `deletedAt` to the project schema.

### 4.10 `seedAdmin` overwrites silently if `ADMIN_PASSWORD` changes

If an operator updates `ADMIN_PASSWORD` in `.env`, the seed sees the existing user and returns early — but they expected the password to rotate. Log "admin already exists; not modifying" so the operator knows.

---

## 5. 🟠 Frontend — concrete bugs and risks

### 5.1 Initial state reads `localStorage` during render

`app/page.tsx:20` and `TestCaseManagementApp.tsx:179-184`, `185-192`, `205`:

```ts
const [token, setToken] = useState<string>(() => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("tcm_token") || "";
});
```

Lazy initializers are evaluated **once**, but if the server renders one value and the client renders another, React will warn about hydration mismatch. For client components this happens to work because the page is `"use client"` and CSR-only at runtime, but it's still fragile — a future server-component refactor will break silently. Move the read into `useEffect`.

### 5.2 Module-level cache in `lib/api.ts` leaks across users

```ts
const _cache = new Map<string, { ts: number; data: unknown }>();
```

This Map lives for the lifetime of the JS module. In Next dev with fast refresh that's the page; in SSR it's the worker. Two scenarios fail:
- A user logs out, a different user logs in in the same tab: the cache key includes the token so this case is OK.
- A user logs out, no one logs in: the data sits in memory until tab close. Minor.
- The cache TTL is 800 ms; in practice this is a debouncer, not a cache. Either commit to a real cache library (SWR, RQ) or delete the cache and keep just the in-flight dedupe.

### 5.3 `useEffect` deps lie

In multiple places, you depend on `selectedProjectIdRef.current` or `currentUserRef.current` to avoid putting them in the deps array. The `ref` pattern is fine for staleness, but several effects (e.g. the refresh effect at 767-797) only run on `[token, refreshAll]` and recompute role from a function-scoped closure. When `currentUser` changes due to a re-login, the effect won't re-run.

### 5.4 `setRunForm: (updater: any) => void`

`ExecutionScreen.tsx:15`. `any` everywhere is a code smell, and Next's eslint-config-next would catch it if you let it. `npm run lint` runs `eslint` with no args, which in the new flat config emits a warning and does nothing useful. Add a `lint:fix` script and an `eslint.config.mjs` that actually targets `**/*.{ts,tsx}`.

### 5.5 Hand-rolled router navigation via `window.history.pushState`

`TestCaseManagementApp.tsx:354-366`:

```ts
if (window.location.pathname !== nextPath) {
  window.history.pushState({}, "", nextPath);
}
```

Mixing `router.replace` (from `next/navigation`) and direct `pushState` is asking for state to disagree with the URL. Use the router for everything.

### 5.6 Globals on `window` for cross-component coordination

`(window as any).__tcm_refreshController`, `__tcm_navigationPending`, `__tcm_initialRefreshToken`. These are bandaids around the monolith. They become unnecessary as soon as data fetching is route-local (see §3.1).

### 5.7 Vietnamese in UI strings is mixed with English

`page.tsx` greets `Dang nhap` / `Dang ky` (unaccented Vietnamese). Sidebar labels are English. Pick one, or wire `next-intl` and externalize strings — saves you from the inevitable "we need EN+VI" request.

### 5.8 Login screen does no client-side rate limiting / feedback

Spamming login is currently silently allowed. The backend has no rate limiter either (see §6).

---

## 6. 🟡 Cross-cutting gaps (medium priority)

- **No tests at all.** Add Vitest for backend services and Playwright for a smoke flow (login → create project → create test case → start run). Even five tests would catch §4.2, §4.5 today.
- **No rate limiting.** `/api/auth/login` is a brute-force target. Add `express-rate-limit` per IP.
- **No request size limits beyond JSON.** `express.json({ limit: '2mb' })` is good. Add Multer limits (see §4.7). Add a global `helmet()` for sane defaults headers.
- **No password policy.** `userController.js` accepts any non-empty password. README's example admin password is `12345678`.
- **No CI.** Add a GitHub Actions workflow: install, lint, build (`next build`), `node -e "require('./src/app')"` smoke, run tests.
- **No OpenAPI / API docs.** With 40+ endpoints, hand-written docs in README will drift. Generate from Zod schemas.
- **Audit log.** Who deleted which project? Who reassigned a plan? Add an `auditLog` collection — small write per mutation — and surface it in the admin dashboard.
- **No telemetry / error monitoring.** Sentry on both ends would surface §5.x bugs in minutes.
- **Commit messages are meaningless.** Recent history reads `update`, `update`, `update`, `update`, `fix ui`. That's not a habit a senior will tolerate — `git log` is the first place anyone goes when something breaks at 2am, and `update` tells the on-call nothing. Adopt a tiny convention and stick with it:
  - **Subject line:** imperative, ≤ 60 chars, prefixed with the area. Examples:
    - `auth: require JWT_SECRET at boot, drop default`
    - `frontend(execution): persist Notes alongside Actual result`
    - `jira: move /assignable-users behind authenticate`
  - **Body (when non-trivial):** *why* this change, not *what* (the diff already shows what). Reference the ticket / review item, e.g. `Refs REVIEW.md §2.1`.
  - Squash WIP commits before merging. One PR ≈ one logical change ≈ one well-written commit.
  - Optional but recommended: enable a commit-msg hook (commitlint with `@commitlint/config-conventional`) so the format is enforced, not just hoped for.

---

## 7. 🟢 Polish

- Remove the unused `scripts/convert-ids.js` from the repo root once it's done its job (it's a one-shot codemod).
- Replace inline `style={{ display: "flex", gap: "0.5rem" }}` in `app/page.tsx` with Tailwind classes — the rest of the app is on Tailwind 4.
- `frontendnext/components/dashboard/StatusBreakdownDonut.tsx` exists alone in `dashboard/`. Either populate the folder with the other dashboard widgets or move it next to `AdminDashboardScreen`.
- `README.md` has two "## Notes" sections.
- `docker-compose.yml` version `'3.8'` line is deprecated by recent Compose; remove it.
- `frontendnext/CLAUDE.md` is one line (`@AGENTS.md`) — fold its content directly in.

---

## 8. 💡 Suggested features (product-level)

Ranked by ROI for a QA team.

1. **Test execution timeline & gantt per release.** Today the dashboard shows pass/fail counts. A swimlane per assignee × day for a given Version helps PMs see who's blocked. You already have the data (`results.executedAt`, `tester`).
2. **Failure trend / flakiness detection.** You already model `executionHistory: TestStatus[]` in `tcmTypes.ts`. Surface it: a "top 10 flaky tests this release" widget and a `flakeScore = failureCount / runCount` per test case.
3. **Test-case versioning UI.** The backend supports `entityId` + `versionNumber` + `previousVersionId`. Show a "history" tab on the test-case detail screen with a diff between versions. This is your competitive moat vs. Excel.
4. **Bulk reassignment.** Replace per-plan-item assignment with a "rebalance" action that round-robins items across selected assignees, weighted by current workload.
5. **CI-friendly automation results.** Today automation results come in via the `applyAutomationResults` endpoint. Publish a small npm package (`@tcm/reporter`) so a Playwright reporter in any project can post results with one config line.
6. **Telegram notifications.** "Plan FOO assigned to you", "Run X is 80% complete", "Test BAR failed 3 runs in a row". Use a Telegram bot (per-project bot token + chat id, or a single bot with per-user `chatId` stored on `User`). Push messages via a queue (BullMQ + Redis) so the request path stays fast. Start with three events: plan assigned, run completed, automation run failed.
7. **Screenshots and trace attachments for automation runs.** Playwright already captures them — store under `.sessions/` is wrong (sessions are credentials); store under `uploads/runs/<runId>/<resultId>/` with signed URLs, and render the trace inline in the result detail.
8. **CSV/JSON export of test runs.** XLSX import exists. Export is asked for at every QA org.
9. **Search.** A simple "search across test cases, plans, runs" command palette. The data is small enough that a Mongo `$text` index works; later move to Atlas Search.
10. **Per-project Jira config.** Today Jira creds are global env vars. Storing per-project bot tokens would let one server serve multiple Jira projects without sharing one Jira user.
11. **Multi-tenant / org boundary.** If this ever ships externally, `User` needs an `orgId` and every query needs to filter by it. Add it now while the data is small.
12. **Read-only "viewer" role.** Right now it's admin vs. employee. Stakeholders (PMs, managers) want dashboard access without execution rights.
13. **Test data fixtures / generators.** A `npm run seed:dev` that fills the DB with a realistic project (5 plans, 50 test cases, 200 results) so contributors don't need a Jira instance to evaluate UI changes.

---

## 9. Where to start (suggested 2-week plan for a fresher)

**Week 1 — safety net**
- Day 1: Rotate secrets, ignore `.env`, scrub history, fail-fast on missing env. (§2.1, §2.4)
- Day 2: Fix automation-results auth, Jira `/assignable-users` auth. (§2.2, §2.3)
- Day 3: Add `npm test` with Vitest. Write five service tests around `startTestRun`, `updateRunResult`, `applyAutomationResults`, `createTestPlan`, `importTestCases`.
- Day 4: Add `helmet`, `express-rate-limit`, multer limits. (§6)
- Day 5: GitHub Actions: install + lint + test + build.

**Week 2 — start the refactor**
- Day 1: Extract `Model.findLatest()` helper (§3.3). Replace 10 call sites. PR.
- Day 2: Introduce Zod, validate `createProject` and `createTestCase`. (§3.4)
- Day 3: Move `createProject` out of `services/testManagementService.js` into a pure service. Controller becomes 15 lines. (§3.2)
- Day 4: Migrate `/workspace/admin/dashboard/page.tsx` to own its data — remove the mega-component from that one route. (§3.1)
- Day 5: Buffer / review / docs.

Don't try to refactor everything at once. The patterns above, applied to one entity at a time over a few months, turn this into a maintainable codebase without ever stopping the world.

---

## 10. Things you did well

It's important to call these out — none of the above means the project is bad. A fresher who shipped this is well above average.

- **The data model thinks about versioning.** Soft-delete + entity versioning is genuinely hard, and you implemented it consistently enough that we can refactor it without losing data.
- **Roles and route segmentation match the product.** `admin/*` vs `employee/*` paths are a clean separation.
- **The automation runner is well isolated.** `services/auth/` and `services/automation/` are properly split, the action allowlist (`ALLOWED_ACTIONS`) is a great safety reflex, and session reuse via storage state is a thoughtful UX touch.
- **The README is real.** Many fresher projects skip it entirely. Yours documents env vars, endpoints, and supported automation actions.
- **`errorMiddleware` already maps Mongo E11000 errors to friendly 409 messages.** That's the kind of detail seniors usually have to add.
- **Pagination/search helpers in `utils/versioning.js`** (`pickPagination`, `buildSearchMatch`) are reusable and reasonable.

Keep these patterns. Push back on the §2 / §3 items first; the rest is incremental.

---

*End of review.*
