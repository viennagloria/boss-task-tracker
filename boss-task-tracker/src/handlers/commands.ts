import { AllMiddlewareArgs, SlackCommandMiddlewareArgs, KnownBlock } from '@slack/bolt';
import { getPinsByUser, searchPins, countPinsByUser, PinnedMessage } from '../db/queries';

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
        blocks: formatPinsList(pins, total, true),
      });
    } else {
      // Default: show recent pins
      const pins = getPinsByUser(userId, 10);
      const total = countPinsByUser(userId);
      await respond({
        response_type: 'ephemeral',
        blocks: formatPinsList(pins, total, false),
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
  showAll: boolean
): KnownBlock[] {
  if (pins.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*You don't have any pinned messages yet.*\n\nReact to a message with :pushpin: to save it!",
        },
      },
    ];
  }

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: showAll
          ? `*All Your Pins* (${pins.length} of ${total})`
          : `*Your Recent Pins* (showing ${pins.length} of ${total})`,
      },
    },
    { type: 'divider' },
  ];

  for (const pin of pins) {
    blocks.push(formatPinBlock(pin));
  }

  if (!showAll && total > 10) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Use \`/pins all\` to see all ${total} pins, or \`/pins search <query>\` to search.`,
        },
      ],
    });
  }

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

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*From ${authorDisplay} in ${channelDisplay}*\n> ${messagePreview}\n${linkText} • Pinned ${pinnedDate}`,
    },
  };
}
