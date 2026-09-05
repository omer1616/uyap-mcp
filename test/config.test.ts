import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { loadSettings } from "../src/config.js";

test("settings ortam değişkenlerinden okunur", () => {
  const settings = loadSettings({
    ...process.env,
    UYAP_MCP_PROFILE_DIR: "/tmp/uyap-test/profile",
    UYAP_MCP_OUTPUT_DIR: "/tmp/uyap-test/output",
    UYAP_MCP_CDP_URL: "http://127.0.0.1:9333/",
  });

  assert.equal(settings.profileDir, resolve("/tmp/uyap-test/profile"));
  assert.equal(settings.outputDir, resolve("/tmp/uyap-test/output"));
  assert.equal(settings.cdpUrl, "http://127.0.0.1:9333");
});

test("yerel olmayan veya belirsiz CDP adresleri reddedilir", () => {
  const badUrls = [
    "https://127.0.0.1:9222",
    "http://example.com:9222",
    "http://127.0.0.1",
    "http://user:pass@127.0.0.1:9222",
    "http://127.0.0.1:9222/json",
  ];
  for (const url of badUrls) {
    assert.throws(() => loadSettings({ ...process.env, UYAP_MCP_CDP_URL: url }));
  }
});
