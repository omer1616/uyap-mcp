"""Portal sözleşmeleri ve I/O içermeyen belge yardımcıları."""

from __future__ import annotations

import re
from pathlib import Path

WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}

COURT_TYPE_CODES = ["0901", "0902", "0904"]

SEARCH_JS = r"""
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
"""

OPEN_AND_LIST_JS = r"""
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
"""

FETCH_ONE_JS = r"""
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
"""


def sanitize_component(name: str | None) -> str:
    """Portal metnini tek ve güvenli bir dosya yolu bileşenine dönüştürür."""
    value = (name or "").replace("/", ".").strip()
    value = re.sub(r'[<>:"\\|?*\x00-\x1f]', "_", value)
    value = re.sub(r"\s+", " ", value).rstrip(" .")[:120]
    if value in {"", ".", ".."}:
        return "x"
    if value.split(".", 1)[0].upper() in WINDOWS_RESERVED_NAMES:
        value = f"_{value}"
    return value


def is_real_document(data: bytes) -> bool:
    """Yalnızca desteklenen gerçek belge imzalarını kabul eder."""
    return (
        data[:4] == b"%PDF"
        or data[:4] in (b"II*\x00", b"MM\x00*")
        or data[:3] == b"\xff\xd8\xff"
        or data[:8] == b"\x89PNG\r\n\x1a\n"
    )


def extension_for(data: bytes) -> str:
    """Uzantıyı güvenilmeyen Content-Type yerine doğrulanmış imzadan üretir."""
    if data[:4] == b"%PDF":
        return ".pdf"
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return ".tif"
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    raise ValueError("Desteklenmeyen belge biçimi.")


def contained_path(root: Path, *components: str) -> Path:
    """Hedefin sabit çıktı kökü dışına ve symlink üzerinden taşmasını engeller."""
    resolved_root = root.expanduser().resolve()
    candidate = resolved_root.joinpath(*(sanitize_component(part) for part in components))
    resolved_candidate = candidate.resolve(strict=False)
    if not resolved_candidate.is_relative_to(resolved_root):
        raise ValueError("Güvensiz çıktı yolu reddedildi.")
    return resolved_candidate
