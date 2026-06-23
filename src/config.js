import { homedir } from "node:os";
import { join } from "node:path";

export const REDIRECT_URI = "http://localhost:3336/callback";
export const OAUTH_PORT = 3336;

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export function getTokenPath() {
  if (process.env.GSC_TOKEN_PATH) {
    return process.env.GSC_TOKEN_PATH;
  }
  return join(homedir(), ".config", "gsc-mcp", "tokens.json");
}

export function requireGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required.\n" +
        "Create a Google Cloud OAuth 2.0 Desktop client and set both variables.\n" +
        "See README.md for setup instructions."
    );
    process.exit(1);
  }

  return { clientId, clientSecret };
}
