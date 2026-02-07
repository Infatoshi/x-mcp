# LLMs.md -- Setup Guide for AI Agents

You are an AI agent helping a user set up the x-mcp server. This file contains everything you need to walk them through it. Follow these instructions in order.

---

## What This Is

x-mcp is an MCP (Model Context Protocol) server that connects AI agents to the X (Twitter) API. Once set up, you (the AI) will have access to 16 tools for posting tweets, reading timelines, searching, liking, retweeting, uploading media, and more.

## Prerequisites

- Node.js 18+ installed
- An X (Twitter) account
- Access to a terminal

---

## Step 1: Clone and Build

Run these commands:

```bash
git clone https://github.com/INFATOSHI/x-mcp.git
cd x-mcp
npm install
npm run build
```

If `npm install` fails, make sure Node.js 18+ is installed (`node --version`).

---

## Step 2: Get X API Credentials

The user needs 5 credentials from the X Developer Portal. Walk them through each sub-step below. This is the part users struggle with most -- be specific and patient.

### 2a: Create a Developer Account and App

1. Direct the user to https://developer.x.com/en/portal/dashboard
2. They need to sign in with their X account
3. If they don't have a developer account, they'll need to sign up (it's free for basic access)
4. Once in the dashboard, go to **Apps** in the left sidebar
5. Click **Create App**
6. Enter any app name (e.g., `my-x-mcp`)
7. After creation, they will see three credentials on screen:
   - **Consumer Key** (also called API Key) --> this is `X_API_KEY`
   - **Secret Key** (also called API Secret) --> this is `X_API_SECRET`
   - **Bearer Token** --> this is `X_BEARER_TOKEN`
8. **IMPORTANT**: Tell the user to save all three immediately. The secret won't be shown again.

### 2b: Enable Write Permissions

This step is critical. Without it, posting/liking/retweeting will fail with a 403 error.

1. On the app's page, scroll to **User authentication settings**
2. Click **Set up**
3. Set these values:
   - **App permissions**: **Read and write** (NOT just Read)
   - **Type of App**: **Web App, Automated App or Bot**
   - **Callback URI / Redirect URL**: `https://localhost`
   - **Website URL**: `https://x.com` (or any valid URL)
4. Click **Save**
5. It will show an OAuth 2.0 Client Secret -- the user can save this but it's not needed for this MCP server

### 2c: Generate Access Tokens

The Access Token and Secret must be generated AFTER enabling write permissions (step 2b). If they were generated before, they need to be regenerated.

1. Go back to the app's **Keys and Tokens** page
2. Find **Access Token and Secret**
3. Click **Generate** (or **Regenerate** if tokens already exist)
4. Save both values:
   - **Access Token** --> this is `X_ACCESS_TOKEN`
   - **Access Token Secret** --> this is `X_ACCESS_TOKEN_SECRET`

### Verify Permissions

After generating, the Access Token section should show **"Read and Write"** (not just "Read"). If it says "Read", the user needs to:
1. Go back to User authentication settings
2. Confirm permissions are set to "Read and write"
3. Regenerate the Access Token and Secret again

---

## Step 3: Configure Environment

Create the `.env` file in the project root:

```bash
cp .env.example .env
```

Then fill in all 5 values:

```
X_API_KEY=<Consumer Key from step 2a>
X_API_SECRET=<Secret Key from step 2a>
X_BEARER_TOKEN=<Bearer Token from step 2a>
X_ACCESS_TOKEN=<Access Token from step 2c>
X_ACCESS_TOKEN_SECRET=<Access Token Secret from step 2c>
```

---

## Step 4: Register with Claude Code

Run this command (replace the path with the actual absolute path to the cloned repo):

```bash
claude mcp add --scope user x-twitter -- node /absolute/path/to/x-mcp/dist/index.js
```

Then restart Claude Code.

To verify it's working:

```bash
claude mcp list
```

The output should show `x-twitter: ... - Connected`.

---

## Step 5: Register with Claude Desktop (Optional)

Add to `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "x-twitter": {
      "command": "node",
      "args": ["/absolute/path/to/x-mcp/dist/index.js"],
      "env": {
        "X_API_KEY": "value",
        "X_API_SECRET": "value",
        "X_ACCESS_TOKEN": "value",
        "X_ACCESS_TOKEN_SECRET": "value",
        "X_BEARER_TOKEN": "value"
      }
    }
  }
}
```

---

## Available Tools Reference

Once connected, you have access to these tools (prefixed with `mcp__x-twitter__` in Claude Code):

### Writing
- **post_tweet** -- Post text, polls, or media. Parameters: `text` (required), `poll_options`, `poll_duration_minutes`, `media_ids`
- **reply_to_tweet** -- Reply to a tweet. Parameters: `tweet_id` (ID or URL), `text`, `media_ids`
- **quote_tweet** -- Quote retweet. Parameters: `tweet_id` (ID or URL), `text`, `media_ids`
- **delete_tweet** -- Delete a tweet. Parameters: `tweet_id` (ID or URL)

### Reading
- **get_tweet** -- Fetch tweet with metadata. Parameters: `tweet_id` (ID or URL)
- **search_tweets** -- Search recent tweets (last 7 days). Parameters: `query`, `max_results` (10-100), `next_token`
- **get_timeline** -- User's recent posts (needs numeric user ID; use get_user to resolve). Parameters: `user_id`, `max_results`, `next_token`
- **get_mentions** -- Authenticated user's mentions. Parameters: `max_results`, `next_token`

### Users
- **get_user** -- Lookup by username or ID. Parameters: `username` OR `user_id`
- **get_followers** -- List followers. Parameters: `user_id`, `max_results`, `next_token`
- **get_following** -- List following. Parameters: `user_id`, `max_results`, `next_token`

### Engagement
- **like_tweet** -- Like a tweet. Parameters: `tweet_id` (ID or URL)
- **retweet** -- Retweet. Parameters: `tweet_id` (ID or URL)

### Media
- **upload_media** -- Upload image/video (base64). Parameters: `media_data`, `mime_type`, `media_category`

### Analytics
- **get_metrics** -- Engagement metrics for a tweet. Parameters: `tweet_id` (ID or URL)

## Search Query Syntax

For `search_tweets`, the `query` parameter supports X's full search syntax:
- `from:username` -- posts by a user
- `to:username` -- replies to a user
- `#hashtag` -- hashtag search
- `"exact phrase"` -- exact match
- `has:media` / `has:links` / `has:images`
- `is:reply` / `-is:retweet`
- `lang:en` -- language filter
- Combine terms with spaces (AND) or `OR`

## Common Patterns

To get a user's latest posts:
1. Call `get_user` with their username to get their numeric ID
2. Call `get_timeline` with that ID

To post with an image:
1. Call `upload_media` with the base64-encoded image data and MIME type
2. Use the returned `media_id` in `post_tweet`'s `media_ids` array

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| 403 "oauth1-permissions" | Access Token has Read-only permissions | Enable "Read and write" in app settings, then **regenerate** Access Token and Secret |
| 401 Unauthorized | Bad credentials | Verify all 5 values in `.env` are correct, no extra whitespace |
| 429 Rate Limited | Too many requests | Error includes reset time -- wait until then |
| "Missing required environment variable" | `.env` file not found or incomplete | Ensure `.env` exists in project root with all 5 variables |
| Server connected but tools not visible | MCP server scope issue | Re-add with `claude mcp add --scope user`, restart Claude Code |
