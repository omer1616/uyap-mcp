from pathlib import Path

import pytest

from uyap_mcp.documents import (
    contained_path,
    extension_for,
    is_real_document,
    sanitize_component,
)


def test_sanitize_component_blocks_path_components() -> None:
    assert sanitize_component("2025/90 Bursa:18") == "2025.90 Bursa_18"
    assert sanitize_component("..") == "x"
    assert sanitize_component("") == "x"


@pytest.mark.parametrize(
    ("data", "extension"),
    [
        (b"%PDF-rest", ".pdf"),
        (b"II*\x00rest", ".tif"),
        (b"MM\x00*rest", ".tif"),
        (b"\xff\xd8\xffrest", ".jpg"),
        (b"\x89PNG\r\n\x1a\nrest", ".png"),
    ],
)
def test_document_signatures(data: bytes, extension: str) -> None:
    assert is_real_document(data)
    assert extension_for(data) == extension


def test_html_and_tiff_near_misses_are_not_documents() -> None:
    for data in (b"<html>oturum hatasi</html>", b"II-invalid", b"MM-invalid"):
        assert not is_real_document(data)
        with pytest.raises(ValueError):
            extension_for(data)


def test_sanitize_component_handles_windows_reserved_names() -> None:
    assert sanitize_component("CON") == "_CON"
    assert sanitize_component("aux.txt") == "_aux.txt"
    assert sanitize_component("ad. ") == "ad"
    assert sanitize_component("a\x00b") == "a_b"


def test_contained_path_stays_under_root(tmp_path: Path) -> None:
    target = contained_path(tmp_path, "2025/90", "belge.pdf")
    assert target.is_relative_to(tmp_path.resolve())


def test_contained_path_rejects_symlink_escape(tmp_path: Path) -> None:
    root = tmp_path / "root"
    outside = tmp_path / "outside"
    root.mkdir()
    outside.mkdir()
    (root / "baglanti").symlink_to(outside, target_is_directory=True)

    with pytest.raises(ValueError):
        contained_path(root, "baglanti", "belge.pdf")
