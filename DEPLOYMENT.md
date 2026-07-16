# SwarmLeads — Deployment (shared EC2)

SwarmLeads runs on the **same EC2 box as BounceBack**. The GitHub Actions workflow
(`.github/workflows/deploy.yml`) build-checks every push/PR and, on push to `main`, SSH-deploys.

**Architecture on the server:** one PM2 process (`swarmleads-api`, port **4000**) runs the Express
API **and** serves the built Vite SPA (`frontend/dist`). nginx just reverse-proxies the SwarmLeads
domain to `127.0.0.1:4000`. One process, one origin — no CORS, no separate static host.

```
Internet ──▶ nginx (leads.bouncebacksms.com) ──▶ 127.0.0.1:4000 (pm2: swarmleads-api)
                                                     ├─ /api/*  → Express API
                                                     └─ /*      → frontend/dist (SPA)
```

---

## 1. GitHub repo secrets (Settings → Secrets and variables → Actions)

Add the **same three** the BounceBack repo uses (they point at the same box):

| Secret | Value |
|---|---|
| `EC2_HOST` | EC2 public host / IP |
| `EC2_USER` | SSH user (e.g. `ubuntu`) |
| `EC2_SSH_KEY` | Private key with access to the box |

## 2. One-time server setup

```bash
# as EC2_USER, with Node 20 + pm2 already installed (BounceBack already needs these)
sudo mkdir -p /var/www/swarmleads && sudo chown "$USER" /var/www/swarmleads
git clone https://github.com/postandstuff415/swarmleads.git /var/www/swarmleads
cd /var/www/swarmleads

# --- Postgres: give SwarmLeads its OWN database (separate from BounceBack's) ---
sudo -u postgres psql -c "CREATE DATABASE swarmleads;"
sudo -u postgres psql -c "CREATE USER swarmleads WITH PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE swarmleads TO swarmleads;"

# --- backend/.env (see §3) ---
cp backend/.env.example backend/.env && nano backend/.env   # fill in real values

# --- first build + boot ---
cd backend && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..
pm2 start ecosystem.config.cjs && pm2 save
```

## 3. `backend/.env` on the server (production)

```ini
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://swarmleads:CHANGE_ME@localhost:5432/swarmleads?schema=public"

# Public URL of this app (login callback + Stripe redirects)
SWARMLEADS_APP_URL="https://leads.bouncebacksms.com"

# Cross-app bridge — MUST equal BounceBack's SWARMLEADS_BRIDGE_JWT_SECRET
SWARMLEADS_BRIDGE_JWT_SECRET="<same 64-hex as BounceBack>"
BOUNCEBACK_API_URL="https://<bounceback public url>"

# SwarmLeads' own session-signing secret (min 16 chars)
SWARMLEADS_SESSION_SECRET="<random 64-hex>"

# Lead source
OUTSCRAPER_API_KEY="<real key>"
OUTSCRAPER_MONTHLY_LEAD_ALLOWANCE=1000       # baseline plan allowance
OUTSCRAPER_MAX_LEADS_PER_SEARCH=50

# Billing (shared Stripe account with BounceBack)
STRIPE_API_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."            # SwarmLeads' own webhook endpoint secret
REQUIRE_SUBSCRIPTION=true                     # gate paid features behind an active sub
```

> `FRONTEND_DIST_PATH` is set by `ecosystem.config.cjs`, not `.env`.

## 4. nginx server block (SwarmLeads subdomain)

```nginx
server {
    server_name leads.bouncebacksms.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
# then: sudo certbot --nginx -d leads.bouncebacksms.com   (TLS)
```

## 5. Stripe webhook (billing)

SwarmLeads has its **own** webhook endpoint (`/api/billing/webhook`). In the Stripe dashboard add an
endpoint → `https://leads.bouncebacksms.com/api/billing/webhook`, subscribe to
`checkout.session.completed`, `customer.subscription.*`, `invoice.*`, and put the signing secret in
`STRIPE_WEBHOOK_SECRET`. (SwarmLeads also self-heals subscription state by reading Stripe directly, so
a missed webhook won't strand a paid user.)

---

## After setup

Every push to `main` → build check → SSH deploy → `prisma migrate deploy` → rebuild → `pm2 reload`
(zero-downtime). Watch a run: `gh run watch <id> --repo postandstuff415/swarmleads`.

## Notes / TODO before public launch
- Point DNS `leads.bouncebacksms.com` → the EC2 IP (pending).
- The `appleboy/ssh-action` step emits a Node-20 deprecation warning (same as BounceBack); harmless,
  bump the action when convenient.
- SwarmLeads has no rate limiting yet — add before heavy public traffic.
