# Task Board - Agile Issue Tracker (COP290)

A comprehensive, full-stack project management and issue-tracking application inspired by industry-standard tools like Jira. This platform enables agile teams to plan, track, and manage collaborative workflows with strict Role-Based Access Control (RBAC) and automated Agile metrics.

---

## 🚀 Tech Stack

**Frontend:** React, Vite, TypeScript, Context API, CSS Modules
**Backend:** Node.js, Express.js, TypeScript
**Database:** PostgreSQL, Prisma ORM
**Security & Auth:** JSON Web Tokens (JWT), bcrypt

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) (Running locally or via a cloud provider like Supabase/Neon)
- Git

---

## 🛠️ Local Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/ARK-LEGION/cop290-assignment2.git
cd cop290-assignment2
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a .env file in the backend directory and configure your environment variables:

```bash
# backend/.env
PORT=5000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
JWT_SECRET="your_super_secret_jwt_key"
```

Initialize the database schema and generate the Prisma Client:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Start the backend development server

```bash
npm run dev
```

### 3. Frontend Setup

Open a new terminal window, navigate to the frontend directory, and install dependencies:

```bash
cd frontend
npm install
```

Create a .env file in the frontend directory

```bash
# frontend/.env
VITE_API_BASE_URL="http://localhost:5000/api"
```

Start the vitre development server

```bash
npm run dev
```

### 4. Default Global Admin Setup

By design, the first GLOBAL_ADMIN must be assigned directly via the database to establish the root hierarchy.

1. Register a new user account via the frontend UI.

2. Open Prisma Studio to access the database visually:

```bash
cd backend
npx prisma studio
```

3. Locate your newly created user in the User table and toggle the isGLOBAL_ADMIN boolean to true.

4. Log back into the application. You now have global privileges to create projects and assign roles to other users.

### 5. API DOCUMENTATION

### 🔐 Authentication Endpoints

The authentication system utilizes a dual-token strategy. Short-lived Access Tokens (JWT) are securely stored in HTTP-Only cookies, while long-lived Refresh Tokens are stored in the database to allow seamless session renewals and secure logouts.

_All authentication routes are prefixed with `/api/auth`._

