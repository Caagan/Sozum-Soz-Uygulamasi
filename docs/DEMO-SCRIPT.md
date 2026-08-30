# Demo Senaryosu (~5 dk) — SÖZÜM SÖZ

Amaç: jüriye "süre sözü → takip → puan/seri → etik → YZ → veri hakları" zincirini tek akışta
göstermek. `dist/SOZUM-SOZ-TEKDOSYA.html`'i tarayıcıda (tercihen iki sekme: biri uygulama,
biri GitHub) açarak anlatın.

| Süre | Anlatılacak | Ekranda ne yapılır |
| --- | --- | --- |
| 0:00–0:30 | Problem: aplik kalıcı kullanım; "kendine söz ver" fikri | Ana ekranı göster: telefon mock'u, "süre sözü" kavramı |
| 0:30–1:15 | Süre sözü akışı | Bir sosyal ağ ikonuna dokun → süre seç (ör. 5 dk) → "Söz ver". Hızlı demo: 1 sn ≈ 1 dk |
| 1:15–1:45 | Sürenin dolması + YZ koç bildirimi | Sayacın akışını beklet; süre dolunca empatik bildirim + mikromola öner (20 sn geri sayım, +5 puan) |
| 1:45–2:15 | Sözü bitir → puan/seri akışı | "Sözümü tut ve kapat" → +3, seri +1; üst bar PUAN/SERİ artışını göster. Son aktiviteler ve haftalık skor emojisi |
| 2:15–2:45 | Günlük yansıma (YZ) | "Yansıma (YZ)" sekmesi → "Yansımayı Oluştur". Çıktıda **YZ damgası + "tıbbi değil"** ibaresini göster; "promptu göster" ile prompt tasarımını açıkla (zero-shot/few-shot/step-by-step) |
| 2:45–3:15 | Sohbet koçu + kriz guard'ı | Sohbette örn. "intihar..."/umutsuzluk içeren mesaj yaz → Yeşilay 115 / 112 yönlendirmesi |
| 3:15–3:45 | Gizlilik: KVKK m.10 + açık rıza | Telefondaki **SÖZÜM SÖZ ikonu**: ilk basışta aydınlatma + "Kabul etmiyorum" dersen kilitli kaldığını göster |
| 3:45–4:15 | Veri hakları (KVKK m.7/m.11) | Ayarlar → Veri Hakları: "Verilerimi indir" (JSON çıkar), "Verilerimi sil" (uygulama kilitlenir), "Rızayı geri al" |
| 4:15–4:45 | Teknik + mimari | Repo ağacı (GitHub'da) + gereksiz bağımlılık olmaması + testler (`tests/run-all.cmd` 69+ test) |
| 4:45–5:00 | Kapanış | Problem → çözüm → "yargısız, tıbbi olmayan, gizlilik merkezli" bir cümleyle bitir |

## İpucu

- Demo'yu **hızlı modda** (varsayılan: 1 sn ≈ 1 dk) yapın; 5 dk'lık söz saniyeler içinde biter.
- Canlı YZ anahtarınız varsa Ayarlar'dan etkinleştirin; yoksa şablon fallback yeterli — bu
  özellik olarak "anahtar olmadan bile uçtan uca çalışır" şeklinde satar.
- "Neden bu teknikler?" sorusuna RAPOR'da hazır (§3) cevabınız var.