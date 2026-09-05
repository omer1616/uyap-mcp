/** Chrome süreci, CDP bağlantısı ve UYAP oturum kontrolü. */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn, execSync } from "node:child_process";
import { platform } from "node:process";
import type { BrowserContext, Page } from "playwright-core";

export const CHECK_LOGIN_JS = String.raw`
async () => {
  try {
    const response = await fetch('/avukat_sik_kullanilan_dosyalar.ajx', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json;charset=UTF-8'}, body:'{}'
    });
    if (!response.ok) return false;
    const text = await response.text();
    try { JSON.parse(text); return true; } catch (_) { return false; }
  } catch (_) { return false; }
}`;

export async function cdpAlive(cdpUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${cdpUrl}/json/version`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function findOnPath(name: string): string | null {
  try {
    const found = execSync(`command -v ${name}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return found || null;
  } catch {
    return null;
  }
}

export function chromeCandidates(): string[] {
  const candidates: string[] = [];
  if (platform === "darwin") {
    candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  } else if (platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`
    );
  } else {
    for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
      const found = findOnPath(name);
      if (found) candidates.push(found);
    }
  }
  return candidates;
}

/** Chrome'u CDP modunda açacak argüman listesini üretir (yan etkisiz, test edilebilir). */
export function buildChromeArgs(profileDir: string, portalUrl: string, cdpPort: string): string[] {
  return [
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    portalUrl,
  ];
}

export interface EnsureChromeDeps {
  cdpAlive: (cdpUrl: string) => Promise<boolean>;
  chromeCandidates: () => string[];
  executableExists: (path: string) => boolean;
  spawn: typeof spawn;
  sleep: (milliseconds: number) => Promise<void>;
}

const defaultDeps: EnsureChromeDeps = {
  cdpAlive,
  chromeCandidates,
  executableExists: existsSync,
  spawn,
  sleep: (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)),
};

/** Gerekirse Chrome'u sabit profil ve yerel CDP portuyla açar. */
export async function ensureChrome(
  profileDir: string,
  portalUrl: string,
  cdpUrl: string,
  waitSeconds = 30,
  deps: EnsureChromeDeps = defaultDeps
): Promise<boolean> {
  if (await deps.cdpAlive(cdpUrl)) {
    return true;
  }
  const executable = deps.chromeCandidates().find((path) => deps.executableExists(path));
  if (!executable) {
    return false;
  }
  await mkdir(profileDir, { recursive: true });
  const cdpPort = new URL(cdpUrl).port;
  if (!cdpPort) {
    throw new Error("CDP adresinde port bulunmalıdır.");
  }
  const child = deps.spawn(executable, buildChromeArgs(profileDir, portalUrl, cdpPort), {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  for (let attempt = 0; attempt < waitSeconds; attempt += 1) {
    await deps.sleep(1000);
    if (await deps.cdpAlive(cdpUrl)) {
      return true;
    }
  }
  return false;
}

/** Beklenen UYAP portalındaki ilk açık sekmeyi döndürür. */
export function activePage(context: BrowserContext | null): Page | null {
  if (!context) return null;
  for (const page of context.pages()) {
    if (!page.isClosed() && (page.url() || "").startsWith("https://avukat.uyap.gov.tr/")) {
      return page;
    }
  }
  return null;
}
