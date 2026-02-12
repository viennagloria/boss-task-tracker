# Boss Task Tracker

A Slack bot that turns pinned messages into a personal task management system, entirely within Slack.

## What This Does

React to any Slack message with 📌 emoji to save it as a task. View, filter, and manage your tasks using slash commands—all without leaving Slack.

## Features

- **Pin to Save**: React with :pushpin: to any message to save it as a task
- **Status Tracking**: Mark tasks as pending or done
- **Channel Filtering**: View tasks from specific channels
- **Search**: Find tasks by keyword
- **Delete**: Remove tasks you no longer need
- **Multi-User**: Each team member has their own private task list
- **SQLite Storage**: Persistent task storage with sql.js

## Commands

- `/pins` - Show pending tasks
- `/pins all` - Show all tasks
- `/pins done` - Show completed tasks
- `/pins channel <name>` - Show pins from a specific channel
- `/pins channels` - List all channels with pins
- `/pins search <query>` - Search your tasks
- `/pins complete <id>` - Mark a task as done
- `/pins delete <id>` - Remove a task
- `/pins help` - Show help message

## How It Works

1. **React with 📌**: When you react to any message with :pushpin:, the bot saves it to your personal task list
2. **Confirmation**: Bot adds ✅ reaction to confirm the task was saved
3. **View Tasks**: Use `/pins` to see your pending tasks
4. **Manage**: Complete or delete tasks as needed

## Tech Stack

- **Runtime**: Node.js 20 with TypeScript
- **Framework**: Slack Bolt SDK (@slack/bolt)
- **Database**: SQLite via sql.js (no native compilation required)
- **Deployment**: Render.com

## Setup

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
DATABASE_PATH=./data/boss-tasks.db
PORT=3000
```

### Local Development

```bash
cd boss-task-tracker
npm install
npm run dev
```

### Build for Production

```bash
npm run build
npm start
```

## Deployment

This app is configured for Render.com deployment:

1. Push to main branch
2. Render automatically rebuilds and deploys
3. Health check endpoint: `/health`
4. SQLite database persists in `/app/data` directory

## Database Schema

```sql
CREATE TABLE pinned_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_ts TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_text TEXT NOT NULL,
    message_author_id TEXT NOT NULL,
    message_author_name TEXT,
    pinned_by_user_id TEXT NOT NULL,
    channel_name TEXT,
    permalink TEXT,
    pinned_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'pending',
    UNIQUE(message_ts, channel_id, pinned_by_user_id)
);
```

## Slack App Configuration

Required OAuth Scopes:
- `reactions:read` - Detect pushpin reactions
- `channels:history` - Read message content in public channels
- `groups:history` - Read message content in private channels
- `im:history` - Read message content in DMs
- `mpim:history` - Read message content in group DMs
- `users:read` - Get user display names
- `channels:read` - Get channel names
- `commands` - Handle slash commands
- `reactions:write` - Add confirmation reactions

Event Subscriptions:
- `reaction_added` - Triggered when user reacts with emoji

Slash Commands:
- `/pins` - Main command for viewing and managing tasks

## Privacy

- Each user only sees their own pinned messages
- Database queries filter by `pinned_by_user_id`
- Assignment is implicit through @mentions in message content
