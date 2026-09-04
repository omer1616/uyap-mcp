"""Claude, Codex ve Gemini için yerel STDIO MCP sunucusu."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from mcp.server import MCPServer
from mcp_types import ToolAnnotations
from pydantic import BaseModel, Field

from .session import MultipleMatches
from .worker import PortalWorker

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


class SessionStatus(BaseModel):
    cdpReachable: bool
    portalPageOpen: bool
    authenticated: bool
    action: str | None


class CaseSummary(BaseModel):
    caseNo: str | None
    unit: str | None
    type: str | None


class CasesResult(BaseModel):
    cases: list[CaseSummary]


class DocumentSummary(BaseModel):
    documentType: str | None
    approvedAt: str | None
    group: str | None


class DocumentsResult(BaseModel):
    case: CaseSummary | None = None
    total: int = 0
    documents: list[DocumentSummary] = Field(default_factory=list)
    error: str | None = None
    candidates: list[CaseSummary] = Field(default_factory=list)


class DownloadOutcome(BaseModel):
    folder: str | None = None
    total: int = 0
    succeeded: int = 0
    failed: int = 0
    error: str | None = None
    candidates: list[CaseSummary] = Field(default_factory=list)


worker = PortalWorker()


@asynccontextmanager
async def app_lifespan(_server: MCPServer) -> AsyncIterator[None]:
    try:
        yield None
    finally:
        worker.close()


mcp = MCPServer(
    "UYAP MCP",
    instructions=(
        "Bu sunucu kullanıcının yerel ve e-imzayla açılmış UYAP Avukat Portalı oturumuna bağlanır. "
        "PIN isteme veya tahmin etme. Listeleme araçları belge içeriğini modele aktarmaz. "
        "İndirme yan etkili bir işlemdir; yalnızca kullanıcı açıkça istediğinde çağır. "
        "Portal eş zamanlı işlemleri reddettiği için çağrılar sunucu tarafından sıraya alınır."
    ),
    lifespan=app_lifespan,
)

READ_ONLY = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)
PREPARES_LOGIN = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)
DOWNLOADS_FILES = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)


def _case_summary(item: dict) -> CaseSummary:
    return CaseSummary(
        caseNo=item.get("dosyaNo") or item.get("caseNo"),
        unit=item.get("birim") or item.get("unit"),
        type=item.get("tur") or item.get("type"),
    )


@mcp.tool(annotations=READ_ONLY)
def uyap_session_status() -> SessionStatus:
    """CDP bağlantısını, portal sekmesini ve UYAP giriş durumunu kişisel veri döndürmeden kontrol eder."""
    return SessionStatus.model_validate(worker.call("status"))


@mcp.tool(annotations=PREPARES_LOGIN)
def uyap_prepare_login(wait_seconds: int = 0) -> SessionStatus:
    """UYAP giriş sayfasını yerel Chrome'da aç; PIN'i yalnızca kullanıcı işletim sistemi ekranına girer.

    wait_seconds 0 ile 120 arasında olmalıdır. Sıfır verilirse sayfayı açıp hemen durum döndürür.
    """
    if not 0 <= wait_seconds <= 120:
        raise ValueError("wait_seconds 0 ile 120 arasında olmalıdır.")
    return SessionStatus.model_validate(worker.call("prepare_login", wait_seconds))


@mcp.tool(annotations=READ_ONLY)
def uyap_list_cases(status: Literal[0, 1] = 0) -> CasesResult:
    """Açık (0) veya kapalı (1) UYAP dosyalarını evrak indirmeden listeler."""
    cases = worker.call("list_cases", status)
    return CasesResult(cases=[_case_summary(item) for item in cases])


@mcp.tool(annotations=READ_ONLY)
def uyap_list_documents(
    case_no: str,
    unit: str | None = None,
    status: Literal[0, 1] = 0,
) -> DocumentsResult:
    """Bir dosyanın evrak türü, tarihi ve grubunu listeler; evrak baytlarını veya metnini döndürmez."""
    try:
        result = worker.call("list_documents", case_no, unit, status)
        return DocumentsResult(
            case=_case_summary(result["case"]),
            total=result["total"],
            documents=[DocumentSummary.model_validate(item) for item in result["documents"]],
        )
    except MultipleMatches as error:
        return DocumentsResult(
            error=str(error),
            candidates=[_case_summary(item) for item in error.candidates],
        )


@mcp.tool(annotations=DOWNLOADS_FILES)
def uyap_download_case(
    case_no: str,
    unit: str | None = None,
    status: Literal[0, 1] = 0,
) -> DownloadOutcome:
    """Kullanıcı açıkça istediğinde dosyanın tüm evraklarını sabit yerel çıktı klasörüne sıralı indir."""
    try:
        return DownloadOutcome.model_validate(worker.call("download_case", case_no, unit, status))
    except MultipleMatches as error:
        return DownloadOutcome(
            error=str(error),
            candidates=[_case_summary(item) for item in error.candidates],
        )


def main() -> None:
    """Sunucuyu yerel STDIO aktarımıyla başlatır."""
    mcp.run()


if __name__ == "__main__":
    main()
