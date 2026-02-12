import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

let db: Database;

// Get the path to sql.js WASM file in node_modules
function getWasmPath(): string {
  // In production (Render), node_modules is at /app/node_modules
  // In development, it's relative to the project root
  const possiblePaths = [
    path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    '/app/node_modules/sql.js/dist/sql-wasm.wasm',
    path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback - let sql.js try to find it
  return '';
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pinned_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_ts TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_text TEXT NOT NULL,
    message_author_id TEXT NOT NULL,
    message_author_name TEXT,
    pinned_by_user_id TEXT NOT NULL,
    channel_name TEXT,
    permalink TEXT,
    pinned_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'pending',
    UNIQUE(message_ts, channel_id, pinned_by_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_by_user ON pinned_messages(pinned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_status ON pinned_messages(status);
`;

const MIGRATION = `
-- Add status column if it doesn't exist (for existing databases)
ALTER TABLE pinned_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
`;

export async function initializeDatabase(): Promise<void> {
  console.log('Starting database initialization...');

  try {
    const wasmPath = getWasmPath();
    console.log(`WASM path: ${wasmPath || 'default (let sql.js find it)'}`);

    // Configure WASM file location for production environments
    const sqlConfig = wasmPath ? { locateFile: () => wasmPath } : {};
    // @ts-expect-error sql.js types don't include config parameter but it's supported
    const SQL = await initSqlJs(sqlConfig);
    console.log('sql.js loaded successfully');

    const dbDir = path.dirname(config.DATABASE_PATH);
    console.log(`Database directory: ${dbDir}`);

    if (!fs.existsSync(dbDir)) {
      console.log(`Creating directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(config.DATABASE_PATH)) {
      console.log(`Loading existing database from ${config.DATABASE_PATH}`);
      const buffer = fs.readFileSync(config.DATABASE_PATH);
      db = new SQL.Database(buffer);
    } else {
      console.log('Creating new database');
      db = new SQL.Database();
    }

    console.log('Running schema...');
    db.run(SCHEMA);

    // Run migration for existing databases (add status column if missing)
    try {
      db.run(MIGRATION);
    } catch (err) {
      // Column already exists, ignore error
      console.log('Migration skipped (column already exists)');
    }

    saveDatabase();

    console.log(`Database initialized at ${config.DATABASE_PATH}`);
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

export function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.DATABASE_PATH, buffer);
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}
