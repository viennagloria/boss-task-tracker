import { Client } from '@notionhq/client';
import { config, isNotionConfigured } from '../config';
import { PinnedMessage } from '../db/queries';

let notionClient: Client | null = null;

function getClient(): Client | null {
  if (!isNotionConfigured()) {
    return null;
  }
  if (!notionClient) {
    notionClient = new Client({ auth: config.NOTION_TOKEN! });
  }
  return notionClient;
}

export interface NotionTaskResult {
  success: boolean;
  pageId?: string;
  error?: string;
}

export async function createNotionTask(pin: PinnedMessage): Promise<NotionTaskResult> {
  const client = getClient();
  if (!client) {
    return { success: false, error: 'Notion not configured' };
  }

  try {
    // Truncate title to 100 chars (Notion limit is 2000, but keep it readable)
    const title = pin.message_text.length > 100
      ? pin.message_text.substring(0, 97) + '...'
      : pin.message_text;

    const authorDisplay = pin.message_author_name || `User ${pin.message_author_id}`;
    const channelDisplay = pin.channel_name || `Channel ${pin.channel_id}`;
    const pinnedDate = new Date(pin.pinned_at).toISOString().split('T')[0];

    const response = await client.pages.create({
      parent: { database_id: config.NOTION_DATABASE_ID! },
      properties: {
        // Title property (required - assumes database has a title property named "Name" or "Title")
        Name: {
          title: [{ text: { content: title } }],
        },
        // These properties are optional - they'll be created if the database has them
        ...(pin.permalink && {
          Source: {
            url: pin.permalink,
          },
        }),
        Author: {
          rich_text: [{ text: { content: authorDisplay } }],
        },
        Channel: {
          rich_text: [{ text: { content: channelDisplay } }],
        },
        'Pinned Date': {
          date: { start: pinnedDate },
        },
      },
      // Add the full message as page content
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: pin.message_text } }],
          },
        },
        ...(pin.permalink ? [{
          object: 'block' as const,
          type: 'paragraph' as const,
          paragraph: {
            rich_text: [{
              type: 'text' as const,
              text: {
                content: 'View in Slack',
                link: { url: pin.permalink },
              },
            }],
          },
        }] : []),
      ],
    });

    return { success: true, pageId: response.id };
  } catch (error) {
    console.error('Error creating Notion task:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function syncPinToNotion(pin: PinnedMessage): Promise<NotionTaskResult> {
  // Skip if already synced
  if (pin.notion_page_id) {
    return { success: true, pageId: pin.notion_page_id };
  }

  return createNotionTask(pin);
}
