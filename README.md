# Test Case Management System (TCM)

A comprehensive web-based test case management platform designed to streamline QA processes, manage test cases, organize test plans, and track test execution across multiple projects.

## Overview

TCM is a full-stack application that enables QA teams and administrators to:
- Organize test cases into projects, groups, and versions
- Create and manage test plans with manual/automation execution modes
- Track test runs and execution status in real-time
- Generate dashboards with project health metrics and progress tracking
- Manage user roles (Admin and Employee) with role-based access control

## Features

### Core Features
- **Project Management**: Create and organize projects with multiple versions
- **Test Case Organization**: Structure test cases into groups with detailed steps and expected results
- **Test Planning**: Compose test plans from test case groups, assign to testers
- **Test Execution**: Support for manual and automation test runs with result tracking
- **Dashboard & Analytics**: 
  - Admin dashboard with portfolio overview and project health metrics
  - Project-specific dashboards with pass/fail rates and progress tracking
  - Active runs monitoring with tester activity
- **User Management**: Role-based access control (Admin/Employee)
- **Search & Filter**: Global search across projects, test cases, runs, and users

### Admin Features
- Manage projects, versions, test case groups, and test cases
- Create and assign test plans to users
- Monitor all test runs and execution progress
- User account management

### Employee Features
- View assigned test plans
- Execute manual test runs
- Track personal test history
- View project-specific dashboards when scoped

## Tech Stack

### Frontend
- **Next.js** 15.x with App Router
- **React** 19.x with TypeScript
- **CSS** (custom styling with workspace theme)
- **Libraries**: XLSX for template import/export, Fetch API for HTTP requests

### Backend
- **Node.js** with Express.js
- **MongoDB** for data persistence
- **JWT** for authentication
- **Middleware**: Error handling, authentication, CORS support

### Development Environment
- Node.js 18+
- npm 9+
- MongoDB (local or remote)

## Project Structure

```
Test_Case_Management/
├── backend/                          # Express.js API server
│   ├── src/
│   │   ├── app.js                   # Express app setup
│   │   ├── seedAdmin.js             # Initial admin user seeding
│   │   ├── config/db.js             # MongoDB connection
│   │   ├── controllers/             # Business logic
│   │   ├── models/                  # MongoDB schemas
│   │   ├── routes/                  # API endpoints
│   │   ├── middlewares/             # Auth, error handling
│   │   └── utils/                   # Helper functions
│   ├── package.json
│   └── index.js                     # Server entry point
│
├── frontend/                         # Next.js client application
│   ├── app/
│   │   ├── page.tsx                 # Login/Register (root)
│   │   ├── Home/page.tsx            # Main app shell
│   │   └── layout.tsx               # Global layout
│   ├── components/
│   │   ├── TestCaseManagementApp.tsx # Main app component
│   │   ├── RoleWorkspace.tsx        # Workspace UI & tabs
│   │   ├── dashboard/               # Dashboard components
│   │   └── execution/               # Test execution panels
│   ├── lib/
│   │   ├── api.ts                   # API client utilities
│   │   └── tcmTypes.ts              # TypeScript types
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
│
└── README.md                         # This file
```

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm 9+
- Docker and Docker Compose (for MongoDB setup) OR MongoDB (local instance)

### MongoDB Setup (Using Docker)

The project includes a `docker-compose.yml` for easy MongoDB setup.

1. Ensure Docker and Docker Compose are installed
2. From the project root directory, start MongoDB:
   ```bash
   docker-compose up -d
   ```

3. MongoDB will be available at `mongodb://admin:admin123@localhost:27017/`

To stop MongoDB:
```bash
docker-compose down
```

To remove all data and volumes:
```bash
docker-compose down -v
```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `backend/` directory:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/test-case-management
   JWT_SECRET=your-secret-key-here
   NODE_ENV=development
   ```

4. Create a `.env` file in the `backend/` directory:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/test-case-management
   JWT_SECRET=your-secret-key-here
   NODE_ENV=development
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=admin123
   ```

5. Start the backend server:
   ```bash
   npm start
   ```
   The API will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the `frontend/` directory:
   ```
   NEXT_PUBLIC_API_BASE=http://localhost:5000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open your browser and navigate to `http://localhost:3000`

### Login
- **Admin Account**: Use the credentials set in `backend/.env` via `ADMIN_EMAIL` and `ADMIN_PASSWORD`
  - Example: `admin@example.com` / `admin123`
- **Employee Account**: Can be created by admin from the Users tab

## Key Workflows

### 1. Creating a Project & Test Cases
1. Login as Admin
2. Navigate to Projects tab
3. Create a new project
4. Create versions under the project
5. Create test case groups
6. Add test cases to groups with steps and expected results

### 2. Planning & Executing Tests
1. Create a test plan from Test Plans tab
2. Select project, version, and test case groups
3. Choose execution mode (Manual/Automation)
4. Assign testers to the plan
5. Testers execute tests from their "Running Tests" tab
6. Results are tracked in test runs

### 3. Monitoring Progress
1. Admin views Dashboard for portfolio overview
2. Select a project to see project-specific metrics
3. Monitor active runs in real-time
4. View project health with pass/fail rates

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (requires token)

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Test Cases
- `GET /api/test-cases` - List test cases
- `POST /api/test-cases` - Create test case
- `PUT /api/test-cases/:id` - Update test case
- `DELETE /api/test-cases/:id` - Delete test case

### Test Plans & Runs
- `GET /api/test-plans` - List test plans
- `POST /api/test-plans` - Create test plan
- `GET /api/test-runs` - List test runs
- `POST /api/test-runs` - Start test run
- `PUT /api/test-runs/:id` - Update run results
- `PUT /api/test-runs/:id/end` - End test run

### Dashboard
- `GET /api/dashboard` - Get dashboard metrics and data

### Users
- `GET /api/users` - List all users (admin only)
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

## Token Management

Authentication uses JWT tokens stored in `localStorage`:
- **Token Key**: `tcm_token`
- **Token Storage**: Browser's `localStorage`
- **Token Verification**: Tokens are verified on app load and API requests
- **Auto-logout**: Token expiration triggers automatic redirect to login

## Development Notes

### Code Standards
- Frontend: TypeScript with strict null checks
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
- Check `MONGODB_URI` in backend `.env` file
- Ensure correct connection string format

### Frontend not loading
- Clear browser cache (Ctrl+Shift+Delete)
- Delete `.next` folder and `npm run dev` again
- Check console for TypeScript errors

## Support

For issues or questions, contact your development team or refer to project documentation.

---

**Version**: 1.0.0  
**Last Updated**: May 2026
