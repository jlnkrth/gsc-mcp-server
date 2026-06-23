#!/usr/bin/env bash
# Install dependencies and run the OAuth flow for the GSC MCP server.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== GSC MCP Server — Setup ==="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Error: 'node' not found. Install Node.js 18+ from https://nodejs.org" >&2
  exit 1
fi

echo "Installing npm dependencies..."
(cd "$ROOT_DIR" && npm install)
echo ""

if [ -z "${GOOGLE_CLIENT_ID:-}" ] || [ -z "${GOOGLE_CLIENT_SECRET:-}" ]; then
  echo "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running auth."
  echo "Copy .env.example to .env, fill in your credentials, then:"
  echo "  export \$(grep -v '^#' .env | xargs) && npm run auth"
  exit 1
fi

echo "Starting Google OAuth flow..."
node "$ROOT_DIR/src/auth.js"
