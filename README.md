# 🐉 Dragon Template AI

[![CI](https://github.com/dongitran/Dragon-Template-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/dongitran/Dragon-Template-AI/actions/workflows/ci.yml)

> AI-powered web chat that doesn't just chat — it creates workflows, roadmaps, and beautiful docs.

## ✨ What's This?

An AI-powered web chat platform that goes beyond simple conversation — it generates **interactive flowcharts**, **project plans**, **sprint boards**, and **roadmaps**, all editable, exportable, and ready to use.

## 🚀 Tech Stack

**Frontend**
- ⚛️ ReactJS
- 🎨 Modern UI/UX with real-time streaming

**Backend**
- 🟢 Node.js + Express
- 🍃 MongoDB
- 🔐 Keycloak (SSO auth)
- 🤖 Google Gemini AI

**Infrastructure**
- 🐳 Docker Compose

## 🎯 Features

- 💬 **AI Chat** — Real-time streaming responses
- 📊 **Generate Workflow** — Interactive flowchart diagrams
- 📝 **Generate Project Plan** — Rich markdown docs with charts & images
- 🗓️ **Generate Roadmap** — Timeline-based project visualization
- 🏃 **Generate Sprint** — Agile sprint planning boards
- 🗂️ **Template Library** — Save & reuse all generated content

## 📖 Documentation

- [`agents.md`](./agents.md) — Project overview & architecture
- [`plan.md`](./plan.md) — Detailed development roadmap

## 🛠️ Getting Started

```bash
# Clone the repo
git clone https://github.com/dongitran/Dragon-Template-AI.git
cd Dragon-Template-AI

# Copy env samples
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start all services
docker compose up --build -d
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001/api/health |
| Keycloak Admin | http://localhost:8080 |

## 📜 License

MIT

---

Built with ❤️ using AI-powered code generation
