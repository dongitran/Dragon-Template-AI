# 🎨 Dragon Template AI — Frontend

React frontend for the Dragon Template AI platform.

## Tech Stack

- **React 19** with Vite
- **Vite 7** for fast dev server & HMR

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.sample .env

# Start dev server
npm run dev
```

The dev server runs at http://localhost:5173

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_KEYCLOAK_URL` | Keycloak server URL |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Docker

```bash
docker build -t dragon-frontend .
docker run -p 5173:5173 dragon-frontend
```
