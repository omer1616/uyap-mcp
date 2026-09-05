/** Tüm portal işlemlerini tek sıralı kuyrukta çalıştırır. */

import type { Settings } from "../config.js";
import {
  UyapSession,
  type DocumentsResult,
  type DownloadResult,
  type PortalCase,
  type SessionStatus,
} from "./session.js";

function log(message: string): void {
  console.error(`INFO uyap_mcp: ${message}`);
}

/** MCP çağrılarının UYAP tarafında birbiriyle yarışmasını engeller. */
export class PortalWorker {
  private readonly settings: Settings;
  private session: UyapSession | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  private getSession(): UyapSession {
    if (!this.session) {
      this.session = new UyapSession(this.settings, log);
    }
    return this.session;
  }

  private enqueue<T>(task: (session: UyapSession) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => task(this.getSession()));
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  status(): Promise<SessionStatus> {
    return this.enqueue((session) => session.status());
  }

  prepareLogin(waitSeconds: number): Promise<SessionStatus> {
    return this.enqueue((session) => session.prepareLogin(waitSeconds));
  }

  listCases(status: 0 | 1): Promise<PortalCase[]> {
    return this.enqueue((session) => session.listCases(status));
  }

  listDocuments(caseNo: string, unit: string | null | undefined, status: 0 | 1): Promise<DocumentsResult> {
    return this.enqueue((session) => session.listDocuments(caseNo, unit, status));
  }

  downloadCase(caseNo: string, unit: string | null | undefined, status: 0 | 1): Promise<DownloadResult> {
    return this.enqueue((session) => session.downloadCase(caseNo, unit, status));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.session) {
      const session = this.session;
      this.session = null;
      await session.close().catch(() => undefined);
    }
  }
}
