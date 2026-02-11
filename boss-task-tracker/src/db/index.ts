import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

let db: Database;

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
  const SQL = await initSqlJs();

  const dbDir = path.dirname(config.DATABASE_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (fs.existsSync(config.DATABASE_PATH)) {
    const buffer = fs.readFileSync(config.DATABASE_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA);

  // Run migration for existing databases (add status column if missing)
  try {
    db.run(MIGRATION);
  } catch {
    // Column already exists, ignore error
  }

  saveDatabase();

  console.log(`Database initialized at ${config.DATABASE_PATH}`);
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
