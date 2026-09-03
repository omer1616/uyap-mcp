from pathlib import Path

import pytest

from uyap_mcp.config import Settings


def test_settings_from_environment(monkeypatch, tmp_path: Path) -> None:
    profile = tmp_path / "profile"
    output = tmp_path / "output"
    monkeypatch.setenv("UYAP_MCP_PROFILE_DIR", str(profile))
    monkeypatch.setenv("UYAP_MCP_OUTPUT_DIR", str(output))
    monkeypatch.setenv("UYAP_MCP_CDP_URL", "http://127.0.0.1:9333/")

    settings = Settings.from_env()

    assert settings.profile_dir == profile
    assert settings.output_dir == output
    assert settings.cdp_url == "http://127.0.0.1:9333"


@pytest.mark.parametrize(
    "url",
    [
        "https://127.0.0.1:9222",
        "http://example.com:9222",
        "http://127.0.0.1",
        "http://user:pass@127.0.0.1:9222",
        "http://127.0.0.1:9222/json",
    ],
)
def test_settings_reject_non_local_or_ambiguous_cdp_urls(monkeypatch, url: str) -> None:
    monkeypatch.setenv("UYAP_MCP_CDP_URL", url)
    with pytest.raises(ValueError):
        Settings.from_env()
