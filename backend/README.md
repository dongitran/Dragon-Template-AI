# 🟢 Dragon Template AI — Backend

Node.js/Express backend API for the Dragon Template AI platform.

## Tech Stack

- **Node.js 20** with Express
- **MongoDB** via Mongoose
- **Keycloak** for authentication

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.sample .env

# Start dev server (with hot-reload)
npm run dev
```

The server runs at http://localhost:3001

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (returns service + MongoDB status) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BACKEND_PORT` | Server port (required) |
| `MONGO_URI` | MongoDB connection string (required) |
| `KEYCLOAK_URL` | Keycloak server URL |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (hot-reload) |
| `npm start` | Start with node (production) |

## Docker

```bash
docker build -t dragon-backend .
docker run -p 3001:3001 --env-file .env dragon-backend
```
