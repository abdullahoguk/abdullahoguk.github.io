---
# Başlık, özet ve linkler src/_data/projects.yaml'dan gelir.
---
Alaturka saat, günü gün batımından başlatan eski zaman ölçüsüdür: akşam ezanı okunduğunda saat 12:00'dir ve yeni gün başlar. Alaturka Vakitler bu saati bulunduğunuz şehrin akşam vaktine göre hesaplar; yanına namaz vakitlerini, hicri takvimi ve paylaşılabilir görseller hazırlanan bir editörü koyar. Ana ekrana eklenebilir, çevrimdışı da çalışır.

<figure class="shots">
  <img src="/img/projects/alaturka-vakitler/01-ana-sayfa.webp" width="480" height="1040" alt="Ana sayfa: LED panelde alaturka saat ve günün vakitleri" loading="lazy">
  <img src="/img/projects/alaturka-vakitler/02-vakitler.webp" width="480" height="1040" alt="Vakitler: zaman şeridi ve kerahat vakitleri" loading="lazy">
  <img src="/img/projects/alaturka-vakitler/04-saat.webp" width="480" height="1040" alt="Analog alaturka kadran" loading="lazy">
</figure>

## Bölümler

**Ana sayfa.** Alaturka saat nokta matrisli bir LED panelde. Altında içinde bulunulan vakit, bir sonrakine kalan süre ve günün altı vakti; en altta hicri tarih ve o gecenin ay fazı. Ekranın rengi vakte göre değişir: imsakta mavi, öğlede sarı, ikindide turuncu, yatsıda lacivert.

**Vakitler.** Günün altı vakti, aralarındaki süreleri gösteren bir zaman şeridiyle. Kerahat vakitleri ayrıca işaretlenir.

**Takvim.** Hicri ayın tamamı, her günün altında miladi karşılığıyla. Aylar arasında kaydırarak geçilir.

**Saat.** Akrebi içinde bulunulan vaktin renginde olan analog bir kadran; altında alaturka ve normal saat, iki takvimin tarihi.

**Görsel oluştur.** Saati, vakitleri ve hicri tarihi story, dikey post ya da kare bir görsele dönüştüren editör. Parçalar parmakla taşınıp döndürülür; 70 yazı ailesi (nesih, rika, kufi, talik dahil), fotoğraf arka planı, Swiss ızgara ve film dokusu.

<figure class="shots">
  <img src="/img/projects/alaturka-vakitler/03-takvim.webp" width="480" height="1040" alt="Hicri takvim" loading="lazy">
  <img src="/img/projects/alaturka-vakitler/05-gorsel-olustur.webp" width="480" height="1040" alt="Görsel oluşturma editörü" loading="lazy">
  <img src="/img/projects/alaturka-vakitler/22-stil-pastel.webp" width="480" height="1040" alt="Pastel renk stili" loading="lazy">
</figure>

## Teknik

Vue 3 (Composition API), Vite, Vue Router, Pinia, Luxon ve hijri-date. Stil tarafında framework yok; CSS custom property'leriyle kurulmuş bir tema sistemi var (`data-theme` × `data-palette` × `data-vakit`). Namaz vakitleri Diyanet verisinden üretilen statik JSON'lardan okunur ve cihazda saklanır; paylaşım görselleri tarayıcıda üretilir, sunucu tarafı yoktur.
