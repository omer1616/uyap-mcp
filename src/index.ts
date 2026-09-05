#!/usr/bin/env node
/** Claude, Codex ve Gemini için yerel STDIO MCP sunucusu. */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadSettings } from "./config.js";
import { PortalWorker } from "./services/worker.js";
import { registerSessionStatusTool } from "./tools/session-status.js";
import { registerPrepareLoginTool } from "./tools/prepare-login.js";
import { registerListCasesTool } from "./tools/list-cases.js";
import { registerListDocumentsTool } from "./tools/list-documents.js";
import { registerDownloadCaseTool } from "./tools/download-case.js";

export function createServer(worker: PortalWorker): McpServer {
  const server = new McpServer(
    { name: "UYAP MCP", version: "0.1.0" },
    {
      instructions:
        "Bu sunucu kullanıcının yerel ve e-imzayla açılmış UYAP Avukat Portalı oturumuna bağlanır. " +
        "PIN isteme veya tahmin etme. Listeleme araçları belge içeriğini modele aktarmaz. " +
        "İndirme yan etkili bir işlemdir; yalnızca kullanıcı açıkça istediğinde çağır. " +
        "Portal eş zamanlı işlemleri reddettiği için çağrılar sunucu tarafından sıraya alınır.",
    }
  );

  registerSessionStatusTool(server, worker);
  registerPrepareLoginTool(server, worker);
  registerListCasesTool(server, worker);
  registerListDocumentsTool(server, worker);
  registerDownloadCaseTool(server, worker);

  return server;
}

async function main(): Promise<void> {
  const settings = loadSettings();
  const worker = new PortalWorker(settings);
  const server = createServer(worker);

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href;
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
