# LLMs.md -- Setup Guide for AI Agents

You are an AI agent helping a user set up the x-mcp server. This file contains everything you need to walk them through it. Follow these instructions in order.

---

## What This Is

x-mcp is an MCP (Model Context Protocol) server that connects AI agents to the X (Twitter) API. Once set up, you (the AI) will have access to 16 tools for posting tweets, reading timelines, searching, liking, retweeting, uploading media, and more.

## Transport

x-mcp uses the **MCP Streamable HTTP transport** (stateful, session-based). The server exposes a single endpoint at `/mcp` and a health check at `/health`. This works for both local and remote (Render/Fly/Railway) deployments.

Default URL: `http://localhost:3000/mcp` (override with `PORT` env var).

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

For remote deployments (Render, etc.), set these as environment variables in the platform's dashboard instead of using a `.env` file.

---

## Step 4: Start the Server

**Local:**
```bash
npm start
```
You should see: `x-mcp Streamable HTTP server listening on http://0.0.0.0:3000`

Verify with: `curl http://localhost:3000/health` (returns `{"status":"ok"}`)

**Remote (Render example):**

| Field | Value |
|-------|-------|
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/health` |
| **Environment** | All 5 `X_API_*` vars (Render auto-sets `PORT`) |

---

## Step 5: Register with Your Client

Determine which client the user is using and follow the corresponding instructions. Only one of these is needed. Replace `http://localhost:3000` with the remote URL (e.g. `https://x-mcp.onrender.com`) if running remotely.

### Claude Code

```bash
claude mcp add --scope user --transport http x-twitter http://localhost:3000/mcp
```

Then restart Claude Code. To verify:

```bash
claude mcp list
```

The output should show `x-twitter: ... - Connected`.

### Claude Desktop

Add to `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "x-twitter": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Restart Claude Desktop after saving.

### Cursor

Add to the Cursor MCP config file:

- **Global** (all projects): `~/.cursor/mcp.json`
- **Project-scoped**: `.cursor/mcp.json` in your project root

```json
{
  "mcpServers": {
    "x-twitter": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Verify in Cursor: Settings > MCP Servers -- the server should appear as connected.

### OpenAI Codex

**Option A -- CLI:**

```bash
codex mcp add x-twitter --url http://localhost:3000/mcp
```

**Option B -- config.toml:**

Add to `~/.codex/config.toml` (global) or `.codex/config.toml` (project-scoped):

```toml
[mcp_servers.x-twitter]
type = "http"
url = "http://localhost:3000/mcp"
```

The CLI and the Codex VS Code extension share this config -- set it up once and both work.

### Windsurf

Add to the Windsurf MCP config:

- **macOS**: `~/.codeium/windsurf/mcp_config.json`
- **Windows**: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

```json
{
  "mcpServers": {
    "x-twitter": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Can also be added from Windsurf Settings > Cascade > MCP Servers.

### Cline (VS Code)

Open Cline's MCP settings: click the MCP Servers icon in Cline's top navigation bar, then click "Configure MCP Servers" to open `cline_mcp_settings.json`. Add:

```json
{
  "mcpServers": {
    "x-twitter": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "alwaysAllow": [],
      "disabled": false
    }
  }
}
```

### Any Other MCP Client

This is a standard Streamable HTTP MCP server. Point your client at:

```
http://localhost:3000/mcp
```

(or your remote URL) using the HTTP transport type. On the server, the required environment variables are: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `X_BEARER_TOKEN`.

---

## Available Tools Reference

Once connected, you have access to these tools (prefixed with `mcp__x-twitter__` in Claude Code):

### Writing
- **post_tweet** -- Post text, polls, or media. Parameters: `text` (required), `poll_options`, `poll_duration_minutes`, `media_ids`
- **reply_to_tweet** -- Reply to a tweet. **Restricted**: only works if the original author @mentioned you or quoted your post (X API policy, Feb 2024). Use `quote_tweet` as a workaround. Parameters: `tweet_id` (ID or URL), `text`, `media_ids`
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
| 401 Unauthorized | Bad credentials | Verify all 5 values in `.env` (or platform env vars) are correct, no extra whitespace |
| Reply fails / restriction error | X restricts programmatic replies (Feb 2024) | Can only reply if original author @mentioned you or quoted your post. Use `quote_tweet` instead |
| 429 Rate Limited | Too many requests | Error includes reset time -- wait until then |
| "Missing required environment variable" | `.env` file not found or incomplete | Ensure `.env` exists in project root with all 5 variables, or platform env vars are set for remote deploys |
| Server unreachable / connection refused | Server not running or wrong URL | Verify `curl http://localhost:3000/health` (or remote URL) returns `{"status":"ok"}` |
| Server connected but tools not visible | MCP transport type mismatch | Re-add with `--transport http` for Claude Code, or `type: "http"` in config; restart client |
