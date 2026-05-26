# frontendnext

This is the active frontend for the Test Case Management System.

For the full project guide, backend setup, MongoDB, automation notes, and Jira logging details, see the root [README.md](../README.md).

Quick start:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` after the dev server starts.

The app uses the App Router workspace under `/workspace/admin/*` and `/workspace/employee/*`, with the shared shell in `TestCaseManagementApp`.

Execution notes:

- `Actual result` and `Notes` are persisted per run item
- failed items can be logged to Jira through the backend proxy
- the Jira modal still has some manual fields until Jira metadata lookup endpoints are wired in