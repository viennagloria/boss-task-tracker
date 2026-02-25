import { createMockSlackClient } from '../setup';
import {
  fetchMessage,
  getPermalink,
  getUserDisplayName,
  getChannelName,
  addReaction,
} from '../../src/services/slack';
import { WebClient } from '@slack/web-api';

function mockClient() {
  return createMockSlackClient() as unknown as WebClient & ReturnType<typeof createMockSlackClient>;
}

describe('fetchMessage', () => {
  it('returns message text and user on success', async () => {
    const client = mockClient();
    (client as any).conversations.history.mockResolvedValue({
      messages: [{ text: 'hello', user: 'U123' }],
    });
    const result = await fetchMessage(client, 'C001', '1234.5678');
    expect(result).toEqual({ text: 'hello', user: 'U123' });
  });

  it('returns [No text content] when text is undefined', async () => {
    const client = mockClient();
    (client as any).conversations.history.mockResolvedValue({
      messages: [{ user: 'U123' }],
    });
    const result = await fetchMessage(client, 'C001', '1234.5678');
    expect(result).toEqual({ text: '[No text content]', user: 'U123' });
  });

  it('returns null when no messages found', async () => {
    const client = mockClient();
    (client as any).conversations.history.mockResolvedValue({ messages: [] });
    expect(await fetchMessage(client, 'C001', '1234.5678')).toBeNull();
  });

  it('returns null on API error', async () => {
    const client = mockClient();
    (client as any).conversations.history.mockRejectedValue(new Error('api error'));
    expect(await fetchMessage(client, 'C001', '1234.5678')).toBeNull();
  });
});

describe('getPermalink', () => {
  it('returns permalink on success', async () => {
    const client = mockClient();
    (client as any).chat.getPermalink.mockResolvedValue({ permalink: 'https://slack.com/link' });
    expect(await getPermalink(client, 'C001', '1234.5678')).toBe('https://slack.com/link');
  });

  it('returns null on error', async () => {
    const client = mockClient();
    (client as any).chat.getPermalink.mockRejectedValue(new Error('api error'));
    expect(await getPermalink(client, 'C001', '1234.5678')).toBeNull();
  });
});

describe('getUserDisplayName', () => {
  it('returns display_name when available', async () => {
    const client = mockClient();
    (client as any).users.info.mockResolvedValue({
      user: { profile: { display_name: 'Alice', real_name: 'Alice Smith' }, name: 'alice' },
    });
    expect(await getUserDisplayName(client, 'U123')).toBe('Alice');
  });

  it('falls back to real_name', async () => {
    const client = mockClient();
    (client as any).users.info.mockResolvedValue({
      user: { profile: { display_name: '', real_name: 'Alice Smith' }, name: 'alice' },
    });
    expect(await getUserDisplayName(client, 'U123')).toBe('Alice Smith');
  });

  it('falls back to name', async () => {
    const client = mockClient();
    (client as any).users.info.mockResolvedValue({
      user: { profile: { display_name: '', real_name: '' }, name: 'alice' },
    });
    expect(await getUserDisplayName(client, 'U123')).toBe('alice');
  });

  it('returns null on error', async () => {
    const client = mockClient();
    (client as any).users.info.mockRejectedValue(new Error('api error'));
    expect(await getUserDisplayName(client, 'U123')).toBeNull();
  });
});

describe('getChannelName', () => {
  it('returns channel name', async () => {
    const client = mockClient();
    (client as any).conversations.info.mockResolvedValue({ channel: { name: 'general' } });
    expect(await getChannelName(client, 'C001')).toBe('general');
  });

  it('returns null on error', async () => {
    const client = mockClient();
    (client as any).conversations.info.mockRejectedValue(new Error('api error'));
    expect(await getChannelName(client, 'C001')).toBeNull();
  });
});

describe('addReaction', () => {
  it('returns true on success', async () => {
    const client = mockClient();
    (client as any).reactions.add.mockResolvedValue({ ok: true });
    expect(await addReaction(client, 'C001', '1234.5678', 'thumbsup')).toBe(true);
  });

  it('returns true on already_reacted error', async () => {
    const client = mockClient();
    (client as any).reactions.add.mockRejectedValue({ data: { error: 'already_reacted' } });
    expect(await addReaction(client, 'C001', '1234.5678', 'thumbsup')).toBe(true);
  });

  it('returns false on other errors', async () => {
    const client = mockClient();
    (client as any).reactions.add.mockRejectedValue(new Error('api error'));
    expect(await addReaction(client, 'C001', '1234.5678', 'thumbsup')).toBe(false);
  });
});
