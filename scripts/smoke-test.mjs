#!/usr/bin/env node
/**
 * Non-interactive MCP protocol smoke test (no live Google API calls).
 */
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const INDEX = join(ROOT, "src", "index.js");

const EXPECTED_TOOLS = [
  "gsc_list_sites",
  "gsc_search_analytics",
  "gsc_inspect_url",
  "gsc_list_sitemaps",
];

function sendMessage(proc, message) {
  proc.stdin.write(JSON.stringify(message) + "\n");
}

function createReader(proc) {
  let buffer = "";

  const pending = [];
  let resolveNext = null;

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");

    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline === -1) break;

      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;

      const message = JSON.parse(line);
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve(message);
      } else {
        pending.push(message);
      }
    }
  });

  return function readMessage() {
    if (pending.length > 0) {
      return Promise.resolve(pending.shift());
    }
    return new Promise((resolve) => {
      resolveNext = resolve;
    });
  };
}

function fail(message) {
  console.error(`smoke-test FAILED: ${message}`);
  process.exit(1);
}

async function main() {
  const tokenDir = await mkdtemp(join(tmpdir(), "gsc-mcp-smoke-"));
  const tokenPath = join(tokenDir, "tokens.json");

  const proc = spawn("node", [INDEX], {
    cwd: ROOT,
    env: {
      ...process.env,
      GOOGLE_CLIENT_ID: "smoke-test-client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "smoke-test-client-secret",
      GSC_TOKEN_PATH: tokenPath,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const readMessage = createReader(proc);
  let exitCode = null;

  proc.on("exit", (code) => {
    exitCode = code;
  });

  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8").trim();
    if (text) console.error(`[server stderr] ${text}`);
  });

  sendMessage(proc, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "gsc-mcp-smoke-test", version: "1.0.0" },
    },
  });

  const initResult = await readMessage();
  if (initResult.error) {
    fail(`initialize error: ${JSON.stringify(initResult.error)}`);
  }
  if (!initResult.result?.serverInfo?.name) {
    fail(`initialize missing serverInfo: ${JSON.stringify(initResult)}`);
  }

  sendMessage(proc, { jsonrpc: "2.0", method: "notifications/initialized" });

  sendMessage(proc, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });

  const toolsResult = await readMessage();
  if (toolsResult.error) {
    fail(`tools/list error: ${JSON.stringify(toolsResult.error)}`);
  }

  const toolNames = (toolsResult.result?.tools || []).map((t) => t.name).sort();
  for (const name of EXPECTED_TOOLS) {
    if (!toolNames.includes(name)) {
      fail(`missing tool ${name}; got: ${toolNames.join(", ")}`);
    }
  }
  if (toolNames.length !== EXPECTED_TOOLS.length) {
    fail(`expected ${EXPECTED_TOOLS.length} tools, got ${toolNames.length}: ${toolNames.join(", ")}`);
  }

  sendMessage(proc, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "gsc_list_sites", arguments: {} },
  });

  const callResult = await readMessage();
  if (callResult.error) {
    fail(`tools/call error: ${JSON.stringify(callResult.error)}`);
  }

  const text = callResult.result?.content?.[0]?.text || "";
  if (!callResult.result?.isError) {
    fail(`expected isError for unauthenticated gsc_list_sites`);
  }
  if (!text.includes("Not authenticated")) {
    fail(`expected 'Not authenticated' in response, got: ${text.slice(0, 200)}`);
  }

  proc.stdin.end();
  await new Promise((resolve) => proc.on("close", resolve));
  await rm(tokenDir, { recursive: true, force: true });

  if (exitCode !== 0 && exitCode !== null) {
    fail(`server exited with code ${exitCode}`);
  }

  console.log("smoke-test OK: 4 tools listed, unauthenticated call handled");
}

main().catch((err) => {
  console.error("smoke-test FAILED:", err);
  process.exit(1);
});
