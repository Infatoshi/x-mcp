# x-mcp

An MCP (Model Context Protocol) server for personal X API access. It supports reading posts, searching, timelines, mentions, metrics, bookmarks, posting, replies, quote posts, deletes, engagements, and media upload.

This fork is hardened for personal-account use:

- Writes are blocked by default.
- Dry-run is enabled by default.
- Real writes require `confirm: true` by default.
- Riskier write categories have separate allow flags.
- Outgoing posts no longer contain any hardcoded model name or account handle.
- OAuth2 bookmark tokens are stored locally, ignored by git, and written with `0600` permissions.
- OAuth2 defaults to read-only bookmark scope; `bookmark.write` must be added intentionally.

If you're an LLM/AI agent helping a user set up this project, read [`LLMs.md`](./LLMs.md).

## Tools

| Category | Tools | Default behavior |
| --- | --- | --- |
| Safety | `get_safety_status` | Shows local safety settings without secrets |
| Read | `get_tweet`, `search_tweets`, `get_timeline`, `get_mentions` | Enabled |
| Users | `get_user`, `get_followers`, `get_following` | Enabled |
| Metrics | `get_metrics` | Enabled; private metrics require user context |
| Bookmarks read | `setup_oauth2`, `get_bookmarks` | Requires OAuth2 setup |
| Post | `post_tweet`, `quote_tweet` | Blocked unless writes are enabled |
| Reply | `reply_to_tweet` | Blocked unless replies are separately enabled |
| Delete | `delete_tweet` | Blocked unless deletes are separately enabled |
| Engage | `like_tweet`, `retweet` | Blocked unless engagements are separately enabled |
| Bookmarks write | `bookmark_tweet`, `unbookmark_tweet` | Blocked unless bookmark writes are separately enabled |
| Media | `upload_media` | Blocked unless media uploads are separately enabled |

Tweet IDs can be raw IDs or URLs such as `https://x.com/user/status/123`.

## Setup

```bash
git clone https://github.com/agentiker/x-mcp.git
cd x-mcp
npm install
npm run build
```

## X API Credentials

