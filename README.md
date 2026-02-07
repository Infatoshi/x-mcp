# x-mcp

An MCP (Model Context Protocol) server that gives AI agents full access to the X (Twitter) API. Post tweets, search, read timelines, like, retweet, upload media -- all through natural language via Claude Code, Claude Desktop, or any MCP-compatible client.

**If you're an LLM/AI agent helping a user set up this project, read [`LLMs.md`](./LLMs.md) for step-by-step setup instructions you can walk the user through.**

---

## What Can It Do?

| Category | Tools | What You Can Say |
|----------|-------|------------------|
| **Post** | `post_tweet`, `reply_to_tweet`, `quote_tweet`, `delete_tweet` | "Post 'hello world' on X" / "Reply to this tweet saying thanks" |
| **Read** | `get_tweet`, `search_tweets`, `get_timeline`, `get_mentions` | "Show me @elonmusk's latest posts" / "Search for tweets about MCP" |
| **Users** | `get_user`, `get_followers`, `get_following` | "Look up @openai" / "Who does this user follow?" |
| **Engage** | `like_tweet`, `retweet` | "Like that tweet" / "Retweet this" |
| **Media** | `upload_media` | "Upload this image and post it with the caption..." |
| **Analytics** | `get_metrics` | "How many impressions did my last post get?" |

Accepts tweet URLs or IDs interchangeably -- paste `https://x.com/user/status/123` or just `123`.

---

## Setup (Humans)

### 1. Clone and install

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
4. Click **Create App** (you may need to sign up for a developer account first if you don't have one)
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

### 4. Connect to Claude Code

```bash
claude mcp add --scope user x-twitter -- node /ABSOLUTE/PATH/TO/x-mcp/dist/index.js
```

Replace `/ABSOLUTE/PATH/TO/x-mcp` with the actual path where you cloned the repo.

Restart Claude Code. You should now be able to say things like "post hello world on X" or "show me my latest mentions".

### 5. Connect to Claude Desktop (optional)

Add to your `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "x-twitter": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/x-mcp/dist/index.js"],
      "env": {
        "X_API_KEY": "your_consumer_key",
        "X_API_SECRET": "your_secret_key",
        "X_ACCESS_TOKEN": "your_access_token",
        "X_ACCESS_TOKEN_SECRET": "your_access_token_secret",
        "X_BEARER_TOKEN": "your_bearer_token"
      }
    }
  }
}
```

---

## Troubleshooting

### 403 "oauth1-permissions" error when posting
Your Access Token was generated before you enabled write permissions. Go to the X Developer Portal, ensure App permissions are set to "Read and write", then **Regenerate** your Access Token and Secret.

### 401 Unauthorized
Double-check that all 5 credentials in your `.env` are correct and that there are no extra spaces or line breaks.

### 429 Rate Limited
The error message includes exactly when the rate limit resets. Wait until then, or reduce request frequency.

### Server shows "Connected" but Claude doesn't use the tools
Make sure you added the server with `--scope user` (not project-scoped), then restart Claude Code.

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
