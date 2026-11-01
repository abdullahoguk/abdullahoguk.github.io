---
---
Türkiye haritası üzerinden **il** ya da **ilçe** seçtiren bir Web Component. Form içinde sıradan bir `<input>` gibi davranıyor: `name`, `required`, gönderme ve sıfırlama doğrudan çalışıyor.

<figure class="shots wide">
  <img src="/img/projects/tr-geo-picker/og.webp" width="1200" height="630" alt="tr-geo-picker: Türkiye haritası üzerinde il seçimi" loading="lazy">
</figure>

## Özellikler

- Bağımlılığı yok: tek bir ES modülü, veri hariç 10 KB (gzip).
- Türkiye › 7 bölge › il › ilçe sırasıyla iniyor; istenirse il seçiminde duruyor.
- Türkçeye duyarlı arama: `kadık` yazınca Kadıköy, `IGDIR` yazınca Iğdır bulunuyor.
- Klavye ve ekran okuyucuyla tam kullanım, liste alternatifi, il görünümünde yakınlaştırma.
- CSS değişkenleri ve `::part()` ile tema; açık ve koyu tema hazır.
- Değer olarak kod, isim ya da kendi veritabanı kimliklerin.
- Güncel veri: 81 il, 973 ilçe (İçişleri Bakanlığı listesi).

Proje hâlâ geliştiriliyor.
