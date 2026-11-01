---
---
Latin harfleriyle kare kûfî (makılî) yazı üreten bir web uygulaması. Metni birim ızgara üzerinde yazıya çeviriyor, satırları aynı genişliğe hizalıyor, SVG ve PNG olarak dışa veriyor. Sunucu yok; her şey tarayıcıda çalışıyor.

## Kurallar ölçülerek kondu

Biçim kurallarını tahminle değil, bir ustanın kare kûfî örneğini hücre ızgarasına çevirip 67 bloğu tek tek inceleyerek çıkardım:

- **Köşeden birleşme yok:** iki dolu kare yalnızca köşeden komşu olamaz.
- **Açıklık tam bir birim:** karşılaşan iki kenar arasında ne sıfır ne iki birim.
- **Harf arası tam bir birim**, ayrıca bir kelime arası yok.
- **Her blok hem üst hem alt çizgiye değer.**
- **Satır arası bir birim**, bütün satırlar aynı genişlikte.
- Harfler bazen kaynaşır: biri ötekinin sütununa girer.

Bant kuralı harfe değil bloğa ait: kısa bir harf, komşusunun iç boşluğuna yuvalanarak kullanılabiliyor, birlikte oluşturdukları blok bandı doldurduğu sürece.

Proje hâlâ geliştiriliyor.
