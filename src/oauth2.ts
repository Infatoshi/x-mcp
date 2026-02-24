import crypto from "crypto";
import { exec } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.resolve(__dirname, "..", ".oauth2-tokens.json");
const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const REDIRECT_URI = "http://127.0.0.1:3219/callback";
const SCOPES = "bookmark.read bookmark.write tweet.read users.read offline.access";

interface OAuth2Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
}

export class OAuth2Manager {
  private tokens: OAuth2Tokens | null = null;
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.loadTokens();
  }

  private loadTokens() {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const raw = fs.readFileSync(TOKEN_FILE, "utf-8");
        this.tokens = JSON.parse(raw);
      }
    } catch {
      this.tokens = null;
    }
  }

  private saveTokens(tokens: OAuth2Tokens) {
    this.tokens = tokens;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
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
      try { fs.unlinkSync(TOKEN_FILE); } catch {}
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
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const state = crypto.randomBytes(16).toString("hex");

    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${AUTH_URL}?${authParams}`;

    return new Promise<string>((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, `http://127.0.0.1:3219`);
          if (url.pathname !== "/callback") {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");

          if (!code || returnedState !== state) {
            res.writeHead(400);
            res.end("Invalid callback: missing code or state mismatch");
            server.close();
            reject(new Error("OAuth callback failed: state mismatch or missing code"));
            return;
          }

          // Exchange code for tokens
          const tokenBody = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
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
          server.close();
          resolve("OAuth 2.0 authorization complete. Bookmark access is now enabled.");
        } catch (err) {
          server.close();
          reject(err);
        }
      });

      server.listen(3219, "127.0.0.1", () => {
        const cmd = process.platform === "darwin"
          ? `open "${authUrl}"`
          : process.platform === "win32"
            ? `start "${authUrl}"`
            : `xdg-open "${authUrl}"`;
        exec(cmd);
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        reject(new Error("OAuth 2.0 authorization timed out after 2 minutes."));
      }, 120_000);
    });
  }
}
