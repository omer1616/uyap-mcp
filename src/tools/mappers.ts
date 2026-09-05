import type { PortalCase } from "../services/session.js";

export function toCaseSummary(item: PortalCase) {
  return {
    caseNo: item.dosyaNo ?? null,
    unit: item.birim ?? null,
    type: item.tur ?? null,
  };
}
