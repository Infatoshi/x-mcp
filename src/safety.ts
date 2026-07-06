import type { WriteSafetyConfig } from "./config.js";

export type WriteCapability =
  | "post"
  | "reply"
  | "quote"
  | "delete"
  | "like"
  | "retweet"
  | "bookmark"
  | "unbookmark"
  | "media";

export interface WriteRequest {
  capability: WriteCapability;
  description: string;
  confirm?: boolean;
  preview: Record<string, unknown>;
}

export interface DryRunResult {
  dry_run: true;
  operation: WriteCapability;
  message: string;
  preview: Record<string, unknown>;
  safety: {
    writes_enabled: boolean;
    dry_run: boolean;
    require_confirmation: boolean;
  };
}

function capabilityAllowed(config: WriteSafetyConfig, capability: WriteCapability): boolean {
  switch (capability) {
    case "post":
    case "quote":
      return config.allowPosts;
    case "reply":
      return config.allowReplies;
    case "delete":
      return config.allowDeletes;
    case "like":
    case "retweet":
      return config.allowEngagements;
    case "bookmark":
    case "unbookmark":
      return config.allowBookmarksWrite;
    case "media":
      return config.allowMediaUploads;
  }
}

export function assertWriteAllowed(config: WriteSafetyConfig, request: WriteRequest): DryRunResult | null {
  if (!config.writesEnabled) {
    throw new Error(
      `${request.description} is blocked because X_MCP_ENABLE_WRITES is not true. ` +
        "Keep it false for read-only use, or enable it intentionally in your MCP client env.",
    );
  }

  if (!capabilityAllowed(config, request.capability)) {
    throw new Error(
      `${request.description} is blocked by the per-action safety policy. ` +
        `Enable the matching X_MCP_ALLOW_* flag only if you want this capability.`,
    );
  }

  if (config.requireConfirmation && request.confirm !== true) {
    throw new Error(
      `${request.description} requires confirm: true. Review the preview, then repeat the tool call with confirm set to true.`,
    );
  }

  if (config.dryRun) {
    return {
      dry_run: true,
      operation: request.capability,
      message: `${request.description} was not sent to X because X_MCP_DRY_RUN is true.`,
      preview: request.preview,
      safety: {
        writes_enabled: config.writesEnabled,
        dry_run: config.dryRun,
        require_confirmation: config.requireConfirmation,
      },
    };
  }

  return null;
}

export function applyDisclosure(text: string, disclosureText: string): string {
  const disclosure = disclosureText.trim();
  if (!disclosure || text.includes(disclosure)) return text;
  return `${text.trimEnd()}\n\n${disclosure}`;
}

export function assertTweetLength(text: string): void {
  const codePoints = Array.from(text).length;
  if (codePoints > 280) {
    throw new Error(`Tweet text is ${codePoints} characters after disclosure; X only allows 280.`);
  }
}
