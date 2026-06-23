#!/usr/bin/env node
/**
 * One-time OAuth helper for the GSC MCP server.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npx gsc-mcp-auth
 *
 * Steps:
 *   1. Run this script
 *   2. Open the URL printed in your browser (or visit http://localhost:3336/)
 *   3. Sign in with the Google account that has Search Console access
 *   4. Tokens are saved locally — you only need to do this once
 */

import { google } from "googleapis";
import { createServer } from "node:http";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { URL } from "node:url";
import {
  GSC_SCOPE,
  OAUTH_PORT,
  REDIRECT_URI,
  getTokenPath,
  requireGoogleCredentials,
} from "./config.js";

const { clientId, clientSecret } = requireGoogleCredentials();
const TOKEN_PATH = getTokenPath();

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authOptions = {
  access_type: "offline",
  scope: [GSC_SCOPE],
  prompt: "consent",
};

if (process.env.GOOGLE_LOGIN_HINT) {
  authOptions.login_hint = process.env.GOOGLE_LOGIN_HINT;
}

const authUrl = oauth2Client.generateAuthUrl(authOptions);

console.log("\n=== Google Search Console — OAuth Setup ===\n");
console.log("Open this URL in your browser and sign in with your Google account:\n");
console.log(authUrl);
console.log("\nWaiting for callback on port", OAUTH_PORT, "...\n");

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`);

  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h1>Error</h1><p>${error}</p>`);
      console.error("OAuth error:", error);
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h1>Error</h1><p>No authorization code received.</p>");
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log("Tokens received!");
      console.log("  access_token:", tokens.access_token ? "yes" : "no");
      console.log("  refresh_token:", tokens.refresh_token ? "yes" : "no");
      console.log(
        "  expiry_date:",
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : "none"
      );

      const payload = JSON.stringify(tokens, null, 2);
      mkdirSync(dirname(TOKEN_PATH), { recursive: true });
      writeFileSync(TOKEN_PATH, payload, { mode: 0o600 });

      console.log("\nTokens saved to:");
      console.log(`  ${TOKEN_PATH}`);

      if (!tokens.refresh_token) {
        console.error(
          "\nWARNING: No refresh_token received. Revoke the app at " +
            "https://myaccount.google.com/permissions and re-run auth."
        );
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;text-align:center">
          <h1 style="color:#22c55e">Google OAuth Complete!</h1>
          <p>Search Console tokens saved. Restart your MCP client to use the GSC tools.</p>
          <p style="color:#666">Refresh token: ${tokens.refresh_token ? "obtained" : "NOT obtained (re-run with prompt=consent)"}</p>
          <p style="color:#666;font-size:0.85em"><code>${TOKEN_PATH}</code></p>
        </body></html>
      `);

      console.log("\nDone! Restart your MCP client, then try gsc_list_sites.");
      setTimeout(() => process.exit(0), 2000);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h1>Error exchanging code</h1><pre>${err.message}</pre>`);
      console.error("Token exchange error:", err.message);
    }
  } else {
    res.writeHead(302, { Location: authUrl });
    res.end();
  }
});

httpServer.listen(OAUTH_PORT, "0.0.0.0", () => {
  console.log(`Callback server listening on http://localhost:${OAUTH_PORT}`);
  console.log(`You can also visit http://localhost:${OAUTH_PORT}/ to be redirected to Google sign-in.\n`);
});
