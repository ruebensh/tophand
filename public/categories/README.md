# Kategoriya rasmlari (PNG) — konvensiya va manifest

Bu papkada har bir **katalog** uchun alohida ichki papka bor. Ichki papkalar
katalog `id`si nomi bilan ataladi, fayllar esa kategoriya `id`si bilan.

## Nom konvensiyasi (majburiy)

```
public/categories/<catalogId>/<categoryId>.png
```

Masalan:
- `public/categories/transport/trn_avto.png`  → "Avtomobillar"
- `public/categories/electronics/el_phone.png` → "Telefonlar"

Katalog sahifasidagi (masalan Avto) top-kategoriyalar gridi aynan shu yo'ldagi
PNG ni ishlatadi. Fayl **bo'lmasa** avtomatik ravishda rangli ikonkaga
(`CategoryChip`, `categories.icon` qiymati) qaytadi — ya'ni hech narsa buzilmaydi,
rasm keyin qo'shilsa bas.

## Talablar
- Format: **PNG**, shaffof fonli (mix-blend-multiply ishlatiladi).
- O'lcham: ~120×120 px (kvadrat) tavsiya; `object-contain` bilan joylashtiriladi.
- Fayl nomi aynan kategoriya `id`si (kichik harf, `_` bilan). Quyidagi manifestdagi
  `id` lardan nusxa oling.

> Eslatma: hozircha faqat **top-level (ota) kategoriyalar** grid ko'rinishida rasm oladi.
> Subkategoriyalar Header mega-menyusida matn bo'lib ko'rsatiladi (rasm talab qilmaydi).

## Manifest — katalog bo'yicha top-level kategoriyalar (id → nom)


### `transport` — 6 ta
- `trn_avto.png` — Avtomobillar
- `trn_moto.png` — Moto va moto-texnika
- `trn_gruz.png` — Yuk mashinalari va maxsus texnika
- `trn_arenda.png` — Maxsus texnika ijarasi
- `trn_suv.png` — Suv transporti
- `trn_zapchasti_ref.png` — Ehtiyot qismlar va aksessuarlar

### `realty` — 5 ta
- `rlt_buy.png` — Uy-joy sotib olish
- `rlt_posut.png` — Kunlik / sayohat ijarasi
- `rlt_arenda.png` — Uzoq muddatga ijara
- `rlt_kommert.png` — Tijorat ko’chmas mulki
- `rlt_other.png` — Boshqa ko’chmas mulk

### `parts` — 11 ta
- `prt_zapchasti.png` — Ehtiyot qismlar
- `prt_wheels.png` — Shinalar, disk va g’ildiraklar
- `prt_av.png` — Audio va video texnika
- `prt_access.png` — Aksessuarlar
- `prt_roof.png` — Bagajnik va farkoplar
- `prt_tools.png` — Asboblar
- `prt_trailer.png` — Tirkama (pritsep)
- `prt_gear.png` — Jihozlar (ekipirovka)
- `prt_oils.png` — Moy va avtokimyo
- `prt_anti.png` — O’g’irlikka qarshi qurilmalar
- `prt_gps.png` — GPS-navigatorlar

### `electronics` — 9 ta
- `el_phone.png` — Telefonlar
- `el_av.png` — Audio va video
- `el_pc.png` — Kompyuter tovarlari
- `el_games.png` — O’yinlar, pristavka va dasturlar
- `el_laptop.png` — Noutbuklar
- `el_desktop.png` — Stol kompyuterlari
- `el_photo.png` — Foto texnika
- `el_tablet.png` — Planshet va elektron kitoblar
- `el_office.png` — Orgtexnika va sarf materiallari

### `home-dacha` — 6 ta
- `hom_remont.png` — Ta’mirlash va qurilish (tovarlar)
- `hom_furniture.png` — Mebel va interyer
- `hom_appliances.png` — Maishiy texnika
- `hom_food.png` — Oziq-ovqat
- `hom_plants.png` — O’simliklar
- `hom_dishes.png` — Idish va oshxona tovarlari

### `personal` — 5 ta
- `per_clothing.png` — Kiyim, poyabzal, aksessuarlar
- `per_kids_cloth.png` — Bolalar kiyim va poyabzali
- `per_kids_goods.png` — Bolalar tovarlari va o’yinchoqlar
- `per_beauty.png` — Go’zallik va salomatlik
- `per_watches.png` — Soat va ziynat buyumlari

### `business` — 4 ta
- `biz_equip.png` — Biznes uchun uskunalar
- `biz_franchise.png` — Franshizalar
- `biz_ready.png` — Tayyor biznes
- `biz_so.png` — Biznes uchun dasturiy ta’minot

