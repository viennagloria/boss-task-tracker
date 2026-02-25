import { PinnedMessage } from '../../src/db/queries';
import {
  formatPinsList,
  formatSearchResults,
  formatPinBlock,
  formatChannelPins,
  formatChannelsList,
  formatHelpMessage,
} from '../../src/handlers/formatters';

const makePin = (overrides: Partial<PinnedMessage> = {}): PinnedMessage => ({
  id: 1,
  message_ts: '1234.5678',
  channel_id: 'C001',
  message_text: 'Test message',
  message_author_id: 'U_AUTHOR',
  message_author_name: 'Alice',
  pinned_by_user_id: 'U_PINNER',
  channel_name: 'general',
  permalink: 'https://slack.com/archives/C001/p1234',
  pinned_at: '2025-01-15T10:00:00Z',
  status: 'pending',
  ...overrides,
});

describe('formatPinsList', () => {
  it('shows empty message for pending view', () => {
    const blocks = formatPinsList([], 0, 'pending');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'section',
      text: { text: expect.stringContaining('No pending pins') },
    });
  });

  it('shows empty message for done view', () => {
    const blocks = formatPinsList([], 0, 'done');
    expect(blocks[0].type).toBe('section');
    expect((blocks[0] as any).text.text).toContain('No completed pins');
  });

  it('shows empty message for all view', () => {
    const blocks = formatPinsList([], 0, 'all');
    expect((blocks[0] as any).text.text).toContain("don't have any pinned messages");
  });

  it('includes header with count', () => {
    const pins = [makePin()];
    const blocks = formatPinsList(pins, 5, 'pending');
    expect((blocks[0] as any).text.text).toContain('Pending Pins');
    expect((blocks[0] as any).text.text).toContain('1 of 5');
  });

  it('includes divider and pin blocks', () => {
    const pins = [makePin(), makePin({ id: 2 })];
    const blocks = formatPinsList(pins, 2, 'all');
    // header + divider + 2 pins + context footer
    expect(blocks).toHaveLength(5);
    expect(blocks[1]).toMatchObject({ type: 'divider' });
  });

  it('includes context footer with commands', () => {
    const blocks = formatPinsList([makePin()], 1, 'pending');
    const last = blocks[blocks.length - 1];
    expect(last).toMatchObject({ type: 'context' });
    expect((last as any).elements[0].text).toContain('/pins');
  });
});

describe('formatPinBlock', () => {
  it('shows hourglass for pending status', () => {
    const block = formatPinBlock(makePin({ status: 'pending' }));
    expect((block as any).text.text).toContain(':hourglass_flowing_sand:');
  });

  it('shows checkmark for done status', () => {
    const block = formatPinBlock(makePin({ status: 'done' }));
    expect((block as any).text.text).toContain(':white_check_mark:');
  });

  it('truncates messages longer than 200 chars', () => {
    const longText = 'x'.repeat(250);
    const block = formatPinBlock(makePin({ message_text: longText }));
    const text = (block as any).text.text;
    expect(text).toContain('...');
    expect(text).not.toContain('x'.repeat(250));
  });

  it('shows permalink when available', () => {
    const block = formatPinBlock(makePin({ permalink: 'https://slack.com/link' }));
    expect((block as any).text.text).toContain('View in Slack');
  });

  it('omits link text when no permalink', () => {
    const block = formatPinBlock(makePin({ permalink: null }));
    expect((block as any).text.text).not.toContain('View in Slack');
  });

  it('uses author name when available', () => {
    const block = formatPinBlock(makePin({ message_author_name: 'Alice' }));
    expect((block as any).text.text).toContain('@Alice');
  });

  it('falls back to user mention when no author name', () => {
    const block = formatPinBlock(makePin({ message_author_name: null, message_author_id: 'U123' }));
    expect((block as any).text.text).toContain('<@U123>');
  });
});

describe('formatSearchResults', () => {
  it('shows no matches message for empty results', () => {
    const blocks = formatSearchResults([], 'test');
    expect((blocks[0] as any).text.text).toContain('No pins found');
    expect((blocks[0] as any).text.text).toContain('test');
  });

  it('shows count and query in header', () => {
    const blocks = formatSearchResults([makePin()], 'deploy');
    expect((blocks[0] as any).text.text).toContain('Search Results');
    expect((blocks[0] as any).text.text).toContain('deploy');
    expect((blocks[0] as any).text.text).toContain('1 found');
  });
});

describe('formatChannelPins', () => {
  it('shows empty message for no pins', () => {
    const blocks = formatChannelPins([], 0, 'general');
    expect((blocks[0] as any).text.text).toContain('No pins in #general');
  });

  it('shows header with channel name and count', () => {
    const blocks = formatChannelPins([makePin()], 1, 'general');
    expect((blocks[0] as any).text.text).toContain('#general');
    expect((blocks[0] as any).text.text).toContain('1 total');
  });
});

describe('formatChannelsList', () => {
  it('shows empty message for no channels', () => {
    const blocks = formatChannelsList([]);
    expect((blocks[0] as any).text.text).toContain("don't have pins");
  });

  it('lists channels as bullet points', () => {
    const blocks = formatChannelsList(['general', 'random']);
    const text = (blocks[0] as any).text.text;
    expect(text).toContain('• #general');
    expect(text).toContain('• #random');
  });
});

describe('formatHelpMessage', () => {
  it('includes all commands', () => {
    const blocks = formatHelpMessage();
    const text = blocks.map((b: any) => b.text?.text || '').join(' ');
    expect(text).toContain('/pins');
    expect(text).toContain('/pins all');
    expect(text).toContain('/pins done');
    expect(text).toContain('/pins search');
    expect(text).toContain('/pins complete');
    expect(text).toContain('/pins delete');
    expect(text).toContain('/pins channel');
    expect(text).toContain('/pins channels');
    expect(text).toContain('/pins help');
  });
});
