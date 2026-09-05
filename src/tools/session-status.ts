import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { SessionStatusSchema } from "../schemas.js";
import type { PortalWorker } from "../services/worker.js";
import { READ_ONLY } from "./annotations.js";

export function registerSessionStatusTool(server: McpServer, worker: PortalWorker): void {
  server.registerTool(
    "uyap_session_status",
    {
      title: "UYAP Oturum Durumu",
      description: "CDP bağlantısını, portal sekmesini ve UYAP giriş durumunu kişisel veri döndürmeden kontrol eder.",
      inputSchema: {},
      outputSchema: SessionStatusSchema.shape,
      annotations: READ_ONLY,
    },
    async () => {
      const status = await worker.status();
      return {
        content: [{ type: "text", text: JSON.stringify(status) }],
        structuredContent: status,
      };
    }
  );
}
