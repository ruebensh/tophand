# WEB_REVERSE_ENGINEERING — Avito: e'lon joylashtirish qismi

> ⚠️ **Ogohlantirish (bir marta).** Bu hujjat faqat **o'quv/ta'lim** maqsadida — saytning
> texnik arxitekturasini tushunish uchun tayyorlangan. Mualliflik huquqi, shaxsiy
> ma'lumotlar va maxfiylik hurmat qilingan. Autentifikatsiya aylanib o'tilmagan, hisob
> yaratilmagan/hisobga kirilmagan, hech qanday forma yuborilmagan (submit), DDoS / SQL
> injection / brute-force va shunga o'xshash harakatlar **bajarilmagan**. Serverga
> ortiqcha yuk bermaslik uchun so'rovlar soni ataylab minimal tutilgan. Hech qanday
> maxfiy token/parol/karta ma'lumoti o'qilmagan va saqlanmagan.

---

## 0. Kirish ma'lumotlari

| Maydon | Qiymat |
|---|---|
| **SAYT_NOMI** | Avito |
| **SAYT_MANZILI** | https://www.avito.ru/ |
| **O'RGANILADIGAN QISM** | E'lon joylashtirish (place-ad / `additem`) — mantiq va funksional |
| **HISOB KERAKMI** | Ha — **lekin hisob YO'Q** (shuning uchun login-orqadagi qismlar cheklangan) |
| **Sana** | 2026-10-20 |

**Dalil manbalari (belgilar):** `Kuzatildi` (jonli brauzer + DevTools-introspeksiya),
`robots.txt` (WebFetch orqali ochiq fayl), `Taxmin` (yuqoridagilardan mantiqiy xulosa),
`Aniqlanmadi` (login-orqasi / tekshirilmadi).

---

## 1. Muhit va vositalar

Muhit tekshirildi (Node, curl, DNS — jonli). `mitmproxy` **o'rnatilmagan**, shuning
uchun tarmoq trafigi alohida proxy orqali emas, **brauzer ichida** (DevTools/Network
kuzatuvi muqobili sifatida runtime introspeksiya) kuzatildi.

| Vosita | Holat | Vazifa |
|---|---|---|
| Browser subagent (jonli navigatsiya + DOM/JS introspeksiya) | ✅ faol | Sahifani ochish, freymvork belgilari, DOM tuzilishi, kuzatilgan XHR |
| WebFetch | ✅ faol | robots.txt (ochiq) — URL/param modelini o'rish |
| WebSearch | ✅ faol | Umumiy texnologik kontekst (juda umumiy natija berdi) |
| Node.js v22 / curl 8.18 | ✅ mavjud | (tarmoq kontenti uchun ishlatilmadi — minimal yuk + etika) |
| DNS (`dig`) | ✅ ishlaydi | `www.avito.ru` → `176.114.122.24`, `176.114.124.24`, `176.114.120.24` |
| **REA (Reverse Engineer Anything)** | ⚠️ nomli vosita sifatida mavjud emas | Vazifa `Browser` + runtime introspeksiya + WebFetch bilan bajarildi (funksional muqobil) |
| mitmproxy / Postman | ❌ yo'q | HTTPS trafikni tashqaridan ushlash bajarilmadi |

**Cheklov:** Hisob bo'lmagani va etika qoidalari tufayli **haqiqiy POST/submit API
so'rovlarini ushlash mumkin emas edi**. Quyidagi "ma'lumot modeli" bo'limi **ochiq
robots.txt** + **kuzatilgan SPA qobig'iga** asoslangan qayta qurish (rekonstruksiya)
bo'lib, tegishli joylarda `Taxmin` deb belgilangan.

---

## 2. Kirish nuqtasi va redirect zanjiri

`Kuzatildi`:

| Qadam | Manzil | Natija |
|---|---|---|
| 1 | `https://www.avito.ru/create` | Server **404** (`Ошибка 404`). SPA emas — sof statik 404 sahifa. Ya'ni `/create` noto'g'ri/eski yo'l. |
| 2 | Header CTA «Разместить объявление» → `href="/additem"` | Haqiqiy kiritish nuqtasi: **`/additem`** |
| 3 | `https://www.avito.ru/additem` | Server **302 → `https://www.avito.ru/#login?next=%2Fadditem`** |
| 4 | `#login?next=%2Fadditem` | **LOGIN DEVORI** — shu yerda to'xtaldi (hisob yo'q). |

