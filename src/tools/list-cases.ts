import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CasesResultSchema, StatusInputSchema } from "../schemas.js";
import type { PortalWorker } from "../services/worker.js";
import { READ_ONLY } from "./annotations.js";
import { toCaseSummary } from "./mappers.js";

export function registerListCasesTool(server: McpServer, worker: PortalWorker): void {
  server.registerTool(
    "uyap_list_cases",
    {
      title: "Dosyaları Listele",
      description: "Açık (0) veya kapalı (1) UYAP dosyalarını evrak indirmeden listeler.",
      inputSchema: StatusInputSchema.shape,
      outputSchema: CasesResultSchema.shape,
      annotations: READ_ONLY,
    },
    async ({ status }) => {
      const cases = (await worker.listCases(status)).map(toCaseSummary);
      const result = { cases };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    }
  );
}
