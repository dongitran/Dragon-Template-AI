# Dragon Template AI — Development Plan

## Overview

Step-by-step plan to build the Dragon Template AI web chat application with AI-powered content generation commands.

---

## Phase 1: Project Setup & Docker Infrastructure

**Goal:** Bootstrap the entire project with Docker Compose and verify all services run correctly.

- [ ] Create `docker-compose.yml` with services:
  - **Keycloak** (identity provider)
  - **MongoDB** (database)
  - **Frontend** (ReactJS dev server)
  - **Backend** (Node.js API server)
- [ ] Initialize ReactJS project in `frontend/`
- [ ] Initialize Node.js project in `backend/` (Express + MongoDB driver/Mongoose)
- [ ] Create `Dockerfile` for frontend and backend
- [ ] Configure environment variables (`.env`)
- [ ] Verify all containers start and communicate correctly

**Deliverable:** `docker-compose up` boots all 4 services successfully.

---

## Phase 2: Authentication with Keycloak

**Goal:** Implement full authentication flow using Keycloak for both frontend and backend.

- [ ] Configure Keycloak realm, client, and roles
- [ ] Backend: Implement token validation middleware (OAuth 2.0 / OpenID Connect)
- [ ] Backend: Create user-related REST API endpoints
- [ ] Frontend: Integrate Keycloak JS adapter for login/logout/register
- [ ] Frontend: Protected routes — redirect unauthenticated users to login
- [ ] Handle token refresh and session expiration
- [ ] Test login flow end-to-end

**Deliverable:** Users can register, log in via Keycloak, and access protected pages.

---

## Phase 3: Basic AI Chat

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

## Phase 4: Chat Session Management

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

## Phase 5: Command — Generate Project Plan

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

## Phase 6: Command — Generate Workflow

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

## Phase 7: Command — Generate Roadmap

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

## Phase 8: Command — Generate Sprint

**Goal:** Add the "Generate Sprint" command for agile sprint planning.

- [ ] Backend: API endpoint to generate sprint plan via AI
- [ ] Frontend: Sprint board view
  - Sprint timeline with tasks
  - Task cards with status, assignee, priority
  - Kanban-style or list view
- [ ] Interactive editing and template saving

**Deliverable:** "Generate Sprint" command creates a structured sprint plan.

---

## Phase 9: Command — Generate Document

**Goal:** Add a general-purpose "Generate Document" command for various document types.

- [ ] Backend: API endpoint to generate different document formats (reports, proposals, specs, etc.)
- [ ] Frontend: Reuse the Markdown Document Editor from Phase 5
- [ ] Template selection: users can choose a document type/template before generating
- [ ] Export to PDF, Markdown, or DOCX

**Deliverable:** "Generate Document" command creates editable, exportable documents of any type.

---

## Phase 10: Template Management & Projects

**Goal:** Allow users to manage all generated artifacts in a centralized library.

- [ ] Backend: MongoDB schema for templates (type, content, metadata, user ID)
- [ ] Backend: REST APIs for templates (CRUD, list by type, search)
- [ ] Frontend: Templates page — browse, search, filter by type
- [ ] Frontend: Projects page — group related templates into projects
- [ ] Duplicate, rename, delete templates
- [ ] Share templates (public link or export)

**Deliverable:** Users can organize, find, and reuse all generated content.

---

## Phase 11: Polish & Production Readiness

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
