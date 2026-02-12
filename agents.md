# Dragon Template AI

## Project Description

A **Web Chat AI** application — an intelligent chat platform powered by artificial intelligence. Users can interact with AI through a modern web interface to generate various types of content, diagrams, and project management artifacts.

Beyond simple chat, the platform provides **advanced AI-powered commands** for generating structured outputs such as workflows, project plans, roadmaps, and documents.

---

## Project Structure

```
dragon-template-ai/
├── frontend/              # React 19 + Vite SPA
├── backend/               # Node.js + Express REST API
├── e2e/                   # Playwright E2E tests
├── infra/
│   ├── gke/               # Kubernetes manifests (backend, frontend, mongodb, keycloak, ingress)
│   └── pulumi/            # Pulumi IaC (VPC + GKE cluster)
├── images/                # Project images, banners, and generation scripts
├── .github/workflows/     # CI/CD pipelines
├── docker-compose.yml     # Local development
├── agents.md              # This file — AI agent instructions
├── plan.md                # Development roadmap
└── secret.md              # Local credentials (gitignored)
```

---

## Tech Stack

| Layer          | Technology                                                    |
|----------------|---------------------------------------------------------------|
| Frontend       | React 19, Vite 7, Ant Design 6, Mantine 8, BlockNote editor  |
| Backend        | Node.js, Express 5, Mongoose 9, Sharp                        |
| AI             | Google Gemini (via `@google/genai`), multi-key rotation       |
| Auth           | Keycloak (OAuth 2.0 / OpenID Connect)                        |
| Database       | MongoDB                                                       |
| File Storage   | Google Cloud Storage (`@google-cloud/storage`)                |
| Infrastructure | GKE (Kubernetes), Pulumi (IaC), GCP Managed SSL              |
| CI/CD          | GitHub Actions (CI, E2E, Deploy, Gitleaks)                    |
| Testing        | Jest (backend), Vitest (frontend), Playwright (E2E)           |

---

## Setup Commands

### Local Development (Docker Compose)

```bash
# Clone and setup
git clone https://github.com/dongitran/Dragon-Template-AI.git
cd Dragon-Template-AI
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start all services
docker compose up --build -d

# Verify
docker compose ps
docker compose logs backend --tail 50
docker compose logs frontend --tail 50
```

| Service        | URL                               |
|----------------|-----------------------------------|
| Frontend       | http://localhost:5173              |
| Backend API    | http://localhost:3001/api/health   |
| Keycloak Admin | http://localhost:8080              |

### Without Docker

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

---

## Testing Instructions

### Backend (Jest)

```bash
cd backend
npm test              # All tests
npm run test:unit     # Unit tests only (16 files)
npm run test:integration  # Integration tests (5 files)
```

### Frontend (Vitest)

```bash
cd frontend
npm test              # Unit tests with Vitest
```

### E2E (Playwright)

```bash
cd e2e
npm test              # Run all E2E tests
npm run test:headed   # Run with browser visible
npm run test:ui       # Playwright UI mode
```

### Browser Testing

**Login credentials:**
- Username: `testuser`
- Password: `testpass123`

---

## Build Steps

### Frontend Production Build

```bash
cd frontend
VITE_API_URL=https://api.dragon-template.xyz \
VITE_KEYCLOAK_URL=https://keycloak.dragon-template.xyz \
npm run build
# Output: frontend/dist/
```

### Docker Images (for GKE)

```bash
# Backend
docker build --platform linux/amd64 --target production -t backend:latest ./backend

# Frontend (VITE_* vars must be build args — baked into static JS)
docker build --platform linux/amd64 \
  --build-arg VITE_API_URL=https://api.dragon-template.xyz \
  --build-arg VITE_KEYCLOAK_URL=https://keycloak.dragon-template.xyz \
  --target production \
  -t frontend:latest ./frontend
```

> **Important:** Use `--platform linux/amd64` when building on Apple Silicon. GKE nodes are amd64.

---

## Frontend

- **Framework:** React 19 + Vite 7
- **UI Libraries:** Ant Design 6, Mantine 8
- **Editor:** BlockNote (rich text/document editor)
- **Routing:** React Router 7
- **Key pages:** ChatPage, DocumentEditorPage, DocumentsPage, HomePage, LoginPage, RegisterPage, SettingsPage, WorkflowsPage, ProjectsPage
- **Auth context:** `frontend/src/contexts/AuthContext.jsx` — Keycloak integration
- **Features:**
  - Real-time AI chat with streaming responses
  - File upload with multimodal AI analysis
  - Conversation history sidebar
  - AI model selector (configurable providers)
  - Visual diagram/flowchart editor
  - Document generation and editing

---

## Backend

- **Runtime:** Node.js + Express 5
- **Database:** MongoDB via Mongoose 9
- **API prefix:** `/api/`
- **Key routes:**
  - `POST /api/chat` — AI chat with streaming (SSE)
  - `GET/POST /api/sessions` — Chat session CRUD
  - `POST /api/upload` — File upload to GCS
  - `GET/POST /api/documents` — Document CRUD
  - `GET /api/auth/me` — Current user info
  - `GET /api/health` — Health check
