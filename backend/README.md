# SwarmLeads — Backend API

TypeScript + Express 5 + Prisma + PostgreSQL. Feature-modular structure. Replaces the
prototype's `team-db`/SQLite layer and raw-SQL bees with typed Prisma queries and Zod validation.

## Quick start

```bash
cp .env.example .env          # defaults match docker-compose
npm install
npm run db:up                 # start Postgres (docker compose)
npx prisma migrate dev --name init   # create tables + generate client
npm run dev                   # API on http://127.0.0.1:4000
```

## Structure

```
src/
├── server.ts                 # bootstrap: connect Prisma, listen
├── app.ts                    # express app + module mounting + error handling
├── config/env.ts             # Zod-validated env
├── lib/                      # prisma singleton, HttpError
├── middleware/               # validate (Zod), error-handler, not-found
├── utils/                    # random helpers, asyncHandler
└── modules/
    ├── health/               # GET /api/health
    ├── leads/                # GET /api/leads, GET /api/stats
    ├── scrape/               # POST /api/scrape, /strategize, /write (+ bee engines)
    └── bounceback/           # POST /api/bounceback/simulate, GET /api/bounceback/logs
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/health` | Health check + bee list |
| POST | `/api/scrape` | Deploy bees for `{ industry, region, target }` (runs full chain) |
| POST | `/api/strategize` | Run Strategist + Writer only |
| POST | `/api/write` | Run Writer only |
| GET  | `/api/leads` | All leads + stats (adds a random `score` per lead) |
| GET  | `/api/stats` | Lead counts (`total`, `verified`, `highIntent`) |
| POST | `/api/bounceback/simulate` | Simulate one missed-call auto-reply |
| GET  | `/api/bounceback/logs` | All bounceback logs |

Responses keep the prototype's snake_case field names so the existing frontend works unchanged.

## Scripts

- `npm run dev` — hot-reload dev server (tsx watch)
- `npm run build` — `prisma generate` + `tsc` → `dist/`
- `npm start` — run compiled `dist/server.js`
- `npm run db:up` / `db:down` — start/stop Postgres via docker compose
- `npm run prisma:migrate` — create/apply a migration
