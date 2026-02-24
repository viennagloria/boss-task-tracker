import { AllMiddlewareArgs, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { getPinsByUser, searchPins, countPinsByUser, updatePinStatus, deletePin, getChannelsByUser } from '../db/queries';
import {
  formatPinsList,
  formatSearchResults,
  formatChannelPins,
  formatChannelsList,
  formatHelpMessage,
} from './formatters';

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
    } else if (subcommand === 'channel' && args.length > 1) {
      const channelName = args[1];
      const pins = getPinsByUser(userId, 50, 0, undefined, channelName);
      const total = countPinsByUser(userId, undefined, channelName);
      await respond({
        response_type: 'ephemeral',
        blocks: formatChannelPins(pins, total, channelName),
      });
    } else if (subcommand === 'channels') {
      const channels = getChannelsByUser(userId);
      await respond({
        response_type: 'ephemeral',
        blocks: formatChannelsList(channels),
      });
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
