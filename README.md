# x-mcp

MCP (Model Context Protocol) server for the X (Twitter) API. Use it with Claude Code, Claude Desktop, or any MCP-compatible client.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

Copy `.env.example` to `.env` and fill in your X API credentials:

```bash
cp .env.example .env
```

Get credentials from the [X Developer Portal](https://developer.x.com/en/portal/dashboard). You need:
- **API Key** and **API Secret** (Consumer Keys)
- **Access Token** and **Access Token Secret** (Authentication Tokens)
- **Bearer Token**

### 3. Build

```bash
npm run build
```

### 4. Test locally

```bash
npm start
```

The server communicates over stdio -- it won't produce visible output unless there's an error.

## Claude Desktop Configuration

Add this to your `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "x-twitter": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/x-mcp/dist/index.js"],
      "env": {
        "X_API_KEY": "your_api_key",
        "X_API_SECRET": "your_api_secret",
        "X_ACCESS_TOKEN": "your_access_token",
        "X_ACCESS_TOKEN_SECRET": "your_access_token_secret",
        "X_BEARER_TOKEN": "your_bearer_token"
      }
    }
  }
}
```

Replace `/ABSOLUTE/PATH/TO/x-mcp` with the actual path (e.g., `/Users/you/x-mcp`).

## Claude Code Configuration

Add to your `.claude/settings.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "x-twitter": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/x-mcp/dist/index.js"],
      "env": {
        "X_API_KEY": "your_api_key",
        "X_API_SECRET": "your_api_secret",
        "X_ACCESS_TOKEN": "your_access_token",
        "X_ACCESS_TOKEN_SECRET": "your_access_token_secret",
        "X_BEARER_TOKEN": "your_bearer_token"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `post_tweet` | Create a new post (text, polls, media) |
| `reply_to_tweet` | Reply to a post by ID or URL |
| `quote_tweet` | Quote retweet a post |
| `delete_tweet` | Delete a post |
| `get_tweet` | Fetch a tweet and its metadata |
| `search_tweets` | Search recent tweets (last 7 days) |
| `get_user` | Look up a user by username or ID |
| `get_timeline` | Fetch a user's recent posts |
| `get_mentions` | Fetch mentions of the authenticated user |
| `get_followers` | List followers of a user |
| `get_following` | List who a user follows |
| `like_tweet` | Like a post |
| `retweet` | Retweet a post |
| `upload_media` | Upload image/video, returns media_id |
| `get_metrics` | Get engagement metrics for a post |

## Authentication

- **Write operations** (post, delete, like, retweet, upload): OAuth 1.0a User Context
- **Read operations** (search, lookup, timeline, followers): OAuth 2.0 Bearer Token
- **Mentions and metrics**: OAuth 1.0a (requires user context)

## Rate Limiting

All responses include rate limit info when available. When a rate limit is hit, the error message includes the reset time so you know when to retry.

## Pagination

List endpoints (`search_tweets`, `get_timeline`, `get_mentions`, `get_followers`, `get_following`) return a `next_token` in the response metadata. Pass it back as `next_token` (or `pagination_token`) to fetch the next page.

## Search Query Syntax

The `search_tweets` tool supports the full X search query syntax:

- `from:username` -- tweets from a user
- `to:username` -- tweets to a user
- `#hashtag` -- tweets with a hashtag
- `"exact phrase"` -- exact match
- `has:media` -- tweets with media
- `has:links` -- tweets with links
- `is:reply` -- only replies
- `-is:retweet` -- exclude retweets
- `lang:en` -- filter by language
- Combine with spaces (AND) or `OR`
