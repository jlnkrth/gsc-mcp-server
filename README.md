# gsc-mcp-server

MCP server for **Google Search Console**. Query search performance, list properties, and inspect URL indexing status from Cursor, Claude Desktop, or any MCP-compatible client.

## Quick start

| Situation | Auth | Run MCP server |
|-----------|------|----------------|
| **Cloned this repo** (you are in the project folder) | `npm run auth` | `npm start` |
| **Installed from npm** (any other directory) | `npx -y -p @jlnkrth/gsc-mcp-server gsc-mcp-auth` | `npx -y @jlnkrth/gsc-mcp-server` |

> `npx @jlnkrth/gsc-mcp-server` does **not** work from inside a cloned copy of this repo — npm resolves to the local folder without linking bin shims. Use `npm run` commands instead.

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` before auth (see [Google Cloud setup](#google-cloud-setup)).

> **Using a Google passkey to sign in?** That's fine — passkey is only for logging into Google in the browser during `npm run auth`. It does not replace your GCP OAuth **client ID and secret** (you still need those env vars).

## Publishing to npm (maintainers)

npm accounts with **passkey 2FA** cannot use `--otp=123456` (that's for authenticator apps). Use **npm 11+** and the browser flow:

```bash
npm install -g npm@11   # once
cd gsc-mcp-server
npm publish --access public
```

When publish fails with `EOTP`, npm prints a URL like `https://www.npmjs.com/auth/cli/...` — open it, approve with your **passkey**, then run `npm publish --access public` again in the same terminal.

Do **not** use placeholder recovery codes from chat; generate new ones at [npm 2FA settings](https://www.npmjs.com/settings/jlnkrth/tfa) if needed.

## Tools

| Tool | Description |
|------|-------------|
| `gsc_list_sites` | List Search Console properties accessible to your Google account |
| `gsc_search_analytics` | Query clicks, impressions, CTR, and position with dimensions and filters |
| `gsc_inspect_url` | Inspect a URL's index status, crawl state, and mobile usability |

## Prerequisites

- **Node.js 18+**
- A **Google Cloud project** with the Search Console API enabled
- An **OAuth 2.0 Desktop client** (client ID + secret)
- A Google account with access to the Search Console properties you want to query

## Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project.
3. Open **APIs & Services → Library** and enable **Google Search Console API**.
4. Open **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
5. Application type: **Desktop app**.
6. Add `http://localhost:3336/callback` as an authorized redirect URI (if prompted).
7. Copy the **Client ID** and **Client secret**.

## Install and authenticate

### Option A: From npm

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"

# Auth (run from any directory except inside a cloned copy of this repo)
npx -y -p @jlnkrth/gsc-mcp-server gsc-mcp-auth
```

> **Note:** If you cloned the repo and are inside the project folder, use `npm run auth` instead of `npx` — npm resolves to the local package and bin shims are not linked there.

### Option B: From source

```bash
git clone https://github.com/jlnkrth/gsc-mcp-server.git
cd gsc-mcp-server
npm install

cp .env.example .env
# Edit .env with your credentials, then:
export $(grep -v '^#' .env | xargs)
npm run auth
```

The auth flow opens a browser on port **3336**. Sign in with the Google account that has Search Console access. Tokens are saved to `~/.config/gsc-mcp/tokens.json` by default (override with `GSC_TOKEN_PATH`).

## MCP client configuration

### Cursor

Add to `~/.cursor/mcp.json` (merge with existing servers):

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "npx",
      "args": ["-y", "@jlnkrth/gsc-mcp-server"],
      "env": {
        "GOOGLE_CLIENT_ID": "YOUR_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "GSC_TOKEN_PATH": "/Users/you/.config/gsc-mcp/tokens.json"
      }
    }
  }
}
```

For local development, point `command` at Node directly:

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "node",
      "args": ["/absolute/path/to/gsc-mcp-server/src/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "YOUR_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

See [examples/cursor-mcp.json](examples/cursor-mcp.json).

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS (see [examples/claude-desktop.json](examples/claude-desktop.json)).

After changing MCP config, **fully quit and restart** your client so the server reloads tokens.

## Example prompts

Once connected, you can ask your AI assistant:

- "List my Search Console properties"
- "What are the top 20 queries by clicks for https://example.com/ in the last 28 days?"
- "Show me pages with the most impressions last week"
- "Is https://example.com/blog/my-post indexed?"

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Desktop client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Desktop client secret |
| `GSC_TOKEN_PATH` | No | Token file path (default: `~/.config/gsc-mcp/tokens.json`) |
| `GOOGLE_LOGIN_HINT` | No | Pre-fill email in the OAuth browser sign-in |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Not authenticated` | Run `npx -y -p @jlnkrth/gsc-mcp-server gsc-mcp-auth` (or `npm run auth` if inside a clone), then restart your MCP client |
| `npx` fails inside cloned repo | Use `npm run auth` / `npm start` locally, or run `npx` from another directory |
| No `refresh_token` in saved tokens | Revoke the app at [Google Account permissions](https://myaccount.google.com/permissions), then re-run auth |
| Port 3336 in use | Free the port or stop the conflicting process, then re-run auth |
| `403` / permission denied on API calls | Confirm the signed-in Google account has access to the property in Search Console |
| MCP client can't find `npx` | Use the full path to `node` and `src/index.js` in your config |
| Google OAuth fails after passkey sign-in | Your `GOOGLE_CLIENT_ID` / `SECRET` must be real values from GCP — not placeholders like `your-client-id`. Check redirect URI `http://localhost:3336/callback` is in your OAuth client |
| `npm publish` asks for OTP but you use passkey | Upgrade to `npm@11`, run `npm publish --access public`, open the browser URL npm prints, approve with passkey, publish again |

## Related MCP servers

- [Google Analytics MCP](https://github.com/googleanalytics/google-analytics-mcp) — official GA4 server
- [DataForSEO MCP](https://github.com/dataforseo/mcp-server-typescript) — official DataForSEO server

## License

MIT
