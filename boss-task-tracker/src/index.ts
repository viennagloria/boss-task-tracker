import { config } from './config';
import { initializeDatabase } from './db';
import { app } from './app';

async function main() {
  // Initialize database
  await initializeDatabase();

  // Start the Bolt app
  await app.start(config.PORT);
  console.log(`Boss Task Tracker running on port ${config.PORT}`);
}

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
