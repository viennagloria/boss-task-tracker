// Top-level startup logging
console.log('=== Boss Task Tracker Starting ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

import { config } from './config';
import { initializeDatabase } from './db';
import { app } from './app';

console.log('All modules imported successfully');
console.log('Config loaded - PORT:', config.PORT);

async function main() {
  console.log('main() executing...');

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
