import { AllMiddlewareArgs, SlackCommandMiddlewareArgs, KnownBlock } from '@slack/bolt';
import { getPinsByUser, searchPins, countPinsByUser, getUnsyncedPins, updateNotionSync, PinnedMessage } from '../db/queries';
import { syncPinToNotion } from '../services/notion';
import { isNotionConfigured } from '../config';

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
    } else if (subcommand === 'sync') {
      await handleSyncCommand(userId, respond);
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
  const notionStatus = pin.notion_page_id ? ' :memo:' : '';

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*From ${authorDisplay} in ${channelDisplay}*${notionStatus}\n> ${messagePreview}\n${linkText} • Pinned ${pinnedDate}`,
    },
  };
}

async function handleSyncCommand(
  userId: string,
  respond: (message: { response_type: 'ephemeral' | 'in_channel'; text?: string; blocks?: KnownBlock[] }) => Promise<unknown>
): Promise<void> {
  if (!isNotionConfigured()) {
    await respond({
      response_type: 'ephemeral',
      text: 'Notion integration is not configured. Ask your admin to set up NOTION_TOKEN and NOTION_DATABASE_ID.',
    });
    return;
  }

  const unsyncedPins = getUnsyncedPins(userId);

  if (unsyncedPins.length === 0) {
    await respond({
      response_type: 'ephemeral',
      text: 'All your pins are already synced to Notion! :white_check_mark:',
    });
    return;
  }

  await respond({
    response_type: 'ephemeral',
    text: `Syncing ${unsyncedPins.length} pin(s) to Notion...`,
  });

  let successCount = 0;
  let failCount = 0;

  for (const pin of unsyncedPins) {
    const result = await syncPinToNotion(pin);
    if (result.success && result.pageId) {
      updateNotionSync(pin.id, result.pageId);
      successCount++;
    } else {
      failCount++;
      console.error(`Failed to sync pin ${pin.id}:`, result.error);
    }
  }

  const resultMessage = failCount > 0
    ? `Synced ${successCount} pin(s) to Notion. ${failCount} failed.`
    : `Successfully synced ${successCount} pin(s) to Notion! :memo:`;

  await respond({
    response_type: 'ephemeral',
    text: resultMessage,
  });
}