`robots.txt` dalili: `/additem` va `/add*` barcha botlar uchun **Disallow** qilingan
(qator 227, 341, 370). Bu ikkinchi mustaqil tasdiq — e'lon yaratish maydoni yopiq,
indekslanmaydigan zonada.

**Xulosa:** E'lon joylashtirish birinchi qadamdayoq **majburiy autentifikatsiya**
talab qiladi. Hisobsiz vizarining o'ziga kirib bo'lmaydi.

---

## 3. Frontend qismi (freymvork va arxitektura)

`Kuzatildi` (runtime introspeksiya + `<script>` tahlili):

**Freymvork: React SPA — Next.js EMAS.**

| Belgi | Qiymat | Xulosa |
|---|---|---|
| `__NEXT_DATA__`, `window.next` | topilmadi | Next.js **ishlatilmaydi** |
| `__reactFiber$…`, `__reactProps$…` DOM tugunlarida | bor | **React (Fiber, 16.8+)** |
| `window.__reactRouterVersion` | `"6"` | **React Router v6** |
| `window.__staticRouterHydrationData` (`loaderData`, `actionData`, `errors`) | bor | **React Router 6.4+ data-router** — loader'lar server tomonidan hibridlangan (SSR/hybrid) |
| `redux…`, `react-redux…` bundle'lari | bor | **Redux** holat ombori |
| `webpackChunkabc_…` (25 chunk) | bor | Webpack split-chunks |
| `remoteEntry.js` (auth-popup, user-navigation-tools, remote-verification, realty-early-access-mfe, buyer-pages-mfe) | bor | **Module Federation — mikro-frontend (MFE) arxitekturasi** |
| Root konteyner | `id="app"` (`#root` yo'q) | Ilova mount nuqtasi |
| CSS | Emotion (`css-*`) + CSS-Modules hash (`login-_91e937…`, `root-_6fa8f2…`) | Hibrid uslublash |
| `sentry.*`, `window.__SENTRY__` | bor | Xatolar kuzatuvi (Sentry) |

**Bundellar manzili (statik CDN):** `www.avito.st/dstatic/build/client/ru-RU/react.fc6bc3fe…js`,
`react-dom…`, `react-router-dom…`, `redux…`, `main.7d0b3c93…js`. Domen: asosiy
`avito.ru`, statik/resurs `avito.st` (`internalResourcesDomains:["avito.ru","avito.st"]`).

**Global konfiguratsiya obyekti** `Kuzatildi`: `window.avito = { pageId, routeId:"main-or-catalog",
platform:"desktop", env:"prod", statsHost:"stats.avito.ru", deeplinkScheme:"ru.avito",
clickstream:{srcId}, componentAuth, banners, rmp, abCentral }` va
`__PERFORMANCE_RUNTIME_INITIAL_CONTEXT__ = { hostVersion:"v3548", buildId:"75548731" }`.
Bu — qurilma/versiya kuzatuvi va A/B (`abCentral`) markazlashgan konfiguratsiyasi.

**UI routing uslubi:** hash-router (`#login?...`) — modal/popup SPA ichida, pathname
o'zgarmaydi. `Kuzatildi`.

**Muhim bot-himoya qatlami** `Kuzatildi`: `fingerprint.*.js`, `background-check.*.js`,
`/api/fl-gpib…` beaconlari, `__RATE_LIMITER_HANDLED_CODES__` va server tomondagi
`loaderData.buyerLocationProps.isBot` bayrog'i. **Lekin ochiq captcha (hCaptcha/gRecaptcha)
elementlari login devorida ko'rinmadi (0 ta).** (H-captcha **e'lon joylashtirish** oqimida
ishlatiladi — quyida robots dalili.)

`Taxmin`: vizarining o'zi ham alohida **MFE (`remoteEntry`)** bo'lishi ehtimoli kuchli
(sayt barcha yirik funksiyalarni MFE'ga ajratgan; `realty-early-access-mfe` bundan
misol). Aniq ismi — `Aniqlanmadi` (login ortida).

