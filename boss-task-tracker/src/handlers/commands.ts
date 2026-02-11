import { AllMiddlewareArgs, SlackCommandMiddlewareArgs, KnownBlock } from '@slack/bolt';
import { getPinsByUser, searchPins, countPinsByUser, updatePinStatus, deletePin, PinnedMessage, PinStatus } from '../db/queries';

type CommandArgs = SlackCommandMiddlewareArgs & AllMiddlewareArgs;

export async function handlePinsCommand({
  command,
  ack,
  respond,
}: CommandArgs): Promise<void> {
  await ack();

  const userId = command.user_id;
  const args = command.text.trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase() || '';

  try {
    if (subcommand === 'search' && args.length > 1) {
      const query = args.slice(1).join(' ');
      const pins = searchPins(userId, query);
      await respond({
        response_type: 'ephemeral',
        blocks: formatSearchResults(pins, query),
      });
    } else if (subcommand === 'all') {
      const pins = getPinsByUser(userId, 50);
      const total = countPinsByUser(userId);
      await respond({
        response_type: 'ephemeral',
        blocks: formatPinsList(pins, total, 'all'),
      });
    } else if (subcommand === 'done') {
      const pins = getPinsByUser(userId, 50, 0, 'done');
      const total = countPinsByUser(userId, 'done');
      await respond({
        response_type: 'ephemeral',
        blocks: formatPinsList(pins, total, 'done'),
      });
    } else if (subcommand === 'complete' && args.length > 1) {
      const pinId = parseInt(args[1], 10);
      await handleCompleteCommand(userId, pinId, respond);
    } else if (subcommand === 'delete' && args.length > 1) {
      const pinId = parseInt(args[1], 10);
      await handleDeleteCommand(userId, pinId, respond);
    } else if (subcommand === 'help') {
      await respond({
        response_type: 'ephemeral',
        blocks: formatHelpMessage(),
      });
    } else {
      // Default: show pending pins
      const pins = getPinsByUser(userId, 10, 0, 'pending');
      const total = countPinsByUser(userId, 'pending');
      await respond({
        response_type: 'ephemeral',
        blocks: formatPinsList(pins, total, 'pending'),
      });
    }
  } catch (error) {
    console.error('Error handling /pins command:', error);
    await respond({
      response_type: 'ephemeral',
      text: 'Something went wrong. Please try again.',
    });
  }
}

function formatPinsList(
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
        text: '`/pins` pending | `/pins done` | `/pins all` | `/pins complete <id>` | `/pins delete <id>` | `/pins help`',
      },
    ],
  });

  return blocks;
}

function formatSearchResults(pins: PinnedMessage[], query: string): KnownBlock[] {
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

function formatPinBlock(pin: PinnedMessage): KnownBlock {
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

async function handleCompleteCommand(
  userId: string,
  pinId: number,
  respond: (message: { response_type: 'ephemeral' | 'in_channel'; text: string }) => Promise<unknown>
): Promise<void> {
  if (isNaN(pinId)) {
    await respond({
      response_type: 'ephemeral',
      text: 'Invalid pin ID. Use `/pins` to see your pins and their IDs.',
    });
    return;
  }

  const success = updatePinStatus(pinId, userId, 'done');

  if (success) {
    await respond({
      response_type: 'ephemeral',
      text: `:white_check_mark: Pin #${pinId} marked as complete!`,
    });
  } else {
    await respond({
      response_type: 'ephemeral',
      text: `Pin #${pinId} not found. Use \`/pins\` to see your pins.`,
    });
  }
}

async function handleDeleteCommand(
  userId: string,
  pinId: number,
  respond: (message: { response_type: 'ephemeral' | 'in_channel'; text: string }) => Promise<unknown>
): Promise<void> {
  if (isNaN(pinId)) {
    await respond({
      response_type: 'ephemeral',
      text: 'Invalid pin ID. Use `/pins` to see your pins and their IDs.',
    });
    return;
  }

  const success = deletePin(pinId, userId);

  if (success) {
    await respond({
      response_type: 'ephemeral',
      text: `:wastebasket: Pin #${pinId} deleted.`,
    });
  } else {
    await respond({
      response_type: 'ephemeral',
      text: `Pin #${pinId} not found. Use \`/pins\` to see your pins.`,
    });
  }
}

function formatHelpMessage(): KnownBlock[] {
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
        text: `*How to pin a message:*\nReact to any message with :pushpin: to save it as a task.\n\n*Commands:*\n• \`/pins\` - Show pending tasks\n• \`/pins all\` - Show all tasks\n• \`/pins done\` - Show completed tasks\n• \`/pins search <query>\` - Search your tasks\n• \`/pins complete <id>\` - Mark a task as done\n• \`/pins delete <id>\` - Remove a task\n• \`/pins help\` - Show this help message`,
      },
    },
  ];
}
