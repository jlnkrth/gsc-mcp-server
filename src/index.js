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

const TOOLS = [
  {
    name: "gsc_list_sites",
    description:
      "List all sites (properties) in Google Search Console accessible to the authenticated Google account.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "gsc_search_analytics",
    description:
      "Query Google Search Console search analytics. Returns clicks, impressions, CTR, and position. Dimensions: query, page, country, device, date, searchAppearance.",
    inputSchema: {
      type: "object",
      properties: {
        site_url: {
          type: "string",
          description:
            "Site URL as registered in GSC (e.g. 'https://example.com/' or 'sc-domain:example.com')",
        },
        start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description:
            "Dimensions to group by: 'query', 'page', 'country', 'device', 'date', 'searchAppearance'",
        },
        row_limit: {
          type: "number",
          description: "Max rows (default 100, max 25000)",
        },
        start_row: {
          type: "number",
          description: "Starting row for pagination (default 0)",
        },
        dimension_filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dimension: { type: "string" },
              operator: {
                type: "string",
                description:
                  "'contains', 'equals', 'notContains', 'notEquals', 'includingRegex', 'excludingRegex'",
              },
              expression: { type: "string" },
            },
          },
          description:
            'Optional filters, e.g. [{"dimension":"query","operator":"contains","expression":"keyword"}]',
        },
        type: {
          type: "string",
          description:
            "Search type: 'web' (default), 'image', 'video', 'news', 'discover', 'googleNews'",
        },
      },
      required: ["site_url", "start_date", "end_date"],
    },
  },
  {
    name: "gsc_inspect_url",
    description:
      "Inspect a URL's indexing status in Google Search Console. Shows whether the URL is indexed, crawl issues, and mobile usability.",
    inputSchema: {
      type: "object",
      properties: {
        site_url: { type: "string", description: "Site URL as registered in GSC" },
        inspection_url: { type: "string", description: "The full URL to inspect" },
      },
      required: ["site_url", "inspection_url"],
    },
  },
];

async function handleTool(name, args) {
  const authErr = requireAuth();
  if (authErr) return authErr;

  try {
    switch (name) {
      case "gsc_list_sites": {
        const res = await searchconsole().sites.list();
        const sites = res.data.siteEntry || [];
        if (!sites.length) return text("No sites found in Search Console.");
        return text(sites.map((s) => `${s.siteUrl}  [${s.permissionLevel}]`).join("\n"));
      }

      case "gsc_search_analytics": {
        const body = {
          startDate: args.start_date,
          endDate: args.end_date,
          rowLimit: args.row_limit || 100,
          startRow: args.start_row || 0,
        };
        if (args.dimensions) body.dimensions = args.dimensions;
        if (args.type) body.type = args.type;
        if (args.dimension_filters) {
          body.dimensionFilterGroups = [
            {
              filters: args.dimension_filters.map((f) => ({
                dimension: f.dimension,
                operator: f.operator,
                expression: f.expression,
              })),
            },
          ];
        }
        const res = await searchconsole().searchanalytics.query({
          siteUrl: args.site_url,
          requestBody: body,
        });
        const rows = res.data.rows || [];
        if (!rows.length) return text("No search analytics data for the specified range.");
        const dims = args.dimensions || [];
        const headers = [...dims, "clicks", "impressions", "ctr", "position"];
        const tableRows = rows.map((r) => {
          const keys = (r.keys || []).map((k) => k);
          return [
            ...keys,
            r.clicks,
            r.impressions,
            (r.ctr * 100).toFixed(2) + "%",
            r.position.toFixed(1),
          ];
        });
        const tbl = `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${tableRows.map((r) => `| ${r.join(" | ")} |`).join("\n")}`;
        return text(tbl);
      }

      case "gsc_inspect_url": {
        const res = await searchconsole().urlInspection.index.inspect({
          requestBody: {
            inspectionUrl: args.inspection_url,
            siteUrl: args.site_url,
          },
        });
        const result = res.data.inspectionResult;
        const idx = result?.indexStatusResult;
        const lines = [
          `URL: ${args.inspection_url}`,
          `Verdict: ${idx?.verdict || "UNKNOWN"}`,
          `Coverage state: ${idx?.coverageState || "N/A"}`,
          `Indexing state: ${idx?.indexingState || "N/A"}`,
          `Last crawl time: ${idx?.lastCrawlTime || "N/A"}`,
          `Crawled as: ${idx?.crawledAs || "N/A"}`,
          `Robots.txt state: ${idx?.robotsTxtState || "N/A"}`,
          `Page fetch state: ${idx?.pageFetchState || "N/A"}`,
        ];
        if (idx?.sitemap) lines.push(`Referring sitemaps: ${JSON.stringify(idx.sitemap)}`);
        const mobile = result?.mobileUsabilityResult;
        if (mobile) {
          lines.push(`\nMobile usability: ${mobile.verdict || "N/A"}`);
          for (const issue of mobile.issues || []) {
            lines.push(`  Issue: ${issue.issueType} — ${issue.message || ""}`);
          }
        }
        return text(lines.join("\n"));
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return { content: [{ type: "text", text: `Google API error: ${msg}` }], isError: true };
  }
}

function text(t) {
  return { content: [{ type: "text", text: t }] };
}

const server = new Server(
  { name: "gsc-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return handleTool(request.params.name, request.params.arguments || {});
});

await loadTokens();
const transport = new StdioServerTransport();
await server.connect(transport);