---

## 4. DOM tuzilishi

Ko'rinadigan qism = **login devori** (vizaraning o'zi yopiq). `Kuzatildi`.

Zanjir: `#app > div > .theme-… > .css-2x0ii1 > [role="dialog"].css-84u6wa > [data-marker="auth-app-root"]`.

**Ishlatilgan belgilash konventsiyasi (Avito UI kit):** interaktiv elementlar
`data-marker="<blok>/<element>"` formatida indekslanadi — bu Avito'dagi barcha
komponentlarning test/analytics uchun yagona identifikatsiya usuli.

Login formasining maydonlari (forma `action`/`method` **siz** → submit JS/fetch orqali):

| Element | `data-marker` | Atributlar |
|---|---|---|
| form | `login-form` | `action`/`method`/`name` yo'q (JS boshqaradi) |
| login input | `login-form/login/input` | `type=text name="login"` placeholder «Телефон или почта», `autocomplete=username` |
| parol | `login-form/password/input` | `type=password name="password"`, `autocomplete=current-password` |
| eslab qolish | `login-form/remember/toggle` | `type=checkbox name="remember"`, `role=checkbox` |
| tiklash | `login-form/restore` | «Забыли пароль?» (href yo'q, JS handler) |
| submit | `login-form/submit` | `type=submit` «Войти» |
| ijtimoiy kirish | `social-auth` | 3 tugma: `vk-id`, `esia-id` (Gosuslugi), `ok` — Telegram/QR **yo'q** |
| ro'yxatdan o'tish | `registration-link` | «Зарегистрироваться» |

Header/search markerlari (sayt qobig'i): `layout/header-wrapper`, `header/navbar`,
`header/login-button`, `search-form/suggest/input`, `search-form/change-location`,
`visual-rubricator/block-Авто|Недвижимость|Услуги`, `top-rubricator/all-categories`.
`Kuzatildi`.

> **E'lon formasining o'zi** (kategoriya tanlash, sarlavha, tavsif, narx, foto, telefon)
> **Aniqlanmadi** — login-orqada, ko'rsatilgani yo'q. Quyidagi 5-bo'lim bunga doir
> qismlarni **faqat** robots.txt dalili + qobiq tahlilidan `Taxmin` bilan qayta quradi.

---

## 5. API va tarmoq trafigi

`Kuzatildi` (sahifaning o'zi qilgan so'rovlar jurnali; hech qanday qo'shimcha so'rov
yuborilmadi). **Asosiy API oilasi patterni:** `GET/POST https://www.avito.ru/web/<v>/<…>`
va `/js/<v>/<…>` — ya'ni versiyalangan XHR API (`/web/1`, `/web/2`, `/js/1`).

| Endpoint (namuna) | Metod | Vazifa | Dalil |
|---|---|---|---|
| `/web/2/topBanner?urlPath=/` | GET | Sahifa bannerlari | Kuzatildi |
| `/web/1/network/check` | GET | Onlayn/tarmoq tekshiruvi | Kuzatildi |
| `/js/1/sideBlock?locationId=…` | GET | Yon blok kontenti | Kuzatildi |
| `/web/1/adv/network/creative` | POST | Reklama kreativlari (bir necha) | Kuzatildi |
| `/web/2/social/available` | GET | Mavjud ijtimoiy-loginlar ro'yxati | Kuzatildi |
| `/api/fl-gpib/idw-avito`, `/api/fl-gpib?u=<uuid>&…` | GET/POST | Anti-bot / risk beacon | Kuzatildi |
| `/clickstream/events/1/json`, `cs.avito.ru/clickstream/events/1/json` | POST | Hodisa (analytics) oqimi | Kuzatildi |

**Yopiq/maskoralgan sirt** `robots.txt` + `Kuzatildi`: `/api/`, `/web/`, `/js/`,
`/rpc/`, `/clickstream/` — hammasi Disallow. Demak haqiqiy biznes API'si (xususan
`/rpc/` — ehtimol internal JSON-RPC/microservice shlyuzi) maxfiy va botlarga yopiq.
HTML ichida `/-/-/xhr/…` yoki `.json` endpointlari **uchramadi** (matches=0).

**Statik/CDN:** `www.avito.st` (bundle'lar va MFE `remoteEntry`), `stats.avito.ru`.
**Uchinchi tomon:** Yandex Metrika (`mc.yandex.ru`, `tag_phono.js`), Mail.ru
(`top-fwz1.mail.ru`, `privacy-cs.mail.ru`), MTS (`api.a.mts.ru/metric-api`, `cm.a.mts.ru`),
Hybrid.ai (`dss/emd/fpf.hybrid.ai`), AdRiver (`ad.adriver.ru`), Buzzoola
(`exchange.buzzoola.com/ssp/avito`), UXfeedback (`widget-api.uxfeedback.ru/v6/…`),
Google Tag Manager / DoubleClick, **Avito ID** (`ru.id.facct.ru/id.html` iframe —
yagona identifikatsiya/SSO xizmati). `Kuzatildi`.

> **E'lon yuborish (`POST`) endpointi va foto yuklash (multipart) endpointlari —
> Aniqlanmadi** (login-orqada, ushlanmadi). Quyidagi 6-bo'lim ularning mavjudligini
> **faqat** robots parametrlari orqali tasdiqlaydi.

---

## 6. Ma'lumot modeli (qayta qurilgan)

Bu bo'lim **asosan `robots.txt`ning `Clean-param` qatorlari** (ochiq, saytning o'zi
yozgan) va `/items/*`, `/*/next$` kabi yo'llariga asoslanadi. `Clean-param` — botlarga
"bu parametr URL'ni takrorlamasin" deb ko'rsatiladigan ro'yxat bo'lib, amalda sayt
**ichida ishlatiladigan parametr nomlarining ochiq ombori** hisoblanadi.

**6.1. Kategoriya tanlash modeli** `robots.txt` (dalil) + `Kuzatildi` (rubricator):
- Parametrlar: `category_id`, `categoryId`, `categoryParentID`, `pcat`, `cat`.
- Sayt qobig'ida `visual-rubricator` va `top-rubricator/all-categories` — iyerarxik
  katalog daraxti. `Taxmin`: e'lon bir **barg (leaf) kategoriya**ga bog'lanadi,
  kategoriya tanlanganidan keyingina qolgan maydonlar dinamik yuklanadi.

**6.2. Dinamik atributlar (kategoriya bo'yicha o'zgaruvchi maydonlar)** `robots.txt` (dalil):
- `serviceType`, `presentationType`, `regnumber` (masalan avto uchun ro'yxat raqami),
  `propertyCost` (ko'chmas mulk narxi) — tur-ga xos atributlar.
- `avito-ui-radio-group-<id>` (yuzlab nomlar!) va `params<id>`, `params578-from-int`
  — **har kategoriya uchun generatsiya qilingan forma kontrollerlari (radio guruhlar,
  sonli parametrlar)**. `Taxmin`: atribut sxemasi kategoriya ID'si bo'yicha serverdan
  keladi va forma dinamik quriladi. (Bu TopHand'dagi `category_attributes` tizimiga
  strukturaviy jihatdan **juda o'xshash** — quyida 8-bo'lim.)

**6.3. Narx** `robots.txt`: `price`, `pmin`, `pmax`, `propertyCost`, `oldPrice`.
`Taxmin`: narx maydoni + (ayrim turlarda) diapazon/eskirish narxi.

**6.4. Lokatsiya** `robots.txt` + `Kuzatildi`: `locationId` (`sideBlock?locationId=621540`),
`city`, `cityID`, `countryID`, `stateId`, `loc-hec`, `slocation`, `checkIn`.
`Taxmin`: region dome (`m.avito.ru`, shahar-slug `www.avito.ru/moskva/…`) + GPS/geo ID.

**6.5. Rasmlar / galereya** `robots.txt`: `imagesAlt` (alt matn — rasm yuklanishi
dalili), `needShowGallery`, `fileFormat`. `Taxmin`: multipart yuklash + galereya.
Aniq endpoint — `Aniqlanmadi`.

**6.6. Qoralama (draft) mexanizmi** `robots.txt` (kuchli dalil): `draftId` va
`after_saving_draft`. `Taxmin`: vizarda **"saqlab qo'yish / keyin davom etish"** bor —
e'lon `draft` holatida `draftId` bilan idishlangan holda saqlanadi.

**6.7. Captcha / abuse-himoya (joylashtirishda)** `robots.txt` (dalil): `captcha`,
`captcha-response`, `h-captcha-response`, `e-captcha-response`. `Taxmin`: e'lon
**yuborish** paytida **hCaptcha** (yoki o'zining "e-captcha") ishlatiladi (spam/abuse
oldini olish). Login devorida captcha ko'rinmadi, lekin POST-qadamda bor.

**6.8. Hayot sikli / oqim yo'llari** `robots.txt` (dalil): `/items/edit`,
`/items/delete`, `/items/next`, `/items/do`, `/items/stat`, `/items/write`
(sotuvchiga yozish), `/items/phone` (telefon ochish), `/items/abuse` (shikoyat),
hamda iyerarxik `/*/edit$`, `/*/edit/finish$`, `/*/next$`, `/*/*/*/do$`.
`Taxmin`: **ko'p qadamli vizari** — `edit → next → … → finish → do` (oxirgi `do` —
haqiqiy submit). Har qadam server route'ga ega.

**6.9. Identifikatsiya / auth** `Kuzatildi` + `robots.txt`: `token`, `oauth`, `scope`,
**Avito ID** (`ru.id.facct.ru` iframe — yagona SSO), ijtimoiy: VK / ESIA (Gosuslugi) / OK.

**Xulosa model (e'lon obyekti maydonlari — qayta qurilgan, `Taxmin`):**
`{ category(+parent), locationId/city, [dinamik atributlar: radio/params], title*,
description*, price, images[](+alt), contact(phone/account), serviceType,
draftId?, captchaToken }` → ko'p qadamli `next/finish/do` orqali `POST`.

---

## 7. E'lon joylashtirish oqimi — rekonstruksiya

`Taxmin` (yuqoridagi dalillar sintezi; **jonli kuzatilmagan**, hisob yo'q):

1. `/additem` → auth talab (`#login`, `next=%2Fadditem`). **Kuzatildi.**
2. Kirish (Avito ID / VK / ESIA / OK / tel+parol). **Kuzatildi (devor); oqim — Aniqlanmadi.**
3. **Kategoriya daraxtini tanlash** (rubricator) → serverdan kategoriya atribut sxemasi
   (`params<id>`, `avito-ui-radio-group-*`, `serviceType`) keladi. **Taxmin (robots dalil).**
4. **Maydonlarni to'ldirish**: sarlavha, tavsif, narx, rasm(`imagesAlt`) yuklash, lokatsiya. **Taxmin.**
5. **Qoralama saqlash** (`draftId`, `after_saving_draft`) — istalgan qadamda. **Taxmin.**
6. **`next` qadamlari** (`/items/next`, `/*/next$`) — tekshirish/ikonfig. **Taxmin.**
7. **Yakun: captcha (`h-captcha-response`) + `do`/`finish`** (`/*/*/*/do$`) → e'lon POST. **Taxmin.**
8. **To'lov / paket** (`/packages/`, `payment`, `promocode`, `cou`) — ko'plab turlarda
   e'lon joylashtirish pullik (premium) yoki limitli. **Kuzatildi (marker) + Taxmin.**

---

## 8. TopHand (bu loyiha) uchun foydali Parallel

Loyihangiz (TopHand — Avito-uslubidagi marketplace) bilan solishtirganda, **kuzatilgan
va robots-dalilli** topilmalar:

- **Dinamik atributlar:** Avito ham kategoriya bo'yicha o'zgaruvchi forma kontrollerlari
  (`params<id>`, `avito-ui-radio-group-*`) ishlatadi — bu sizning
  `category_attributes` + admin "Filtrlar" tizimingiz bilan **bir xil arxitektura**.
- **React + MFE:** Avito React SPA + Module Federation. Sizning stack (React + Vite)
  yengiroq; katta hajmga chiqqanda funksiyalarni MFE'ga bo'lish g'oyasi kelajak uchun
  kerakli.
- **Draft (`draftId`):** e'lonni qoralama saqlash — TopHand'da yo'q bo'lsa, UX uchun
  kuchli qo'shimcha (`create` yarim tugmasa qaytish imkoniyati).
- **`edit → next → finish → do`:** Avito ko'p-qadamli vizari server-route'larga ega.
  Sizda ham `CreateListingPage` 4-qadamli wizard — mos keladi (mantiqiy to'g'ri).
- **Captcha yuborishda (hCaptcha), bot-himoya qatlami:** spam/abuse oldini olish.
  TopHand'da mutation-rate-limit bor; rivojlanishda abuse-himoyani ko'rib chiqing.
- **`/items/write` va `/items/phone` alohida yo'llar:** sotuvchiga yozish / telefon
  ochish — alohida endpointlar (sizning `CallModal`/chat mantig'iga mos).

> Bu bo'lim tavsiya sifatida; hech qanday Avito kodi nusxalanmagan.

---

## 9. Nima ANIQLANMADI (va nega)

| Noma'lum | Sabab |
|---|---|
| E'lon vizarining ichki DOM/maydonlari (kategoriya tanlash oynasi, sarlavha/tavsif/narx inputlari, foto yukgich) | Login-orqasi; hisob yo'q |
| Haqiqiy `POST` e'lon endpointi + request/response JSON strukturasi | Auth talab qiladi; submit etika bo'yicha bajarilmadi |
| Foto/fayl yuklash (multipart) endpointi va limiti | Login-orqasi |
| Login/submit API endpointlari, CSRF/token mexanizmi, 2-faktor (SMS/QR) oqimi | Hisob yo'q; kiritish harakati qilingani yo'q |
| React Router yo'llari ro'yxati (`routeId` faqat `main-or-catalog` hibridlangan) | HTML'da faqat bitta route ko'rsatildi |
| Mobil (`m.avito.ru`) va region-dome versiyalari | Qo'shimcha yuklama / takroriy so'rovdan saqlanildi |
| `/rpc/` ichki xizmat shlyuzi javoblari | Yopiq (robots + auth) |

---

## 10. Yakuniy xulosa

- **Texnologiya steki (Kuzatildi, ishonchli):** **React SPA** (Fiber) + **React Router v6
  data-router** (server-hybrid loader) + **Redux** + **Module Federation mikro-frontendlar**
  + **Emotion/CSS-Modules** + **Sentry**. **Next.js emas.** Statik CDN: `avito.st`.
  Versiyalangan XHR API: `/web/<v>`, `/js/<v>`; yopiq: `/api/`, `/rpc/`, `/clickstream/`.
- **Joylashtirish mantiqi (rekonstruksiya):** `/additem` → **majburiy login** → ko'p
  qadamli (`next/finish/do`) vizari → **kategoriya bo'yicha dinamik atributlar**
  (`params`/radio-groups) → narx, rasm (`imagesAlt`), lokatsiya → **qoralama (`draftId`)**
  imkoni → **captcha** bilan `POST`. Kuzatilgan qobiq va robots.txt buni tasdiqlaydi;
  ichki qismlar hisob bo'lmagani uchun **aniqlanmadi**.
- **Etika:** faqat o'qish; hech qanday hisobga kirish/submit/hujum yo'q; maxfiy
  ma'lumot saqlanmagan; so'rovlar minimal.

### Screenshotlar (dalil)
- `Qa/avito-create-404.png` — `/create` 404 holati
- `Qa/avito-additem-login-wall.jpeg` — `/additem` → login devori (`role="dialog"`)

---

## 11. Ilova — Integratsiya qo'llanmasi (universal shablon)

> ⚠️ **Muhim aniqlik.** Ushbu bo'lim — e'lon joylashtirish tizimini **istalgan
> mustaqil platformada** qurish uchun **universal arxitektura shabloni** va uni
> **TopHand (bu loyiha)** bilan solishtirish. Quyidagi `POST /api/1/...` kabi
> endpointlar **Avito'dan USHLANMAGAN** — ular ataylab `[SHABLON]` deb belgilangan
> timsoliy misollardir. Avito'da kuzatilgan haqiqiy API sirti: versiyalangan
> `/web/<v>/…` va `/js/<v>/…`, biznes sirti esa `/api/`, `/rpc/`, `/clickstream/`
> orqali **yopiq** (5-bo'lim). E'lon kiritish yo'li: **`/additem`** (`/create` 404;
> `/add-item/` — noto'g'ri) [Kuzatildi].

### 11.1 Oqim (4 bosqich) va dalil maqomi

```
[1. Kategoriya tanlash] -> [2. Dinamik parametrlar] -> [3. Media yuklash] -> [4. Tekshirish va chop etish]
```

| Bosqich | Avito dalili | Maqom |
|---|---|---|
| 1. Kategoriya | `visual-rubricator`, `category_id/categoryParentID` | [Kuzatildi] (tuzilish); aniq endpoint [SHABLON] |
| 2. Dinamik atributlar | `avito-ui-radio-group-*`, `params<id>`, `serviceType` | [Kuzatildi] (mavjudligi); konfiguratsiya formati [SHABLON] |
| 3. Media | `imagesAlt`, `needShowGallery`, `fileFormat` | [Kuzatildi] (maydonlar); upload endpoint [SHABLON/Aniqlanmadi] |
| 4. Chop etish | `/items/edit->next->finish->do`, `draftId`, `h-captcha-response` | [Taxmin] (oqim); aniq POST [Aniqlanmadi] |

### 11.2 Har bosqich: shablon + TopHand holati

**Bosqich 1 — Kategoriya taklifi (suggester).** `[SHABLON]` — kuzatilmagan misol:
```jsonc
// POST /api/1/add/category_suggest  (SHABLON; Avito'da isbotlanmagan)
{ "title": "iPhone 13 Pro Max" }
// -> { "suggested_categories": [ {"id":97,"path":"Elektronika > Telefonlar > ..."} ] }
```
- *TopHand holati:* AI prefill mavjud — `/api/ai/...` (`aiPrefillAttributes`,
  `aiGenerateDescription`) orqali sarlavhadan atribut/kategoriya to'ldiriladi
  (kategoria taklifi `catalog_id/category_id` bilan). Yo'q bo'lsa — PostgreSQL
  `pg_trgm` bilan soddalashtirilgan suggester qo'shish mumkin.

**Bosqich 2 — Dinamik atributlar (EAV/JSONB).** `[SHABLON]` forma konfiguratsiyasi:
```jsonc
// GET /api/1/add/form_config?category_id=97   (SHABLON)
{ "fields": [
  { "id": "phone_color", "type": "select", "label": "Rangi", "required": true,
    "options": [{"value":"black","label":"Qora"},{"value":"white","label":"Oq"}] },
  { "id": "storage_capacity", "type": "radio", "label": "Xotira", "required": true }
]}
```
- *TopHand holati:* **allaqachon bor** — `category_attributes` jadvali
  (`key`, `label_uz`, `type`, `options JSONB`, `required`, `filterable`, `sort_order`,
  `section`, `meta`) va `DynamicFieldRenderer.tsx` (`attr.type` bo'yicha kontrol
  tanlaydi) + `react-hook-form` + **Zod** (`makeListingSchema`).
- *Kasqad maydonlar (BMW -> modellar):* TopHand'da hozircha **yo'q** — `meta`
  ustuniga `depends_on`/`parent_key` sxemasini qo'shib, `options`ni dinamik filtrlash
  orqali qo'shiladi (kichik UX yangilanish).

**Bosqich 3 — Media (asinxron yuklash + CDN).** `[SHABLON]`:
```jsonc
// POST /api/1/media/upload  (multipart/form-data)   (SHABLON)
// -> { "image_id":"img_uuid_9921", "preview_url":"https://cdn.../tmp/9921.jpg" }
```
- *TopHand holati:* **bor** — fayllar alohida yuklanadi (`uploadImageFile`/
  `uploadVideoFile`), `listing_images` (`url`, `sort_order`, `media_type`) va
  `sort_order=0` rasm **cover** hisoblanadi; R2 + lokal saqlash, `Sharp` bilan
  qayta o'lchash.
- *Topilmagan (yaxshilanish):* brauzerda `Canvas`/WebP siqish (hashosiy client-side
  optimizatsiya) — ixtiyoriy tezlik qo'shimchasi.

**Bosqich 4 — Yakuniy payload + chop etish.** `[SHABLON]` payload (Avito'da
`do/finish` orqali — aniq struktura [Aniqlanmadi]):
```jsonc
// POST /api/1/items/create   (SHABLON; Avito REST shakli EMAS)
{ "category_id":97, "title":"...", "description":"...",
  "price":{"amount":7500000,"currency":"UZS"},
  "location":{"address":"Toshkent, Chilonzor","lat":41.2827,"lng":69.2043},
  "media_ids":["img_uuid_9921"],
  "attributes":{"phone_color":"black","storage_capacity":"128gb"} }
```
- *TopHand holati:* `CreateListingPage` submit -> `POST /api/listings` (`attributes`
  JSONB, `price_*`, `region/district/lat/lng`, `images[]`). Server-side required-sxema
  tekshiruvi `listingService`da bor.
- *Draft (`draftId`):* Avito'da **bor** (robots: `draftId`, `after_saving_draft`);
  TopHand'da **yo'q** — e'lonni qoralama saqlash `listings.status='DRAFT'` +
  avtosaqlash bilan qo'shiladigan qimmatli UX (8-bo'lim).
- *Captcha/abuse:* Avito `h-captcha-response` ishlatadi; TopHand'da mutation rate-limit
  bor, ho'sin abuse-himoya (masalan hCaptcha/Turnstile) qo'shish mumkin.

### 11.3 Ma'lumot modeli — Avito dalili -> TopHand

| Tushuncha | Avito dalili (robots/kuzatuv) | TopHand mosligi |
|---|---|---|
| Kategoriya | `category_id`, `categoryParentID` | `categories` (`id`, `parent_id`, `catalog_id`, `slug`) |
| Dinamik atribut | `avito-ui-radio-group-*`, `params<id>` | `category_attributes` (JSONB `options`) |
| Narx | `price`, `pmin`, `pmax` | `price_type`, `price_min/max`, `currency` |
| Lokatsiya | `locationId`, `city`, `lat/lng` | `region_id`, `district_id`, `latitude/longitude` |
| Media | `imagesAlt`, `needShowGallery` | `listing_images` (`url`, `sort_order`, `media_type`) |
| Qoralama | `draftId`, `after_saving_draft` | [yo'q — `status='DRAFT'` bilan qo'shiladi] |
| Hayot sikli | `/items/edit->next->finish->do` | `status` (DRAFT->ACTIVE->...), 4-qadamli wizard |

### 11.4 Xavfsizlik / validatsiya (universal)
1. **Server-side validatsiya** — `attributes`ni kategoriya sxemasiga qat'iy tekshirish
   (TopHand: `listingService` required-sxema — mos).
2. **Transaksiya** — `BEGIN...COMMIT` (TopHand: atomic create + media biriktirish).
3. **Rate limiting** — spam/abuse uchun (TopHand: mutation-only limiter; +captcha opsiya).
4. **Media optimizatsiya** — WebP + CDN (TopHand: Sharp + R2/lokal; client-side siqish ixtiyoriy).
5. **Asinxron indexing/push** — chop etishdan keyin (TopHand: Postgres indeks +
   notification; Elasticsearch shart emas — hajm kichkina).

### 11.5 Xulosa (ilova)
Avito'ning e'lon joylashtirish andazasi — **kategoriya -> dinamik atributlar (EAV/JSONB)
-> media -> ko'p-qadamli (`next/finish/do`) chop etish + captcha + draft**. Bu **TopHand
da deyarli to'liq amalga oshirilgan** (category_attributes + DynamicFieldRenderer +
Zod + listing_images + rate-limit). Yagona sezilarli **bo'sh joylar**: (a) `draftId`
bilgan qoralama saqlash, (b) kasqad (dependent) atributlar, (c) yuborishda captcha.
`/api/1/...` endpointlari — faqat timsol; Avito'ning haqiqiy sirti [`/web`,`/js` +
yopiq `/api`,`/rpc`] va ular **kuzatilmagan**.
