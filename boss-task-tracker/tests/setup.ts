import initSqlJs, { Database } from 'sql.js';

// Provide dummy env vars so config.ts doesn't throw during test imports
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
process.env.DATABASE_PATH = ':memory:';

// ---------- In-memory database helper ----------

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

let SQL: Awaited<ReturnType<typeof initSqlJs>>;

/**
 * Returns a fresh in-memory Database with the schema applied.
 * WASM is loaded once and cached across calls.
 */
export async function createTestDatabase(): Promise<Database> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  const db = new SQL.Database();
  db.run(SCHEMA);
  return db;
}

// ---------- Slack WebClient mock factory ----------

export function createMockSlackClient() {
  return {
    conversations: {
      history: vi.fn(),
      info: vi.fn(),
    },
    chat: {
      getPermalink: vi.fn(),
    },
    users: {
      info: vi.fn(),
    },
    reactions: {
      add: vi.fn(),
    },
  };
}
