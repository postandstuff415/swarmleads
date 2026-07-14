import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { createApp } from './app.js';

async function main() {
  // Fail fast if the database is unreachable.
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(env.PORT, '127.0.0.1', () => {
    console.log(`SwarmLeads API running on http://127.0.0.1:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (err) => {
  console.error('Failed to start server:', err);
  await prisma.$disconnect();
  process.exit(1);
});
