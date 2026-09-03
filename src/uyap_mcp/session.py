"""Tek bir Chrome/CDP bağlantısı üzerinden UYAP işlemleri."""

from __future__ import annotations

import base64
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

from playwright.sync_api import sync_playwright

from . import browser, documents
from .config import Settings


class CaseNotFound(Exception):
    """Dosya numarasıyla eşleşen kayıt bulunamadı."""


class MultipleMatches(Exception):
    """Aynı dosya numarası birden fazla birimde bulundu."""

    def __init__(self, candidates: list[dict]):
        self.candidates = candidates
        super().__init__("Birden fazla eşleşme bulundu; birim belirtin.")


@dataclass(frozen=True)
class DownloadResult:
    folder: str
    total: int
    succeeded: int
    failed: int


class UyapSession:
    """Playwright nesneleriyle aynı iş parçacığında yaşayan portal oturumu."""

    def __init__(self, settings: Settings, on_log: Callable[[str], None]):
        self.settings = settings
        self.on_log = on_log
        self._playwright = None
        self._browser = None
        self._page = None

    def close(self) -> None:
        if self._playwright is not None:
            self._playwright.stop()
        self._playwright = self._browser = self._page = None

    def _connect(self):
        if self._playwright is None:
            self._playwright = sync_playwright().start()
        if self._browser is not None and self._browser.is_connected():
            return self._browser.contexts[0] if self._browser.contexts else None
        self._browser = self._playwright.chromium.connect_over_cdp(self.settings.cdp_url)
        self._page = None
        return self._browser.contexts[0] if self._browser.contexts else None

    def _active_page(self):
        if self._page is not None and not self._page.is_closed():
            return self._page
        context = self._connect()
        page = browser.active_page(context) if context else None
        if page is None:
            raise RuntimeError("UYAP sekmesi bulunamadı. Önce giriş hazırlığını çalıştırın.")
        self._page = page
        return page

    def _logged_in(self) -> bool:
        try:
            self._page = None
            return bool(self._active_page().evaluate(browser.CHECK_LOGIN_JS))
        except Exception:
            return False

    def status(self) -> dict:
        cdp = browser.cdp_alive(self.settings.cdp_url)
        if not cdp:
            return {
                "cdpReachable": False,
                "portalPageOpen": False,
                "authenticated": False,
                "action": "Giriş hazırlığını çalıştırın.",
            }
        try:
            context = self._connect()
            portal_page = browser.active_page(context) if context else None
        except Exception:
            portal_page = None
        authenticated = self._logged_in() if portal_page else False
        return {
            "cdpReachable": True,
            "portalPageOpen": portal_page is not None,
            "authenticated": authenticated,
            "action": None if authenticated else "Chrome'da e-Devlet ve e-imza ile giriş yapın.",
        }

    def prepare_login(self, wait_seconds: int = 0) -> dict:
        wait_seconds = max(0, min(wait_seconds, 120))
        if not browser.ensure_chrome(
            self.settings.profile_dir,
            self.settings.portal_url,
            self.settings.cdp_url,
        ):
            raise RuntimeError("Chrome CDP modunda başlatılamadı. Chrome kurulumunu kontrol edin.")
        context = self._connect()
        if context and browser.active_page(context) is None:
            context.new_page().goto(
                self.settings.portal_url,
                wait_until="domcontentloaded",
                timeout=60_000,
            )
        deadline = time.monotonic() + wait_seconds
        while wait_seconds and time.monotonic() < deadline:
            if self._logged_in():
                break
            time.sleep(3)
        return self.status()

    def _require_login(self) -> None:
        if not self._logged_in():
            raise RuntimeError("UYAP oturumu açık değil. Kullanıcı e-imza girişini tamamlamalı.")

    def list_cases(self, status: int = 0) -> list[dict]:
        if status not in (0, 1):
            raise ValueError("status yalnızca 0 (açık) veya 1 (kapalı) olabilir.")
        self._require_login()
        unique: list[dict] = []
        seen: set[tuple[str, str]] = set()
        for item in self._active_page().evaluate(
            documents.SEARCH_JS,
            [documents.COURT_TYPE_CODES, status],
        ):
            key = (item.get("dosyaNo") or "", item.get("birim") or "")
            if key not in seen:
                seen.add(key)
                unique.append(item)
        return unique

    def find_case(self, case_no: str, unit: str | None = None, status: int = 0) -> dict:
        candidates = [item for item in self.list_cases(status) if item["dosyaNo"] == case_no]
        if unit:
            candidates = [
                item for item in candidates if unit.casefold() in (item.get("birim") or "").casefold()
            ]
        if not candidates:
            raise CaseNotFound(f"'{case_no}' numaralı dosya bulunamadı.")
        if len(candidates) > 1:
            raise MultipleMatches(candidates)
        return candidates[0]

    def list_documents(self, case_no: str, unit: str | None = None, status: int = 0) -> dict:
        target = self.find_case(case_no, unit, status)
        items = self._active_page().evaluate(documents.OPEN_AND_LIST_JS, [target["dosyaId"]])
        return {
            "case": self._public_case(target),
            "total": len(items),
            "documents": [self._public_document(item) for item in items],
        }

    def download_case(self, case_no: str, unit: str | None = None, status: int = 0) -> dict:
        target = self.find_case(case_no, unit, status)
        page = self._active_page()
        items = page.evaluate(documents.OPEN_AND_LIST_JS, [target["dosyaId"]])
        root = self.settings.output_dir.expanduser().resolve()
        root.mkdir(parents=True, exist_ok=True)
        case_dir = documents.contained_path(root, f"{target['dosyaNo']} {target['birim']}")
        case_dir.mkdir(parents=True, exist_ok=True)
        groups = sorted({item.get("grup") or "-" for item in items})
        succeeded = failed = 0
        name_counts: dict[tuple[str, str], int] = {}

        for index, item in enumerate(items, 1):
            label = f"{item.get('tur') or 'evrak'} {item.get('tarih') or ''}".strip()
            response = page.evaluate(
                documents.FETCH_ONE_JS,
                [target["dosyaId"], item["evrakId"]],
            )
            data = base64.b64decode(response.get("b64") or "")
            if response.get("error") or not documents.is_real_document(data):
                self.on_log(f"Belge indirilemedi ({index}/{len(items)}): {label}")
                failed += 1
                continue

            group = documents.sanitize_component(item.get("grup") or "-")
            out_dir = documents.contained_path(case_dir, group) if len(groups) > 1 else case_dir
            out_dir.mkdir(parents=True, exist_ok=True)
            base = documents.sanitize_component(label)
            key = (group, base)
            count = name_counts.get(key, 0) + 1
            name_counts[key] = count
            suffix = f" ({count})" if count > 1 else ""
            filename = f"{index:03d} - {base}{suffix}{documents.extension_for(data)}"
            destination = documents.contained_path(out_dir, filename)
            destination.write_bytes(data)
            succeeded += 1

        result = DownloadResult(
            folder=str(case_dir.relative_to(root)),
            total=len(items),
            succeeded=succeeded,
            failed=failed,
        )
        return asdict(result)

    @staticmethod
    def _public_case(item: dict) -> dict:
        return {
            "caseNo": item.get("dosyaNo"),
            "unit": item.get("birim"),
            "type": item.get("tur"),
        }

    @staticmethod
    def _public_document(item: dict) -> dict:
        return {
            "documentType": item.get("tur"),
            "approvedAt": item.get("tarih"),
            "group": item.get("grup"),
        }
