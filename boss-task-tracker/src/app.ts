import { App } from '@slack/bolt';
import { config } from './config';
import { handleReactionAdded } from './handlers/reaction';
import { handlePinsCommand } from './handlers/commands';

export const app = new App({
  token: config.SLACK_BOT_TOKEN,
  signingSecret: config.SLACK_SIGNING_SECRET,
  customRoutes: [
    {
      path: '/health',
      method: ['GET'],
      handler: (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy' }));
      },
    },
  ],
});

// Handle pushpin reactions
app.event('reaction_added', handleReactionAdded);

// Handle /pins slash command
app.command('/pins', handlePinsCommand);

// Global error handler
app.error(async (error) => {
  console.error('Unhandled Bolt error:', error);
});
