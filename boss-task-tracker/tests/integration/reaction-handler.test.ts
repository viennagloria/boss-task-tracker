import { Database } from 'sql.js';
import { createTestDatabase, createMockSlackClient } from '../setup';

let testDb: Database;

vi.mock('../../src/db/index', () => ({
  getDatabase: () => testDb,
  saveDatabase: vi.fn(),
}));

const { handleReactionAdded } = await import('../../src/handlers/reaction');
const { getPinsByUser } = await import('../../src/db/queries');

beforeEach(async () => {
  testDb = await createTestDatabase();
});

afterEach(() => {
  testDb.close();
});

function makeReactionEvent(overrides: Record<string, unknown> = {}) {
  return {
    reaction: 'pushpin',
    user: 'U_PINNER',
    item: { type: 'message', channel: 'C001', ts: '1234.5678' },
    ...overrides,
  };
}

function setupMockClient() {
  const client = createMockSlackClient();
  client.conversations.history.mockResolvedValue({
    messages: [{ text: 'important task', user: 'U_AUTHOR' }],
  });
  client.chat.getPermalink.mockResolvedValue({ permalink: 'https://slack.com/link' });
  client.users.info.mockResolvedValue({
    user: { profile: { display_name: 'Alice' } },
  });
  client.conversations.info.mockResolvedValue({ channel: { name: 'general' } });
  client.reactions.add.mockResolvedValue({ ok: true });
  return client;
}

describe('handleReactionAdded', () => {
  it('ignores non-pushpin reactions', async () => {
    const client = setupMockClient();
    await handleReactionAdded({
      event: makeReactionEvent({ reaction: 'thumbsup' }),
      client,
    } as any);

    expect(client.conversations.history).not.toHaveBeenCalled();
    expect(getPinsByUser('U_PINNER')).toHaveLength(0);
  });

  it('ignores non-message item types', async () => {
    const client = setupMockClient();
    await handleReactionAdded({
      event: makeReactionEvent({ item: { type: 'file', file: 'F001' } }),
      client,
    } as any);

    expect(client.conversations.history).not.toHaveBeenCalled();
  });

  it('saves pin and adds confirmation on pushpin reaction', async () => {
    const client = setupMockClient();
    await handleReactionAdded({
      event: makeReactionEvent(),
      client,
    } as any);

    const pins = getPinsByUser('U_PINNER');
    expect(pins).toHaveLength(1);
    expect(pins[0].message_text).toBe('important task');
    expect(pins[0].channel_name).toBe('general');
    expect(pins[0].permalink).toBe('https://slack.com/link');

    expect(client.reactions.add).toHaveBeenCalledWith({
      channel: 'C001',
      timestamp: '1234.5678',
      name: 'white_check_mark',
    });
  });

  it('handles round_pushpin the same way', async () => {
    const client = setupMockClient();
    await handleReactionAdded({
      event: makeReactionEvent({ reaction: 'round_pushpin' }),
      client,
    } as any);

    expect(getPinsByUser('U_PINNER')).toHaveLength(1);
  });

  it('does not add confirmation for duplicate pin', async () => {
    const client = setupMockClient();
    const args = { event: makeReactionEvent(), client } as any;

    await handleReactionAdded(args);
    await handleReactionAdded(args);

    expect(getPinsByUser('U_PINNER')).toHaveLength(1);
    // First call adds confirmation, second does not
    expect(client.reactions.add).toHaveBeenCalledTimes(1);
  });

  it('handles fetchMessage returning null gracefully', async () => {
    const client = setupMockClient();
    client.conversations.history.mockResolvedValue({ messages: [] });

    await handleReactionAdded({
      event: makeReactionEvent(),
      client,
    } as any);

    expect(getPinsByUser('U_PINNER')).toHaveLength(0);
    expect(client.reactions.add).not.toHaveBeenCalled();
  });
});
