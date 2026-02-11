import { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { insertPin } from '../db/queries';
import {
  fetchMessage,
  getPermalink,
  getUserDisplayName,
  getChannelName,
  addReaction,
} from '../services/slack';

type ReactionAddedArgs = SlackEventMiddlewareArgs<'reaction_added'> &
  AllMiddlewareArgs;

const PUSHPIN_REACTIONS = ['pushpin', 'round_pushpin'];

export async function handleReactionAdded({
  event,
  client,
}: ReactionAddedArgs): Promise<void> {
  // Only handle pushpin reactions
  if (!PUSHPIN_REACTIONS.includes(event.reaction)) {
    return;
  }

  // Only handle reactions to messages (not files, etc.)
  if (event.item.type !== 'message') {
    return;
  }

  const { channel, ts: messageTs } = event.item;
  const pinnedByUserId = event.user;

  console.log(
    `Pushpin reaction detected from ${pinnedByUserId} on message ${messageTs} in ${channel}`
  );

  try {
    // Fetch the message content
    const message = await fetchMessage(client, channel, messageTs);
    if (!message) {
      console.error('Could not fetch message content');
      return;
    }

    // Fetch additional metadata in parallel
    const [permalink, authorName, channelName] = await Promise.all([
      getPermalink(client, channel, messageTs),
      getUserDisplayName(client, message.user),
      getChannelName(client, channel),
    ]);

    // Insert into database
    const pin = insertPin({
      message_ts: messageTs,
      channel_id: channel,
      message_text: message.text,
      message_author_id: message.user,
      message_author_name: authorName,
      pinned_by_user_id: pinnedByUserId,
      channel_name: channelName,
      permalink,
    });

    if (pin) {
      console.log(`Pinned message saved with id ${pin.id}`);
      // Add confirmation reaction
      await addReaction(client, channel, messageTs, 'white_check_mark');
    } else {
      console.log('Message was already pinned by this user');
    }
  } catch (error) {
    console.error('Error handling reaction:', error);
  }
}
