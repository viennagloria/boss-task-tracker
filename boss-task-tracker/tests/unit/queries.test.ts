import { Database } from 'sql.js';
import { createTestDatabase } from '../setup';

let testDb: Database;

vi.mock('../../src/db/index', () => ({
  getDatabase: () => testDb,
  saveDatabase: vi.fn(),
}));

// Import after mock is set up
const { insertPin, getPinsByUser, searchPins, countPinsByUser, getChannelsByUser, getPinById, updatePinStatus, deletePin } = await import('../../src/db/queries');

const basePinData = {
  message_ts: '1234.5678',
  channel_id: 'C001',
  message_text: 'important task',
  message_author_id: 'U_AUTHOR',
  message_author_name: 'Alice',
  pinned_by_user_id: 'U_PINNER',
  channel_name: 'general',
  permalink: 'https://slack.com/archives/C001/p1234',
};

beforeEach(async () => {
  testDb = await createTestDatabase();
});

afterEach(() => {
  testDb.close();
});

describe('insertPin', () => {
  it('inserts a pin and returns it', () => {
    const pin = insertPin(basePinData);
    expect(pin).not.toBeNull();
    expect(pin!.id).toBe(1);
    expect(pin!.message_text).toBe('important task');
    expect(pin!.status).toBe('pending');
    expect(pin!.channel_name).toBe('general');
  });

  it('returns null for duplicate pin', () => {
    insertPin(basePinData);
    const duplicate = insertPin(basePinData);
    expect(duplicate).toBeNull();
  });

  it('allows same message pinned by different users', () => {
    insertPin(basePinData);
    const pin2 = insertPin({ ...basePinData, pinned_by_user_id: 'U_OTHER' });
    expect(pin2).not.toBeNull();
    expect(pin2!.id).toBe(2);
  });
});

