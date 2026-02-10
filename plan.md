# Dragon Template AI — Development Plan

## Overview

Step-by-step plan to build the Dragon Template AI web chat application with AI-powered content generation commands.

---

## Phase 1: Project Setup & Docker Infrastructure ✅

**Goal:** Bootstrap the entire project with Docker Compose and verify all services run correctly.

- [x] Create `docker-compose.yml` with services:
  - **Keycloak** (identity provider)
  - **MongoDB** (database)
  - **Frontend** (ReactJS dev server)
  - **Backend** (Node.js API server)
- [x] Initialize ReactJS project in `frontend/`
- [x] Initialize Node.js project in `backend/` (Express + MongoDB driver/Mongoose)
- [x] Create `Dockerfile` for frontend and backend
- [x] Configure environment variables (`.env` per service + `.env.sample`)
- [x] Verify all containers start and communicate correctly

**Deliverable:** `docker-compose up` boots all 4 services successfully.

---

## Phase 2: Unit Testing & CI/CD Pipeline ✅

**Goal:** Set up unit testing for both frontend and backend, and create a CI pipeline with GitHub Actions.

- [x] Backend: Set up Jest testing framework
  - Install `jest`, `supertest` for API testing
  - Configure `jest.config.js`
  - Write unit tests for health endpoint
  - Write test utilities and helpers
- [x] Backend: Integration tests with `mongodb-memory-server`
  - Install `mongodb-memory-server` for in-memory MongoDB
  - Write integration tests for health endpoint with real DB connection
  - Verify MongoDB connection status in health response
