"""Tüm portal işlemlerini tek Playwright iş parçacığında sıraya koyar."""

from __future__ import annotations

import atexit
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from .config import Settings
from .session import UyapSession

LOGGER = logging.getLogger("uyap_mcp")


class PortalWorker:
    """MCP çağrılarının UYAP tarafında birbiriyle yarışmasını engeller."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or Settings.from_env()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="uyap-portal")
        self._session: UyapSession | None = None
        self._closed = False
        atexit.register(self.close)

    def _get_session(self) -> UyapSession:
        if self._session is None:
            self._session = UyapSession(self.settings, LOGGER.info)
        return self._session

    def call(self, method: str, *args: Any, **kwargs: Any) -> Any:
        def invoke() -> Any:
            target: Callable[..., Any] = getattr(self._get_session(), method)
            return target(*args, **kwargs)

        return self._executor.submit(invoke).result()

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._session is not None:
            try:
                self._executor.submit(self._session.close).result(timeout=5)
            except RuntimeError:
                # Python, atexit işleyicilerinden önce executor havuzunu kapatmış olabilir.
                pass
            except Exception:
                LOGGER.exception("Portal oturumu kapatılırken hata oluştu.")
            self._session = None
        self._executor.shutdown(wait=False, cancel_futures=True)
