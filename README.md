# Test Case Management System (TCM)

A concise guide to run the TCM app locally (backend + frontend) and the bundled MongoDB from Docker Compose.

**Quick summary**
- Backend: runs on port `5000` (http://localhost:5000)
- Frontend (primary): `frontendnext` runs on port `3000` (http://localhost:3000)
- Legacy frontend: a `frontend/` folder remains for reference but `frontendnext/` is the active codebase.
- MongoDB (via Docker Compose): container listens on `27017`, exposed to host as `27018` (`27018:27017`)

## Prerequisites
- Node.js 18+ and npm
- Docker & Docker Compose (optional but recommended for MongoDB)

## Starter (recommended)
1. From project root, start MongoDB with Docker Compose:

```bash
docker compose up -d
```

2. Start backend:

```bash
cd backend
npm install
# copy or create a .env file (see example below)
npm start
```

3. Start frontend (recommended: `frontendnext`):

```bash
cd frontendnext
npm install
npm run dev
```

Notes:
- The repository contains two frontend folders: `frontend/` (legacy) and `frontendnext/` (active). Use `frontendnext` for development.
- Open the app at http://localhost:3000 after the frontend starts.

## Important MongoDB connection notes
- The compose service maps host port `27018` to container port `27017` (`27018:27017`).
- Inside the Docker network the MongoDB server listens on `27017` and is reachable by the service name `mongodb`.
- The admin/root user is created in the `admin` database by the image init scripts. When connecting with credentials, you must specify the authentication database (authSource).

Examples for `MONGO_URI` in backend/.env:
- From host (app running on host, connecting to Docker-exposed port):
  mongodb://admin:admin123@localhost:27018/Test_Case_Management?authSource=admin
- From inside Docker (when the app runs as another service in same compose):
  mongodb://admin:admin123@mongodb:27017/Test_Case_Management?authSource=admin

If you omit `?authSource=admin`, the driver will try to authenticate against the `Test_Case_Management` database and authentication will fail.

## Example backend `.env` (backend/.env)

MONGO_URI=mongodb://admin:admin123@localhost:27018/Test_Case_Management?authSource=admin
PORT=5000
JWT_SECRET=super-secret-change-me
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000

# Optional admin seeding (used by seedAdmin.js on first run)
ADMIN_NAME=Admin Root
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=12345678

## Start backend

```bash
cd backend
npm install
npm start
```

The backend will log a successful MongoDB connection and start the Express server (port 5000 by default).

## Start frontend

Recommended (active frontend):

```bash
cd frontendnext
npm install
npm run dev
```

Legacy frontend (for reference only):

```bash
cd frontend
npm install
npm run dev
```

## Docker compose healthcheck detail
The `healthcheck` for the MongoDB service runs inside the container, so it must target `localhost:27017` (container port). The host mapping `27018` is irrelevant to the healthcheck because that mapping exists on the host side only.

## Useful Docker commands
- Start services: `docker compose up -d`
- Stop: `docker compose down`
- Remove volumes/data: `docker compose down -v`
- View logs: `docker compose logs -f mongodb`

## API (high level)
The backend exposes REST endpoints under `/api`. Key endpoints include:
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Projects: `GET /api/projects`, `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`
- Test cases: `GET /api/test-cases`, `POST /api/test-cases`, `GET /api/test-cases/:id`
- Test plans & runs: `GET /api/test-plans`, `POST /api/test-plans`, `POST /api/test-runs`

## Troubleshooting
- "Authentication failed" when connecting to MongoDB: ensure `authSource=admin` is present and Docker compose is running.
- Backend can't reach Mongo: confirm `docker compose up` and `docker compose ps` show the mongodb service healthy.
- Seeded admin not created: verify `ADMIN_*` vars in backend/.env and check server logs on startup.

If you'd like, I can also update `backend/.env.example` and add a short `CONTRIBUTING.md` with quick run steps.
- `POST /api/users` - Create new user (admin only)

## User Roles

### Admin
- Full access to all features
- Can manage projects, test cases, users, and all test plans
- Views portfolio-wide dashboards and analytics

### Employee
- Can view and execute assigned test plans
- Can view project-specific dashboards when scoped
- Cannot create or delete projects/test cases
- Limited to personal test run history

## Token & Client State

Authentication uses JWT tokens stored in `localStorage` and the app stores a few client keys to preserve UI state across reloads:
- **Token Key**: `tcm_token`
- **Selected project Key**: `tcm_selected_project_id` (the currently scoped project id; used to restore project scope after reload)
- **Token Storage**: Browser's `localStorage`
- **Token Verification**: Tokens are verified on app load and API requests
- **Auto-logout**: Token expiration triggers automatic redirect to login

## Development Notes

### Code Standards
- Frontend: TypeScript with strict null checks (primarily in `frontendnext`)
- Backend: JavaScript with JSDoc comments
- Styling: CSS with BEM naming convention
- Components: Functional React components with hooks

### Common Tasks

**Clear User Session:**
```javascript
localStorage.removeItem('tcm_token');
// Then refresh the page or navigate to login
```

**Import Test Cases Template:**
- Use the "Download Template" button in Test Cases tab
- Fill in the XLSX file with test case data
- Use "Import Test Cases" to bulk upload

## Troubleshooting

### "Connection Refused" on API calls
- Ensure backend is running on `http://localhost:5000`
- Check `NEXT_PUBLIC_API_BASE` environment variable in frontend

### "User is not available" error
- Token may be expired; log out and log in again
- Check backend logs for authentication issues

### MongoDB Connection Error
- Verify MongoDB is running
- Check `MONGO_URI` in backend `.env` file
- Ensure correct connection string format

### Frontend not loading
- Clear browser cache (Ctrl+Shift+Delete)
- Delete `.next` folder and `npm run dev` again
- Check console for TypeScript errors

### Dev-mode RSC / HMR issues
In development (Next/Turbopack HMR) you may see frequent server requests and occasional RSC payload fetch failures. If you observe navigation/fallback loops during rapid UI changes, try:

- Run a production build to verify behavior without HMR:

```bash
cd frontendnext
npm run build
npm start
```

- The app includes mitigations to reduce duplicate API requests, but dev-mode churn can still produce noisy logs.

### Developer tips & debugging hooks
- The frontend now exposes a short list of helpful globals for debugging in the browser console:
   - `window.__tcm_refreshController` — the current `AbortController` used by the global refresh flow; calling `window.__tcm_refreshController?.abort()` cancels an in-flight refresh.
   - `localStorage` keys: `tcm_token`, `tcm_selected_project_id`.

- Tab navigation inside the app is handled client-side (history.pushState) to avoid unnecessary server navigations that used to cause remount loops.

- Debug Playwright scripts were removed from the repo; Playwright dependency remains in `devDependencies` for test/automation usage.

## Support

For issues or questions, contact your development team or refer to project documentation.

---

**Version**: 1.0.1  
**Last Updated**: May 22, 2026
