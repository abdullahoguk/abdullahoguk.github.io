# abdullahoguk.com.tr

Kişisel site: statik, [Eleventy 3](https://www.11ty.dev) ile üretiliyor, Cloudflare Pages'te yayında.
Framework yok, Tailwind yok: tek CSS dosyası ve arka plandaki ASCII bozkır sahnesi için tek bir canvas script'i.

```bash
npm install
npm run dev      # http://localhost:8080, canlı yenileme
npm run panel    # yerel panel http://127.0.0.1:4321 (+ dev sunucusu)
npm run build    # çıktı: _site/
npm run new:post -- "Yazı başlığı"
npm run goodreads -- ~/Downloads/goodreads_library_export.csv
npm run raindrop -- ~/Downloads/<raindrop-export>.csv
```

## İçerik nerede?

Her şey düz dosya. Dış linkler build sırasında otomatik olarak yeni sekmede açılacak şekilde işaretlenir. İstersen `npm run panel` ile tarayıcıdan düzenlersin; panel yalnızca bu
dosyaları günceller, siteye dahil değildir ve yalnızca `127.0.0.1`'de çalışır.

| Dosya | Ne işe yarar |
|---|---|
| `src/_data/site.yaml` | İsim, tanıtım, **şimdi · now**, menü, **arka plan sahnesi**, ana sayfa bölümleri. JSON-LD `Person` ve `llms.txt` buradan. |
| `src/_data/projects.yaml` | `/projects`. `status`: active / wip (geliştiriliyor) / archived (eski işler). `featured: true` → ana sayfa. |
| `src/projects/<id>.md` | Varsa `/projects/<id>/` detay sayfası olur (ör. `alaturka-vakitler.md`). |
| `src/_data/uses.yaml` | `/uses`: kategoriler, ürün başına tek foto, sayfa başında opsiyonel kapak fotoğrafı |
| `src/_data/goodreads-books.json` | Goodreads CSV'den üretilir, elle düzenleme |
| `src/_data/books-hidden.yaml` | `/read`'de gösterilmeyecek Goodreads kitapları (Book Id; `note: bitince ekle`) |
| `src/_data/books.yaml` | Goodreads'te olmayan kitaplar |
| `src/_data/watched.yaml` | `/watched`: diziler ve filmler türe göre gruplu; `fav: true` olanlar kalın, IMDb kimliği ve puanı |
| `src/_data/bookmarks.yaml` | `/bookmarks`: etiketli linkler (`/bookmarks/#design` gibi filtrelenebilir). Raindrop CSV'sinden `npm run raindrop` ile beslenir: yalnızca yeni linkler eklenir, mevcutlardaki düzenlemeler korunur. Buy/Dini/Unsorted klasörleri ve bazı siteler (`lib/raindrop.js`) atlanır. |
| `src/_data/bookmarks-hidden.yaml` | İçe aktarımda bir daha eklenmeyecek linkler |
| `src/_data/resume.yaml` | `/resume` + ana sayfadaki deneyim bölümü |
| `src/_data/listens.yaml` | `/listens` + ana sayfa: playlistler, Tekke Musikisi, profiller |
| `src/blog/posts/*.md` | Blog yazıları. `draft: true` olanlar yalnızca `npm run dev` sırasında görünür. |
| `src/public/` | Olduğu gibi kopyalanır (görseller, `_headers`, `_redirects`, favicon). |

**İki dilli metin:** bir alan `{ tr: "…", en: "…" }` olursa Türkçe üstte, İngilizce altında daha
küçük ve soluk çıkar. Düz metin yazarsan tek satır.

### Goodreads

Goodreads → My Books → Import and export → **Export Library** ile CSV'yi indir, sonra
`npm run goodreads -- dosya.csv` (ya da panelde “goodreads → CSV yükle”). Okunan ve okunmakta
olan kitaplar alınır, “to-read” atlanır. Gizlediğin kitaplar `books-hidden.yaml`'da kalır;
yeni CSV geldiğinde de gizli kalırlar.

## SEO / yapay zekâ araçları

- Her sayfada tek bir schema.org `@graph`: `WebSite`, `Person` (sameAs = tüm profiller), sayfa tipi
  (`ProfilePage`, `CollectionPage` + `ItemList`, `BlogPosting`) ve `BreadcrumbList`. Kod: `lib/schema.js`.
- `sitemap.xml`, `robots.txt` (tüm botlara açık), Atom `feed.xml`, `llms.txt`, `rel="me"` linkleri, OG/Twitter kartları.
- Kontrol: <https://search.google.com/test/rich-results> ve <https://validator.schema.org>.

## Arka plan sahneleri

Yalnızca ana sayfada var, iç sayfaların arka planı düz. Kod: `src/public/js/scene.js`.
Hangi sahnenin gösterileceğini `site.yaml` içindeki `scene:` belirler:

| değer | sahne |
|---|---|
| `auto` | mevsime göre: Ara–Şub kış, Mar–May bahar, Haz–Ağu yaz, Eyl–Kas güz |
| `steppe` | bozkır: yakın plan, rüzgârla dalgalanan altın başaklar, alçak güneş, tepede oturan biri (atkısı uçuşur), tek ağaç |
| `spring` | bahar: çiçekli otlar, pembe çiçek açmış ağaç, uçuşan yapraklar, kelebekler |
| `summer` | yaz: yüksek güneş, uzun yeşil otlar, gölgeli büyük ağaç, uçuşan tohumlar, kelebekler |
| `autumn` | güz: kapalı hava, yağmur ve sıçramalar, dökülen yapraklar, çıplak ağaç, şemsiyeli biri |
| `winter` | kış: karlı tepeler, üç katman kar, karlı çamlar, bereli biri (nefesi buhar olur) |
| `sunset` | istanbul sahili: gün batımı gökyüzü, şerefeli minareler ve kubbeler, kule, dumanı tüten vapur, güneş yansıması, martılar, rıhtımda biri, buharı tüten çay, kedi |

- Önizleme: `http://localhost:8080/?scene=winter`
- `scenePicker: true` olursa ana sayfanın köşesinde küçük bir "scene" düğmesi çıkar. Ziyaretçi tıklayarak sahneleri gezebilir, seçimi tarayıcısında saklanır. Kapatmak için `false` yap.
- Renkler hem dark hem light temaya göre ayarlı. Fare, rüzgâr gibi parçacıkları iter.
- Bütün sahneler ince bir piksel çizicisiyle çiziliyor (gölgelendirme, ışık, rüzgârda dalgalanan otlar, hava olayları); 60 fps. Mevsimler bozkırla aynı yakın plan çayır üzerine kurulu.
- Masaüstünde sayfa aşağı kaydırıldıkça sahne soluklaşır; metnin altında okunurluk düşmez.
- `prefers-reduced-motion` açıksa tek kare çizilir. Sekme arka plandayken animasyon durur.

## Cloudflare Pages

- Framework preset: **Eleventy** (veya None)
- Build command: `npm run build`
- Output directory: `_site`
- Environment: `NODE_VERSION=22`
- Custom domain: `abdullahoguk.com.tr` (`abdullahog.uk` → buraya yönlendirme)