describe('getPinsByUser', () => {
  it('returns pins for the correct user', () => {
    insertPin({ ...basePinData, message_ts: '1000.0', message_text: 'first' });
    insertPin({ ...basePinData, message_ts: '2000.0', message_text: 'second' });
    const pins = getPinsByUser('U_PINNER');
    expect(pins).toHaveLength(2);
    const texts = pins.map(p => p.message_text);
    expect(texts).toContain('first');
    expect(texts).toContain('second');
  });

  it('filters by status', () => {
    insertPin({ ...basePinData, message_ts: '1000.0' });
    insertPin({ ...basePinData, message_ts: '2000.0' });
    updatePinStatus(1, 'U_PINNER', 'done');

    const pending = getPinsByUser('U_PINNER', 10, 0, 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(2);

    const done = getPinsByUser('U_PINNER', 10, 0, 'done');
    expect(done).toHaveLength(1);
    expect(done[0].id).toBe(1);
  });

  it('filters by channel name', () => {
    insertPin({ ...basePinData, message_ts: '1000.0', channel_name: 'general' });
    insertPin({ ...basePinData, message_ts: '2000.0', channel_id: 'C002', channel_name: 'random' });

    const pins = getPinsByUser('U_PINNER', 10, 0, undefined, 'random');
    expect(pins).toHaveLength(1);
    expect(pins[0].channel_name).toBe('random');
  });

  it('respects limit and offset', () => {
    for (let i = 0; i < 5; i++) {
      insertPin({ ...basePinData, message_ts: `${i}.0` });
    }
    const page = getPinsByUser('U_PINNER', 2, 2);
    expect(page).toHaveLength(2);
  });

  it('returns empty array for unknown user', () => {
    insertPin(basePinData);
    const pins = getPinsByUser('U_NOBODY');
    expect(pins).toEqual([]);
  });
});

describe('searchPins', () => {
  beforeEach(() => {
    insertPin({ ...basePinData, message_ts: '1.0', message_text: 'deploy the app' });
    insertPin({ ...basePinData, message_ts: '2.0', message_text: 'fix the bug', channel_name: 'engineering' });
    insertPin({ ...basePinData, message_ts: '3.0', message_text: 'review PR', message_author_name: 'Bob' });
  });

  it('searches by message text', () => {
    const results = searchPins('U_PINNER', 'deploy');
    expect(results).toHaveLength(1);
    expect(results[0].message_text).toBe('deploy the app');
  });

  it('searches by channel name', () => {
    const results = searchPins('U_PINNER', 'engineering');
    expect(results).toHaveLength(1);
    expect(results[0].channel_name).toBe('engineering');
  });

  it('searches by author name', () => {
    const results = searchPins('U_PINNER', 'Bob');
    expect(results).toHaveLength(1);
    expect(results[0].message_author_name).toBe('Bob');
  });

  it('returns empty array when no matches', () => {
    const results = searchPins('U_PINNER', 'nonexistent');
    expect(results).toEqual([]);
  });

  it('escapes SQL LIKE wildcards', () => {
    insertPin({ ...basePinData, message_ts: '4.0', message_text: '100% done' });
    const results = searchPins('U_PINNER', '100%');
    expect(results).toHaveLength(1);
    expect(results[0].message_text).toBe('100% done');
  });
});

describe('countPinsByUser', () => {
  beforeEach(() => {
    insertPin({ ...basePinData, message_ts: '1.0', channel_name: 'general' });
    insertPin({ ...basePinData, message_ts: '2.0', channel_name: 'random', channel_id: 'C002' });
    updatePinStatus(1, 'U_PINNER', 'done');
  });

  it('counts all pins', () => {
    expect(countPinsByUser('U_PINNER')).toBe(2);
  });

  it('counts by status', () => {
    expect(countPinsByUser('U_PINNER', 'done')).toBe(1);
    expect(countPinsByUser('U_PINNER', 'pending')).toBe(1);
  });

  it('counts by channel', () => {
    expect(countPinsByUser('U_PINNER', undefined, 'random')).toBe(1);
  });

  it('returns 0 for unknown user', () => {
    expect(countPinsByUser('U_NOBODY')).toBe(0);
  });
});

describe('getChannelsByUser', () => {
  it('returns distinct channel names sorted', () => {
    insertPin({ ...basePinData, message_ts: '1.0', channel_name: 'general' });
    insertPin({ ...basePinData, message_ts: '2.0', channel_id: 'C002', channel_name: 'random' });
    insertPin({ ...basePinData, message_ts: '3.0', channel_id: 'C003', channel_name: 'general' }); // duplicate channel

    const channels = getChannelsByUser('U_PINNER');
    expect(channels).toEqual(['general', 'random']);
  });

  it('returns empty array when no channels', () => {
    expect(getChannelsByUser('U_NOBODY')).toEqual([]);
  });
});

describe('getPinById', () => {
  it('returns pin by id and user', () => {
    insertPin(basePinData);
    const pin = getPinById(1, 'U_PINNER');
    expect(pin).not.toBeNull();
    expect(pin!.message_text).toBe('important task');
  });

  it('returns null for wrong user', () => {
    insertPin(basePinData);
    expect(getPinById(1, 'U_OTHER')).toBeNull();
  });

  it('returns null for non-existent id', () => {
    expect(getPinById(999, 'U_PINNER')).toBeNull();
  });
});

describe('updatePinStatus', () => {
  it('updates status to done', () => {
    insertPin(basePinData);
    const success = updatePinStatus(1, 'U_PINNER', 'done');
    expect(success).toBe(true);

    const pin = getPinById(1, 'U_PINNER');
    expect(pin!.status).toBe('done');
  });

  it('returns false for non-existent pin', () => {
    expect(updatePinStatus(999, 'U_PINNER', 'done')).toBe(false);
  });

  it('returns false for wrong user', () => {
    insertPin(basePinData);
    expect(updatePinStatus(1, 'U_OTHER', 'done')).toBe(false);
  });
});

describe('deletePin', () => {
  it('deletes a pin', () => {
    insertPin(basePinData);
    const success = deletePin(1, 'U_PINNER');
    expect(success).toBe(true);
    expect(getPinById(1, 'U_PINNER')).toBeNull();
  });

  it('returns false for non-existent pin', () => {
    expect(deletePin(999, 'U_PINNER')).toBe(false);
  });

  it('returns false for wrong user', () => {
    insertPin(basePinData);
    expect(deletePin(1, 'U_OTHER')).toBe(false);
  });
});
