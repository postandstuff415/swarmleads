/**
 * PM2 process definition for the SwarmLeads API (production, on the shared EC2).
 *
 * The API process ALSO serves the built frontend (frontend/dist) — see
 * backend/src/app.ts — so this single process handles both the SPA and /api.
 * nginx just reverse-proxies the SwarmLeads domain to PORT (4000).
 *
 * Environment comes from backend/.env (loaded via dotenv/config); only NODE_ENV
 * and the frontend path are pinned here so the process always runs in prod mode
 * and knows where the built SPA is regardless of cwd.
 *
 *   pm2 start  ecosystem.config.cjs   # first boot
 *   pm2 reload swarmleads-api         # zero-downtime redeploy (CI does this)
 */
module.exports = {
  apps: [
    {
      name: 'swarmleads-api',
      cwd: '/var/www/swarmleads/backend',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        FRONTEND_DIST_PATH: '/var/www/swarmleads/frontend/dist',
      },
    },
  ],
};
