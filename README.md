# UYAP MCP

UYAP Avukat Portalı'nı Claude Code, Claude Desktop, Codex ve Gemini CLI gibi MCP uyumlu
istemcilere **yerel araçlar** olarak açan bağımsız Python sunucusu.

> Bu proje UYAP'ın, Adalet Bakanlığı'nın veya başka bir kamu kurumunun resmî ürünü değildir.
> Kullanıcı yalnızca kendi hesabı, kendi yetkileri ve mevzuata uygun kullanımından sorumludur.

## Güvenlik modeli

- Sunucu yalnızca kullanıcının bilgisayarında STDIO süreci olarak çalışır; internete MCP portu açmaz.
- UYAP'a kullanıcının gerçek Chrome'u ve kalıcı yerel profili üzerinden CDP ile bağlanır.
- E-imza PIN'ini istemez, almaz, saklamaz veya loglamaz. Girişi kullanıcı Chrome'da tamamlar.
- Listeleme araçları evrak içeriğini modele göndermez.
- İndirmeler yalnızca sabit yerel çıktı köküne yapılır; model çıktı yolu veremez.
- Portal işlemleri tek Playwright iş parçacığında sıraya alınır. UYAP eş zamanlı sorguları reddeder.

Ayrıntılar için [SECURITY.md](SECURITY.md) ve [PRIVACY.md](PRIVACY.md) dosyalarına bakın.

## MCP araçları

| Araç | İşlev |
|---|---|
| `uyap_session_status` | CDP, portal sekmesi ve giriş durumunu kontrol eder |
| `uyap_prepare_login` | Chrome'u UYAP giriş sayfasıyla açar; PIN'i kullanıcı girer |
| `uyap_list_cases` | Açık veya kapalı dosyaları evrak indirmeden listeler |
| `uyap_list_documents` | Evrak türü, tarihi ve grubunu listeler; içerik döndürmez |
| `uyap_download_case` | Açık kullanıcı isteğiyle evrakları sıralı olarak yerel diske indirir |

## Gereksinimler

- Python 3.11 veya üzeri
- `uv`
- Google Chrome
- UYAP Avukat Portalı hesabı, e-imza ve akıllı kart

Playwright kendi Chromium'unu indirmez; sistemdeki gerçek Chrome'a CDP üzerinden bağlanır.

## Yerel geliştirme

```bash
git clone <depo-adresi>
cd uyap-mcp
uv sync --extra dev
uv run pytest
uv run uyap-mcp
```

Son komut STDIO sunucusunu başlatır ve bir MCP istemcisinden istek bekler; terminale normal
çıktı yazmaması beklenen davranıştır.

## Claude Desktop'a ekleme

Claude Desktop, sadece bulutta çalışan claude.ai web sürümünden farklı olarak yerel STDIO MCP
sunucularını destekler. Uygulamanın yapılandırma dosyasını açın:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Dosya yoksa oluşturun; varsa `mcpServers` altına `uyap` girdisini ekleyin:

```json
{
  "mcpServers": {
    "uyap": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/absolute/path/to/uyap-mcp",
        "uyap-mcp"
      ]
    }
  }
}
```

`command` ve `args` alanlarını `uv` ikilisinin tam yoluyla belirtmeniz gerekebilir (örn.
`command: "/usr/local/bin/uv"`), çünkü Claude Desktop uygulamayı sizin kabuk (`shell`)
profilinizi yüklemeden başlatır ve `uv` `PATH` üzerinde bulunamayabilir. Terminalde
`which uv` ile tam yolu öğrenebilirsiniz.

Dosyayı kaydettikten sonra Claude Desktop'ı tamamen kapatıp yeniden açın. Araçlar bağlı
göründüğünde (⚙️/🔌 simgesinden veya sohbet giriş alanındaki araç listesinden kontrol
edebilirsiniz) sunucu hazırdır.

## Claude Code'a ekleme

Yerel geliştirme kopyasını doğrudan ekleyin:

```bash
claude mcp add uyap -- uv run --directory /absolute/path/to/uyap-mcp uyap-mcp
```

Yayın adresi belirlendikten sonra kurulum gerektirmeyen Git sürümü şöyle olacaktır:

```bash
claude mcp add uyap -- uvx --from git+https://github.com/ORGANIZATION/uyap-mcp uyap-mcp
```

## Codex'e ekleme

```bash
codex mcp add uyap -- uv run --directory /absolute/path/to/uyap-mcp uyap-mcp
```

Yayın sonrasında aynı sunucu `uvx --from git+https://...` komutuyla doğrudan çalıştırılabilir.

## Gemini CLI'a ekleme

Gemini CLI `settings.json` dosyasındaki `mcpServers` bölümüne STDIO komutunu ekleyin:

```json
{
  "mcpServers": {
    "uyap": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/absolute/path/to/uyap-mcp",
        "uyap-mcp"
      ]
    }
  }
}
```

## Ayarlar

MCP araçları profil veya çıktı yolu kabul etmez. Bunlar yalnızca sunucu başlatılırken ortam
değişkenleriyle belirlenir:

| Değişken | Varsayılan |
|---|---|
| `UYAP_MCP_PROFILE_DIR` | `~/.uyap-mcp/chrome-profile` |
| `UYAP_MCP_OUTPUT_DIR` | `~/Downloads/UYAP` |
| `UYAP_MCP_CDP_URL` | `http://127.0.0.1:9222` (yalnızca loopback HTTP adresi) |

Örnek:

```bash
UYAP_MCP_OUTPUT_DIR="$HOME/Documents/UYAP" uv run uyap-mcp
```

## Kullanım örneği

MCP bağlantısı kurulduktan sonra modele şunu söyleyin:

```text
UYAP oturum durumunu kontrol et. Giriş açıksa açık dosyalarımı listele.
```

İndirme yalnızca açık istekle yapılmalıdır:

```text
2025/90 numaralı dosyanın evraklarını yerel UYAP çıktı klasörüne indir.
```

## Bilinen sınırlar

- Portal uç noktaları resmî ve kararlı bir geliştirici API'si değildir; UYAP değişiklikleri akışı bozabilir.
- Doğrulanmış birim türü kodları şimdilik `0901`, `0902` ve `0904` ile sınırlıdır.
- Dosya araması birim türü başına ilk 500 sonucu ister.
- E-imza oturumu kısa ömürlü olabilir ve işlem ortasında sona erebilir.
- Aynı hesapla birden fazla aktif oturum portalın oturum sınırına takılabilir.
- Aynı anda başka bir UYAP indiricisi çalıştırılmamalıdır; süreçler arası ortak kilit henüz yoktur.

## Lisans

MIT License. Ayrıntılar için [LICENSE](LICENSE).
