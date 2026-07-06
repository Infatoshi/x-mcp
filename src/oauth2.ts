import crypto from "crypto";
import { execFile } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const DEFAULT_TOKEN_FILE = path.resolve(__dirname, "..", ".oauth2-tokens.json");
const DEFAULT_REDIRECT_URI = "http://127.0.0.1:3219/callback";
const DEFAULT_SCOPES = "bookmark.read tweet.read users.read offline.access";

interface OAuth2Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
}

export interface OAuth2ManagerOptions {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  tokenFile?: string;
  scopes?: string;
}

export class OAuth2Manager {
  private tokens: OAuth2Tokens | null = null;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private tokenFile: string;
  private scopes: string;

  constructor(options: OAuth2ManagerOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri || DEFAULT_REDIRECT_URI;
    this.tokenFile = options.tokenFile
      ? path.resolve(options.tokenFile)
      : DEFAULT_TOKEN_FILE;
    this.scopes = options.scopes || DEFAULT_SCOPES;
    this.loadTokens();
  }

  private loadTokens() {
    try {
      if (fs.existsSync(this.tokenFile)) {
        fs.chmodSync(this.tokenFile, 0o600);
        const raw = fs.readFileSync(this.tokenFile, "utf-8");
        this.tokens = JSON.parse(raw);
      }
    } catch {
      this.tokens = null;
    }
  }

  private saveTokens(tokens: OAuth2Tokens) {
    this.tokens = tokens;
    fs.mkdirSync(path.dirname(this.tokenFile), { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.tokenFile, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    fs.chmodSync(this.tokenFile, 0o600);
  }

  get isAuthorized(): boolean {
    return this.tokens !== null;
  }

  async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error(
        "OAuth 2.0 not authorized. Run the 'setup_oauth2' tool first to authorize bookmark access.",
      );
    }

    // Refresh if expired or expiring within 60s
    if (Date.now() > this.tokens.expires_at - 60_000) {
      await this.refreshAccessToken();
    }

    return this.tokens!.access_token;
  }

  private async refreshAccessToken() {
    if (!this.tokens?.refresh_token) {
      throw new Error("No refresh token available. Re-run 'setup_oauth2'.");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.tokens.refresh_token,
      client_id: this.clientId,
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      this.tokens = null;
      try { fs.unlinkSync(this.tokenFile); } catch {}
      throw new Error(
        `OAuth 2.0 token refresh failed (HTTP ${response.status}): ${text}. Re-run 'setup_oauth2'.`,
      );
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    this.saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
  }

  /**
   * Starts the OAuth 2.0 PKCE authorization flow.
   * Opens a local HTTP server, returns the URL the user must visit.
   * Resolves when the callback is received and tokens are stored.
   */
  async authorize(): Promise<string> {
    const redirectUrl = new URL(this.redirectUri);
    if (!["http:", "https:"].includes(redirectUrl.protocol)) {
      throw new Error("X_OAUTH2_REDIRECT_URI must be an http or https URL.");
    }
    if (!redirectUrl.port) {
      throw new Error("X_OAUTH2_REDIRECT_URI must include a local port, for example http://127.0.0.1:3219/callback.");
    }

    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const state = crypto.randomBytes(16).toString("hex");

    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${AUTH_URL}?${authParams}`;

    return new Promise<string>((resolve, reject) => {
      let timeout: NodeJS.Timeout;

      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, this.redirectUri);
          if (url.pathname !== redirectUrl.pathname) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");

          if (!code || returnedState !== state) {
            res.writeHead(400);
            res.end("Invalid callback: missing code or state mismatch");
            clearTimeout(timeout);
            server.close();
            reject(new Error("OAuth callback failed: state mismatch or missing code"));
            return;
          }

          // Exchange code for tokens
          const tokenBody = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: this.redirectUri,
            code_verifier: codeVerifier,
            client_id: this.clientId,
          });

          const tokenRes = await fetch(TOKEN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
            },
            body: tokenBody.toString(),
          });

          if (!tokenRes.ok) {
            const text = await tokenRes.text();
            res.writeHead(500);
            res.end(`Token exchange failed: ${text}`);
            clearTimeout(timeout);
            server.close();
            reject(new Error(`Token exchange failed (HTTP ${tokenRes.status}): ${text}`));
            return;
          }

          const data = await tokenRes.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
          };

          this.saveTokens({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + data.expires_in * 1000,
          });

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Authorization successful!</h1><p>You can close this tab and return to your MCP client.</p>");
          clearTimeout(timeout);
          server.close();
          resolve("OAuth 2.0 authorization complete. Bookmark access is now enabled.");
        } catch (err) {
          clearTimeout(timeout);
          server.close();
          reject(err);
        }
      });

      server.listen(Number(redirectUrl.port), redirectUrl.hostname, () => {
        if (process.platform === "darwin") {
          execFile("open", [authUrl]);
        } else if (process.platform === "win32") {
          execFile("cmd", ["/c", "start", "", authUrl]);
        } else {
          execFile("xdg-open", [authUrl]);
        }
      });

      // Timeout after 2 minutes
      timeout = setTimeout(() => {
        server.close();
        reject(new Error("OAuth 2.0 authorization timed out after 2 minutes."));
      }, 120_000);
    });
  }
}
