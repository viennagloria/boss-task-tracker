import { config } from './config';
import { initializeDatabase, saveDatabase } from './db';
import { app } from './app';

async function main() {
  await initializeDatabase();
  await app.start(config.PORT);
  console.log(`Boss Task Tracker running on port ${config.PORT}`);
}

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  try {
    saveDatabase();
  } catch (err) {
    console.error('Error saving database during shutdown:', err);
  }
  app.stop().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Error stopping app:', err);
    process.exit(1);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
