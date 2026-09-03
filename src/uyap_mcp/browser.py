"""Chrome süreci, CDP bağlantısı ve UYAP oturum kontrolü."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

CHECK_LOGIN_JS = """async () => {
  try {
    const response = await fetch('/avukat_sik_kullanilan_dosyalar.ajx', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json;charset=UTF-8'}, body:'{}'
    });
    if (!response.ok) return false;
    const text = await response.text();
    try { JSON.parse(text); return true; } catch (_) { return false; }
  } catch (_) { return false; }
}"""


def cdp_alive(cdp_url: str) -> bool:
    try:
        with urllib.request.urlopen(f"{cdp_url}/json/version", timeout=2):
            return True
    except Exception:
        return False


def chrome_candidates() -> list[Path]:
    candidates: list[Path] = []
    if sys.platform == "darwin":
        candidates.append(Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"))
    elif os.name == "nt":
        candidates.extend(
            Path(path)
            for path in (
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
            )
        )
    else:
        for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
            found = shutil.which(name)
            if found:
                candidates.append(Path(found))
    return candidates


def ensure_chrome(profile_dir: Path, portal_url: str, cdp_url: str, wait_seconds: int = 30) -> bool:
    """Gerekirse Chrome'u sabit profil ve yerel CDP portuyla açar."""
    if cdp_alive(cdp_url):
        return True
    executable = next((path for path in chrome_candidates() if path.exists()), None)
    if executable is None:
        return False
    profile_dir.mkdir(parents=True, exist_ok=True)
    cdp_port = urlparse(cdp_url).port
    if cdp_port is None:
        raise ValueError("CDP adresinde port bulunmalıdır.")
    subprocess.Popen(
        [
            str(executable),
            "--remote-debugging-address=127.0.0.1",
            f"--remote-debugging-port={cdp_port}",
            f"--user-data-dir={profile_dir}",
            portal_url,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    for _ in range(wait_seconds):
        time.sleep(1)
        if cdp_alive(cdp_url):
            return True
    return False


def active_page(context):
    """Beklenen UYAP portalındaki ilk açık sekmeyi döndürür."""
    for page in context.pages:
        if not page.is_closed() and (page.url or "").startswith("https://avukat.uyap.gov.tr/"):
            return page
    return None
