#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { z } from "zod";
import { XApiClient } from "./x-api.js";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example for required variables.`);
  }
  return value;
}

const client = new XApiClient({
  apiKey: requireEnv("X_API_KEY"),
  apiSecret: requireEnv("X_API_SECRET"),
  accessToken: requireEnv("X_ACCESS_TOKEN"),
  accessTokenSecret: requireEnv("X_ACCESS_TOKEN_SECRET"),
  bearerToken: requireEnv("X_BEARER_TOKEN"),
});

const server = new McpServer({
  name: "x-mcp",
  version: "1.0.0",
});

// --- Helper to extract tweet ID from URL or raw ID ---
function parseTweetId(input: string): string {
  // Handle URLs like https://x.com/user/status/123456 or https://twitter.com/user/status/123456
  const match = input.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (match) return match[1];
  // Otherwise treat as raw ID
  const stripped = input.trim();
  if (/^\d+$/.test(stripped)) return stripped;
  throw new Error(`Invalid tweet ID or URL: ${input}`);
}

function formatResult(data: unknown, rateLimit: string): string {
  const output: Record<string, unknown> = { data };
  if (rateLimit) output.rate_limit = rateLimit;
  return JSON.stringify(output, null, 2);
}

// ============================================================
// TWEET TOOLS
// ============================================================

server.tool(
  "post_tweet",
  "Create a new post on X (Twitter). Supports text, polls, and media attachments.",
  {
    text: z.string().describe("The text content of the tweet (max 280 characters)"),
    poll_options: z.array(z.string()).optional().describe("Poll options (2-4 choices)"),
    poll_duration_minutes: z.number().optional().describe("Poll duration in minutes (default 1440 = 24h)"),
    media_ids: z.array(z.string()).optional().describe("Media IDs to attach (from upload_media)"),
  },
  async ({ text, poll_options, poll_duration_minutes, media_ids }) => {
    try {
      const { result, rateLimit } = await client.postTweet({
        text,
        poll_options,
        poll_duration_minutes,
        media_ids,
      });
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "reply_to_tweet",
  "Reply to an existing post on X. Provide the tweet ID or URL to reply to.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to reply to"),
    text: z.string().describe("The reply text"),
    media_ids: z.array(z.string()).optional().describe("Media IDs to attach"),
  },
  async ({ tweet_id, text, media_ids }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.postTweet({
        text,
        reply_to: id,
        media_ids,
      });
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "quote_tweet",
  "Quote retweet a post on X. Adds your commentary above the quoted post.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to quote"),
    text: z.string().describe("Your commentary text"),
    media_ids: z.array(z.string()).optional().describe("Media IDs to attach"),
  },
  async ({ tweet_id, text, media_ids }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.postTweet({
        text,
        quote_tweet_id: id,
        media_ids,
      });
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "delete_tweet",
  "Delete a post on X by its ID.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to delete"),
  },
  async ({ tweet_id }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.deleteTweet(id);
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
  "Like a post on X.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to like"),
  },
  async ({ tweet_id }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.likeTweet(id);
      return { content: [{ type: "text", text: formatResult(result, rateLimit) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "retweet",
  "Retweet a post on X.",
  {
    tweet_id: z.string().describe("The tweet ID or URL to retweet"),
  },
  async ({ tweet_id }) => {
    try {
      const id = parseTweetId(tweet_id);
      const { result, rateLimit } = await client.retweet(id);
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
  "Upload an image or video to X. Returns a media_id that can be attached to posts. Provide the file as base64-encoded data.",
  {
    media_data: z.string().describe("Base64-encoded media file data"),
    mime_type: z.string().describe("MIME type (e.g. 'image/png', 'image/jpeg', 'video/mp4')"),
    media_category: z.string().optional().describe("Category: 'tweet_image', 'tweet_gif', or 'tweet_video' (default: tweet_image)"),
  },
  async ({ media_data, mime_type, media_category }) => {
    try {
      const { mediaId, rateLimit } = await client.uploadMedia(
        media_data,
        mime_type,
        media_category || "tweet_image",
      );
      return {
        content: [{
          type: "text",
          text: formatResult({ media_id: mediaId, message: "Upload complete. Use this media_id in post_tweet." }, rateLimit),
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
