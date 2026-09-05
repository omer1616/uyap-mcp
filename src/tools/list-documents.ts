import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CaseLookupInputSchema, DocumentsResultSchema } from "../schemas.js";
import { MultipleMatches } from "../services/session.js";
import type { PortalWorker } from "../services/worker.js";
import { READ_ONLY } from "./annotations.js";
import { toCaseSummary } from "./mappers.js";

export function registerListDocumentsTool(server: McpServer, worker: PortalWorker): void {
  server.registerTool(
    "uyap_list_documents",
    {
      title: "Evrakları Listele",
      description: "Bir dosyanın evrak türü, tarihi ve grubunu listeler; evrak baytlarını veya metnini döndürmez.",
      inputSchema: CaseLookupInputSchema.shape,
      outputSchema: DocumentsResultSchema.shape,
      annotations: READ_ONLY,
    },
    async ({ case_no, unit, status }) => {
      try {
        const result = await worker.listDocuments(case_no, unit, status);
        const structured = {
          case: result.case,
          total: result.total,
          documents: result.documents,
          error: null,
          candidates: [],
        };
        return { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured };
      } catch (error) {
        if (error instanceof MultipleMatches) {
          const structured = {
            case: null,
            total: 0,
            documents: [],
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
