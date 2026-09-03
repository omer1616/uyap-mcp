from pathlib import Path

from uyap_mcp import browser


def test_ensure_chrome_uses_configured_local_port(monkeypatch, tmp_path: Path) -> None:
    calls: list[list[str]] = []
    alive_results = iter([False, True])
    executable = tmp_path / "chrome"
    executable.touch()

    monkeypatch.setattr(browser, "cdp_alive", lambda _url: next(alive_results))
    monkeypatch.setattr(browser, "chrome_candidates", lambda: [executable])
    monkeypatch.setattr(browser.subprocess, "Popen", lambda argv, **_kwargs: calls.append(argv))
    monkeypatch.setattr(browser.time, "sleep", lambda _seconds: None)

    assert browser.ensure_chrome(
        tmp_path / "profile",
        "https://avukat.uyap.gov.tr/",
        "http://127.0.0.1:9333",
        wait_seconds=1,
    )
    assert "--remote-debugging-address=127.0.0.1" in calls[0]
    assert "--remote-debugging-port=9333" in calls[0]
