export interface WriteSafetyConfig {
  writesEnabled: boolean;
  dryRun: boolean;
  requireConfirmation: boolean;
  allowPosts: boolean;
  allowReplies: boolean;
  allowDeletes: boolean;
  allowEngagements: boolean;
  allowBookmarksWrite: boolean;
  allowMediaUploads: boolean;
  disclosureText: string;
}

export interface AppConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken: string;
  oauth2ClientId?: string;
  oauth2ClientSecret?: string;
  oauth2RedirectUri?: string;
  oauth2TokenFile?: string;
  oauth2Scopes?: string;
  safety: WriteSafetyConfig;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example for required variables.`);
  }
  return value;
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const value = optionalEnv(name);
  if (!value) return defaultValue;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  throw new Error(`Invalid boolean value for ${name}: ${value}. Use true or false.`);
}

function buildDisclosure(): string {
  const disclosure = optionalEnv("X_MCP_DISCLOSURE_TEXT");
  if (!disclosure) return "";
  return disclosure.replace(/\\n/g, "\n");
}

export function loadConfig(): AppConfig {
  return {
    apiKey: requireEnv("X_API_KEY"),
    apiSecret: requireEnv("X_API_SECRET"),
    accessToken: requireEnv("X_ACCESS_TOKEN"),
    accessTokenSecret: requireEnv("X_ACCESS_TOKEN_SECRET"),
    bearerToken: requireEnv("X_BEARER_TOKEN"),
    oauth2ClientId: optionalEnv("X_OAUTH2_CLIENT_ID"),
    oauth2ClientSecret: optionalEnv("X_OAUTH2_CLIENT_SECRET"),
    oauth2RedirectUri: optionalEnv("X_OAUTH2_REDIRECT_URI"),
    oauth2TokenFile: optionalEnv("X_OAUTH2_TOKEN_FILE"),
    oauth2Scopes: optionalEnv("X_OAUTH2_SCOPES"),
    safety: {
      writesEnabled: envFlag("X_MCP_ENABLE_WRITES", false),
      dryRun: envFlag("X_MCP_DRY_RUN", true),
      requireConfirmation: envFlag("X_MCP_REQUIRE_CONFIRMATION", true),
      allowPosts: envFlag("X_MCP_ALLOW_POSTS", true),
      allowReplies: envFlag("X_MCP_ALLOW_REPLIES", false),
      allowDeletes: envFlag("X_MCP_ALLOW_DELETES", false),
      allowEngagements: envFlag("X_MCP_ALLOW_ENGAGEMENTS", false),
      allowBookmarksWrite: envFlag("X_MCP_ALLOW_BOOKMARKS_WRITE", false),
      allowMediaUploads: envFlag("X_MCP_ALLOW_MEDIA_UPLOADS", false),
      disclosureText: buildDisclosure(),
    },
  };
}
