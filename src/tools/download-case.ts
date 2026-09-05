import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CaseLookupInputSchema, DownloadOutcomeSchema } from "../schemas.js";
import { MultipleMatches } from "../services/session.js";
import type { PortalWorker } from "../services/worker.js";
import { DOWNLOADS_FILES } from "./annotations.js";
import { toCaseSummary } from "./mappers.js";

export function registerDownloadCaseTool(server: McpServer, worker: PortalWorker): void {
  server.registerTool(
    "uyap_download_case",
    {
      title: "Dosya Evraklarını İndir",
      description: "Kullanıcı açıkça istediğinde dosyanın tüm evraklarını sabit yerel çıktı klasörüne sıralı indir.",
      inputSchema: CaseLookupInputSchema.shape,
      outputSchema: DownloadOutcomeSchema.shape,
      annotations: DOWNLOADS_FILES,
    },
    async ({ case_no, unit, status }) => {
      try {
        const result = await worker.downloadCase(case_no, unit, status);
        const structured = { ...result, error: null, candidates: [] };
        return { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured };
      } catch (error) {
        if (error instanceof MultipleMatches) {
          const structured = {
            folder: null,
            total: 0,
            succeeded: 0,
            failed: 0,
            error: error.message,
            candidates: error.candidates.map(toCaseSummary),
          };
          return { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured };
        }
        throw error;
      }
    }
  );
}
