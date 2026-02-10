# Dragon Template AI

## Project Description

A **Web Chat AI** application — an intelligent chat platform powered by artificial intelligence. Users can interact with AI through a modern web interface to generate various types of content, diagrams, and project management artifacts.

Beyond simple chat, the platform provides **advanced AI-powered commands** for generating structured outputs such as workflows, project plans, roadmaps, and documents.

## Project Structure

```
dragon-template-ai/
├── frontend/          # User interface
├── backend/           # Server logic & API
└── agents.md          # Project description
```

---

## Frontend

- **Framework:** ReactJS
- **Key features:**
  - Real-time chat interface with AI
  - Conversation history management
  - Display user messages and AI responses
  - Left sidebar navigation (Home, Document, Design, Presentation, Image, Video, Templates, Brand, Projects)
  - Chat input bar with attachments and tool selection
  - AI model selector (e.g., Light AI / advanced models)
  - Visual diagram/flowchart editor with zoom controls, download, and share options

---

## Backend

- **Runtime:** Node.js
- **Database:** MongoDB
- **API Architecture:** REST API
- **Key features:**
  - Handle requests from frontend
  - Connect and interact with AI models
  - Store conversation data in MongoDB
  - User and chat session management
  - Process and generate structured content (workflows, plans, roadmaps, documents)

---

## Authentication

- **Identity Provider:** Keycloak
- **Key features:**
  - User login and registration
  - Single Sign-On (SSO) support
  - Token-based authentication (OAuth 2.0 / OpenID Connect)
  - Role-based access control

---

## Core Features

### 1. AI Chat
- Users send messages/prompts and receive AI-generated responses
- Supports contextual, multi-turn conversations
- "Researching..." loading state while AI processes

### 2. Generate Commands
After an AI response, the system suggests follow-up actions:

| Command                  | Description                                                                 |
|--------------------------|-----------------------------------------------------------------------------|
| **Generate Project Plan** | Create a structured project plan based on the conversation context          |
| **Generate Workflow**     | Generate a visual flowchart/workflow diagram with decision nodes and steps  |
| **Generate Roadmap**      | Create a timeline-based roadmap with milestones and phases                  |
| **Generate Sprint**       | Generate sprint planning with tasks and timeline                           |
| **Generate Document**     | Produce a formatted document from the conversation                         |

### 3. Visual Diagram Editor
- Interactive flowchart/workflow and roadmap diagrams
- Click-to-customize, zoom, download, and share

### 4. Template Management
- Generated outputs are saved as reusable templates:
  - Workflow templates
  - Sprint templates
  - Roadmap templates
- Templates can be revisited and further customized

### 5. Tools & Attachments
- "Tools" menu for additional capabilities
- File attachment support in chat input
- Multiple AI model options for different quality/speed tradeoffs
