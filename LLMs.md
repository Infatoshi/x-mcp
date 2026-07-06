# LLMs.md -- Setup Guide for AI Agents

You are helping a user set up `x-mcp`, a personal MCP server for the X API.

Important: this fork is intentionally safe by default. Do not tell the user that writes will happen automatically. Writes are blocked unless environment flags and tool-level confirmation allow them.

## Core Safety Model

The server has three write gates:

1. Global gate: `X_MCP_ENABLE_WRITES=true`
2. Dry-run gate: `X_MCP_DRY_RUN=false` is required for real writes
3. Confirmation gate: write tools require `confirm: true` when `X_MCP_REQUIRE_CONFIRMATION=true`

There are also per-action gates:

```env
X_MCP_ALLOW_POSTS=true
X_MCP_ALLOW_REPLIES=false
X_MCP_ALLOW_DELETES=false
X_MCP_ALLOW_ENGAGEMENTS=false
X_MCP_ALLOW_BOOKMARKS_WRITE=false
X_MCP_ALLOW_MEDIA_UPLOADS=false
```

Default behavior:

- Read tools work.
- Write tools are blocked.
- If writes are enabled but dry-run remains true, write tools return a preview and do not call X.
- Real writes should be deliberate and include `confirm: true`.

Use `get_safety_status` after connection to inspect the active settings. It does not reveal credentials.

## Step 1: Clone and Build

```bash
git clone https://github.com/agentiker/x-mcp.git
cd x-mcp
npm install
npm run build
```

## Step 2: Get X API Credentials

The user needs an X Developer Portal app and these values:

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_BEARER_TOKEN`

If the user wants to post, quote, delete, like, retweet, or upload media:

1. Open the app in the X Developer Portal.
2. Set app permissions to **Read and write**.
3. Regenerate Access Token and Secret after changing permissions.
4. Confirm the generated token section says **Read and Write**.

If the user wants bookmarks:

1. Configure OAuth2 client ID and secret.
2. Set callback/redirect URI to `http://127.0.0.1:3219/callback`.
3. Make sure the same value is used in `X_OAUTH2_REDIRECT_URI`.
4. Keep the default scopes for read-only bookmarks. Add `bookmark.write` only if the user explicitly wants bookmark write tools.

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Minimal credentials:

```env
X_API_KEY=<Consumer Key>
X_API_SECRET=<Secret Key>
X_ACCESS_TOKEN=<Access Token>
X_ACCESS_TOKEN_SECRET=<Access Token Secret>
X_BEARER_TOKEN=<Bearer Token>
```

Safe default write settings:

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
X_MCP_DISCLOSURE_TEXT=
```

Optional OAuth2 bookmark settings:

```env
X_OAUTH2_CLIENT_ID=
X_OAUTH2_CLIENT_SECRET=
X_OAUTH2_REDIRECT_URI=http://127.0.0.1:3219/callback
X_OAUTH2_SCOPES=bookmark.read tweet.read users.read offline.access
X_OAUTH2_TOKEN_FILE=
```

If `X_OAUTH2_TOKEN_FILE` is blank, the server stores tokens in `.oauth2-tokens.json`, which is git-ignored and written with `0600` permissions.

For bookmark writes, use:

```env
X_OAUTH2_SCOPES=bookmark.read bookmark.write tweet.read users.read offline.access
X_MCP_ALLOW_BOOKMARKS_WRITE=true
```

Then run `setup_oauth2` again so the stored token receives the write scope.

## Step 4: Register MCP Server

Use an absolute path to `dist/index.js`.

### Claude Code

```bash
claude mcp add --scope user x-twitter -- node /absolute/path/to/x-mcp/dist/index.js
```

### Claude Desktop / Cursor / Windsurf / Cline

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
        "X_BEARER_TOKEN": "value",
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
args = ["/absolute/path/to/x-mcp/dist/index.js"]

[mcp_servers.x-twitter.env]
X_API_KEY = "value"
X_API_SECRET = "value"
X_ACCESS_TOKEN = "value"
X_ACCESS_TOKEN_SECRET = "value"
X_BEARER_TOKEN = "value"
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

## Available Tools

### Safety

- `get_safety_status`: show active local safety settings without secrets.

### Reading

- `get_tweet`
- `search_tweets`
- `get_timeline`
- `get_mentions`
- `get_user`
- `get_followers`
- `get_following`
- `get_metrics`

### Bookmarks

- `setup_oauth2`: one-time browser authorization.
- `get_bookmarks`: read bookmarks.
- `bookmark_tweet`: write; requires bookmark write gate and `confirm: true`.
- `unbookmark_tweet`: write; requires bookmark write gate and `confirm: true`.

### Writing

- `post_tweet`: requires global writes, posts gate, and `confirm: true`.
- `reply_to_tweet`: requires global writes, replies gate, and `confirm: true`.
- `quote_tweet`: requires global writes, posts gate, and `confirm: true`.
- `delete_tweet`: requires global writes, deletes gate, and `confirm: true`.
- `like_tweet`: requires global writes, engagements gate, and `confirm: true`.
- `retweet`: requires global writes, engagements gate, and `confirm: true`.
- `upload_media`: requires global writes, media uploads gate, and `confirm: true`.

## Safe Usage Patterns

To test without posting:

1. Set `X_MCP_ENABLE_WRITES=true`.
2. Keep `X_MCP_DRY_RUN=true`.
3. Call the write tool with `confirm: true`.
4. Review the returned preview.

To actually post:

1. Set `X_MCP_ENABLE_WRITES=true`.
2. Set `X_MCP_DRY_RUN=false`.
3. Keep `X_MCP_REQUIRE_CONFIRMATION=true`.
4. Keep only the necessary per-action gate enabled.
5. Call the write tool with `confirm: true`.

Do not enable deletes, replies, engagements, bookmark writes, or media uploads unless the user explicitly asks for those capabilities.

## Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `X_MCP_ENABLE_WRITES is not true` | Safe read-only mode | Enable writes intentionally |
| `requires confirm: true` | Confirmation gate | Repeat with `confirm: true` after reviewing intent |
| Dry-run preview returned | `X_MCP_DRY_RUN=true` | Set `X_MCP_DRY_RUN=false` for real writes |
| 403 `oauth1-permissions` | Access Token lacks write permission | Set app to Read and write, regenerate Access Token/Secret |
| 401 Unauthorized | Bad or missing credential | Recheck all env vars |
| OAuth2 callback fails | Redirect URI mismatch | Match `X_OAUTH2_REDIRECT_URI` in the X Developer Portal |
| Reply fails | X API reply restriction or tier limit | Use `quote_tweet` or check plan/policy |

## Verification

```bash
npm test
npm audit
```

Tests write a review artifact to `test-artifacts/safety-results.json`.
