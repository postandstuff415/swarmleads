# SwarmLeads — Project Notes

SwarmLeads is now split into **two separate apps** under this folder:

```
swarmleads/
├── frontend/    # React 19 + Vite 8 + Tailwind v4 dashboard (unchanged UI)
└── backend/     # TypeScript + Express 5 + Prisma + PostgreSQL API
```

The product theme is a swarm of "Worker Bees" that process lead-generation jobs in a
chain (Scraper → Strategist → Writer), plus a BounceBack missed-call auto-text add-on.
It remains a **simulation/demo** — leads and messages are generated from templates and
random data (live Outscraper scraping is a later phase).

---

## 1. Architecture

```
Browser (React SPA)
    │
    ▼
Vite dev server :3000 ──proxy /api──► Express API :4000
                                          │
                                          ▼
                                    Prisma ──► PostgreSQL (docker)
```

- **frontend/** — Vite + React + Tailwind, single-file UI in `src/App.jsx`. Proxies all
  `/api/*` calls to the backend (see `frontend/vite.config.js`).
- **backend/** — TypeScript Express 5, feature-modular (`src/modules/{health,leads,scrape,
  bounceback}`), Postgres via Prisma, Zod-validated request bodies. Replaces the old
  `team-db`/SQLite shim and raw-SQL bees.

### The Worker Bee chain (backend/src/modules/scrape/engines/)

| Bee | Responsibility |
|-----|----------------|
| **Scraper**    | Generates up to 50 simulated leads for an industry + region; stores them `NEW`. |
| **Strategist** | Verification + high-intent checks on `NEW` leads; rewrites angle; sets `VERIFIED`/`HIGH_INTENT`. |
| **Writer**     | Generates a personalized SMS outreach script per lead (`outreach_script`). |
| **BounceBack** | (`modules/bounceback`) Simulated missed-call auto-text; logs each event. |

`POST /api/scrape` fires the whole chain (fire-and-forget): Scraper → Strategist → Writer.

---

## 2. API Endpoints

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

Responses keep the prototype's **snake_case** field names (`business_name`,
`outreach_script`, `incoming_number`, …) so the frontend runs unchanged.

---

## 3. Database

Postgres, managed by Prisma (`backend/prisma/schema.prisma`). Two models mapped to
snake_case tables:

- **`leads`** — `id, business_name, contact_person, phone, email, industry, region,
  angle, source, status (new|verified|high_intent), outreach_script, created_at`
- **`bounceback_logs`** — `id, incoming_number, outgoing_text, industry, region, status,
  created_at`

---

## 4. How to Run

### Backend
```bash
cd backend
cp .env.example .env          # defaults match docker-compose
npm install
npm run db:up                 # start Postgres (docker compose)
npx prisma migrate dev --name init   # create tables + generate client
npm run dev                   # API on http://127.0.0.1:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

Then open **http://localhost:3000**. Flow: Start Project → Launch Worker Bees →
Command Center (progress) → Your Leads (table + per-lead script modal + BounceBack add-on).

> Node 22.5+ recommended. On this machine, `prisma generate`'s engine download was
> blocked by the sandbox network; engines were fetched manually into
> `backend/prisma-engines/` (gitignored). On a normal machine Prisma downloads them itself.

---

## 5. Notes

- The prototype bug where outreach scripts never reached the UI is **fixed** — the Prisma
  `leads` query returns the full model, so `outreach_script` now flows to the frontend and
  the "View Draft" modal shows the generated script.
- All request bodies are Zod-validated (invalid industry / missing region / bad target →
  `400`), and there is no more raw string-concatenated SQL.
- Out of scope (later PDF phases): live Outscraper scraping, auth/JWT, Stripe, Push-to-SMS,
  AWS deploy + CI/CD.

---

## 6. File Map

```
swarmleads/
├── frontend/
│   ├── index.html
│   ├── vite.config.js        # dev server :3000, proxies /api → :4000
│   ├── package.json          # FE deps only
│   └── src/ (App.jsx, main.jsx, index.css)
└── backend/
    ├── docker-compose.yml    # postgres:16
    ├── .env.example
    ├── package.json          # scripts: dev / build / start / prisma:* / db:up
    ├── tsconfig.json
    ├── prisma/schema.prisma
    └── src/
        ├── server.ts, app.ts
        ├── config/env.ts
        ├── lib/ (prisma.ts, http-error.ts)
        ├── middleware/ (validate, error-handler, not-found)
        ├── utils/ (random, async-handler)
        └── modules/
            ├── health/
            ├── leads/        # routes, controller, service, serializer
            ├── scrape/       # routes, controller, service, schema + engines/
            └── bounceback/   # routes, controller, service, schema
```
