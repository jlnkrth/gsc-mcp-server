# Contributing

## Local development

```bash
git clone https://github.com/jlnkrth/gsc-mcp-server.git
cd gsc-mcp-server
npm install
```

Set credentials and run auth:

```bash
export GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-...."
npm run auth
npm start
```

**Important:** `npx @jlnkrth/gsc-mcp-server` does not work from inside a cloned copy of this repo — npm resolves to the local package without linking bin shims. Use `npm run auth` and `npm start` instead, or run `npx` from another directory.

## Tests

```bash
npm test
```

Runs `scripts/smoke-test.mjs` — MCP `initialize`, `tools/list` (expects 4 tools), and unauthenticated `gsc_list_sites` error handling. No live Google API calls.

## Publishing to npm

Prerequisites:

- npm 11+ (`npm install -g npm@11`)
- 2FA enabled on your npm account (passkey is fine)

```bash
npm test
npm publish --access public
```

If publish fails with `EOTP`, npm prints a browser URL — open it, approve with your passkey, then run `npm publish --access public` again.

Do **not** use `--otp=123456` unless you have a real 6-digit authenticator code. Passkey users should use the browser URL flow above.

Scoped packages require `--access public` on every publish.

## Pull requests

1. Branch from `main`
2. Run `npm test` before opening PR (CI runs the same)
3. Update `CHANGELOG.md` under `[Unreleased]` or the next version section
