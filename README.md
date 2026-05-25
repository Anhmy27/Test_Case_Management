# Test Case Management System

Test Case Management System is a full-stack test management app with:

- an Express + MongoDB backend
- an active Next.js frontend in `frontendnext/`
- a legacy frontend in `frontend/` kept for reference only
- Playwright-based automation execution for automation test plans

## Repository Layout

- `backend/` - REST API, authentication, test management, automation runner
- `frontendnext/` - active Next.js UI for admin and employee workspaces
- `frontend/` - legacy frontend, not the primary app
- `docker-compose.yml` - local MongoDB container only

## Requirements

- Node.js 18+
- npm
- Docker and Docker Compose

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
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000

ADMIN_NAME=Admin Root
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=12345678
```

Then start the backend:

```bash
cd backend
npm install
npm start
```

### 3) Configure the frontend

The active frontend lives in `frontendnext/`.

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

## Backend Overview

The backend exposes REST endpoints under `/api` and includes:

- JWT authentication
- project, version, group, test case, test plan, and test run management
- admin user seeding on first startup
- Playwright automation execution for automation-mode test plans

The backend starts from [backend/index.js](backend/index.js) and connects to MongoDB before starting Express.

## Frontend Overview

The active UI is a Next.js App Router workspace in `frontendnext/`.

Key points:

- admin and employee workspaces are routed under `/workspace/admin/*` and `/workspace/employee/*`
- the workspace shell is centralized in `TestCaseManagementApp`
- admin screens handle CRUD and planning
- employee screens handle assigned plans, running tests, and execution

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

## Local Storage Keys

The frontend stores a few client-side keys in `localStorage`:

- `tcm_token` - JWT token
- `tcm_selected_project_id` - selected project scope

## API Highlights

The backend mounts routes as:

- `/api/auth`
- `/api/users`
- `/api`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

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
- `GET /api/test-cases/detail`
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
```

### Frontend

```bash
cd frontendnext
npm install
npm run dev
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

## Notes

- `frontendnext/` is the active frontend. The `frontend/` folder is legacy.
- `docker-compose.yml` only starts MongoDB; the backend and frontend are started separately.