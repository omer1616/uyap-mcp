import assert from "node:assert/strict";
import test from "node:test";

import { ensureChrome, cdpAlive, type EnsureChromeDeps } from "../src/services/browser.js";

test("ensureChrome yapılandırılan yerel portu kullanır", async () => {
  const calls: string[][] = [];
  let aliveCallCount = 0;
  const deps: EnsureChromeDeps = {
    cdpAlive: async () => {
      aliveCallCount += 1;
      return aliveCallCount > 1;
    },
    chromeCandidates: () => ["/fake/chrome"],
    executableExists: () => true,
    spawn: ((argv: string, args: string[]) => {
      calls.push(args);
      return { unref() {} } as ReturnType<typeof import("node:child_process").spawn>;
    }) as typeof import("node:child_process").spawn,
    sleep: async () => undefined,
  };

  const started = await ensureChrome("/tmp/uyap-profile", "https://avukat.uyap.gov.tr/", "http://127.0.0.1:9333", 1, deps);

  assert.equal(started, true);
  assert.ok(calls[0].includes("--remote-debugging-address=127.0.0.1"));
  assert.ok(calls[0].includes("--remote-debugging-port=9333"));
});

test("cdpAlive kapalı bir port için false döner", async () => {
  const alive = await cdpAlive("http://127.0.0.1:9");
  assert.equal(alive, false);
});
