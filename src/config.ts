/** Ortam değişkenlerinden güvenli yerel çalışma ayarları. */

import { homedir } from "node:os";
import { resolve } from "node:path";

export interface Settings {
  readonly profileDir: string;
  readonly outputDir: string;
  readonly cdpUrl: string;
  readonly portalUrl: string;
}

const PORTAL_URL = "https://avukat.uyap.gov.tr/";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return resolve(path);
}

function validateCdpUrl(raw: string): string {
  const cdpUrl = raw.replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(cdpUrl);
  } catch {
    throw new Error("UYAP_MCP_CDP_URL yalnızca port içeren yerel bir HTTP adresi olabilir.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "http:" ||
    !LOCAL_HOSTS.has(hostname) ||
    parsed.port === "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    !["", "/"].includes(parsed.pathname) ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("UYAP_MCP_CDP_URL yalnızca port içeren yerel bir HTTP adresi olabilir.");
  }
  return cdpUrl;
}

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const home = homedir();
  const cdpUrl = validateCdpUrl(env.UYAP_MCP_CDP_URL ?? "http://127.0.0.1:9222");
  return {
    profileDir: expandHome(env.UYAP_MCP_PROFILE_DIR ?? resolve(home, ".uyap-mcp", "chrome-profile")),
    outputDir: expandHome(env.UYAP_MCP_OUTPUT_DIR ?? resolve(home, "Downloads", "UYAP")),
    cdpUrl,
    portalUrl: PORTAL_URL,
  };
}
