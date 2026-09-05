import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { PrepareLoginInputSchema, SessionStatusSchema } from "../schemas.js";
import type { PortalWorker } from "../services/worker.js";
import { PREPARES_LOGIN } from "./annotations.js";

export function registerPrepareLoginTool(server: McpServer, worker: PortalWorker): void {
  server.registerTool(
    "uyap_prepare_login",
    {
      title: "UYAP Girişini Hazırla",
      description:
        "UYAP giriş sayfasını yerel Chrome'da aç; PIN'i yalnızca kullanıcı işletim sistemi ekranına girer. " +
        "wait_seconds 0 ile 120 arasında olmalıdır. Sıfır verilirse sayfayı açıp hemen durum döndürür.",
      inputSchema: PrepareLoginInputSchema.shape,
      outputSchema: SessionStatusSchema.shape,
      annotations: PREPARES_LOGIN,
    },
    async ({ wait_seconds }) => {
      const status = await worker.prepareLogin(wait_seconds);
      return {
        content: [{ type: "text", text: JSON.stringify(status) }],
        structuredContent: status,
      };
    }
  );
}
