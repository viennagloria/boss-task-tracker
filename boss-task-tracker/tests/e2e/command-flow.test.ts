import { Database } from 'sql.js';
import { createTestDatabase, createMockSlackClient } from '../setup';

let testDb: Database;

vi.mock('../../src/db/index', () => ({
  getDatabase: () => testDb,
  saveDatabase: vi.fn(),
}));

const { handleReactionAdded } = await import('../../src/handlers/reaction');
const { handlePinsCommand } = await import('../../src/handlers/commands');
const { getPinsByUser } = await import('../../src/db/queries');

beforeEach(async () => {
  testDb = await createTestDatabase();
});

afterEach(() => {
  testDb.close();
});

function setupMockClient(text = 'important task', channel = 'general') {
  const client = createMockSlackClient();
  client.conversations.history.mockResolvedValue({
    messages: [{ text, user: 'U_AUTHOR' }],
  });
  client.chat.getPermalink.mockResolvedValue({ permalink: 'https://slack.com/link' });
  client.users.info.mockResolvedValue({
    user: { profile: { display_name: 'Alice' } },
  });
  client.conversations.info.mockResolvedValue({ channel: { name: channel } });
  client.reactions.add.mockResolvedValue({ ok: true });
  return client;
}

async function pinMessage(client: ReturnType<typeof createMockSlackClient>, ts = '1234.5678', channel = 'C001') {
  await handleReactionAdded({
    event: {
      reaction: 'pushpin',
      user: 'U_USER',
      item: { type: 'message', channel, ts },
    },
    client,
  } as any);
}

function makeCommandArgs(text: string) {
  return {
    command: { user_id: 'U_USER', text },
    ack: vi.fn().mockResolvedValue(undefined),
    respond: vi.fn().mockResolvedValue(undefined),
  };
}

describe('full command flows', () => {
  it('pin a message, then list it via /pins', async () => {
    const client = setupMockClient();
    await pinMessage(client);

    const args = makeCommandArgs('');
    await handlePinsCommand(args as any);

    const response = args.respond.mock.calls[0][0];
    expect(response.blocks.length).toBeGreaterThan(1);
    // Pin block should contain the message text
    const allText = response.blocks.map((b: any) => b.text?.text || '').join(' ');
    expect(allText).toContain('important task');
  });

  it('pin, complete, verify it moves from pending to done', async () => {
    const client = setupMockClient();
    await pinMessage(client);

    // Complete the pin
    const completeArgs = makeCommandArgs('complete 1');
    await handlePinsCommand(completeArgs as any);
    expect(completeArgs.respond.mock.calls[0][0].text).toContain('marked as complete');

    // Verify not in pending list
    const pendingArgs = makeCommandArgs('');
    await handlePinsCommand(pendingArgs as any);
    const pendingText = pendingArgs.respond.mock.calls[0][0].blocks
      .map((b: any) => b.text?.text || '').join(' ');
    expect(pendingText).toContain('No pending pins');

    // Verify in done list
    const doneArgs = makeCommandArgs('done');
    await handlePinsCommand(doneArgs as any);
    const doneText = doneArgs.respond.mock.calls[0][0].blocks
      .map((b: any) => b.text?.text || '').join(' ');
    expect(doneText).toContain('important task');
  });

  it('pin, delete, verify empty list', async () => {
    const client = setupMockClient();
    await pinMessage(client);

    const deleteArgs = makeCommandArgs('delete 1');
    await handlePinsCommand(deleteArgs as any);
    expect(deleteArgs.respond.mock.calls[0][0].text).toContain('deleted');

    // Verify empty
    const listArgs = makeCommandArgs('all');
    await handlePinsCommand(listArgs as any);
    const text = listArgs.respond.mock.calls[0][0].blocks
      .map((b: any) => b.text?.text || '').join(' ');
    expect(text).toContain("don't have any pinned messages");
  });

  it('pin across channels, filter with /pins channel', async () => {
    const client1 = setupMockClient('task in general', 'general');
    await pinMessage(client1, '1.0', 'C001');

    const client2 = setupMockClient('task in random', 'random');
    await pinMessage(client2, '2.0', 'C002');

    // List channels
    const channelsArgs = makeCommandArgs('channels');
    await handlePinsCommand(channelsArgs as any);
    const channelsText = channelsArgs.respond.mock.calls[0][0].blocks
      .map((b: any) => b.text?.text || '').join(' ');
    expect(channelsText).toContain('general');
    expect(channelsText).toContain('random');

    // Filter by channel
    const filterArgs = makeCommandArgs('channel random');
    await handlePinsCommand(filterArgs as any);
    const filterText = filterArgs.respond.mock.calls[0][0].blocks
      .map((b: any) => b.text?.text || '').join(' ');
    expect(filterText).toContain('task in random');
    expect(filterText).not.toContain('task in general');
  });

  it('pin messages and search by text', async () => {
    const client1 = setupMockClient('fix the login bug');
    await pinMessage(client1, '1.0');

    const client2 = setupMockClient('deploy to production');
    await pinMessage(client2, '2.0');

    const searchArgs = makeCommandArgs('search deploy');
    await handlePinsCommand(searchArgs as any);
    const searchText = searchArgs.respond.mock.calls[0][0].blocks
      .map((b: any) => b.text?.text || '').join(' ');
    expect(searchText).toContain('deploy to production');
    expect(searchText).not.toContain('login bug');
  });
});
