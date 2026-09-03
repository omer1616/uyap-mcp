"""Ortam değişkenlerinden güvenli yerel çalışma ayarları."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    """MCP araçlarının değiştiremeyeceği süreç düzeyi ayarlar."""

    profile_dir: Path
    output_dir: Path
    cdp_url: str
    portal_url: str = "https://avukat.uyap.gov.tr/"

    @classmethod
    def from_env(cls) -> "Settings":
        home = Path.home()
        cdp_url = os.environ.get("UYAP_MCP_CDP_URL", "http://127.0.0.1:9222").rstrip("/")
        parsed = urlparse(cdp_url)
        if (
            parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.port is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("UYAP_MCP_CDP_URL yalnızca port içeren yerel bir HTTP adresi olabilir.")
        return cls(
            profile_dir=Path(
                os.environ.get("UYAP_MCP_PROFILE_DIR", home / ".uyap-mcp" / "chrome-profile")
            ).expanduser(),
            output_dir=Path(
                os.environ.get("UYAP_MCP_OUTPUT_DIR", home / "Downloads" / "UYAP")
            ).expanduser(),
            cdp_url=cdp_url,
        )
