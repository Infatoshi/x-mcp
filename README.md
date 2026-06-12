# x-mcp

An MCP (Model Context Protocol) server that gives AI agents full access to the X (Twitter) API. Post tweets, search, read timelines, like, retweet, upload media -- all through natural language.

Works with **Claude Code**, **Claude Desktop**, **OpenAI Codex**, **Cursor**, **Windsurf**, **Cline**, and any other MCP-compatible client.

**If you're an LLM/AI agent helping a user set up this project, read [`LLMs.md`](./LLMs.md) for step-by-step instructions you can walk the user through.**

---

## What Can It Do?

| Category | Tools | What You Can Say | Status |
|----------|-------|------------------|--------|
| **Post** | `post_tweet`, `quote_tweet`, `delete_tweet` | "Post 'hello world' on X" | OK |
| **Read** | `get_tweet`, `search_tweets`, `get_timeline`, `get_mentions` | "Show me @elonmusk's latest posts" | OK |
| **Users** | `get_user`, `get_followers`, `get_following` | "Look up @openai" / "Who does this user follow?" | OK |
| **Engage** | `retweet` | "Retweet this" | OK |
| **Media** | `upload_media` | "Upload this image and post it with the caption..." | OK |
| **Analytics** | `get_metrics` | "How many impressions did my last post get?" | OK |
| **Bookmarks** | `get_bookmarks`, `bookmark_tweet`, `unbookmark_tweet` | "Show my bookmarks" | Requires Basic+ tier |
| **Reply** | `reply_to_tweet` | "Reply to this tweet saying thanks" | Restricted (see below) |
| **Like** | `like_tweet` | "Like that tweet" | Removed on Free tier (see below) |

Accepts tweet URLs or IDs interchangeably -- paste `https://x.com/user/status/123` or just `123`.

---

## Transport

x-mcp runs as an **HTTP server using the MCP Streamable HTTP transport** (stateful, session-based). This lets you run it:

- **Locally** as a background process your MCP client connects to over HTTP
- **Remotely** on platforms like Render, Fly.io, Railway, etc. and connect from any device

**Default endpoint**: `http://localhost:3000/mcp` (set via `PORT` env var)

| Path | Methods | Purpose |
|------|---------|---------|
| `/mcp` | `POST`, `GET`, `DELETE` | MCP protocol endpoint (initialize, stream, terminate sessions) |
| `/sse` | `GET` | Legacy HTTP+SSE MCP endpoint for integration clients like Poke |
| `/messages` | `POST` | Legacy HTTP+SSE client message endpoint, advertised automatically by `/sse` |
| `/health` | `GET` | Health check (returns `{"status":"ok"}`) |

The Streamable HTTP transport supersedes the older HTTP+SSE transport and is the current MCP specification. This server keeps both: `/mcp` for modern clients, and `/sse` for integration clients that still expect an SSE MCP URL. This does not create a live X/Twitter firehose; X read tools still call the X API when the MCP client invokes them.

---

## Setup

### 1. Clone and build

```bash
git clone https://github.com/INFATOSHI/x-mcp.git
cd x-mcp
npm install
npm run build
```

### 2. Get your X API credentials

