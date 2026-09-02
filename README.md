# Drive Today — DSMS (MVP)

This repository contains a minimal MVP scaffold for Drive Today — Driver Scheduling & Monitoring System (DSMS).

Contents
- backend: Node.js + TypeScript + Express + Prisma + SQLite
- frontend: React + Vite + TypeScript
- docker-compose for local development

Quick start (local)

1. Backend

```bash
cd backend
npm install
# generate prisma client and push schema to SQLite
npx prisma generate
npx prisma db push
npm run dev
```

By default the backend listens on http://localhost:4000 and exposes REST endpoints:
- POST /auth/register
- POST /auth/login
- GET /drivers
- POST /drivers
- GET /trips
- POST /trips
- GET /incidents
- POST /incidents

2. Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

Docker (optional)

```bash
docker-compose up --build
```

Notes
- This is an initial scaffold — see TODOs in the README and code for next steps.
