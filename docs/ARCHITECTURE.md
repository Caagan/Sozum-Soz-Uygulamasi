# Mimarî — SÖZÜM SÖZ

SÖZÜM SÖZ, tamamen istemci taraflı (client-side) çalışan bir web prototipidir: sunucuya
bağımlı değildir, tüm kullanıcı verisi `localStorage`'da durur ve YZ yalnızca anonim özetleri
işler. Çok-katmanlı (layered) ve seyrek ama net bir mimarî kullanır.

## Katmanlar

| Katman | Dosya | Sorumluluk |
| --- | --- | --- |
| Sunum / UI | `src/index.html`, `src/css/styles.css`, `src/js/app.js` (render + olaylar) | Arayüz, telefon mock ekranı, bildirim yığını, tüm ekran akışı |
| Uygulama motoru | `src/js/app.js` | Durum yönetimi, süre sözü motoru, puan/seri, görevler, çekiliş, ödül, feed, KVKK akışı, ekran yönlendirme |
| Veri | `src/js/data.js` | Statik içerik: uygulama kataloğu, ödül kataloğu, çekiliş ödülleri, haftalık görevler, svg logo üreticileri |
| YZ katmanı | `src/js/ai.js` | Prompt tasarımı (sistem rolü, few-shot, adım-adım), sağlayıcı çağrısı (OpenAI/Gemini), şablon fallback, kriz guard'ı, YZ damgası üreticisi |
| Kalıcı veri | tarayıcı `localStorage` | Anahtar-değer durumun kalıcılığı (uygulama içinde `state` + `save()`) |
| Yapım / test | `tools/`, `tests/` | `build-standalone.js` → `dist/` tek dosya; jsdom tabanlı davranış testleri |

## Veri akışı (bir oturum örneği)

```
index.html ──> app.js (IIFE başlatıcı)
   ├─ localStorage'dan state yükle → renderHome()
   ├─ ikona bas → openPromiseDialog()  (süre sözü "söz ver" ekranı)
   │    └─ durum seçildi → enterApp(): sayacı başlat (1 sn ≈ 1 dk demo)
   ├─ süre dolar → coachBuild() → bildirim (mikromola + puan) → finishSession()
   │    └─ feed/istatistik/seri/görev güncelle → save()
   ├─ Yansıma sekmesi → ai.js: buildDaily/buildWeekly → API veya fallback → çıktı (YZ damgası + "tıbbi değil" uyarısı)
   └─ Sohbet → ai.js: chatSystem + kriz guard → mesaj geçmişi (son 20) + yanıt
```

## Dosya / dizin ağacı

```
`Sozum-Soz-Uygulamasi/`
├── src/                     # tek doğruluk kaynağı (source of truth)
│   ├── index.html           # sayfa iskeleti + sekmeler + telefon mock
│   ├── css/styles.css       # tüm stil/poetika
│   └── js/
│       ├── data.js          # statik veri kataloğu
│       ├── ai.js            # YZ katmanı
│       └── app.js           # uygulama motoru + sunum
├── tests/                   # jsdom uçtan uca davranış testleri
│   ├── test-app.js          # 69 test (çekirdek akış, KVKK, görev, sheet, ödül…)
│   ├── test-offtopic.js     # YZ alan dışı yönlendirme
│   ├── test-ai-stamp.js     # YZ damgası / "tıbbi değil" uyarısı
│   ├── test-kvkk-full.js    # KVKK bölüm başlıkları + veri hakları
│   └── run-all.cmd          # hepsini sırayla çalıştırır (Windows)
├── tools/
│   ├── build-standalone.js  # src/ → dist/ tek dosya derleyicisi
│   ├── standalone-check.js  # üretilen tek dosyayı jsdom'da doğrular
│   ├── BASLAT.bat           # yerel sunucuyu açıp tarayıcıyı başlatır
│   └── server.ps1           # bağımlılıksız mini statik sunucu
├── docs/
│   ├── ARCHITECTURE.md      # bu belge
│   └── DEMO-SCRIPT.md       # ~5 dk jüri anlatımı
├── dist/                    # üretilen tek dosya (sunum artifact)
│   └── SOZUM-SOZ-TEKDOSYA.html
├── package.json             # npm test / npm run build:check / npm run serve
├── README.md
├── Hackathon Raporu.pdf    # hackathon raporu (TR, PDF)
├── TR_HackathoSunumu_SözümSöz.pptx  # sunum (TR)
├── LICENSE                  # Apache-2.0
└── .gitignore
```

## Tasarım kararları

1. **Bağımlılıksız çalışma:** Uygulama anahtar olmadan da uçtan uca çalışır (şablon YZ).
   Bu, jüri demosunda "internet/API yok" senaryosunu bile kurtarır.
2. **Tek-dosya `dist/`:** Sunum tek bir HTML dosyasıyla yapılabilir; repo içinde büyüklük
   algısı için `src/` ayrı tutulur. Üretim `tools/build-standalone.js`.
3. **Gizlilik merkezli:** Hiçbir katman kullanıcı kimliğini bilmez; API'ye yalnızca sayısal
   özetler gider. KVKK akışı motorun içindedir; veri hakları ekranı da.
4. **Test edilebilirlik:** jsdom + `runScripts:"dangerously"` ile gerçek DOM davranışı
   test edilir (test-app 69 adet). Böylece yeni özellik mevcut akışları bozmadığı doğrulanır.
5. **YZ güvenliği:** Tek kriz guard'ı (`ai.js`) hem canlı model hem şablon yolu için ortaktır;
   tüm çıktılara otomatik YZ damgası ve "tıbbi değil" uyarısı eklenir.

## Yap → doğrula (build & verify)

```
npm install                # jsdom dev-bağımlılığı (tek sefer)
npm test                   # 69 + 4 + 5 + 9 davranış testi (0 FAIL beklenir)
npm run build:check        # src/ → dist/ tek dosya üret + jsdom'da doğrula
npm run serve              # python ile yerel sunucu (src/ kök)
```