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

function setupMockClient() {
  const client = createMockSlackClient();
  client.conversations.history.mockResolvedValue({
    messages: [{ text: 'deploy the new feature', user: 'U_AUTHOR' }],
  });
  client.chat.getPermalink.mockResolvedValue({ permalink: 'https://slack.com/archives/C001/p1234' });
  client.users.info.mockResolvedValue({
    user: { profile: { display_name: 'Alice', real_name: 'Alice Smith' }, name: 'alice' },
  });
  client.conversations.info.mockResolvedValue({ channel: { name: 'engineering' } });
  client.reactions.add.mockResolvedValue({ ok: true });
  return client;
}

describe('full reaction flow', () => {
  it('complete happy path: reaction -> fetch -> DB insert -> confirmation -> all fields correct', async () => {
    const client = setupMockClient();

    await handleReactionAdded({
      event: {
        reaction: 'pushpin',
        user: 'U_PINNER',
        item: { type: 'message', channel: 'C001', ts: '1234.5678' },
      },
      client,
    } as any);

    // Verify all Slack API calls were made
    expect(client.conversations.history).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C001', latest: '1234.5678' })
    );
    expect(client.chat.getPermalink).toHaveBeenCalled();
    expect(client.users.info).toHaveBeenCalledWith({ user: 'U_AUTHOR' });
    expect(client.conversations.info).toHaveBeenCalledWith({ channel: 'C001' });

    // Verify DB record has all correct fields
    const pins = getPinsByUser('U_PINNER');
    expect(pins).toHaveLength(1);

    const pin = pins[0];
    expect(pin.message_ts).toBe('1234.5678');
    expect(pin.channel_id).toBe('C001');
    expect(pin.message_text).toBe('deploy the new feature');
    expect(pin.message_author_id).toBe('U_AUTHOR');
    expect(pin.message_author_name).toBe('Alice');
    expect(pin.pinned_by_user_id).toBe('U_PINNER');
    expect(pin.channel_name).toBe('engineering');
    expect(pin.permalink).toBe('https://slack.com/archives/C001/p1234');
    expect(pin.status).toBe('pending');
    expect(pin.pinned_at).toBeTruthy();

    // Verify confirmation reaction
    expect(client.reactions.add).toHaveBeenCalledWith({
      channel: 'C001',
      timestamp: '1234.5678',
      name: 'white_check_mark',
    });
  });

  it('duplicate reaction: only one DB record, second reaction skips confirmation', async () => {
    const client = setupMockClient();

    const args = {
      event: {
        reaction: 'pushpin',
        user: 'U_PINNER',
        item: { type: 'message', channel: 'C001', ts: '1234.5678' },
      },
      client,
    } as any;

    await handleReactionAdded(args);
    await handleReactionAdded(args);

    expect(getPinsByUser('U_PINNER')).toHaveLength(1);
    expect(client.reactions.add).toHaveBeenCalledTimes(1);
  });

  it('Slack API partial failure: pin saved with null permalink when getPermalink fails', async () => {
    const client = setupMockClient();
    client.chat.getPermalink.mockRejectedValue(new Error('api error'));

    await handleReactionAdded({
      event: {
        reaction: 'pushpin',
        user: 'U_PINNER',
        item: { type: 'message', channel: 'C001', ts: '1234.5678' },
      },
      client,
    } as any);

    const pins = getPinsByUser('U_PINNER');
    expect(pins).toHaveLength(1);
    expect(pins[0].permalink).toBeNull();
    expect(pins[0].message_text).toBe('deploy the new feature');
  });
});
