/** Araçların girdi/çıktı şemaları (Zod). */

import { z } from "zod";

export const SessionStatusSchema = z
  .object({
    cdpReachable: z.boolean(),
    portalPageOpen: z.boolean(),
    authenticated: z.boolean(),
    action: z.string().nullable(),
  })
  .strict();

export const CaseSummarySchema = z
  .object({
    caseNo: z.string().nullable(),
    unit: z.string().nullable(),
    type: z.string().nullable(),
  })
  .strict();

export const CasesResultSchema = z
  .object({
    cases: z.array(CaseSummarySchema),
  })
  .strict();

export const DocumentSummarySchema = z
  .object({
    documentType: z.string().nullable(),
    approvedAt: z.string().nullable(),
    group: z.string().nullable(),
  })
  .strict();

export const DocumentsResultSchema = z
  .object({
    case: CaseSummarySchema.nullable().default(null),
    total: z.number().int().default(0),
    documents: z.array(DocumentSummarySchema).default([]),
    error: z.string().nullable().default(null),
    candidates: z.array(CaseSummarySchema).default([]),
  })
  .strict();

export const DownloadOutcomeSchema = z
  .object({
    folder: z.string().nullable().default(null),
    total: z.number().int().default(0),
    succeeded: z.number().int().default(0),
    failed: z.number().int().default(0),
    error: z.string().nullable().default(null),
    candidates: z.array(CaseSummarySchema).default([]),
  })
  .strict();

export const StatusInputSchema = z
  .object({
    status: z.union([z.literal(0), z.literal(1)]).default(0).describe("0 açık dosyalar, 1 kapalı dosyalar"),
  })
  .strict();

export const PrepareLoginInputSchema = z
  .object({
    wait_seconds: z
      .number()
      .int()
      .min(0)
      .max(120)
      .default(0)
      .describe("Girişin tamamlanmasını en fazla bu kadar saniye bekle (0-120)."),
  })
  .strict();

export const CaseLookupInputSchema = z
  .object({
    case_no: z.string().min(1).describe("Dosya numarası, örn. 2025/90"),
    unit: z.string().optional().describe("Birim adının bir kısmı; birden fazla eşleşme varsa daraltmak için."),
    status: z.union([z.literal(0), z.literal(1)]).default(0).describe("0 açık dosyalar, 1 kapalı dosyalar"),
  })
  .strict();
