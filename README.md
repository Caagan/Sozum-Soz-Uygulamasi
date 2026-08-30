# SÖZÜM SÖZ - Dijital İyi Olma Hâli Prototipi

Hackathon projesi: dijital bağımlılık / dijital iyi olma hâli. Kullanıcı bir uygulamaya
girerken "kaç dakika kalmayı taahhüt ettiğini" söyler (süre sözü); sözünü tutunca puan
kazanır, aşarsa ya da kapatıp hemen başka uygulamaya geçerse uyarı alır ve puan kaybeder.
Puanlar streak/günün sözü ile çoğalır, Yeşilay ödül kataloğunda ve aylık çekilişte kullanılır.
Üretken YZ, oturum geçmişinden yargısız günlük yansıma ve haftalık özet üretir.

## Çalıştırma

index.html'i doğrudan tarayıcıda aç (çift tık) veya yerel sunucuyla:

    python -m http.server 8000
    # tarayıcıda: http://localhost:8000

Sunucu gerektirmez; tüm veri `localStorage` (tarayıcı) içinde saklanır.

## Canlı YZ kullanımı (opsiyonel)

Varsayılan hâlde "Yansıma (YZ)" sekmesi, şablon üreten bir fallback kullanır (anahtar
yoksa demo tam çalışır). Gerçek model için Ayarlar'dan şu anahtarlar doldurulur:

- Canlı YZ: aç
- Sağlayıcı: **OpenAI** (varsayılan) veya **Google Gemini** (seçilince adres/model otomatik
  ayarlanır; özel/ince-ayar model adını 'Model' alanına yazabilirsin)
- API temel adresi: `https://api.openai.com/v1` (OpenAI uyumlu her servis çalışır)
- Model: örn. `gpt-4o-mini` veya `gemini-3.6-flash`
- API anahtarı: `sk-...` veya `AIza...`

Anahtarlar yalnızca tarayıcıda saklanır; API'ye yalnızca anonim oturum özeti (prompt) gider.

## Test

Hızlı demo açıkken 1 saniye ≈ 1 dakika sayılır; böylece 5 dakikalık bir süre sözü
saniyeler içinde dolar ve bildirim puan akışı bitişte izlenebilir.

- Uygulamaya gir → süre sözü ver (2/5/10/15/... dk)
- Süre dolunca YZ koçu, kullanıcının bağlamına göre (saat, aşım, seri) empatik ve suçluluk
  hissettirmeyen bir bildirim üretir ve somut bir mikromola önerir (gözleri dinlendir, su iç...
  "Mola başla" → 20 sn geri sayım → +5 puan)
- "Sözümü tut ve kapat" = +3 puan, seri +1
- "Başka uygulamaya geç" veya kapatıp hemen başka uygulama açmak = -5 puan, seri sıfırlanır
- Seri bonusları: 3/7/14/30 söz → +10/+25/+60/+150
- Günün sözü: 3 söz tutunca +20 (Durum sekmesinden talep edilir)
- Grafikler: bugün vs geçen hafta aynı gün karşılaştırması, son 7 gün kullanımı,
  haftalık (4 hafta) karşılaştırma, kategori dağılımı (donut) ve en çok kullanılan uygulamalar
- Sohbet (çok turlu YZ koç): konuşma geçmişini hatırlayan koç; şablon yanıt varsayılan,
  canlı model için Ayarlar'dan anahtar girilir
- Haftalık skor emojisi: telefon bildirim panelinde uygulama "arka planda çalışıyor" iken
  😀 (iyi) / 😐 (ortalama) / 🙁 (kötü) gösterilir; Telefon sekmesindeki demo butonlarıyla
  (İyi/Orta/Kötü/Otomatik) videoda gösterilebilir
- Yansıma (YZ): günlük yansıma + haftalık özet; "Kullanılan promptu göster" ile rapora
  girecek prompt ve tasarım gerekçeleri görüntülenir
- Haftalık Görevler sekmesi: 5 görev (ekran <10 saat, 7 söz, 5 mola, 3 farklı uygulama,
  3'ten az aşım). Göreve katıl → koşul sağlanınca puanı al; ilerleme son 7 günden sayılır

## Gizlilik ve etik

- Telefonda **SÖZÜM SÖZ ikonuna** ilk basışta **KVKK m.10 tam aydınlatma metni + açık rıza** ekranı
  gelir: kabul edilirse uygulama açılır, kabul edilmezse uygulama çalışmaz. Onay hatırlanır.
- **Veri hakları (Ayarlar → Veri Hakları):**
  - **Verilerimi indir (JSON)** — erişim hakkı (KVKK m.11): verilerinizi dışa aktarır.
  - **Verilerimi sil** — silme hakkı (KVKK m.11): açık rıza dahil tüm verileri cihazdan kalıcı
    olarak siler, uygulamayı kilide alır, bir dahaki açılışta rıza yeniden sorulur.
  - **Rızayı geri al** — KVKK m.7: açık rızayı geri çeker, SÖZÜM SÖZ kilitlenir.
  - **Demoyu sıfırla** — demo verilerini temizler (KVKK kalıcı silmenin yerini tutmaz).
- Veriler yalnızca `localStorage`'da (tarayıcıda) tutulur; API'ye yalnızca anonim oturum
  özeti ve sohbetin son mesajları gider (ad/fotoğraf/iletişim asla toplanmaz).
- **Kriz guard:** sohbette intihar/kendine zarar/ağır umutsuzluk sinyali görülürse model
  tanı koymaz; kullanıcı Yeşilay Danışmanlık Hattı (115) ve 112'ye yönlendirilir.
- **YZ damgası:** tüm YZ çıktılarında "Bu (içerik/yanıt) yapay zekâ tarafından üretilmiştir"
  ibaresi ve sohbette "YZ" rozeti bulunur; çıktılar "farkındalık amaçlıdır, tıbbi değildir" uyarısı taşır.

## Dosyalar

- `index.html`, `css/styles.css` - arayüz
- `js/data.js` - uygulamalar, ödüller, çekiliş, zorluk verileri
- `js/ai.js` - YZ prompt tasarımı (sistem rolü, few-shot, adım adım), API çağrısı, fallback
- `js/app.js` - çekirdek mantık: süre sözü, uyarılar, puan/seri, ödül, çekiliş, YZ sayfası

## Notlar

- **Sunum:** `SOZUM-SOZ-TEKDOSYA.html` tek dosyadır; tarayıcıda doğrudan açılıp sunulabilir
  (çok-dosyalı hâlin birebir derlenmiş kopyası).
- **Lisans:** Apache-2.0 — bkz. `LICENSE`.
- Tüm veriler yalnızca tarayıcıda (`localStorage`) saklanır; API'ye kimlik içeren hiçbir veri gitmez.