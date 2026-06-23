import { CHARACTER_LIMIT, DIMENSION_VALUE_MAX_LEN } from "./constants.js";
import { formatGoogleError } from "./errors.js";

export const TOOLS = [
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
        query_filter: {
          type: "string",
          description: "Filter search queries containing this string (case-insensitive)",
        },
        page_filter: {
          type: "string",
          description: "Filter pages whose URL contains this string",
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
  {
    name: "gsc_list_sitemaps",
    description:
      "List all sitemaps submitted for a site in Google Search Console. Returns paths, types, dates, and errors/warnings.",
    inputSchema: {
      type: "object",
      properties: {
        site_url: { type: "string", description: "Site URL as registered in GSC" },
      },
      required: ["site_url"],
    },
  },
];

function text(t) {
  return { content: [{ type: "text", text: t }] };
}

function truncateCell(value) {
  const s = String(value);
  if (s.length <= DIMENSION_VALUE_MAX_LEN) return s;
  return s.slice(0, DIMENSION_VALUE_MAX_LEN - 3) + "...";
}

export function truncateIfNeeded(output, itemCount) {
  if (output.length <= CHARACTER_LIMIT) return output;
  return (
    output.slice(0, CHARACTER_LIMIT) +
    `\n\n--- Response truncated (${itemCount} rows). Use date filters or narrow your query. ---`
  );
}

function buildDimensionFilterGroups(args) {
  const groups = [];

  if (args.query_filter) {
    groups.push({
      groupType: "and",
      filters: [
        { dimension: "query", operator: "contains", expression: args.query_filter },
      ],
    });
  }

  if (args.page_filter) {
    groups.push({
      groupType: "and",
      filters: [
        { dimension: "page", operator: "contains", expression: args.page_filter },
      ],
    });
  }

  if (args.dimension_filters?.length) {
    groups.push({
      filters: args.dimension_filters.map((f) => ({
        dimension: f.dimension,
        operator: f.operator,
        expression: f.expression,
      })),
    });
  }

  return groups.length ? groups : undefined;
}

export function createToolHandler({ searchconsole, requireAuth }) {
  return async function handleTool(name, args) {
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

          const filterGroups = buildDimensionFilterGroups(args);
          if (filterGroups) body.dimensionFilterGroups = filterGroups;

          const res = await searchconsole().searchanalytics.query({
            siteUrl: args.site_url,
            requestBody: body,
          });
          const rows = res.data.rows || [];
          if (!rows.length) return text("No search analytics data for the specified range.");

          const dims = args.dimensions || [];
          const searchType = args.type || "web";
          const lines = [
            `# Search Console: ${args.site_url}`,
            `*${args.start_date} to ${args.end_date} | ${searchType} | ${rows.length} rows*`,
            "",
          ];

          const headers = [...dims, "clicks", "impressions", "ctr", "position"];
          lines.push(`| ${headers.join(" | ")} |`);
          lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

          for (const r of rows) {
            const keys = (r.keys || []).map((k) => truncateCell(k));
            lines.push(
              `| ${[...keys, r.clicks, r.impressions, (r.ctr * 100).toFixed(2) + "%", r.position.toFixed(1)].join(" | ")} |`
            );
          }

          return text(truncateIfNeeded(lines.join("\n"), rows.length));
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
          const outputLines = [
            `URL: ${args.inspection_url}`,
            `Verdict: ${idx?.verdict || "UNKNOWN"}`,
            `Coverage state: ${idx?.coverageState || "N/A"}`,
            `Indexing state: ${idx?.indexingState || "N/A"}`,
            `Last crawl time: ${idx?.lastCrawlTime || "N/A"}`,
            `Crawled as: ${idx?.crawledAs || "N/A"}`,
            `Robots.txt state: ${idx?.robotsTxtState || "N/A"}`,
            `Page fetch state: ${idx?.pageFetchState || "N/A"}`,
          ];
          if (idx?.sitemap) outputLines.push(`Referring sitemaps: ${JSON.stringify(idx.sitemap)}`);
          const mobile = result?.mobileUsabilityResult;
          if (mobile) {
            outputLines.push(`\nMobile usability: ${mobile.verdict || "N/A"}`);
            for (const issue of mobile.issues || []) {
              outputLines.push(`  Issue: ${issue.issueType} — ${issue.message || ""}`);
            }
          }
          return text(outputLines.join("\n"));
        }

        case "gsc_list_sitemaps": {
          const res = await searchconsole().sitemaps.list({ siteUrl: args.site_url });
          const sitemaps = res.data.sitemap || [];
          if (!sitemaps.length) return text("No sitemaps found for this site.");

          const lines = [`# Sitemaps for ${args.site_url}`, ""];
          for (const sm of sitemaps) {
            lines.push(`## ${sm.path}`);
            lines.push(`- **Type**: ${sm.type ?? "Unknown"}`);
            lines.push(`- **Last submitted**: ${sm.lastSubmitted ?? "Unknown"}`);
            lines.push(`- **Last downloaded**: ${sm.lastDownloaded ?? "Unknown"}`);
            lines.push(`- **Errors**: ${sm.errors ?? 0} | **Warnings**: ${sm.warnings ?? 0}`);
            if (sm.contents?.length) {
              for (const content of sm.contents) {
                lines.push(
                  `- **${content.type}**: ${content.submitted ?? 0} submitted, ${content.indexed ?? 0} indexed`
                );
              }
            }
            lines.push("");
          }
          return text(lines.join("\n"));
        }

        default:
          return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }
    } catch (err) {
      return { content: [{ type: "text", text: formatGoogleError(err) }], isError: true };
    }
  };
}
