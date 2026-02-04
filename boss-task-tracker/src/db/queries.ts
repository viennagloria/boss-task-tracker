import { getDatabase, saveDatabase } from './index';

export interface PinnedMessage {
  id: number;
  message_ts: string;
  channel_id: string;
  message_text: string;
  message_author_id: string;
  message_author_name: string | null;
  pinned_by_user_id: string;
  channel_name: string | null;
  permalink: string | null;
  pinned_at: string;
  notion_page_id: string | null;
  notion_synced_at: string | null;
}

export interface InsertPinData {
  message_ts: string;
  channel_id: string;
  message_text: string;
  message_author_id: string;
  message_author_name?: string | null;
  pinned_by_user_id: string;
  channel_name?: string | null;
  permalink?: string | null;
}

export function insertPin(data: InsertPinData): PinnedMessage | null {
  const db = getDatabase();

  // Check if already exists
  const existing = db.exec(
    `SELECT * FROM pinned_messages
     WHERE message_ts = ? AND channel_id = ? AND pinned_by_user_id = ?`,
    [data.message_ts, data.channel_id, data.pinned_by_user_id]
  );

  if (existing.length > 0 && existing[0].values.length > 0) {
    return null; // Already pinned
  }

  db.run(
    `INSERT INTO pinned_messages
     (message_ts, channel_id, message_text, message_author_id, message_author_name, pinned_by_user_id, channel_name, permalink)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.message_ts,
      data.channel_id,
      data.message_text,
      data.message_author_id,
      data.message_author_name || null,
      data.pinned_by_user_id,
      data.channel_name || null,
      data.permalink || null,
    ]
  );

  saveDatabase();

  // Return the inserted row
  const result = db.exec(
    `SELECT * FROM pinned_messages
     WHERE message_ts = ? AND channel_id = ? AND pinned_by_user_id = ?`,
    [data.message_ts, data.channel_id, data.pinned_by_user_id]
  );

  if (result.length > 0 && result[0].values.length > 0) {
    return rowToPin(result[0].columns, result[0].values[0]);
  }

  return null;
}

export function getPinsByUser(
  userId: string,
  limit: number = 10,
  offset: number = 0
): PinnedMessage[] {
  const db = getDatabase();
  const result = db.exec(
    `SELECT * FROM pinned_messages
     WHERE pinned_by_user_id = ?
     ORDER BY pinned_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  if (result.length === 0) return [];

  return result[0].values.map((row: unknown[]) => rowToPin(result[0].columns, row));
}

export function searchPins(userId: string, query: string): PinnedMessage[] {
  const db = getDatabase();
  const searchPattern = `%${query}%`;
  const result = db.exec(
    `SELECT * FROM pinned_messages
     WHERE pinned_by_user_id = ?
       AND (message_text LIKE ? OR channel_name LIKE ? OR message_author_name LIKE ?)
     ORDER BY pinned_at DESC
     LIMIT 20`,
    [userId, searchPattern, searchPattern, searchPattern]
  );

  if (result.length === 0) return [];

  return result[0].values.map((row: unknown[]) => rowToPin(result[0].columns, row));
}

export function countPinsByUser(userId: string): number {
  const db = getDatabase();
  const result = db.exec(
    `SELECT COUNT(*) as count FROM pinned_messages WHERE pinned_by_user_id = ?`,
    [userId]
  );

  if (result.length === 0) return 0;
  return result[0].values[0][0] as number;
}

function rowToPin(columns: string[], values: unknown[]): PinnedMessage {
  const pin: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    pin[col] = values[i];
  });
  return pin as unknown as PinnedMessage;
}
