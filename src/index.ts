#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { parseTweetId } from "./twitter.js";
import { XApiClient } from "./x-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const appConfig = loadConfig();
const client = new XApiClient(appConfig);

const server = new McpServer({
  name: "x-mcp",
  version: "1.0.0",
});

function formatResult(data: unknown, rateLimit: string): string {
  const output: Record<string, unknown> = { data };
  if (rateLimit) output.rate_limit = rateLimit;
  return JSON.stringify(output, null, 2);
}

const confirmField = z.boolean().optional().describe("Required as true for real write operations when X_MCP_REQUIRE_CONFIRMATION=true.");

// ============================================================
// SAFETY
// ============================================================

server.tool(
  "get_safety_status",
  "Show the current local write-safety settings for this MCP server. Does not reveal API credentials.",
  {},
  async () => ({
    content: [{ type: "text", text: formatResult(client.getSafetyStatus(), "") }],
  }),
);

// ============================================================
// TWEET TOOLS
// ============================================================

server.tool(
  "post_tweet",
  "Create a new post on X (Twitter). Server-side safety defaults block writes unless enabled; dry-run is on by default; pass confirm: true when confirmation is required.",
  {
    text: z.string().min(1).describe("The text content of the tweet (max 280 characters after optional disclosure)"),
    poll_options: z.array(z.string().min(1)).min(2).max(4).optional().describe("Poll options (2-4 choices)"),
    poll_duration_minutes: z.number().optional().describe("Poll duration in minutes (default 1440 = 24h)"),
    media_ids: z.array(z.string()).optional().describe("Media IDs to attach (from upload_media)"),
    confirm: confirmField,
  },
  async ({ text, poll_options, poll_duration_minutes, media_ids, confirm }) => {
    try {
      const { result, rateLimit } = await client.postTweet({
        text,
        poll_options,
        poll_duration_minutes,
        media_ids,
        confirm,
      });
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "reply_to_tweet",
  "Reply to an existing post on X. Server-side safety defaults block replies; dry-run is on by default. X also restricts programmatic replies on self-serve tiers unless the original author @mentions you or quotes your post.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to reply to"),
    text: z.string().min(1).describe("The reply text"),
    media_ids: z.array(z.string()).optional().describe("Media IDs to attach"),
    confirm: confirmField,
  },
  async ({ tweet_id, text, media_ids, confirm }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.postTweet({
        text,
        reply_to: id,
        media_ids,
        confirm,
      });
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "quote_tweet",
  "Quote post on X. Server-side safety defaults block writes unless enabled; dry-run is on by default; pass confirm: true when confirmation is required.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to quote"),
    text: z.string().min(1).describe("Your commentary text"),
    media_ids: z.array(z.string()).optional().describe("Media IDs to attach"),
    confirm: confirmField,
  },
  async ({ tweet_id, text, media_ids, confirm }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.postTweet({
        text,
        quote_tweet_id: id,
        media_ids,
        confirm,
      });
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "delete_tweet",
  "Delete a post on X by its ID. Disabled by default; enable X_MCP_ALLOW_DELETES and pass confirm: true for real writes.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to delete"),
    confirm: confirmField,
  },
  async ({ tweet_id, confirm }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.deleteTweet(id, confirm);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "get_tweet",
  "Fetch a tweet and its metadata by ID or URL. Returns author info, metrics, and referenced tweets.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to fetch"),
  },
  async ({ tweet_id }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.getTweet(id);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ============================================================
// SEARCH
// ============================================================

server.tool(
  "search_tweets",
  "Search recent tweets by query. Supports keywords, hashtags, from:user, to:user, is:reply, has:media, etc. Uses the recent search endpoint (last 7 days).",
  {
    query: z.string().describe("Search query (e.g. 'from:elonmusk', '#ai', 'machine learning')"),
    max_results: z.number().optional().describe("Number of results (10-100, default 10)"),
    next_token: z.string().optional().describe("Pagination token from previous response"),
  },
  async ({ query, max_results, next_token }) => {
    try {
      const { result, rateLimit } = await client.searchTweets(query, max_results, next_token);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ============================================================
// USER TOOLS
// ============================================================

server.tool(
  "get_user",
  "Look up a user profile by username or user ID. Returns bio, metrics, verification status, etc.",
  {
    username: z.string().optional().describe("Username (without @)"),
    user_id: z.string().optional().describe("Numeric user ID"),
  },
  async ({ username, user_id }) => {
    try {
      if (!username && !user_id) {
        return { content: [{ type: "text", text: "Error: Provide either username or user_id" }], isError: true };
      }
      const { result, rateLimit } = await client.getUser({ username, userId: user_id });
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "get_timeline",
  "Fetch a user's recent posts. Requires the user's numeric ID (use get_user first to resolve username to ID).",
  {
    user_id: z.string().describe("The numeric user ID"),
    max_results: z.number().optional().describe("Number of results (5-100, default 10)"),
    next_token: z.string().optional().describe("Pagination token from previous response"),
  },
  async ({ user_id, max_results, next_token }) => {
    try {
      const { result, rateLimit } = await client.getTimeline(user_id, max_results, next_token);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "get_mentions",
  "Fetch recent mentions of the authenticated user.",
  {
    max_results: z.number().optional().describe("Number of results (5-100, default 10)"),
    next_token: z.string().optional().describe("Pagination token from previous response"),
  },
  async ({ max_results, next_token }) => {
    try {
      const { result, rateLimit } = await client.getMentions(max_results, next_token);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "get_followers",
  "List followers of a user by their numeric user ID.",
  {
    user_id: z.string().describe("The numeric user ID"),
    max_results: z.number().optional().describe("Number of results (1-1000, default 100)"),
    next_token: z.string().optional().describe("Pagination token from previous response"),
  },
  async ({ user_id, max_results, next_token }) => {
    try {
      const { result, rateLimit } = await client.getFollowers(user_id, max_results, next_token);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "get_following",
  "List who a user follows by their numeric user ID.",
  {
    user_id: z.string().describe("The numeric user ID"),
    max_results: z.number().optional().describe("Number of results (1-1000, default 100)"),
    next_token: z.string().optional().describe("Pagination token from previous response"),
  },
  async ({ user_id, max_results, next_token }) => {
    try {
      const { result, rateLimit } = await client.getFollowing(user_id, max_results, next_token);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ============================================================
// ENGAGEMENT TOOLS
// ============================================================

server.tool(
  "like_tweet",
  "Like a post on X. Disabled by default; enable X_MCP_ALLOW_ENGAGEMENTS and pass confirm: true for real writes. This endpoint is unavailable on some X API tiers.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to like"),
    confirm: confirmField,
  },
  async ({ tweet_id, confirm }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.likeTweet(id, confirm);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "retweet",
  "Retweet a post on X. Disabled by default; enable X_MCP_ALLOW_ENGAGEMENTS and pass confirm: true for real writes.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to retweet"),
    confirm: confirmField,
  },
  async ({ tweet_id, confirm }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.retweet(id, confirm);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ============================================================
// BOOKMARKS (requires OAuth 2.0 -- run setup_oauth2 first)
// ============================================================

server.tool(
  "setup_oauth2",
  "One-time setup: Authorize OAuth 2.0 for bookmark access. Opens a browser for X login. Required before using get_bookmarks, bookmark_tweet, or unbookmark_tweet.",
  {},
  async () => {
    try {
      const message = await client.getOAuth2Manager().authorize();
      return { content: [{ type: "text", text: message }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "get_bookmarks",
  "Fetch the authenticated user's bookmarked posts. Returns tweets with author info and metrics.",
  {
    max_results: z.number().optional().describe("Number of results (1-100, default 10)"),
    next_token: z.string().optional().describe("Pagination token from previous response"),
  },
  async ({ max_results, next_token }) => {
    try {
      const { result, rateLimit } = await client.getBookmarks(max_results, next_token);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "bookmark_tweet",
  "Bookmark a post on X. Disabled by default; enable X_MCP_ALLOW_BOOKMARKS_WRITE and pass confirm: true for real writes.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to bookmark"),
    confirm: confirmField,
  },
  async ({ tweet_id, confirm }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.bookmarkTweet(id, confirm);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "unbookmark_tweet",
  "Remove a bookmark from a post on X. Disabled by default; enable X_MCP_ALLOW_BOOKMARKS_WRITE and pass confirm: true for real writes.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to unbookmark"),
    confirm: confirmField,
  },
  async ({ tweet_id, confirm }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.unbookmarkTweet(id, confirm);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ============================================================
// MEDIA
// ============================================================

server.tool(
  "upload_media",
  "Upload an image or video to X. Disabled by default; enable X_MCP_ALLOW_MEDIA_UPLOADS and pass confirm: true for real writes. Provide the file as base64-encoded data.",
  {
    media_data: z.string().describe("Base64-encoded media file data"),
    mime_type: z.string().describe("MIME type (e.g. 'image/png', 'image/jpeg', 'video/mp4')"),
    media_category: z.string().optional().describe("Category: 'tweet_image', 'tweet_gif', or 'tweet_video' (default: tweet_image)"),
    confirm: confirmField,
  },
  async ({ media_data, mime_type, media_category, confirm }) => {
    try {
      const { result, rateLimit } = await client.uploadMedia(
        media_data,
        mime_type,
        media_category || "tweet_image",
        confirm,
      );
      return {
        content: [{
          type: "text",
          text: formatResult(result, rateLimit),
        }],
      };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ============================================================
// METRICS
// ============================================================

server.tool(
  "get_metrics",
  "Get engagement metrics for a specific post (impressions, likes, retweets, replies, quotes, bookmarks). Requires the tweet to be authored by the authenticated user for non-public metrics.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to get metrics for"),
  },
  async ({ tweet_id }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.getTweetMetrics(id);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ============================================================
// START SERVER
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