| Method | Endpoint    | Description                                                                                                               | Request Body                                                                             | Success Response (200/201)                                                                                                                     |
| :----- | :---------- | :------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/register` | Creates a new user account with a bcrypt-hashed password.                                                                 | `{ "name": "John Doe", "email": "john@email.com", "user_password": "mySecurePassword" }` | `{ "message": "User registered successfully", "userId": "uuid-..." }`                                                                          |
| `POST` | `/login`    | Authenticates user credentials. Sets an HTTP-Only cookie with a 15-minute Access Token and returns a 7-day Refresh Token. | `{ "email": "john@email.com", "user_password": "mySecurePassword" }`                     | `{ "message": "Login successful", "refreshToken": "jwt...", "user": { "id": "...", "name": "...", "email": "...", "isGLOBAL_ADMIN": false } }` |
| `POST` | `/refresh`  | Validates the provided Refresh Token against the database and issues a new 15-minute HTTP-Only Access Token cookie.       | `{ "refreshToken": "jwt..." }`                                                           | `{ "message": "Token refreshed successfully" }`                                                                                                |
| `POST` | `/logout`   | Destroys the user session by deleting the Refresh Token from the database and clearing the HTTP-Only cookie.              | `{ "refreshToken": "jwt..." }`                                                           | `{ "message": "Logged out successfully" }`                                                                                                     |

**Security Note:** Because Access Tokens are delivered via HTTP-Only cookies, frontend clients do not need to manually attach the token to the `Authorization` header. The browser will automatically include the cookie in subsequent API requests (ensure `withCredentials: true` is set in your Axios/Fetch configuration).

### 📁 Project Endpoints

All project routes enforce strict Role-Based Access Control (RBAC). Access is denied (`403 Forbidden`) if the user does not meet the required hierarchy tier.
_All routes below are prefixed with `/api/projects` and require a valid JWT Access Token._

| Method   | Endpoint                | Description                                                                              | Access Level      | Request Body                                              |
| :------- | :---------------------- | :--------------------------------------------------------------------------------------- | :---------------- | :-------------------------------------------------------- |
| `GET`    | `/`                     | Fetches all projects. (Global Admins see all; regular users only see assigned projects). | `AUTHENTICATED`   | None                                                      |
| `POST`   | `/`                     | Creates a new project and automatically assigns the creator as the `PROJECT_ADMIN`.      | `GLOBAL_ADMIN`    | `{ "name": "Project X", "description": "..." }`           |
| `GET`    | `/:projectId`           | Fetches specific project details and its associated Kanban boards.                       | `PROJECT_VIEWER+` | None                                                      |
| `PATCH`  | `/:projectId`           | Updates project name or description and broadcasts notifications to the team.            | `PROJECT_ADMIN+`  | `{ "name": "New Name" }`                                  |
| `DELETE` | `/:projectId`           | Permanently deletes the project and cascades deletion to boards and tasks.               | `PROJECT_ADMIN+`  | None                                                      |
| `POST`   | `/:projectId/assign`    | Assigns a new user to the project or updates an existing user's role.                    | `PROJECT_ADMIN+`  | `{ "targetUserId": "uuid...", "role": "PROJECT_MEMBER" }` |
| `GET`    | `/:projectId/members`   | Retrieves a list of all users and their respective roles in the project.                 | `AUTHENTICATED`   | None                                                      |
| `PATCH`  | `/:projectId/archive`   | Archives the project, hiding it from default views.                                      | `GLOBAL_ADMIN`    | None                                                      |
| `PATCH`  | `/:projectId/unarchive` | Restores an archived project.                                                            | `GLOBAL_ADMIN`    | None                                                      |
| `PATCH`  | `/:projectId/workflow`  | Updates the custom Kanban workflow definitions (allowed status transitions).             | `PROJECT_ADMIN+`  | `{ "workflow": { ...jsonMap } }`                          |

### 🛠️ Task and Issue Management Endpoints

The Task endpoints manage the core lifecycle of work items (Tasks and Bugs). These routes implement sophisticated business logic, including automated parent-child status synchronization and a rigid state-machine to enforce valid workflow transitions.

_All routes below require a valid JWT Access Token._

| Method   | Endpoint (Prefix: /api/tasks) | RBAC & Description                                                                                                                                                       |
| :------- | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/:taskId`                    | **[PROJECT VIEWER+]** Retrieves full task metadata, including nested comments, assignee/reporter details, and a complete audit trail.                                    |
| `POST`   | `/column/:colId`              | **[PROJECT MEMBER+]** Creates a new task. The backend automatically calculates the next `order` index and verifies the column's `wipLimit` before persisting.            |
| `PATCH`  | `/:taskId`                    | **[CONTEXTUAL]** Updates task attributes. Admins can edit all fields; Assignees or Members (for unassigned tasks) are restricted to status/column transitions.           |
| `PATCH`  | `/reorder`                    | **[PROJECT MEMBER+]** Handles bulk Kanban movements. Processes an array of updates in a single `Prisma.transaction` to ensure atomicity during drag-and-drop operations. |
| `DELETE` | `/:taskId`                    | **[PROJECT MEMBER+]** Permanently removes an issue. Triggers a `syncStoryStatus` check if the deleted item was a subtask of a Story.                                     |
| `POST`   | `/:taskId/comments`           | **[PROJECT VIEWER+]** Appends a discussion comment to the task, supporting rich-text and user mentions.                                                                  |

### 📋 Board Endpoints

Boards act as the primary Kanban interface within a Project. All routes enforce RBAC checks against the parent Project to ensure users cannot view or mutate boards they don't have access to.

_All routes below are prefixed with `/api/boards` (or your configured mount path) and require a valid JWT Access Token._

| Method   | Endpoint              | Description                                                                                           | Access Level      | Request Body                       |
| :------- | :-------------------- | :---------------------------------------------------------------------------------------------------- | :---------------- | :--------------------------------- |
| `GET`    | `/:boardId`           | Fetches a board, eagerly loading all nested columns and tasks (sorted in ascending positional order). | `PROJECT_VIEWER+` | None                               |
| `POST`   | `/project/:projectId` | Creates a new Kanban board within the specified project.                                              | `PROJECT_ADMIN+`  | `{ "name": "Sprint 1 Board" }`     |
| `PUT`    | `/:boardId`           | Updates the name of an existing board.                                                                | `PROJECT_ADMIN+`  | `{ "name": "Updated Board Name" }` |
| `DELETE` | `/:boardId`           | Permanently deletes the board and cascades deletion to all contained columns and tasks.               | `PROJECT_ADMIN+`  | None                               |