- **Services:**
  - `aiProvider.js` — Google Gemini integration with multi-key rotation and multimodal support
  - `storageService.js` — GCS file upload/download
  - `imageGenerationService.js` — AI image generation
  - `planGenerationService.js` — Project plan generation
  - `titleGenerator.js` — Auto-generate chat session titles
  - `userSync.js` — Sync Keycloak users to MongoDB
- **Middleware:** `auth.js` — JWT validation via Keycloak JWKS

---

## Authentication

- **Identity Provider:** Keycloak
- **Protocol:** OAuth 2.0 / OpenID Connect
- **Realm:** `dragon`
- **Client:** `dragon-app`
- **Features:**
  - User login and registration
  - Single Sign-On (SSO)
  - JWT token validation (backend verifies via JWKS endpoint)
  - Role-based access control

> **Important:** Backend's `KEYCLOAK_URL` must use the external URL (`https://keycloak.dragon-template.xyz`) to match the JWT issuer claim.

---

## Infrastructure

### Production (GKE)

- **GCP Project:** `fair-backbone-479312-h7`
- **Cluster:** `dragon-gke` (zonal, `asia-southeast1-a`)
- **Namespace:** `dragon`
- **Domain:** `dragon-template.xyz`
- **Static IP:** `34.120.179.221` (global)

| Service   | Type         | Port    | External URL                             |
|-----------|--------------|---------|------------------------------------------|
| MongoDB   | StatefulSet  | 30017   | Internal only                            |
| Keycloak  | Deployment   | 30080   | https://keycloak.dragon-template.xyz     |
| Backend   | Deployment   | 30010   | https://api.dragon-template.xyz          |
| Frontend  | Deployment   | 30020   | https://dragon-template.xyz              |

### K8s Manifests

- `infra/gke/mongodb/` — StatefulSet + PVC + Service
- `infra/gke/keycloak/` — Deployment + PVC + Service
- `infra/gke/backend/` — Deployment + Service
- `infra/gke/frontend/` — Deployment + Service
- `infra/gke/ingress/` — Ingress + GCP ManagedCertificate

### IaC (Pulumi)

- `infra/pulumi/` — TypeScript Pulumi project
- Manages: VPC, subnet, GKE cluster, node pool
- Docs: `infra/pulumi/INFRASTRUCTURE.md` (step-by-step deployment guide)

---

## CI/CD Pipelines

| Workflow        | File                              | Trigger                        | Purpose                        |
|-----------------|-----------------------------------|--------------------------------|--------------------------------|
| CI              | `.github/workflows/ci.yml`        | Push/PR                        | Lint + unit tests              |
| E2E Tests       | `.github/workflows/e2e.yml`       | Push/PR                        | Playwright E2E tests           |
| Deploy to GKE   | `.github/workflows/deploy-gke.yml`| Push to `main` (path-filtered) | Build, push, deploy to GKE    |
| Gitleaks        | `.github/workflows/gitleaks.yml`  | Push/PR                        | Secret scanning                |

**Deploy workflow** uses `dorny/paths-filter@v3` to only deploy changed services. Each service (mongodb, keycloak, backend, frontend, ingress) deploys independently.

---

## Code Style Guidelines

- No hardcoded default values for environment variables — all config must come from `.env` files
- No hardcoded API keys or secrets in source code
- Every file should end with exactly one newline
- Backend: CommonJS (`require`/`module.exports`)
- Frontend: ES Modules (`import`/`export`)
- Run `npm test` in both `backend/` and `frontend/` before committing

---

## Security Considerations

- **Gitleaks CI** runs on every push/PR to detect leaked secrets
- API keys use rotation (`GEMINI_API_KEYS` is comma-separated, round-robin in `aiProvider.js`)
- K8s secrets are created via `kubectl create secret --dry-run=client -o yaml | kubectl apply -f -`
- GCS credentials stored as K8s secret (`GCS_CREDENTIALS` — full JSON service account key)
- `secret.md` is gitignored — contains all credentials for local reference only
- Keycloak JWT tokens validated via JWKS endpoint (no shared secret)
- CORS restricted to `CORS_ORIGIN` env var
- Helmet + rate limiting on backend

---

## Development Workflow

### Docker Container Management

- **Always check container logs after restart/rebuild:** Run `docker compose logs <service> --tail 200` after any `docker compose up` to verify services started correctly
- Common issues:
  - Stale `node_modules` in anonymous volumes → fix with `docker compose down -v` then rebuild
  - Missing env vars → verify with `docker exec <container> env | grep <VAR>`
- Check all container statuses with `docker compose ps` before testing

### Deploying to GKE Manually

```bash
# Authenticate
gcloud auth login
gcloud container clusters get-credentials dragon-gke --zone asia-southeast1-a --project fair-backbone-479312-h7

# Apply manifests
kubectl apply -f infra/gke/<service>/

# Check status
kubectl get pods -n dragon
kubectl logs deployment/<service> -n dragon --tail 50
```

> **Important:** When building Docker images on Apple Silicon for GKE, always use `--platform linux/amd64`.