You need 5 credentials from the [X Developer Portal](https://developer.x.com/en/portal/dashboard). Here's exactly how to get them:

#### a) Create an app

1. Go to the [X Developer Portal](https://developer.x.com/en/portal/dashboard)
2. Sign in with your X account
3. Go to **Apps** in the left sidebar
4. Click **Create App** (you may need to sign up for a developer account first)
5. Give it a name (e.g., `my-x-mcp`)
6. You'll immediately see your **Consumer Key** (API Key), **Secret Key** (API Secret), and **Bearer Token**
7. **Save all three now** -- the secret won't be shown again

#### b) Enable write permissions

By default, new apps only have Read permissions. You need Read and Write to post tweets, like, retweet, etc.

1. In your app's page, scroll down to **User authentication settings**
2. Click **Set up**
3. Set **App permissions** to **Read and write**
4. Set **Type of App** to **Web App, Automated App or Bot**
5. Set **Callback URI / Redirect URL** to `https://localhost` (required but won't be used)
6. Set **Website URL** to any valid URL (e.g., `https://x.com`)
7. Click **Save**

#### c) Generate access tokens (with write permissions)

After enabling write permissions, you need to generate (or regenerate) your Access Token and Secret so they carry the new permissions:

1. Go back to your app's **Keys and Tokens** page
2. Under **Access Token and Secret**, click **Regenerate**
3. Save both the **Access Token** and **Access Token Secret**

If you skip step (b) before generating tokens, your tokens will be Read-only and posting will fail with a 403 error.

### 3. Configure credentials

Copy the example env file and fill in your 5 credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
X_API_KEY=your_consumer_key
X_API_SECRET=your_secret_key
X_BEARER_TOKEN=your_bearer_token
X_ACCESS_TOKEN=your_access_token
X_ACCESS_TOKEN_SECRET=your_access_token_secret
```

Optional:

```
X_AGENT_DISCLOSURE=[AI-assisted post]
```

If set, this text is appended to outgoing posts. Leave it unset to post exactly the provided text.

For **local** runs the server reads `.env` automatically. For **remote** deployments (Render, Railway, etc.) set these as environment variables in your platform's dashboard.

### 4. Run the server

**Local:**
```bash
npm start
```
You should see: `x-mcp Streamable HTTP server listening on http://0.0.0.0:3000`

**Remote (Railway/Render example):**

| Field | Value |
|-------|-------|
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Environment** | All 5 `X_API_*` vars (Railway/Render auto-set `PORT`) |

Health check URL: `https://<your-app>.up.railway.app/health` or `https://<your-app>.onrender.com/health`

---

## Connect to Your Client

Pick your client below. Replace `http://localhost:3000` with your remote URL (e.g. `https://x-mcp.onrender.com`) if running remotely.

### Claude Code

**Remote (HTTP):**
```bash
claude mcp add --scope user --transport http x-twitter http://localhost:3000/mcp
```

**Local (HTTP, in background):**
```bash
# In one terminal:
npm start
# In another:
claude mcp add --scope user --transport http x-twitter http://localhost:3000/mcp
```

### Claude Desktop

Edit `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude%\claude_desktop_config.json`

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

For remote: replace `http://localhost:3000/mcp` with your deployed URL.

### Cursor

Edit your Cursor MCP config:

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

Verify in Cursor: Settings > MCP Servers.

### OpenAI Codex

**Option A: CLI**
```bash
codex mcp add x-twitter --url http://localhost:3000/mcp
```

**Option B: config.toml**

Add to `~/.codex/config.toml` (global) or `.codex/config.toml` (project-scoped):

```toml
[mcp_servers.x-twitter]
type = "http"
url = "http://localhost:3000/mcp"
```

The CLI and the Codex VS Code extension share this config -- set it up once and both work.

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

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

Open Cline's MCP settings (click the MCP Servers icon in Cline's top nav > Configure), then add to `cline_mcp_settings.json`:

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

### Other MCP Clients

This is a standard Streamable HTTP MCP server. Point your client at:

```
http://localhost:3000/mcp
```

(or your remote URL) using the HTTP transport type. Required environment variables on the server: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `X_BEARER_TOKEN`.

### Poke

Use the deployed SSE MCP endpoint:

```
https://<your-app>.up.railway.app/sse
```

Poke will receive `/messages?sessionId=...` from the SSE handshake and use that for client messages.

---

## API Restrictions (as of 2025-2026)

X has progressively restricted what automated/API clients can do. Here's what affects x-mcp:

### Likes removed from Free tier (Aug 2025)
The `like_tweet` endpoint (`POST /2/users/:id/likes`) was removed from the Free API tier in August 2025. If you're on the Free tier, `like_tweet` will return a permissions error. Paid tiers (Basic, Pro, Enterprise) are unaffected.

### Programmatic replies restricted (Feb 2026)
Replies via the API now only succeed if the original post's author @mentioned you or quoted your post. This applies to **all self-serve tiers** (Free, Basic, Pro, Pay-Per-Use). Only Enterprise is exempt. Use `quote_tweet` as a workaround.

### Bookmarks require Basic+ tier
Bookmark endpoints have never been available on the Free tier. You need at least Basic ($200/mo) to use `get_bookmarks`, `bookmark_tweet`, and `unbookmark_tweet`.

### Post volume caps
Free tier: 500 posts/month. Basic: 10,000/month. Pro: 1,000,000/month.

---

## Troubleshooting

### 403 "oauth1-permissions" error when posting
Your Access Token was generated before you enabled write permissions. Go to the X Developer Portal, ensure App permissions are set to "Read and write", then **Regenerate** your Access Token and Secret.

### 401 Unauthorized
Double-check that all 5 credentials in your `.env` (or platform env vars) are correct and that there are no extra spaces or line breaks.

### 429 Rate Limited
The error message includes exactly when the rate limit resets. Wait until then, or reduce request frequency.

### Reply fails with a permissions/restriction error
As of Feb 2026, X restricts programmatic replies via the API on all self-serve tiers. You can only reply if the original author @mentions you or quotes your post. This applies to Free, Basic, Pro, and Pay-Per-Use tiers (Enterprise is exempt). Use `quote_tweet` as a workaround.

### Server unreachable / connection refused
- Verify the server is running: `curl http://localhost:3000/health` (or your remote URL) should return `{"status":"ok"}`
- For remote deployments, confirm the platform is listening on the correct port (Render auto-sets `PORT`)
- Free-tier Render instances spin down after 15 min of inactivity -- the first request after idle takes ~30-60s

### Server shows "Connected" but tools aren't used
Make sure you registered the server with the correct scope and HTTP transport type, then restart your client.

---

## Rate Limiting

Every response includes rate limit info: remaining requests, total limit, and reset time. When a limit is hit, you get a clear error with the exact reset timestamp.

## Pagination

List endpoints return a `next_token` in the response. Pass it back to get the next page of results. Works on: `search_tweets`, `get_timeline`, `get_mentions`, `get_followers`, `get_following`.

## Search Query Syntax

The `search_tweets` tool supports X's full query language:

- `from:username` -- posts by a specific user
- `to:username` -- replies to a specific user
- `#hashtag` -- posts containing a hashtag
- `"exact phrase"` -- exact text match
- `has:media` / `has:links` / `has:images` -- filter by content type
- `is:reply` / `-is:retweet` -- filter by post type
- `lang:en` -- filter by language
- Combine with spaces (AND) or `OR`

---

## License

MIT
