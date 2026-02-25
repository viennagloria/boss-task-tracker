import { Database } from 'sql.js';
import { createTestDatabase } from '../setup';

let testDb: Database;

vi.mock('../../src/db/index', () => ({
  getDatabase: () => testDb,
  saveDatabase: vi.fn(),
}));

const { handlePinsCommand } = await import('../../src/handlers/commands');
const { insertPin } = await import('../../src/db/queries');

beforeEach(async () => {
  testDb = await createTestDatabase();
});

afterEach(() => {
  testDb.close();
});

function makeCommandArgs(text: string = '', userId: string = 'U_USER') {
  const ack = vi.fn().mockResolvedValue(undefined);
  const respond = vi.fn().mockResolvedValue(undefined);
  return {
    command: { user_id: userId, text },
    ack,
    respond,
  };
}

function seedPins() {
  insertPin({
    message_ts: '1.0',
    channel_id: 'C001',
    message_text: 'fix the bug',
    message_author_id: 'U_A',
    message_author_name: 'Alice',
    pinned_by_user_id: 'U_USER',
    channel_name: 'general',
    permalink: 'https://slack.com/1',
  });
  insertPin({
    message_ts: '2.0',
    channel_id: 'C002',
    message_text: 'deploy to prod',
    message_author_id: 'U_B',
    message_author_name: 'Bob',
    pinned_by_user_id: 'U_USER',
    channel_name: 'random',
    permalink: 'https://slack.com/2',
  });
}

describe('handlePinsCommand', () => {
  it('always calls ack() first', async () => {
    const args = makeCommandArgs();
    await handlePinsCommand(args as any);
    expect(args.ack).toHaveBeenCalled();
  });

  it('default: returns pending pins', async () => {
    seedPins();
    const args = makeCommandArgs('');
    await handlePinsCommand(args as any);

    expect(args.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'section' }),
        ]),
      })
    );
  });

  it('all: returns all pins', async () => {
    seedPins();
    const args = makeCommandArgs('all');
    await handlePinsCommand(args as any);

    const response = args.respond.mock.calls[0][0];
    expect(response.response_type).toBe('ephemeral');
    // Header should say "All Pins"
    expect(response.blocks[0].text.text).toContain('All Pins');
  });

  it('done: returns empty message when no completed pins', async () => {
    seedPins();
    const args = makeCommandArgs('done');
    await handlePinsCommand(args as any);

    const response = args.respond.mock.calls[0][0];
    expect(response.blocks[0].text.text).toContain('No completed pins');
  });

  it('search: returns matching pins', async () => {
    seedPins();
    const args = makeCommandArgs('search deploy');
    await handlePinsCommand(args as any);

    const response = args.respond.mock.calls[0][0];
    expect(response.blocks[0].text.text).toContain('Search Results');
    expect(response.blocks[0].text.text).toContain('deploy');
  });

  it('complete: marks pin as done', async () => {
    seedPins();
    const args = makeCommandArgs('complete 1');
    await handlePinsCommand(args as any);

    expect(args.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('marked as complete'),
      })
    );
  });

  it('complete: returns error for invalid ID', async () => {
    const args = makeCommandArgs('complete abc');
    await handlePinsCommand(args as any);

    expect(args.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Invalid pin ID'),
      })
    );
  });

  it('complete: returns not found for non-existent pin', async () => {
    const args = makeCommandArgs('complete 999');
    await handlePinsCommand(args as any);

    expect(args.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('not found'),
      })
    );
  });

  it('delete: removes pin', async () => {
    seedPins();
    const args = makeCommandArgs('delete 1');
    await handlePinsCommand(args as any);

    expect(args.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('deleted'),
      })
    );
  });

  it('delete: returns not found for non-existent pin', async () => {
    const args = makeCommandArgs('delete 999');
    await handlePinsCommand(args as any);

    expect(args.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('not found'),
      })
    );
  });

  it('channel: filters by channel name', async () => {
    seedPins();
    const args = makeCommandArgs('channel random');
    await handlePinsCommand(args as any);

    const response = args.respond.mock.calls[0][0];
    expect(response.blocks[0].text.text).toContain('#random');
  });

  it('channels: lists channels with pins', async () => {
    seedPins();
    const args = makeCommandArgs('channels');
    await handlePinsCommand(args as any);

    const response = args.respond.mock.calls[0][0];
    expect(response.blocks[0].text.text).toContain('general');
    expect(response.blocks[0].text.text).toContain('random');
  });

  it('help: returns help blocks', async () => {
    const args = makeCommandArgs('help');
    await handlePinsCommand(args as any);

    const response = args.respond.mock.calls[0][0];
    expect(response.blocks[0].text.text).toContain('Help');
  });
});