- [x] Frontend: Set up Vitest testing framework
  - Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`
  - Configure Vitest in `vite.config.js`
  - Write unit tests for App component
  - Write test utilities and helpers
- [x] GitHub Actions CI pipeline:
  - Create `.github/workflows/ci.yml`
  - Run backend tests on push/PR
  - Run frontend tests on push/PR
  - Build Docker images to verify builds pass
- [x] Verify CI pipeline runs successfully on push

**Deliverable:** Both projects have unit tests with a green CI pipeline on GitHub Actions.

---

## Phase 3: Frontend Foundation & Docker Optimization ✅

**Goal:** Set up Ant Design UI framework, configure base theme/layout, and optimize Dockerfiles for both dev and production.

- [x] Frontend: Install and configure Ant Design
- [x] Frontend: Set up base layout component (header, sidebar placeholder, main content)
- [x] Frontend: Configure Ant Design theme (color palette, dark mode support)
- [x] Frontend: Set up CSS Modules or Vanilla CSS structure for custom styles
- [x] Frontend: Add React Router for page navigation
- [x] Optimize backend Dockerfile (multi-stage build, non-root user, production mode)
- [x] Optimize frontend Dockerfile (multi-stage build with nginx for production, dev mode for local)
- [x] Verify Docker builds and CI pipeline still pass

**Deliverable:** Frontend has Ant Design with a base layout ready for pages. Docker images are production-optimized.

---

## Phase 4: Authentication with Keycloak

**Goal:** Implement full authentication flow with a custom login page, Keycloak as identity provider, and user sync to MongoDB.

- [ ] Configure Keycloak realm, client, and roles (via admin console or realm export JSON)
- [ ] Backend: JWT token validation middleware (verify Keycloak-issued tokens)
- [ ] Backend: MongoDB `users` collection (keycloakId, email, displayName, avatar, preferences, lastLoginAt)
- [ ] Backend: User sync — on first login, create user record in MongoDB; on subsequent logins, update `lastLoginAt`
- [ ] Backend: REST API endpoints:
  - `POST /api/auth/login` — proxy to Keycloak token endpoint
  - `POST /api/auth/register` — proxy to Keycloak registration
  - `POST /api/auth/refresh` — refresh access token
  - `GET /api/auth/me` — return current user profile from MongoDB
- [ ] Frontend: Custom Login page (email/password form, modern design)
- [ ] Frontend: Custom Register page
- [ ] Frontend: Protected routes — redirect unauthenticated users to login page
- [ ] Frontend: Token storage, auto-refresh, and session expiration handling
- [ ] Write tests for auth middleware and user sync

**Deliverable:** Users can register and log in via a custom-designed login page, with user data synced to MongoDB.

---

## Phase 5: Basic AI Chat

**Goal:** Build the core chat interface integrated with Google Gemini, with streaming responses.

- [ ] Backend: Integrate Gemini API with streaming support (Server-Sent Events or WebSocket)
- [ ] Backend: REST API endpoints for sending messages and receiving streamed responses
- [ ] Frontend: Chat UI layout (sidebar + main chat area)
  - Message input bar with send button
  - Chat bubble display (user messages + AI responses)
  - Typing/loading indicator ("Researching...")
  - Auto-scroll to latest message
- [ ] Frontend: Consume streaming responses and render progressively
- [ ] AI model selector (optional: switch between models)

**Deliverable:** Users can chat with AI and see streamed responses in real-time.

---

## Phase 6: Chat Session Management

**Goal:** Implement full conversation management — history, sessions, multi-chat support.

- [ ] Backend: MongoDB schema for chat sessions and messages
  - `sessions` collection: session ID, user ID, title, created/updated timestamps
  - `messages` collection: session ID, role (user/assistant), content, timestamp
- [ ] Backend: REST APIs for sessions (create, list, get, delete, rename)
- [ ] Frontend: Sidebar with chat history list
  - Create new chat
  - Switch between existing chats
  - Rename chat sessions
  - Delete chat sessions
- [ ] Auto-generate session title from first message (via AI summarization)
- [ ] Persist and restore full conversation context per session

**Deliverable:** Full multi-session chat experience with history stored in MongoDB.

---

## Phase 7: Command — Generate Project Plan

**Goal:** Add the "Generate Project Plan" command that creates a rich markdown document in an editor view.

- [ ] Backend: API endpoint to generate a structured project plan via AI
  - Output: Markdown with headings, bullet points, tables, charts, and image placeholders
- [ ] Frontend: Markdown Document Editor (right panel)
  - Rich WYSIWYG editor (e.g., TipTap, Milkdown, or BlockNote)
  - Support rendering: headings, lists, tables, code blocks, images, charts
  - Inline editing — users can edit the generated content directly
  - Slash command support (`/` to insert elements)
- [ ] Image handling in documents:
  - AI-generated images or user-uploaded images
  - Upload to S3 (or compatible storage) and display via URL
  - Click on image → context menu to replace/upload image
  - Image options: aspect ratio, filters, resize
- [ ] Save generated document as a reusable template
- [ ] Download document (PDF/Markdown export)

**Deliverable:** "Generate Project Plan" command opens a full document editor with rich content, editable images, and export capability.

---

## Phase 8: Command — Generate Workflow

**Goal:** Add the "Generate Workflow" command that creates interactive flowchart diagrams.

- [ ] Backend: API endpoint to generate workflow structure via AI (output: Mermaid syntax or custom JSON)
- [ ] Frontend: Diagram Editor (options to consider):
  - **Option A — Mermaid-based:** Use a Mermaid renderer + editor. AI generates Mermaid syntax, render visually, allow code editing
  - **Option B — Interactive canvas:** Use a library like React Flow or Excalidraw for drag-and-drop diagram editing
  - **Recommended: React Flow** — provides interactive nodes, edges, decision diamonds, zoom, pan, and export
- [ ] Diagram features:
  - Decision nodes (diamond), process nodes (rectangle), start/end nodes (circle)
  - Connecting arrows with labels (Yes/No)
  - Color-coded nodes by type
  - Zoom controls and pan navigation
  - Click-to-customize node content
  - Add/remove nodes and connections
- [ ] Export: Download as PNG/SVG, or save as a reusable template
- [ ] Save workflow to user's template library

**Deliverable:** "Generate Workflow" command creates an interactive, editable flowchart diagram.

---

## Phase 9: Command — Generate Roadmap

**Goal:** Add the "Generate Roadmap" command for timeline-based project visualization.

- [ ] Backend: API endpoint to generate roadmap structure via AI
- [ ] Frontend: Roadmap/timeline view
  - Horizontal or vertical timeline with phases
  - Color-coded milestones (e.g., green = setup, blue = development, pink = testing)
  - Phase cards with details and dependencies
- [ ] Interactive editing: drag to reorder, click to edit, add/remove phases
- [ ] Export and save as template

**Deliverable:** "Generate Roadmap" command creates a visual, editable project timeline.

---

## Phase 10: Command — Generate Sprint

**Goal:** Add the "Generate Sprint" command for agile sprint planning.

- [ ] Backend: API endpoint to generate sprint plan via AI
- [ ] Frontend: Sprint board view
  - Sprint timeline with tasks
  - Task cards with status, assignee, priority
  - Kanban-style or list view
- [ ] Interactive editing and template saving

**Deliverable:** "Generate Sprint" command creates a structured sprint plan.

---

## Phase 11: Command — Generate Document

**Goal:** Add a general-purpose "Generate Document" command for various document types.

- [ ] Backend: API endpoint to generate different document formats (reports, proposals, specs, etc.)
- [ ] Frontend: Reuse the Markdown Document Editor from Phase 7
- [ ] Template selection: users can choose a document type/template before generating
- [ ] Export to PDF, Markdown, or DOCX

**Deliverable:** "Generate Document" command creates editable, exportable documents of any type.

---

## Phase 12: Template Management & Projects

**Goal:** Allow users to manage all generated artifacts in a centralized library.

- [ ] Backend: MongoDB schema for templates (type, content, metadata, user ID)
- [ ] Backend: REST APIs for templates (CRUD, list by type, search)
- [ ] Frontend: Templates page — browse, search, filter by type
- [ ] Frontend: Projects page — group related templates into projects
- [ ] Duplicate, rename, delete templates
- [ ] Share templates (public link or export)

**Deliverable:** Users can organize, find, and reuse all generated content.

---

## Phase 13: Polish & Production Readiness

**Goal:** Final polish, performance, and deployment preparation.

- [ ] UI/UX polish: animations, transitions, responsive design, dark mode
- [ ] Left sidebar navigation (Home, Document, Design, Templates, Brand, Projects, etc.)
- [ ] Error handling and user-friendly error messages
- [ ] Rate limiting and API security
- [ ] Logging and monitoring
- [ ] CI/CD pipeline setup
- [ ] Production Docker Compose / Kubernetes config
- [ ] Documentation (README, API docs)

**Deliverable:** Production-ready application with polished UI and deployment pipeline.
