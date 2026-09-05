/** Portal sözleşmeleri ve I/O içermeyen belge yardımcıları. */

import { resolve, relative, isAbsolute, sep, dirname, basename } from "node:path";
import { realpathSync } from "node:fs";

const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);

export const COURT_TYPE_CODES = ["0901", "0902", "0904"];

export const SEARCH_JS = String.raw`
async ([codes, status]) => {
  const H = {"Content-Type":"application/json;charset=UTF-8"};
  const postJson = async (body) => {
    const response = await fetch("/search_phrase_detayli.ajx", {
      method:"POST", credentials:"include", headers:H, body:JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error("Dosya arama isteği başarısız: HTTP " + response.status);
    try { return JSON.parse(text); }
    catch (_) { throw new Error("Dosya arama yanıtı JSON değil; oturum sona ermiş olabilir."); }
  };
  const cases = [];
  for (const code of codes) {
    const result = await postJson({
      dosyaDurumKod:status, pageSize:500, pageNumber:1,
      birimId:"", birimTuru2:code, birimTuru3:"0"
    });
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    for (const item of rows) cases.push({
      dosyaNo:item.dosyaNo, dosyaId:item.dosyaId,
      birim:item.birimAdi, tur:item.dosyaTur
    });
  }
  return cases;
}
`;

export const OPEN_AND_LIST_JS = String.raw`
async ([dosyaId]) => {
  const H = {"Content-Type":"application/json;charset=UTF-8"};
  const postText = async (path, body) => {
    const response = await fetch(path, {
      method:"POST", credentials:"include", headers:H, body:JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(path + " başarısız: HTTP " + response.status);
    return text;
  };
  const postJson = async (path, body) => {
    const text = await postText(path, body);
    try { return JSON.parse(text); }
    catch (_) { throw new Error(path + " yanıtı JSON değil; oturum sona ermiş olabilir."); }
  };

  await postJson("/dosya_islem_turleri_sorgula_brd.ajx", {dosyaId});
  await postJson("/dosyaAyrintiBilgileri_brd.ajx", {dosyaId});

  const pageText = await postText("/listDosyaEvraklarPageTotal.ajx", {dosyaId, pageNumber:1});
  const pageTotal = parseInt(pageText) || 1;
  const documents = [];
  for (let pageNumber = 1; pageNumber <= pageTotal; pageNumber++) {
    const result = await postJson("/list_dosya_evraklar.ajx", {dosyaId, pageNumber});
    const groups = (result && result.tumEvraklar) || {};
    for (const group of Object.keys(groups)) {
      for (const item of groups[group]) documents.push({
        evrakId:item.evrakId, tur:item.tur,
        tarih:item.onaylandigiTarih, grup:group
      });
    }
  }
  return documents;
}
`;

export const FETCH_ONE_JS = String.raw`
async ([dosyaId, evrakId]) => {
  const isDocument = (bytes) => {
    if (bytes.length < 4) return false;
    if (bytes[0]===0x25 && bytes[1]===0x50 && bytes[2]===0x44 && bytes[3]===0x46) return true;
    if (bytes[0]===0x49 && bytes[1]===0x49 && bytes[2]===0x2A && bytes[3]===0x00) return true;
    if (bytes[0]===0x4D && bytes[1]===0x4D && bytes[2]===0x00 && bytes[3]===0x2A) return true;
    if (bytes[0]===0xFF && bytes[1]===0xD8 && bytes[2]===0xFF) return true;
    if (bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4E && bytes[3]===0x47) return true;
    return false;
  };
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const url = "/view_document_brd.uyap?evrakId=" + encodeURIComponent(evrakId)
    + "&dosyaId=" + encodeURIComponent(dosyaId);
  let bytes = null, contentType = null, error = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {credentials:"include"});
      contentType = response.headers.get("content-type");
      bytes = new Uint8Array(await response.arrayBuffer());
      error = null;
      if (isDocument(bytes)) break;
    } catch (caught) {
      bytes = null;
      error = String(caught);
    }
    if (attempt < 3) await sleep(4000);
  }
  if (bytes && isDocument(bytes)) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
    }
    return {ct:contentType, b64:btoa(binary)};
  }
  let snippet = "";
  if (bytes) {
    try { snippet = new TextDecoder().decode(bytes.subarray(0, 150)).trim(); }
    catch (_) {}
  }
  return {error:error || snippet || "Geçersiz yanıt; oturum veya aktif oturum sınırı kontrol edilmeli."};
}
`;

/** Portal metnini tek ve güvenli bir dosya yolu bileşenine dönüştürür. */
export function sanitizeComponent(name: string | null | undefined): string {
  let value = (name ?? "").replace(/\//g, ".").trim();
  value = value.replace(/[<>:"\\|?*\x00-\x1f]/g, "_");
  value = value.replace(/\s+/g, " ").replace(/[ .]+$/, "").slice(0, 120);
  if (value === "" || value === "." || value === "..") {
    return "x";
  }
  const stem = value.split(".", 1)[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(stem)) {
    value = `_${value}`;
  }
  return value;
}

/** Yalnızca desteklenen gerçek belge imzalarını kabul eder. */
export function isRealDocument(data: Uint8Array): boolean {
  return (
    startsWith(data, [0x25, 0x50, 0x44, 0x46]) ||
    startsWith(data, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(data, [0x4d, 0x4d, 0x00, 0x2a]) ||
    (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ||
    startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
}

/** Uzantıyı güvenilmeyen Content-Type yerine doğrulanmış imzadan üretir. */
export function extensionFor(data: Uint8Array): string {
  if (startsWith(data, [0x25, 0x50, 0x44, 0x46])) return ".pdf";
  if (startsWith(data, [0x49, 0x49, 0x2a, 0x00]) || startsWith(data, [0x4d, 0x4d, 0x00, 0x2a])) return ".tif";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return ".jpg";
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ".png";
  throw new Error("Desteklenmeyen belge biçimi.");
}

function startsWith(data: Uint8Array, signature: number[]): boolean {
  if (data.length < signature.length) return false;
  return signature.every((byte, index) => data[index] === byte);
}

/**
 * Python'daki `Path.resolve(strict=False)` karşılığı: var olan en uzun üst dizini
 * symlink'ler dahil gerçek yoluna çözer, henüz var olmayan kalan bileşenleri
 * olduğu gibi sonuna ekler.
 */
function resolveStrictFalse(input: string): string {
  const target = resolve(input);
  let ancestor = target;
  const missingTail: string[] = [];
  for (;;) {
    try {
      const real = realpathSync.native(ancestor);
      return missingTail.length ? resolve(real, ...missingTail.reverse()) : real;
    } catch {
      const parent = dirname(ancestor);
      if (parent === ancestor) {
        return target;
      }
      missingTail.push(basename(ancestor));
      ancestor = parent;
    }
  }
}

/** Hedefin sabit çıktı kökü dışına ve symlink üzerinden taşmasını engeller. */
export function containedPath(root: string, ...components: string[]): string {
  const resolvedRoot = resolveStrictFalse(root);
  const rawCandidate = resolve(resolvedRoot, ...components.map((part) => sanitizeComponent(part)));
  const resolvedCandidate = resolveStrictFalse(rawCandidate);
  const relativePath = relative(resolvedRoot, resolvedCandidate);
  const isOutside = relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
  if (isOutside) {
    throw new Error("Güvensiz çıktı yolu reddedildi.");
  }
  return resolvedCandidate;
}
