import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  SLACK_BOT_TOKEN: requireEnv('SLACK_BOT_TOKEN'),
  SLACK_SIGNING_SECRET: requireEnv('SLACK_SIGNING_SECRET'),
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_PATH: process.env.DATABASE_PATH || './data/boss-tasks.db',

  // Notion integration (optional)
  NOTION_TOKEN: process.env.NOTION_TOKEN || null,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID || null,
};

export function isNotionConfigured(): boolean {
  return !!(config.NOTION_TOKEN && config.NOTION_DATABASE_ID);
}
