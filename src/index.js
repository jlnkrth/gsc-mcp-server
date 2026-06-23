#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getTokenPath, REDIRECT_URI, requireGoogleCredentials } from "./config.js";
import { SERVER_NAME, VERSION } from "./constants.js";
import { TOOLS, createToolHandler } from "./tools.js";

const { clientId, clientSecret } = requireGoogleCredentials();
const TOKEN_PATH = getTokenPath();

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

let authenticated = false;

async function loadTokens() {
  try {
    const data = JSON.parse(await readFile(TOKEN_PATH, "utf-8"));
    oauth2Client.setCredentials(data);
    authenticated = true;
  } catch {
    authenticated = false;
  }
}

oauth2Client.on("tokens", async (tokens) => {
  const existing = oauth2Client.credentials;
  const merged = { ...existing, ...tokens };
  try {
    await mkdir(dirname(TOKEN_PATH), { recursive: true });
    await writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error("Failed to save tokens:", e.message);
  }
});

function requireAuth() {
  if (!authenticated) {
    return {
      content: [
        {
          type: "text",
          text:
            "Not authenticated. Run the OAuth flow once:\n" +
            "  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npx -y -p @jlnkrth/gsc-mcp-server gsc-mcp-auth\n" +
            "  (or npm run auth if you cloned the repo)\n" +
            "Then restart your MCP client.",
        },
      ],
      isError: true,
    };
  }
  return null;
}

function searchconsole() {
  return google.searchconsole({ version: "v1", auth: oauth2Client });
}

const handleTool = createToolHandler({ searchconsole, requireAuth });

const server = new Server(
  { name: SERVER_NAME, version: VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return handleTool(request.params.name, request.params.arguments || {});
});

await loadTokens();
const transport = new StdioServerTransport();
await server.connect(transport);
