# Changelog

## 1.1.0

- Add `gsc_list_sitemaps` tool
- Add `query_filter` and `page_filter` on `gsc_search_analytics`
- Truncate large responses and dimension values for model context safety
- Friendlier Google API error messages (403/404/429)
- Split source into `constants.js`, `errors.js`, `tools.js`; sync MCP server version from `package.json`
- README focused on adopters; maintainer docs moved to `CONTRIBUTING.md`
- Add smoke test (`npm test`) and GitHub Actions CI

## 1.0.2

- Add `gsc-mcp-server` bin entry so bare `npx @jlnkrth/gsc-mcp-server` works
- Add `bin/` wrapper scripts for npm bin linking

## 1.0.1

- Rename npm package to scoped `@jlnkrth/gsc-mcp-server` (unscoped `gsc-mcp-server` is taken)
- Fix bin paths per `npm pkg fix`

## 1.0.0

- Initial public release: `gsc_list_sites`, `gsc_search_analytics`, `gsc_inspect_url`
- OAuth helper and Cursor/Claude Desktop config examples