### 💬 Task Comments & Collaboration Endpoints

The Collaboration endpoints power the discussion threads within individual tasks. To verify permissions, the backend utilizes a recursive hierarchy-climbing algorithm to trace any subtask, bug, or story back to its root `projectId`. All comment mutations are securely wrapped in Prisma transactions to ensure the `AuditLog` is perfectly synchronized with the discussion history.

_All routes below are prefixed with `/api/comments` and require a valid JWT Access Token._

| Method   | Endpoint        | Description                                                                                                                                                            | Access Level      | Request Body                                                    |
| :------- | :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- | :-------------------------------------------------------------- |
| `POST`   | `/task/:taskId` | Appends a new comment to a task thread. Automatically parses `@[name](email)` markdown for user mentions and dispatches targeted notifications.                        | `PROJECT_MEMBER+` | `{ "content": "Checking in on this @[John](john@email.com)!" }` |
| `PUT`    | `/:commentId`   | Updates an existing comment's text. Strict ownership validation ensures only the original author can edit it. Both original and edited content are logged.             | `AUTHOR ONLY`     | `{ "content": "Updated comment text" }`                         |
| `DELETE` | `/:commentId`   | Permanently removes a comment. Project Admins have overarching moderation privileges to delete any comment. The deleted text is preserved in the read-only `AuditLog`. | `AUTHOR / ADMIN`  | None                                                            |

### 👤 User Identity and Profile Endpoints

The User endpoints handle personal profile customization and directory queries. A key feature is the custom Base64 image decoding logic, which natively parses, extracts, and writes uploaded avatar images directly to the server's local filesystem, eliminating the need for external storage dependencies.

_All routes below are prefixed with `/api/users` and require a valid JWT Access Token._

| Method  | Endpoint    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                         | Access Level    |
| :------ | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------- |
| `GET`   | `/profile`  | Retrieves the authenticated user's profile metadata, including their Global Admin status and avatar link.                                                                                                                                                                                                                                                                                                                                           | `AUTHENTICATED` |
| `PATCH` | `/profile`  | Updates the user's name, email, or profile picture. Base64 image payloads are intercepted, written to the `/uploads/avatars` directory, and the resulting file path is saved to the database.                                                                                                                                                                                                                                                       | `AUTHENTICATED` |
| `PATCH` | `/password` | Allows users to securely change their password. Requires the current password for verification against the `bcrypt` hash before accepting the new one.                                                                                                                                                                                                                                                                                              | `AUTHENTICATED` |
| `GET`   | `/`         | A highly dynamic endpoint for querying the user directory based on URL parameters:<br><ul><li>`?projectId=...`: Returns only users assigned to that specific project (Requires Viewer status).</li><li>`?notInProject=...`: Returns users _not_ currently in the project, used for populating the "Add Member" dropdown (Requires Admin status).</li><li>**Default:** Returns the entire system directory (Requires Global Admin status).</li></ul> | `CONTEXTUAL`    |

### 🔔 System Tracking & Notification Endpoints

To maintain a rigorous Agile audit trail and keep team members informed of critical workflow updates, the platform implements an automated event-tracking architecture.

A key security feature of this system is that **Audit Logs are strictly read-only**. There are no `POST`, `PUT`, or `DELETE` endpoints exposed for audit logs; they are exclusively system-generated ("Ghost Audits") within secure Prisma transactions whenever a task is modified, ensuring absolute traceability and preventing malicious history tampering.

_All routes below are prefixed with `/api/notifications` and require a valid JWT Access Token._

