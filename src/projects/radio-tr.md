---
# Başlık, özet ve linkler src/_data/projects.yaml'dan gelir.
---
Türkiye radyolarını tek bir yerde, reklamsız ve sade bir arayüzle dinlemek için yaptığım bir PWA. Tasarımda İsviçre tipografisinden yola çıktım: büyük başlıklar, tek yazı ailesi, ızgara.

<figure class="shots wide">
  <img src="/img/projects/radio-tr/desktop.webp" width="1280" height="800" alt="Radio TR ana ekranı: büyük “Radyo. Türkiye” başlığı, arama ve istasyon listesi" loading="lazy">
</figure>

## Neler var

- Seçilmiş istasyon listesi depoda duruyor; dış bir API'ye bağlı değil.
- Arama, kategori ve yayın grubu filtreleri, favoriler, en son dinlenen istasyonu hatırlama.
- Kadran ve ibreli tam ekran oynatıcı. Media Session sayesinde kilit ekranından ve klavyenin medya tuşlarıyla kontrol edilebiliyor. HLS yayınları da destekleniyor.
- Kısayollar: `/` ara, `Boşluk` oynat/duraklat, `←` `→` önceki/sonraki.
- Kurulabilir; uygulama kabuğu çevrimdışı da açılıyor.

<figure class="shots narrow">
  <img src="/img/projects/radio-tr/mobile.webp" width="390" height="844" alt="Radio TR mobil görünüm, koyu tema" loading="lazy">
</figure>

## İstasyon verisi

Liste TRT'nin resmi oynatıcısı, Karnaval kataloğu ve radyolar.net.tr'den derlendi. Her yayın adresi tek tek denendi; yalnızca HTTPS üzerinden çalışanlar listede.
