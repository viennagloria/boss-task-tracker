import { WebClient } from '@slack/web-api';

export async function fetchMessage(
  client: WebClient,
  channel: string,
  messageTs: string
): Promise<{ text: string; user: string } | null> {
  try {
    const result = await client.conversations.history({
      channel,
      latest: messageTs,
      inclusive: true,
      limit: 1,
    });

    if (result.messages && result.messages.length > 0) {
      const msg = result.messages[0];
      return {
        text: msg.text || '[No text content]',
        user: msg.user || 'unknown',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching message:', error);
    return null;
  }
}

export async function getPermalink(
  client: WebClient,
  channel: string,
  messageTs: string
): Promise<string | null> {
  try {
    const result = await client.chat.getPermalink({
      channel,
      message_ts: messageTs,
    });
    return result.permalink || null;
  } catch (error) {
    console.error('Error getting permalink:', error);
    return null;
  }
}

export async function getUserDisplayName(
  client: WebClient,
  userId: string
): Promise<string | null> {
  try {
    const result = await client.users.info({ user: userId });
    if (result.user) {
      return (
        result.user.profile?.display_name ||
        result.user.profile?.real_name ||
        result.user.name ||
        null
      );
    }
    return null;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

export async function getChannelName(
  client: WebClient,
  channelId: string
): Promise<string | null> {
  try {
    const result = await client.conversations.info({ channel: channelId });
    if (result.channel) {
      return result.channel.name || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting channel info:', error);
    return null;
  }
}

export async function addReaction(
  client: WebClient,
  channel: string,
  messageTs: string,
  emoji: string
): Promise<boolean> {
  try {
    await client.reactions.add({
      channel,
      timestamp: messageTs,
      name: emoji,
    });
    return true;
  } catch (error: unknown) {
    // Ignore "already_reacted" errors
    if (error && typeof error === 'object' && 'data' in error) {
      const slackError = error as { data?: { error?: string } };
      if (slackError.data?.error === 'already_reacted') {
        return true;
      }
    }
    console.error('Error adding reaction:', error);
    return false;
  }
}
