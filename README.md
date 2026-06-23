# gsc-mcp-server

[![npm version](https://img.shields.io/npm/v/@jlnkrth/gsc-mcp-server)](https://www.npmjs.com/package/@jlnkrth/gsc-mcp-server)

MCP server for **Google Search Console**. Query search performance, list properties, inspect URLs, and list sitemaps from Cursor, Claude Desktop, or any MCP-compatible client.

**npm:** [@jlnkrth/gsc-mcp-server](https://www.npmjs.com/package/@jlnkrth/gsc-mcp-server)

> Use the scoped package name `@jlnkrth/gsc-mcp-server`. The unscoped name `gsc-mcp-server` on npm is a different package.

## Quick start

| Situation | Auth | Run MCP server |
|-----------|------|----------------|
| **Cloned this repo** (inside project folder) | `npm run auth` | `npm start` |
| **Installed from npm** (any other directory) | `npx -y -p @jlnkrth/gsc-mcp-server gsc-mcp-auth` | `npx -y @jlnkrth/gsc-mcp-server` |

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` before auth (see [Google Cloud setup](#google-cloud-setup)).

> **Using a Google passkey to sign in?** That's fine — passkey only applies to signing into Google in the browser during auth. You still need your own GCP OAuth client ID and secret.

## Tools

| Tool | Description |
|------|-------------|
| `gsc_list_sites` | List Search Console properties accessible to your Google account |
| `gsc_search_analytics` | Query clicks, impressions, CTR, and position with dimensions and filters |
| `gsc_inspect_url` | Inspect a URL's index status, crawl state, and mobile usability |
| `gsc_list_sitemaps` | List submitted sitemaps with status, errors, and indexed counts |

### `gsc_search_analytics` filters

| Parameter | Description |
|-----------|-------------|
| `query_filter` | Shorthand: queries containing this string |
| `page_filter` | Shorthand: page URLs containing this string |
| `dimension_filters` | Full GSC filter objects (advanced) |

## Prerequisites

- **Node.js 18+**
- A **Google Cloud project** with the Search Console API enabled
- An **OAuth 2.0 Desktop client** (client ID + secret)
- A Google account with access to the Search Console properties you want to query

## Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project.
3. Open **APIs & Services → Library** and enable **Google Search Console API**.
4. Open **APIs & Services → OAuth consent screen** — configure the consent screen. If the app is in **Testing** mode, add your Google account under **Test users** or sign-in will fail.
5. Open **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
6. Application type: **Desktop app**.
7. Add `http://localhost:3336/callback` as an authorized redirect URI (if prompted).
8. Copy the **Client ID** and **Client secret**.

## Install and authenticate

### From npm

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"

npx -y -p @jlnkrth/gsc-mcp-server gsc-mcp-auth
```

### From source

```bash
git clone https://github.com/jlnkrth/gsc-mcp-server.git
cd gsc-mcp-server
npm install

cp .env.example .env
# Edit .env with your credentials, then:
export $(grep -v '^#' .env | xargs)
npm run auth
```

The auth flow opens a browser on port **3336**. Tokens are saved to `~/.config/gsc-mcp/tokens.json` by default (override with `GSC_TOKEN_PATH`).

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

Keep `mcp.json` private — it contains your OAuth client secret. Do not commit it to git.

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
- "Show me blog pages with the most impressions last week" (use `page_filter`)
- "Is https://example.com/blog/my-post indexed?"
- "List sitemaps for sc-domain:example.com"

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
| Google sign-in fails / access denied | If OAuth app is in Testing mode, add your Google account as a test user in GCP |
| No `refresh_token` in saved tokens | Revoke the app at [Google Account permissions](https://myaccount.google.com/permissions), then re-run auth |
| Port 3336 in use | Free the port or stop the conflicting process, then re-run auth |
| `403` / permission denied on API calls | Confirm the signed-in Google account has access to the property in Search Console |
| MCP client can't find `npx` | Use the full path to `node` and `src/index.js` in your config |
| Google OAuth fails after passkey sign-in | `GOOGLE_CLIENT_ID` / `SECRET` must be real GCP values — not placeholders. Check redirect URI `http://localhost:3336/callback` |

## Related MCP servers

- [Google Analytics MCP](https://github.com/googleanalytics/google-analytics-mcp) — official GA4 server
- [DataForSEO MCP](https://github.com/dataforseo/mcp-server-typescript) — official DataForSEO server

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development, tests, and publishing.

## License

MIT
