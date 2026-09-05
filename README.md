# UYAP MCP

UYAP Avukat Portalı'nı Claude Desktop, Claude Code, Codex ve Gemini CLI gibi MCP uyumlu
istemcilere **yerel araçlar** olarak açan bağımsız Node.js sunucusu.

> Bu proje UYAP'ın, Adalet Bakanlığı'nın veya başka bir kamu kurumunun resmî ürünü değildir.
> Kullanıcı yalnızca kendi hesabı, kendi yetkileri ve mevzuata uygun kullanımından sorumludur.

## Güvenlik modeli

- Sunucu yalnızca kullanıcının bilgisayarında STDIO süreci olarak çalışır; internete MCP portu açmaz.
- UYAP'a kullanıcının gerçek Chrome'u ve kalıcı yerel profili üzerinden CDP ile bağlanır.
- E-imza PIN'ini istemez, almaz, saklamaz veya loglamaz. Girişi kullanıcı Chrome'da tamamlar.
- Listeleme araçları evrak içeriğini modele göndermez.
- İndirmeler yalnızca sabit yerel çıktı köküne yapılır; model çıktı yolu veremez.
- Portal işlemleri tek sıralı kuyrukta çalışır. UYAP eş zamanlı sorguları reddeder.

Bu tasarım yüzünden sunucu bilinçli olarak **yereldir**: UYAP oturumunu veya e-imza akışını
uzak/hosted bir sunucuya taşımak bu güvenlik modelini bozar (bkz. [SECURITY.md](SECURITY.md),
[PRIVACY.md](PRIVACY.md)).

## Kurulum: Claude Desktop (önerilen, avukat için)

En kolay yol **Claude Desktop Extension** (`.mcpb`) paketidir — Node.js zaten Claude
Desktop'ın içinde geldiği için kullanıcının ayrıca Node, Python veya `uv` kurmasına gerek
yoktur; yalnızca Google Chrome (e-imza girişi için zaten şart) yeterlidir.

1. Bu depoyu klonlayıp bağımlılıkları kurun ve derleyin:

   ```bash
   git clone <depo-adresi>
   cd uyap-mcp
   npm install
   npm run build
   ```

2. `.mcpb` paketleme aracını kurup paketi üretin:

   ```bash
   npm install -g @anthropic-ai/mcpb
   mcpb pack .
   ```

   Bu, dizine bir `uyap-mcp.mcpb` dosyası oluşturur.

3. Oluşan `uyap-mcp.mcpb` dosyasını Claude Desktop'a **sürükleyip bırakın** (veya Claude
   Desktop → Settings → Extensions → Install from file...). Kurulum ekranında "Evrakların
   indirileceği klasör" alanı isteğe bağlı olarak görünür — boş bırakılırsa
   `~/Downloads/UYAP` kullanılır. JSON dosyası düzenlemeye, terminale komut yazmaya gerek yok.

4. Chrome'da e-Devlet ve e-imza ile UYAP Avukat Portalı'na giriş yapın, ardından Claude'a
   "UYAP oturum durumunu kontrol et" deyin.

## MCP araçları

| Araç | Görünen ad | İşlev |
|---|---|---|
| `uyap_session_status` | UYAP Oturum Durumu | CDP, portal sekmesi ve giriş durumunu kontrol eder |
| `uyap_prepare_login` | UYAP Girişini Hazırla | Chrome'u UYAP giriş sayfasıyla açar; PIN'i kullanıcı girer |
| `uyap_list_cases` | Dosyaları Listele | Açık veya kapalı dosyaları evrak indirmeden listeler |
| `uyap_list_documents` | Evrakları Listele | Evrak türü, tarihi ve grubunu listeler; içerik döndürmez |
| `uyap_download_case` | Dosya Evraklarını İndir | Açık kullanıcı isteğiyle evrakları sıralı olarak yerel diske indirir |

`Araç` sütunu MCP protokolünün çağrı için kullandığı teknik kimliktir (İngilizce/snake_case
kalması gerekir, değiştirilirse mevcut istemci bağlantıları kırılır). `Görünen ad` ise
Claude Desktop gibi istemcilerin arayüzünde kullanıcıya gösterdiği Türkçe başlıktır
(`title` alanı).

## Gereksinimler

- **`.mcpb` ile kurulum yapan avukat için**: yalnızca Google Chrome + UYAP Avukat Portalı
  hesabı, e-imza ve akıllı kart. Node.js kurmasına gerek yoktur (Claude Desktop'ın içinde
  gelir).
- **Geliştirme / paketleme için**: Node.js 18+, npm, ve `.mcpb` üretmek isteyen için
  `@anthropic-ai/mcpb` (`npm install -g @anthropic-ai/mcpb`).

`playwright-core` kullanılır (tam `playwright` değil) — kendi Chromium'unu indirmez,
sistemdeki gerçek Chrome'a yalnızca CDP üzerinden bağlanır.

## Yerel geliştirme

```bash
git clone <depo-adresi>
cd uyap-mcp
npm install
npm test
npm run build
npm start
```

`npm start` STDIO sunucusunu başlatır ve bir MCP istemcisinden istek bekler; terminale
normal çıktı yazmaması beklenen davranıştır. Geliştirme sırasında derlemeden çalıştırmak
için `npm run dev` (tsx ile doğrudan TypeScript'ten çalışır).

## Claude Code'a ekleme

```bash
claude mcp add uyap -- node /absolute/path/to/uyap-mcp/dist/index.js
```

## Codex'e ekleme

```bash
codex mcp add uyap -- node /absolute/path/to/uyap-mcp/dist/index.js
```

## Gemini CLI'a ekleme

Gemini CLI `settings.json` dosyasındaki `mcpServers` bölümüne STDIO komutunu ekleyin:

```json
{
  "mcpServers": {
    "uyap": {
      "command": "node",
      "args": ["/absolute/path/to/uyap-mcp/dist/index.js"]
    }
  }
}
```

## Ayarlar

MCP araçları profil veya çıktı yolu kabul etmez. Bunlar yalnızca sunucu başlatılırken ortam
değişkenleriyle belirlenir (`.mcpb` kurulumunda `output_dir` alanı `UYAP_MCP_OUTPUT_DIR`'a
otomatik eşlenir):

| Değişken | Varsayılan |
|---|---|
| `UYAP_MCP_PROFILE_DIR` | `~/.uyap-mcp/chrome-profile` |
| `UYAP_MCP_OUTPUT_DIR` | `~/Downloads/UYAP` |
| `UYAP_MCP_CDP_URL` | `http://127.0.0.1:9222` (yalnızca loopback HTTP adresi) |

Örnek:

```bash
UYAP_MCP_OUTPUT_DIR="$HOME/Documents/UYAP" npm start
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