| Method   | Endpoint                | RBAC & Description                                                                                                                              |
| :------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/`                     | **[AUTHENTICATED]** Retrieves the authenticated user's chronological notification feed (e.g., role assignments, task mentions, status updates). |
| `PATCH`  | `/:notificationId/read` | **[AUTHENTICATED]** Marks a specific notification as read, updating the UI's unread bell counter.                                               |
| `PATCH`  | `/read-all`             | **[AUTHENTICATED]** A bulk-update utility endpoint that marks all of the user's pending notifications as read in a single query.                |
| `DELETE` | `/:notificationId`      | **[AUTHENTICATED]** Allows users to permanently clear a specific alert from their historical inbox.                                             |

#### Implicit Audit Log Retrieval

Rather than exposing a standalone endpoint for audit logs, the historical timeline of an issue is deeply integrated into the Task fetching logic. When a user queries `GET /api/tasks/:taskId`, the backend eagerly loads the nested `auditLogs` array, sorted by `timestamp: 'desc'`. This allows the frontend React application to immediately render a chronological "Activity History" timeline alongside the task details, directly associating each state transition with the `User` who triggered it.

### 📋 Kanban Column Configuration Endpoints

The Column endpoints allow Project Admins to fully customize their board's workflow. To bridge the gap between user-defined column names (e.g., "QA Testing") and backend state management, the system strictly maps every dynamic column to a core internal state enum (`cStatus`).

_All routes below are prefixed with `/api/columns` and require a valid JWT Access Token._

| Method   | Endpoint          | Description                                                                                                                                                                | Access Level     |
| :------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| `POST`   | `/board/:boardId` | Creates a new workflow column. The backend automatically calculates its visual `order` index to append it to the right-most edge of the board.                             | `PROJECT_ADMIN+` |
| `PATCH`  | `/:colId`         | Partially updates column attributes, allowing Admins to rename phases or enforce/modify Work-In-Progress (`wipLimit`) constraints.                                         | `PROJECT_ADMIN+` |
| `PATCH`  | `/reorder`        | Handles horizontal drag-and-drop column movements. Takes an array of new order indices and applies them concurrently within a strict `Prisma.$transaction`.                | `PROJECT_ADMIN+` |
| `DELETE` | `/:colId`         | Deletes a column. **Safety Constraint:** The backend explicitly counts nested tasks and rejects the request (`400`) if the column is not empty, preventing orphaned tasks. | `PROJECT_ADMIN+` |

### 📖 Story Management Endpoints

Stories act as top-level Agile containers for standard tasks and bugs. These endpoints are nested under a specific project to automatically link the story directly to the project's backlog.

*All routes below are prefixed with `/api/projects/:projectId/stories` and require a valid JWT Access Token.*

| Method | Endpoint | Description | Access Level | Request Body |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Creates a new Story linked directly to the project backlog. Automatically enforces the `STORY` type, sets the initial status to `TO_DO`, and anchors it to the `projectId`. | `PROJECT_MEMBER+` | `{ "title": "Implement Auth", "description": "..." }` |
| `GET` | `/` | Retrieves all stories for a specific project, ordered by newest first. Eagerly loads all nested child subtasks. | `PROJECT_VIEWER+` | None |
| `DELETE` | `/:storyId` | Deletes a Story. Executes a transaction to safely unlink all child subtasks (setting `parentId` to `null`), converting them into standalone Kanban tasks to prevent accidental data loss. | `PROJECT_MEMBER+` | None |


## 🧪 Backend Testing Architecture

This project features a robust, isolated, production-grade test suite boasting **111 passing tests across 14 suites**. The architecture leverages **Vitest** for extreme execution speed, **Supertest** for in-memory API simulation, and **Vitest-Mock-Extended** for deep-mocking the Prisma database to ensure the real database is never accidentally modified during tests.

### 🛠 Installation & Tech Stack
To run or contribute to the test suite, ensure the following development dependencies are installed:

\`\`\`bash
npm install -D vitest supertest @types/supertest vitest-mock-extended
\`\`\`

### 🚀 Running the Tests
The test environment is natively configured in `package.json`. Use the following commands:

* **Run all tests once:** `npm run test`
* **Run tests in watch mode (auto-reloads on file save):** `npm run test:watch`

### 🧩 Unit Tests (Pure Logic)
Unit tests isolate single functions or pure logic without spinning up the Express server or touching HTTP protocols.

* **`workflow.test.ts`**: Mathematically verifies the Finite State Machine (FSM) default transitions (e.g., preventing illegal jumps from `DONE` to `TO_DO`).
* **`mention.test.ts`**: Validates the Regex parser for `@[name](email)` to ensure accurate email extraction for notifications, even with user syntax errors.
* **`taskLogic.test.ts`**: Tests the `syncStoryStatus` helper to verify that a parent Story correctly calculates its status based on its child subtasks.

### 🌐 Integration Tests (API + Middleware + Controllers)
Integration tests use Supertest to send virtual HTTP requests through the auth middleware, RBAC controllers, and into the mocked Prisma database.

* **`task.test.ts` (21 tests)**: Verifies task creation, strict Column WIP limits, drag-and-drop reordering array logic, and combined Audit Log/Notification `$transaction` generations.
* **`project.test.ts` (17 tests)**: Checks Global Admin creation rights, RBAC role assignments, and archiving workflows.
* **`board.test.ts` (12 tests)**: Ensures project-board linking and validates `403 Forbidden` responses for unauthorized access attempts.
* **`story.test.ts` (10 tests)**: Tests deep-fetching of nested subtasks and verifies that deleting a story safely orphans (detaches) its subtasks rather than destroying them.
* **`user.test.ts` (10 tests)**: Validates profile updates, Base64 image interception, native file-system avatar creation, and bcrypt password hashing.
* **`comment.test.ts` (9 tests)**: Verifies mention parsing, `USER_MENTIONED` notification dispatching, and strict deletion access control for authors/admins.
* **`auth.test.ts` (9 tests)**: Simulates the JWT lifecycle, including registration, `httpOnly` cookie injection, refresh token renewal, and secure session destruction.
* **`column.test.ts` (8 tests)**: Validates column creation, bulk array updates for reordering, and deletion-blocking for columns containing active tasks.
* **`notification.test.ts` (5 tests)**: Ensures data isolation so users only fetch their own notifications and tests the bulk `read-all` endpoint.
* **`error.test.ts` (2 tests)**: Triggers deliberate database failures (e.g., Prisma `P2025` Record Not Found) to verify the global error handler returns clean `404`s instead of crashing the server.
* **`security.test.ts` (2 tests)**: Probes the `checkAccess` utility to mathematically enforce the Admin > Member > Viewer hierarchy across endpoints.


## 🎨 Frontend Architecture & UI/UX

The frontend is a highly interactive, Single Page Application (SPA) designed with a premium, dark-mode-first SaaS aesthetic. Built for speed and productivity, it utilizes strict TypeScript and isolated CSS Modules to deliver a seamless, Jira-like project management experience without heavy UI libraries.

### 🛠 Tech Stack
* **Framework:** React 18 + TypeScript + Vite (Ultra-fast HMR)
* **Styling:** Pure CSS Modules (Zero-dependency, locally scoped, custom CSS variables for themeing)
* **Routing:** React Router DOM

### ✨ Key Features & Capabilities

* **Interactive Kanban Workspace:** * Native HTML5 Drag-and-Drop API implementation for moving tasks across custom columns.
  * Real-time UI updates and visual enforcement of Column WIP (Work In Progress) limits.
* **Dynamic Workflow Builder:**
  * A dedicated UI for Project Admins to visually configure the Finite State Machine (FSM).
  * Uses an interactive matrix to define exact transition rules (e.g., Tasks in "To Do" can only move to "In Progress").
* **Advanced Task & Story Management:**
  * Multi-level hierarchy supporting Parent Stories and Child Subtasks/Bugs.
  * Custom built **Rich Text Editor** featuring floating, Notion-style `@` user-mention dropdowns.
  * Dynamic, color-coded status badges and priority tags (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
* **Modern "SaaS" Design System:**
  * Fully custom UI using the `Inter` font family.
  * Context-aware floating modals with `z-index` layering to ensure smooth, uninterrupted user workflows.
  * Global Dark/Light mode theme toggle that seamlessly updates CSS variables across the entire application.
* **Real-time Collaboration UI:**
  * Custom Notification Bell dropdown to view mentions and updates.
  * Role-Based UI rendering (e.g., "Delete" buttons and "Customize Workflow" options are automatically hidden from Viewers/Members and only visible to Project Admins).
