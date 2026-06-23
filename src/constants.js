import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

export const VERSION = pkg.version;
export const SERVER_NAME = "gsc-mcp-server";
export const CHARACTER_LIMIT = 25_000;
export const DIMENSION_VALUE_MAX_LEN = 80;