### `business360` — 9 ta
- `b360_equip.png` — Uskunalar
- `b360_transport.png` — Transport
- `b360_services.png` — Xizmatlar
- `b360_realty.png` — Ko’chmas mulk
- `b360_materials.png` — Qurilish materiallari va xomashyo
- `b360_bizfr.png` — Tayyor biznes va franshizalar
- `b360_staff.png` — Xodim qidirish
- `b360_goods.png` — Tovarlar
- `b360_office.png` — Ofis uchun hammasi

### `handmade` — 9 ta
- `hnd_textile.png` — To’qimachilik va naqsh
- `hnd_ceramic.png` — Kulolchilik va koshin
- `hnd_wood.png` — Yog’och va naqqoshlik
- `hnd_metal.png` — Metall va zargarlik
- `hnd_leather.png` — Teri va mo’yna
- `hnd_cloth.png` — Kiyim va poyabzal (qo’l tikuv)
- `hnd_decor.png` — Uy dekor va sovg’alar
- `hnd_instrument.png` — Qo’l yasalgan musiqa asboblari
- `hnd_other.png` — Boshqa qo’l mehnati

### `services` — 34 ta
- `svc_avto_servis.png` — Avto servis, ijara
- `svc_perevozki.png` — Yuk tashish va yetkazish
- `svc_passazhir.png` — Yo’lovchi tashish
- `svc_gruzchiki.png` — Gruvchiklar, ombor xizmatlari
- `svc_evakuator.png` — Evakuator xizmati
- `svc_tamirlash.png` — Ta’mirlash va bezash
- `svc_qurilish.png` — Qurilish
- `svc_bog.png` — Bog’, obodonlashtirish
- `svc_gozallik.png` — Go’zallik
- `svc_somatlik.png` — Salomatlik
- `svc_medsitsina.png` — Meditsina
- `svc_texnika_tamir.png` — Texnika ta’miri va xizmati
- `svc_kompyuter.png` — Kompyuter yordami
- `svc_montazh.png` — Uskunalar o’rnatish
- `svc_oborudovanie.png` — Uskunalar, ishlab chiqarish
- `svc_talim.png` — Ta’lim, kurslar
- `svc_biznes.png` — Biznes xizmatlari
- `svc_vositachi.png` — Vositachi xizmatlari
- `svc_poligrafiya.png` — Poligrafiya, tashqi reklama
- `svc_chiqindi.png` — Chiqindi va ikkilamchi xomashyo
- `svc_tozalash.png` — Tozalash
- `svc_dezinf.png` — Dezinfektsiya, dezinektsiya, spec tozalash
- `svc_maishiy.png` — Maishiy xizmatlar
- `svc_bayram.png` — Bayram va tadbirlar
- `svc_tadbir_arenda.png` — Tadbir va dam olish uchun ijara
- `svc_dosug.png` — Doshg va dam olish
- `svc_ovqat.png` — Ovqat va keytering
- `svc_foto.png` — Foto va video
- `svc_enaga.png` — Enaga va qarovchilar
- `svc_hayvon_uhod.png` — Hayvonlarga g’amxo’rlik
- `svc_ijod.png` — Ijod
- `svc_qoriq.png` — Qo’riq va xavfsizlik
- `svc_sport_tamir.png` — Sport anjomlari ta’miri
- `svc_boshqa.png` — Boshqa xizmatlar

### `hobby` — 7 ta
- `hob_tickets.png` — Chiptalar va sayohat
- `hob_bike.png` — Velosipedlar
- `hob_books.png` — Kitob va jurnallar
- `hob_collect.png` — Kolleksiya
- `hob_music.png` — Musiqa asboblari
- `hob_hunt.png` — Ov va baliq ovlash
- `hob_sport.png` — Sport va dam olish

### `animals` — 7 ta
- `ani_dogs.png` — Itlar
- `ani_cats.png` — Mushuklar
- `ani_birds.png` — Qushlar
- `ani_aqua.png` — Akvarium
- `ani_other.png` — Boshqa hayvonlar
- `ani_goods.png` — Hayvonlar uchun tovarlar
- `ani_lost.png` — Yo’qolgan va topilgan hayvonlar

### `jobs` — 26 vakansiya + 52 rezyume (scope bo'yicha ikki daraxt)
- Vakansiyalar (JOB_OPENING): `job_vac_1.png` … `job_vac_26.png`
- Rezyumelar (JOB_SEEKER):    `job_res_1.png` … `job_res_52.png`
- `jobs` gridi ikkala daraxtni ham ko'rsatadi; kerak bo'lsa `scope` bo'yicha ajratiladi.
