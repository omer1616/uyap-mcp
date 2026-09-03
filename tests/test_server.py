import pytest
from mcp import Client

from uyap_mcp.server import mcp


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_mcp_tools_have_stable_schemas_and_annotations() -> None:
    async with Client(mcp) as client:
        tools_result = await client.list_tools()
        tools = {tool.name: tool for tool in tools_result.tools}

        assert set(tools) == {
            "uyap_session_status",
            "uyap_prepare_login",
            "uyap_list_cases",
            "uyap_list_documents",
            "uyap_download_case",
        }
        assert tools["uyap_session_status"].annotations.read_only_hint is True
        assert tools["uyap_download_case"].annotations.read_only_hint is False
        assert tools["uyap_session_status"].output_schema["type"] == "object"
        assert tools["uyap_list_cases"].output_schema["properties"]["cases"]["type"] == "array"

        result = await client.call_tool("uyap_session_status", {})
        assert result.structured_content == {
            "cdpReachable": False,
            "portalPageOpen": False,
            "authenticated": False,
            "action": "Giriş hazırlığını çalıştırın.",
        }
