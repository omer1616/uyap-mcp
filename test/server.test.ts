import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/index.js";
import { PortalWorker } from "../src/services/worker.js";
import type { Settings } from "../src/config.js";

async function connectedClient(settings: Settings) {
  const worker = new PortalWorker(settings);
  const server = createServer(worker);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, worker };
}

async function testSettings(): Promise<Settings> {
  const profileDir = await mkdtemp(join(tmpdir(), "uyap-profile-"));
  const outputDir = await mkdtemp(join(tmpdir(), "uyap-output-"));
  return {
    profileDir,
    outputDir,
    // Kapalı olduğu bilinen (discard) bir port: CDP'ye asla ulaşılamaz.
    cdpUrl: "http://127.0.0.1:9",
    portalUrl: "https://avukat.uyap.gov.tr/",
  };
}

test("mcp araçları sabit şema ve anotasyonlara sahiptir", async () => {
  const { client, worker } = await connectedClient(await testSettings());
  try {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    assert.deepEqual(
      new Set(byName.keys()),
      new Set([
        "uyap_session_status",
        "uyap_prepare_login",
        "uyap_list_cases",
        "uyap_list_documents",
        "uyap_download_case",
      ])
    );
    assert.equal(byName.get("uyap_session_status")?.annotations?.readOnlyHint, true);
    assert.equal(byName.get("uyap_download_case")?.annotations?.readOnlyHint, false);
    assert.equal(byName.get("uyap_session_status")?.outputSchema?.type, "object");
    assert.equal(
      (byName.get("uyap_list_cases")?.outputSchema?.properties as Record<string, { type: string }>)?.cases?.type,
      "array"
    );

    const result = await client.callTool({ name: "uyap_session_status", arguments: {} });
    assert.deepEqual(result.structuredContent, {
      cdpReachable: false,
      portalPageOpen: false,
      authenticated: false,
      action: "Giriş hazırlığını çalıştırın.",
    });
  } finally {
    await worker.close();
  }
});
