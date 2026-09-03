# Güvenlik Politikası

## Desteklenen güvenlik sınırı

UYAP MCP yerel bir STDIO sunucusudur. Uzak HTTP servisi olarak yayımlanması desteklenmez.
Sunucu e-imza PIN'ini hiçbir araç parametresi, ortam değişkeni veya yapılandırma dosyası üzerinden
almaz. PIN yalnızca işletim sistemi ve e-imza akışında kullanıcı tarafından girilmelidir.

## Hassas dosyalar

Aşağıdakileri issue, log, ekran görüntüsü veya örnek veri olarak paylaşmayın:

- Chrome profili, çerezler ve oturum verileri
- Dava numaralarıyla ilişkilendirilebilir kişisel bilgiler
- İndirilen PDF, TIFF, JPEG, PNG veya UDF evrakları
- CDP hedef ayrıntıları veya kimlik doğrulama başlıkları

## Tehdit modeli

- MCP istemcisi araçları çağırabilir ancak keyfî URL, JavaScript, profil veya çıktı yolu veremez.
- Çıktılar yapılandırılmış sabit kökün dışına yazılamaz; yol bileşenleri temizlenir ve çözülmüş yol
  tekrar doğrulanır.
- Belge yanıtları Content-Type yerine PDF/TIFF/JPEG/PNG imza baytlarıyla doğrulanır.
- Evrak metni ve ham belge baytları MCP yanıtı olarak modele verilmez.
- Tüm portal işlemleri tek iş parçacığında sıralanır.

## Güvenlik açığı bildirimi

Gerçek dava verisi veya oturum bilgisi içermeyen en küçük yeniden üretim örneğiyle özel güvenlik
bildirim kanalını kullanın. Kamuya açık issue içine hassas veri koymayın.