Create an app in the [X Developer Portal](https://developer.x.com/en/portal/dashboard), then collect:

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_BEARER_TOKEN`

For writes, your X app must have **Read and write** permissions, and the Access Token/Secret must be generated after those permissions are set.

For bookmark OAuth2, set the app callback/redirect URI to match:

```text
http://127.0.0.1:3219/callback
```

You can change it with `X_OAUTH2_REDIRECT_URI`, but the value in the X Developer Portal must match exactly.

## Environment

```bash
cp .env.example .env
```

Fill in your credentials:

```env
X_API_KEY=your_consumer_key
X_API_SECRET=your_secret_key
X_ACCESS_TOKEN=your_access_token
X_ACCESS_TOKEN_SECRET=your_access_token_secret
X_BEARER_TOKEN=your_bearer_token
```

Safe defaults are already in `.env.example`:

```env
X_MCP_ENABLE_WRITES=false
X_MCP_DRY_RUN=true
X_MCP_REQUIRE_CONFIRMATION=true

X_MCP_ALLOW_POSTS=true
X_MCP_ALLOW_REPLIES=false
X_MCP_ALLOW_DELETES=false
X_MCP_ALLOW_ENGAGEMENTS=false
X_MCP_ALLOW_BOOKMARKS_WRITE=false
X_MCP_ALLOW_MEDIA_UPLOADS=false
```

With these defaults, read tools work, but write tools are blocked before any request reaches X.

To preview writes without sending anything to X:

```env
X_MCP_ENABLE_WRITES=true
X_MCP_DRY_RUN=true
X_MCP_REQUIRE_CONFIRMATION=true
```

Then call a write tool with `confirm: true`. The tool returns a preview.

To allow real posts:

```env
X_MCP_ENABLE_WRITES=true
X_MCP_DRY_RUN=false
X_MCP_REQUIRE_CONFIRMATION=true
X_MCP_ALLOW_POSTS=true
```

Then call `post_tweet` or `quote_tweet` with `confirm: true`.

Only enable higher-risk flags when you explicitly need them:

```env
X_MCP_ALLOW_REPLIES=true
X_MCP_ALLOW_DELETES=true
X_MCP_ALLOW_ENGAGEMENTS=true
X_MCP_ALLOW_BOOKMARKS_WRITE=true
X_MCP_ALLOW_MEDIA_UPLOADS=true
```

Optional post disclosure:

```env
X_MCP_DISCLOSURE_TEXT=[AI-assisted draft]
```

Leave it blank for no disclosure. Use `\n` for line breaks.

## OAuth2 Bookmarks

Bookmark read/write uses OAuth2 user authorization. Configure:

```env
X_OAUTH2_CLIENT_ID=your_oauth2_client_id
X_OAUTH2_CLIENT_SECRET=your_oauth2_client_secret
X_OAUTH2_REDIRECT_URI=http://127.0.0.1:3219/callback
X_OAUTH2_SCOPES=bookmark.read tweet.read users.read offline.access
X_OAUTH2_TOKEN_FILE=
```

If `X_OAUTH2_TOKEN_FILE` is blank, tokens are stored in `.oauth2-tokens.json`. This file is git-ignored and written with `0600` permissions.

After the MCP server is connected, run the `setup_oauth2` tool once. It opens the X authorization URL in your browser and stores the returned refresh token locally.

To use `bookmark_tweet` or `unbookmark_tweet`, set:

```env
X_OAUTH2_SCOPES=bookmark.read bookmark.write tweet.read users.read offline.access
X_MCP_ALLOW_BOOKMARKS_WRITE=true
```

Then re-run `setup_oauth2` so the stored OAuth2 token has the write scope.

## MCP Client Config

Build first:

```bash
npm run build
```

Use an absolute path to `dist/index.js`.

### Claude Code

```bash
claude mcp add --scope user x-twitter -- node /ABSOLUTE/PATH/TO/x-mcp/dist/index.js
```

If you configure env vars in the client instead of `.env`, include both credentials and safety settings.

### Claude Desktop / Cursor / Windsurf / Cline

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
        "X_BEARER_TOKEN": "your_bearer_token",
        "X_OAUTH2_SCOPES": "bookmark.read tweet.read users.read offline.access",
        "X_MCP_ENABLE_WRITES": "false",
        "X_MCP_DRY_RUN": "true",
        "X_MCP_REQUIRE_CONFIRMATION": "true",
        "X_MCP_ALLOW_POSTS": "true",
        "X_MCP_ALLOW_REPLIES": "false",
        "X_MCP_ALLOW_DELETES": "false",
        "X_MCP_ALLOW_ENGAGEMENTS": "false",
        "X_MCP_ALLOW_BOOKMARKS_WRITE": "false",
        "X_MCP_ALLOW_MEDIA_UPLOADS": "false",
        "X_MCP_DISCLOSURE_TEXT": ""
      }
    }
  }
}
```

### OpenAI Codex

```toml
[mcp_servers.x-twitter]
command = "node"
args = ["/ABSOLUTE/PATH/TO/x-mcp/dist/index.js"]

[mcp_servers.x-twitter.env]
X_API_KEY = "your_consumer_key"
X_API_SECRET = "your_secret_key"
X_ACCESS_TOKEN = "your_access_token"
X_ACCESS_TOKEN_SECRET = "your_access_token_secret"
X_BEARER_TOKEN = "your_bearer_token"
X_OAUTH2_SCOPES = "bookmark.read tweet.read users.read offline.access"
X_MCP_ENABLE_WRITES = "false"
X_MCP_DRY_RUN = "true"
X_MCP_REQUIRE_CONFIRMATION = "true"
X_MCP_ALLOW_POSTS = "true"
X_MCP_ALLOW_REPLIES = "false"
X_MCP_ALLOW_DELETES = "false"
X_MCP_ALLOW_ENGAGEMENTS = "false"
X_MCP_ALLOW_BOOKMARKS_WRITE = "false"
X_MCP_ALLOW_MEDIA_UPLOADS = "false"
X_MCP_DISCLOSURE_TEXT = ""
```

## Testing

```bash
npm test
npm audit
```

Tests write a review artifact to:

```text
test-artifacts/safety-results.json
```

## X API Notes

X API permissions and paid-tier availability change over time. The server enforces local safety gates, but X may still reject calls based on your plan, app permissions, rate limits, or policy restrictions.

Known constraints:

- Likes may be unavailable on some lower API tiers.
- Programmatic replies may be restricted unless the original author mentioned or quoted you.
- Bookmark endpoints require OAuth2 authorization and may require a paid tier.
- Free/basic tiers may have monthly post caps.

## Troubleshooting

### 403 `oauth1-permissions`

Your Access Token was generated before enabling app write permissions. Set the app to **Read and write**, then regenerate Access Token and Secret.

### 401 Unauthorized

Check all credentials for extra spaces, stale tokens, or missing env vars.

### Write tool says `X_MCP_ENABLE_WRITES is not true`

This is the default safe mode. Set `X_MCP_ENABLE_WRITES=true` only when you want write tools to proceed to the next safety gate.

### Write tool says `requires confirm: true`

Review the preview and repeat the same tool call with `confirm: true`.

### Dry-run returns a preview instead of posting

Set `X_MCP_DRY_RUN=false` for real writes.

### OAuth2 callback fails

Make sure `X_OAUTH2_REDIRECT_URI` exactly matches the callback URI in the X Developer Portal.

## License

MIT
