import { KnownBlock } from '@slack/bolt';
import { PinnedMessage } from '../db/queries';

export function formatPinsList(
  pins: PinnedMessage[],
  total: number,
  view: 'pending' | 'done' | 'all'
): KnownBlock[] {
  if (pins.length === 0) {
    const emptyMessages = {
      pending: "*No pending pins.*\n\nReact to a message with :pushpin: to save it!",
      done: "*No completed pins yet.*\n\nUse `/pins complete <id>` to mark pins as done.",
      all: "*You don't have any pinned messages yet.*\n\nReact to a message with :pushpin: to save it!",
    };
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: emptyMessages[view],
        },
      },
    ];
  }

  const titles = {
    pending: `*Pending Pins* (${pins.length} of ${total})`,
    done: `*Completed Pins* (${pins.length} of ${total})`,
    all: `*All Pins* (${pins.length} of ${total})`,
  };

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: titles[view],
      },
    },
    { type: 'divider' },
  ];

  for (const pin of pins) {
    blocks.push(formatPinBlock(pin));
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '`/pins` | `/pins done` | `/pins all` | `/pins channels` | `/pins channel <name>` | `/pins help`',
      },
    ],
  });

  return blocks;
}

export function formatSearchResults(pins: PinnedMessage[], query: string): KnownBlock[] {
  if (pins.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*No pins found matching "${query}"*`,
        },
      },
    ];
  }

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Search Results for "${query}"* (${pins.length} found)`,
      },
    },
    { type: 'divider' },
  ];

  for (const pin of pins) {
    blocks.push(formatPinBlock(pin));
  }

  return blocks;
}

export function formatPinBlock(pin: PinnedMessage): KnownBlock {
  const authorDisplay = pin.message_author_name
    ? `@${pin.message_author_name}`
    : `<@${pin.message_author_id}>`;
  const channelDisplay = pin.channel_name ? `#${pin.channel_name}` : 'a channel';
  const pinnedDate = new Date(pin.pinned_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Truncate long messages
  const maxLength = 200;
  let messagePreview = pin.message_text;
  if (messagePreview.length > maxLength) {
    messagePreview = messagePreview.substring(0, maxLength) + '...';
  }

  const linkText = pin.permalink ? `<${pin.permalink}|View in Slack>` : '';
  const statusIcon = pin.status === 'done' ? ':white_check_mark:' : ':hourglass_flowing_sand:';

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${statusIcon} *#${pin.id}* - From ${authorDisplay} in ${channelDisplay}\n> ${messagePreview}\n${linkText} • Pinned ${pinnedDate}`,
    },
  };
}

export function formatChannelPins(
  pins: PinnedMessage[],
  total: number,
  channelName: string
): KnownBlock[] {
  if (pins.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*No pins in #${channelName}*`,
        },
      },
    ];
  }

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Pins from #${channelName}* (${pins.length} total)`,
      },
    },
    { type: 'divider' },
  ];

  for (const pin of pins) {
    blocks.push(formatPinBlock(pin));
  }

  return blocks;
}

export function formatChannelsList(channels: string[]): KnownBlock[] {
  if (channels.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*You don't have pins in any channels yet.*",
        },
      },
    ];
  }

  const channelList = channels.map((ch) => `• #${ch}`).join('\n');

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Channels with pins:*\n${channelList}\n\nUse \`/pins channel <name>\` to filter by channel.`,
      },
    },
  ];
}

export function formatHelpMessage(): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Boss Task Tracker - Help*',
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*How to pin a message:*\nReact to any message with :pushpin: to save it as a task.\n\n*Commands:*\n• \`/pins\` - Show pending tasks\n• \`/pins all\` - Show all tasks\n• \`/pins done\` - Show completed tasks\n• \`/pins channel <name>\` - Show pins from a channel\n• \`/pins channels\` - List all channels with pins\n• \`/pins search <query>\` - Search your tasks\n• \`/pins complete <id>\` - Mark a task as done\n• \`/pins delete <id>\` - Remove a task\n• \`/pins help\` - Show this help message`,
      },
    },
  ];
}
