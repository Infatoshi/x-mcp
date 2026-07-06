import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { WriteSafetyConfig } from "./config.js";
import { applyDisclosure, assertTweetLength, assertWriteAllowed } from "./safety.js";
import { parseTweetId } from "./twitter.js";

function config(overrides: Partial<WriteSafetyConfig> = {}): WriteSafetyConfig {
  return {
    writesEnabled: false,
    dryRun: true,
    requireConfirmation: true,
    allowPosts: true,
    allowReplies: false,
    allowDeletes: false,
    allowEngagements: false,
    allowBookmarksWrite: false,
    allowMediaUploads: false,
    disclosureText: "",
    ...overrides,
  };
}

const artifact: Record<string, unknown> = {};

test("parseTweetId accepts raw IDs and X/Twitter status URLs", () => {
  assert.equal(parseTweetId("1234567890"), "1234567890");
  assert.equal(parseTweetId("https://x.com/user/status/1234567890"), "1234567890");
  assert.equal(parseTweetId("https://twitter.com/user/status/9876543210?s=20"), "9876543210");
  assert.throws(() => parseTweetId("https://example.com/nope"), /Invalid tweet ID or URL/);
  artifact.parseTweetId = "passed";
});

test("applyDisclosure appends configured disclosure once", () => {
  const disclosure = "[AI-assisted draft]";
  assert.equal(applyDisclosure("hello", disclosure), "hello\n\n[AI-assisted draft]");
  assert.equal(
    applyDisclosure("hello\n\n[AI-assisted draft]", disclosure),
    "hello\n\n[AI-assisted draft]",
  );
  assert.equal(applyDisclosure("hello", ""), "hello");
  artifact.applyDisclosure = "passed";
});

test("assertTweetLength enforces the 280 character limit after disclosure", () => {
  assert.doesNotThrow(() => assertTweetLength("x".repeat(280)));
  assert.throws(() => assertTweetLength("x".repeat(281)), /only allows 280/);
  artifact.assertTweetLength = "passed";
});

test("assertWriteAllowed blocks writes by default", () => {
  assert.throws(
    () => assertWriteAllowed(config(), {
      capability: "post",
      description: "Posting to X",
      confirm: true,
      preview: { text: "hello" },
    }),
    /X_MCP_ENABLE_WRITES/,
  );
  artifact.defaultBlocked = true;
});

test("assertWriteAllowed requires confirmation before dry-run or real writes", () => {
  assert.throws(
    () => assertWriteAllowed(config({ writesEnabled: true }), {
      capability: "post",
      description: "Posting to X",
      preview: { text: "hello" },
    }),
    /confirm: true/,
  );
  artifact.confirmationRequired = true;
});

test("assertWriteAllowed returns a dry-run preview when writes are enabled but dry-run stays on", () => {
  const result = assertWriteAllowed(config({ writesEnabled: true }), {
    capability: "post",
    description: "Posting to X",
    confirm: true,
    preview: { text: "hello" },
  });
  assert.equal(result?.dry_run, true);
  assert.deepEqual(result?.preview, { text: "hello" });
  artifact.dryRunPreview = result;
});

test("assertWriteAllowed enforces per-action gates", () => {
  assert.throws(
    () => assertWriteAllowed(config({ writesEnabled: true, allowReplies: false }), {
      capability: "reply",
      description: "Replying to a post",
      confirm: true,
      preview: { text: "hello" },
    }),
    /per-action safety policy/,
  );
  artifact.perActionGate = true;
});

test.after(() => {
  const artifactDir = path.resolve(process.cwd(), "test-artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactDir, "safety-results.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), results: artifact }, null, 2),
  );
});
