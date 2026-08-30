// ---------- Üretken YZ katmanı: prompt tasarımı + API + fallback ----------

const AI = {

  systemPrompt() {
    return [
      "Sen 'SÖZÜM SÖZ' dijital iyi olma hâli koçusun. Görevin, kullanıcının ekran kullanım kayıtlarını yargısız, tıbbi olmayan bir dille yansıtmasına yardımcı olmak.",
      "Kurallar:",
      "1) 'bağımlı', 'hasta', 'tedavi', 'bozukluk' gibi tıbbi veya damgalayıcı kelimeler kullanma. Tanı koyma.",
      "2) Kişisel suçlama yapma; davranış kalıplarına ve bağlamlara odaklan.",
      "3) Yanıtı en fazla 6-8 kısa madde hâlinde ver: Desen -> Olası tetikleyici -> Küçük iyileştirme önerisi.",
      "4) Rakamları yalnızca verilen verilere dayandır; veri yoksa kesin rakam iddia etme.",
      "5) Öneriler somut, erişilebilir ve kısa süreli (1-2 dakikalık) 'deney' şeklinde olsun; kullanıcıyı zorlamasın.",
      "6) Her zaman Türkçe yanıt ver.",
      "7) Çıktının sonuna 'Bu bilgi farkındalık amaçlıdır, tıbbi tanı veya tedavi önerisi değildir.' satırını ekle.",
      "8) Kriz sinyali görürsen (intihar, kendine zarar, ağır umutsuzluk, dayanamıyorum) tanı koymadan, sakin ve yargısız biçimde ücretsiz destek hatlarına yönlendir: Yeşilay Danışmanlık Hattı 115, acil durumlar için 112.",
      "9) DOĞRULAMA (yanıtı göndermeden önce): kullandığın her sayı veride var mı? Emin değilsen rakam uydurma, 'bu bilgi kaydımda yok' de. Tıbbi, suçlayıcı veya cezalandırıcı bir ifade var mı? Biçim kurallarına (madde '-', son satır uyarı) uyuluyor mu?"
    ].join("\n");
  },

  // ---------- kriz guard ----------
  crisisPattern: /kendime zarar|kendimi öldür|kendime kıy|intihar|ölmek istiyorum|yaşamak istemiyorum|canıma kıy|kimse beni (anlamıyor|sevmiyor|önemsemiyor)|dayanamıyorum|dayanacak gücüm yok|umutsuzum|yaşamı (bitirmek|sonlandırmak) istiyorum/i,

  isCrisis(text) {
    return !!String(text || "").match(AI.crisisPattern);
  },

  crisisReply() {
    return [
      "Önemli bir şey yazdın ve bunu ciddiye alıyorum. SÖZÜM SÖZ tanı koymaz ve tıbbi destek sağlamaz; ama en doğru adım, bu duyguları tek başına tutmamak.",
      "",
      "Lütfen hemen bir yetişkinle konuş (aile büyüğü, velin, öğretmen veya rehber öğretmen) ya da ücretsiz destek hattını ara:",
      "- Yeşilay Danışmanlık Hattı: 115",
      "- Acil durum / güvenlik riski: 112",
      "",
      "Bu bilgi farkındalık amaçlıdır, tıbbi tanı veya tedavi önerisi değildir."
    ].join("\n");
  },

  // ---------- tıbbi geçit (tıbbi soruları yanıtlamayız, doktora yönlendiririz) ----------
  medicalPattern: /(ağr(ı|ım)|sancı|iltihap|ateş|mide|baş dönmesi|dönüyor|uyuşma|karıncalanma|çarpıntı|kalp|tansiyon|şeker|ilaç|doz|reçete|ameliyat|yara|kanama|kusma|ishal|kabızlık|diyabet|kolesterol|grip|öksürük|nefes darlığı|kırık|çıkık|şişlik|döküntü|kaşıntı|vitamin|doktor|hap|şurup|eczane)/i,

  isMedical(text) {
    return !!String(text || "").match(AI.medicalPattern);
  },

  medicalReply() {
    return [
      "Bu tıbbi bir soru gibi görünüyor; SÖZÜM SÖZ tanı koymaz ve tıbbi tavsiye veremez.",
      "Sağlık konularında bir doktora veya sağlık kuruluşuna danışman en doğru adım olur.",
      "",
      "Bunun yerine sana dijital iyi olma hâlinde destek olabilirim: ekran süresi, süre sözü, mola ve gece kullanımı üzerine konuşabiliriz."
    ].join("\n");
  },

  // ---------- konu dışı (off-topic) tespiti, gruplara ayrılır ----------
  wellbeingContext: /(telefon|ekran|uygulama|kaydır|feed|süre sözü|mola|bağımlı|bildirim|oturum|alışkanlık|aşırı|oyun bağ|sosyal medya|gece kullanım)/i,

  offTopicGroups: [
    { name: "finans", re: /döviz|dolar|euro|avro|borsa|hisse|kripto|bitcoin|coin|faiz|enflasyon|banka|piyasa|maaş/i },
    { name: "haber", re: /seçim|siyaset|parti|hükümet|savaş|deprem|gündem|gazete|haber/i },
    { name: "spor", re: /maç sonucu|takım|lig|şampiyon|gol|skor|futbolcu/i },
    { name: "eğlence", re: /hile|mini sipariş|sanatçı|ünlü|magazin/i },
    { name: "bilgi", re: /matematik|denklem|fizik|kimya|tarih sorusu|coğrafya|ne demek|anlamı nedir|ingilizce|ödev/i },
    { name: "yaşam", re: /hava durumu|tarif|otel|gezi öner/i }
  ],

  detectOffTopic(q) {
    const lower = String(q || "").toLowerCase();
    if (AI.wellbeingContext.test(lower)) return null;
    for (const g of AI.offTopicGroups) {
      if (lower.match(g.re)) return g.name;
    }
    return null;
  },

  offTopicReply(group) {
    const labels = {
      finans: "Döviz, hisse ve piyasa bilgileri benim alanım değil",
      haber: "Güncel haber ve siyaset benim alanım değil",
      spor: "Spor sonuçları ve puanlar benim alanım değil",
      eğlence: "Film, müzik veya oyun hileleri önermiyorum",
      bilgi: "Genel bilgi ve ders konuları benim alanım değil",
      yaşam: "Tarif, hava durumu ve yaşam tavsiyesi benim alanım dışında"
    };
    return [
      (labels[group] || "Bu konu benim alanım değil") + "; ben dijital iyi olma hâli koçuyum.",
      "Bunun yerine şunlarda yardımcı olabilirim: ekran süresi, süre sözü, mola önerisi, gece kullanımı, uygulama atlama alışkanlığı.",
      "Seni şu anda en çok zorlayan ekran alışkanlığı hangisi?"
    ].join("\n");
  },

  hourOf(ts) {
    return new Date(ts).getHours();
  },

  periodOf(h) {
    if (h >= 6 && h < 12) return "sabah";
    if (h >= 12 && h < 18) return "öğleden sonra";
    if (h >= 18 && h < 22) return "akşam";
    return "gece";
  },

  aggregate(sessions) {
    const byCategory = {};
    const byApp = {};
    const periodCounts = {};
    let usedMin = 0, promisedMin = 0, kept = 0, brokenExceed = 0, brokenHop = 0, overshoot = 0;
    const overshootSum = { total: 0, n: 0 };
    sessions.forEach(s => {
      usedMin += s.usedMin;
      promisedMin += s.promisedMin;
      byCategory[s.category] = (byCategory[s.category] || 0) + s.usedMin;
      if (!byApp[s.appId]) byApp[s.appId] = { name: s.appName, used: 0, exceed: 0, kept: 0 };
      byApp[s.appId].used += s.usedMin;
      if (s.result === "kept") { kept++; byApp[s.appId].kept++; }
      if (s.result === "broken_exceed") { brokenExceed++; byApp[s.appId].exceed++; }
      if (s.result === "broken_hop") brokenHop++;
      if (s.usedMin > s.promisedMin) {
        overshoot++;
        overshootSum.total += (s.usedMin - s.promisedMin);
        overshootSum.n++;
      }
      const p = AI.periodOf(AI.hourOf(s.ts));
      periodCounts[p] = (periodCounts[p] || 0) + (s.usedMin > s.promisedMin ? 1 : 0);
    });
    const topApps = Object.keys(byApp)
      .map(k => ({ name: byApp[k].name, used: byApp[k].used, exceed: byApp[k].exceed }))
      .sort((a, b) => b.used - a.used);
    const categories = Object.keys(byCategory)
      .map(k => ({ name: k, used: byCategory[k] }))
      .sort((a, b) => b.used - a.used);
    return {
      total: sessions.length,
      usedMin, promisedMin,
      kept, brokenExceed, brokenHop, overshoot,
      avgOvershootMin: overshootSum.n ? Math.round(overshootSum.total / overshootSum.n) : 0,
      avgUsedMin: sessions.length ? Math.round(usedMin / sessions.length) : 0,
      topApps, categories, periodCounts
    };
  },

  serialized(sessions) {
    return sessions.slice(0, 14).map(s => ({
      uygulama: s.appName,
      hedefDakika: s.promisedMin,
      gercekDakika: s.usedMin,
      sonuc: s.result,
      kapanisSaat: AI.hourOf(s.ts)
    }));
  },

  buildDaily(sessions) {
    const agg = AI.aggregate(sessions);
    return [
      "===== BÖLÜM 1: KOMUT (görevin) =====",
      "Kullanıcının bugüne ait ekran kullanım kaydını yargısız, tanı koymadan ve sayıları YALNIZCA aşağıdaki VERİ bölümünden alarak bir yansımaya dönüştür.",
      "",
      "===== BÖLÜM 2: VERİ (sayılar sadece buradan gelecek) =====",
      "Kullanıcının bugüne ait ekran kullanım kaydı (JSON):",
      JSON.stringify({
        toplamOturum: agg.total,
        toplamKullanimDk: agg.usedMin,
        tutulanSoz: agg.kept,
        bozulanSoz: agg.brokenExceed + agg.brokenHop
      }, null, 2),
      "",
      "Oturumlar:",
      AI.serialized(sessions).length
        ? JSON.stringify(AI.serialized(sessions), null, 2)
        : "Bugüne ait oturum kaydı yok; bunu belirt.",
      "",
      "===== BÖLÜM 3: ÖRNEK 1 — OLAĞAN GÜN (sözlerin çoğu tutulmuş) =====",
      "\"Bugün 4 uygulamada toplam ~85 dakika geçirdin ve 2 sözünü tuttuğun için iyi bir başlangıç. En fazla aşım TikTok'ta görünüyor (2 kez, ortalama 7 dk). Akşam 21:00 sonrası aşım eğilimi dikkat çekiyor; yorgunluk döneminde otomatik kaydırma davranışı tetiklenmiş olabilir. Küçük deneyim: TikTok'a girmeden önce 1 dakika 'girme sebebimi' yaz. İkinci deneyim: telefonu saat 23:00'te başka odaya bırak.\"",
      "",
      "===== BÖLÜM 4: ÖRNEK 2 — ZOR GÜN (birçok söz bozulmuş, yumuşak ve cesaretlendirici dil) =====",
      "\"Bugün zordu ve bunu saklamak yerine fark etmek önemli: 5 oturumda 4 hedef aşıldı, toplamda hedefinin ~40 dk üzerine çıktın. Bu bir başarısızlık değil; tekrar eden bir kalıp. Aşımlar öğleden sonra ve gece saatlerinde yoğunlaşıyor. Küçük deneyimin: öğleden sonra geçişlerinde 30 saniye nefes alıp sonra karar ver; 23:00'ten sonra telefonu başka odaya bırak.\"",
      "",
      "===== BÖLÜM 5: DOĞRULAMA (yanıtı göndermeden önce kendine sor) =====",
      "1) Kullandığım her rakam BÖLÜM 2'deki VERİ'de var mı? Yoksa rakam uydurma; yerine 'kaydımda yok' demekten çekinme.",
      "2) Hiçbir maddede tıbbi, suçlayıcı veya cezalandırıcı dil var mı?",
      "3) Her madde '-' ile başlıyor mu ve son satırda yasal uyarı var mı?",
      "",
      "Şimdi bu kullanıcının verisiyle, ÖRNEK 1/2'nin yapısına ve tüm kurallara uyarak yanıt ver."
    ].join("\n");
  },

  buildWeekly(sessions) {
    const agg = AI.aggregate(sessions);
    const catLines = agg.categories.length
      ? agg.categories.map(c => "* " + (CATEGORY_LABELS[c.name] || c.name) + ": " + c.used + " dk").join("\n")
      : "* Veri yok.";
    const appLines = agg.topApps.length
      ? agg.topApps.slice(0, 3).map(a => "* " + a.name + ": " + a.used + " dk (" + a.exceed + " aşım)").join("\n")
      : "* Veri yok.";
    return [
      "===== BÖLÜM 1: KOMUT (görevin) =====",
      "Kullanıcının son 7 günlük ekran kullanım kaydından, sayıları yalnızca aşağıdaki VERİ'den alarak yargısız bir haftalık yansıma üret.",
      "",
      "===== BÖLÜM 2: VERİ (sayılar sadece buradan gelecek) =====",
      "Kullanıcının son 7 güne ait ekran kullanımı istatistiği:",
      JSON.stringify({
        toplamOturum: agg.total,
        toplamKullanimDk: agg.usedMin,
        tutulanSoz: agg.kept,
        bozulanSozAsim: agg.brokenExceed,
        bozulanSozAtlama: agg.brokenHop,
        ortalamaAsimDk: agg.avgOvershootMin,
        enCokKullanilan: agg.topApps.slice(0, 3).map(a => a.name),
        kategoriDagilimDk: Object.fromEntries(agg.categories.map(c => [c.name, c.used]))
      }, null, 2),
      "",
      "Kategori dağılımı:",
      catLines,
      "En çok kullanılan 3 uygulama:",
      appLines,
      "",
      "===== BÖLÜM 3: ADIMLAR (sırayı asla bozma) =====",
      "ADIM 1: Haftanın genel tablosunu 1-2 cümlelik, yargısız bir özetle. Tanı koyma.",
      "ADIM 2: En belirgin 2 kalıbı seç; her biri için 'desen -> olası tetikleyici -> küçük deneyim' yapısında kısa madde yaz.",
      "ADIM 3: Gelecek hafta için 2 somut ve esnek sınır/rota önerisi ver (sert 'günde 1 saat' gibi hedefler koyma).",
      "ADIM 4: Cesaretlendirici ama gerçekçi bir kapanış cümlesi yaz ve yasal uyarı notunu ekle.",
      "",
      "===== BÖLÜM 4: DOĞRULAMA (yanıtı göndermeden önce kendine sor) =====",
      "1) Tüm rakamlar VERİ'den mi? Bilmediğimi uydurma.",
      "2) Tıbbi/suçlayıcı dil var mı?",
      "3) Bölüm 3'teki adım sırası korundu mu ve son satır yasal uyarı mı?",
      "",
      "Şimdi bu kullanıcının verisiyle yanıt ver."
    ].join("\n");
  },

  fallback(kind, agg) {
    if (!agg || agg.total === 0) {
      return "Henüz yeterli veri yok. Önce bir uygulamada süre sözü ver ve oturumu kapat; ardından buraya dönüp yeniden oluştur.";
    }
    const top = agg.topApps[0];
    const exApps = agg.topApps.filter(a => a.exceed > 0);
    const periodNames = { sabah: "sabah saatlerinde", "öğleden sonra": "öğleden sonra", akşam: "akşam saatlerinde", gece: "gece saatlerinde" };
    const worstPeriod = Object.keys(agg.periodCounts)
      .map(p => ({ p, n: agg.periodCounts[p] }))
      .sort((a, b) => b.n - a.n)[0];
    const periodStr = worstPeriod && worstPeriod.n > 0
      ? "Aşımların en sık " + periodNames[worstPeriod.p] + " görülüyor."
      : "Aşımların gün içinde dengeli dağılıyor.";
    const exStr = exApps.length
      ? "Hedef aşımın olan uygulamalar: " + exApps.slice(0, 2).map(a => a.name).join(" ve ") + " (" + exApps[0].exceed + " kez)."
      : "Bu dönemde hedef aşımın yok, güzel bir disiplin.";
    if (kind === "daily") {
      return [
        "Bugün " + agg.total + " oturumda toplam ~" + agg.usedMin + " dakika geçirdin ve " + agg.kept + " sözünü tuttun. İyi bir başlangıç.",
        "",
        "Desen: " + top.name + " en yüksek kullanımın (" + top.used + " dk). " + exStr,
        periodStr,
        "",
        "Olası tetikleyiciler: Akış (feed) tabanlı uygulamalarda süre fark edilmeden akar; otomatik içerik önerisi, 'bir dakika daha' isteğini artırabilir. Bunun farkında olmak ilk basamağı atlamanı kolaylaştırır.",
        "",
        "Küçük deneyler (1 hafta):",
        "1) " + top.name + " adlı uygulamayı açmadan önce 10 saniye 'şu an ne hissettiğimi / neden girdiğimi' yaz.",
        "2) Oturuma başlamadan önce bitiş saati söyle; süre dolunca telefonu ters çevir ve 2 dakika uzaklaş.",
        "",
        "Bu bilgi farkındalık amaçlıdır, tıbbi tanı veya tedavi önerisi değildir."
      ].join("\n");
    }
    return [
      "Haftalık genel görünüm: Toplam " + agg.total + " oturum, ~" + agg.usedMin + " dakika ekran zamanı. " + agg.kept + " söz tutuldu, " + (agg.brokenExceed + agg.brokenHop) + " söz bozuldu.",
      "",
      "Desen 1: " + top.name + " toplam kullanımının önemli bir bölümünü alıyor (" + top.used + " dk) ve aşım eğilimi taşıyor.",
      "Desen 2: " + periodStr + " Yorgunluk ve geç saatteki geçişler, 'kısa bir bakış' ile başlayıp uzayan oturumların eşiği olabiliyor.",
      "",
      "Küçük deneyler: 1) Haftada bir gün tüm bildirimleri kapat. 2) Bir uygulamayı açmadan önce 'kaç dakika' sorusunu sesli olarak yanıtla, sonra aç.",
      "",
      "Önümüzdeki hafta için: 'Sıfır aşım' gibi sert bir hedef yerine, aynı saat dilimlerindeki oturumları her gün 3 dakika kısaltmayı dene.",
      "",
      "Bu bilgi farkındalık amaçlıdır, tıbbi tanı veya tedavi önerisi değildir."
    ].join("\n");
  },

  async generate(kind, sessions, cfg) {
    const system = AI.systemPrompt();
    const user = kind === "daily" ? AI.buildDaily(sessions) : AI.buildWeekly(sessions);
    const promptText = "SİSTEM PROMPTU:\n" + system + "\n\n\nKULLANICI PROMPTU:\n" + user;
    if (cfg.live && cfg.apiKey) {
      try {
        const callCfg = Object.assign({}, cfg, { temperature: 0.5 });
        const text = await AI.callLLM(callCfg, system, user);
        return { text, source: "live", prompt: promptText };
      } catch (err) {
        const fb = AI.fallback(kind, AI.aggregate(sessions));
        return { text: fb, source: "live-error", prompt: promptText, error: err.message };
      }
    }
    await new Promise(r => setTimeout(r, 700));
    return { text: AI.fallback(kind, AI.aggregate(sessions)), source: "template", prompt: promptText };
  },

  async callLLM(cfg, system, user) {
    return AI.requestChat(cfg, [
      { role: "system", content: system },
      { role: "user", content: user }
    ]);
  },

  async requestChat(cfg, messages) {
    if ((cfg.provider || "openai") === "gemini") {
      return AI.requestGemini(cfg, messages);
    }
    const base = (cfg.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.apiKey
      },
      body: JSON.stringify({
        model: cfg.model || "gpt-4o-mini",
        messages: messages,
        temperature: cfg.temperature !== undefined ? cfg.temperature : 0.7,
        max_tokens: 1500
      })
    });
    if (!res.ok) {
      let detail = res.status;
      try {
        const j = await res.json();
        if (j.error) detail = j.error.message || j.error.code || res.status;
      } catch (e) { /* boş */ }
      throw new Error("API isteğinde hata (HTTP " + detail + ").");
    }
    const j = await res.json();
    const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text) throw new Error("YZ'dan boş yanıt geldi.");
    return text.trim();
  },

  async requestGemini(cfg, messages) {
    const base = (cfg.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    const model = cfg.model || "gemini-3.6-flash";
    const systemParts = [];
    const contents = [];
    (messages || []).forEach(m => {
      if (m.role === "system") { systemParts.push(m.content); }
      else { contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }); }
    });
    const body = { contents, generationConfig: { temperature: cfg.temperature !== undefined ? cfg.temperature : 0.7, maxOutputTokens: 1500 } };
    if (systemParts.length) body.systemInstruction = { parts: systemParts.map(t => ({ text: t })) };
    const res = await fetch(base + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(cfg.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let detail = res.status;
      try {
        const je = await res.json();
        if (je.error) detail = je.error.message || je.error.code || res.status;
      } catch (e) { /* boş */ }
      throw new Error("Gemini isteğinde hata (HTTP " + detail + ").");
    }
    const j = await res.json();
    const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    const text = parts ? parts.map(p => p.text || "").join("") : "";
    if (!text) throw new Error("YZ'dan boş yanıt geldi.");
    return text.trim();
  },

  coachSystem() {
    return [
      "Sen 'SÖZÜM SÖZ' dijital iyi olma hâli koçusun. Görevin, kullanıcının oturumuyla ilgili kısa, empatik ve suçluluk hissettirmeyen tek bir bildirim üretmek.",
      "Kurallar:",
      "1) Yargılama, suçlama yapma; 'bağımlı', 'hasta', 'tedavi' gibi tıbbi veya damgalayıcı sözcükler kullanma.",
      "2) En fazla 2 cümle; içten ve teşvik edici ol.",
      "3) Somut, hemen yapılabilir bir küçük mola öner (gözleri dinlendir, su iç, ayaklarını uzat, 20 nefes vb.).",
      "4) Molayı puan cinsinden sun (points): makul aralık 10-20.",
      "5) Sert hedef koyma, kullanıcıyı zorlama; öneri bir seçenek olsun.",
      "6) Çıktıyı yalnızca JSON olarak üret: {\"title\": \"...\", \"body\": \"...\", \"breakOffer\": \"...\", \"points\": <sayı>}",
      "7) Her zaman Türkçe cevap ver, markdown işareti kullanma."
    ].join("\n");
  },

  buildCoach(opts) {
    return [
      "===== BÖLÜM 1: KOMUT =====",
      "Tek, empatik, suçluluk hissettirmeyen bir bildirim üret. Çıktı YALNIZCA bu JSON şeması olacak: {\"title\": \"...\", \"body\": \"...\", \"breakOffer\": \"...\", \"points\": <sayı>}",
      "",
      "===== BÖLÜM 2: VERİ / BAĞLAM =====",
      "Uygulama: " + opts.appName,
      "Kategori: " + (CATEGORY_LABELS[opts.category] || opts.category || "bilinmiyor"),
      "Saat: " + opts.hour + ":00",
      "Durum: " + (opts.type === "overshoot"
        ? "hedef " + opts.promisedMin + " dk idi, " + opts.overMin + " dk aşıldı"
        : "kapatıp hemen başka uygulamaya geçildi (uygulama atlama)."),
      "Kullanıcının güncel serisi: " + opts.streak + (opts.streak > 1 ? " söz arka arkaya tutuldu" : ""),
      "",
      "===== BÖLÜM 3: ÖRNEK 1 — SÜRE AŞIMI =====",
      "{\"title\": \"Mola zamanı\", \"body\": \"30 dakikalık oturum biraz uzadı; bu gayet doğal.\", \"breakOffer\": \"Gözlerini 20 saniye dinlendirip bir bardak su içmek ister misin?\", \"points\": 15}",
      "",
      "===== BÖLÜM 4: ÖRNEK 2 — HIZLI GEÇİŞ =====",
      "{\"title\": \"Hızlı geçiş fark ettik\", \"body\": \"Bir uygulamayı kapatıp hemen diğerine geçmek stresle daha sık olur.\", \"breakOffer\": \"10 saniye dur ve kendine sor: şu an gerçekten neye ihtiyacım var?\", \"points\": 10}",
      "",
      "===== BÖLÜM 5: DOĞRULAMA (göndermeden önce) =====",
      "1) title, body, breakOffer, points alanları var mı?",
      "2) points 1-20 aralığında mı?",
      "3) Tıbbi veya suçlayıcı bir ifade var mı?",
      "İçeriği bu kullanıcının bağlamına uyarla, şema dışına çıkma."
    ].join("\n");
  },

  fallbackCoach(opts) {
    var title, body, breakOffer, points;
    if (opts.type === "overshoot") {
      title = "Süre hedefini hafifçe aştın";
      body = (opts.appName || "Oturum") + " beklediğinden " + opts.overMin + " dk uzadı. Fark etmen yeterli.";
      breakOffer = "Küçük bir mola: gözlerini 20 sn kapat, nefes al, su iç.";
      points = 5;
    } else {
      title = "Hızlı geçiş fark ettik";
      body = (opts.appName || "Yeni uygulama") + " oturumuna geçtin; hemen ardından diğerine geçmek dikkati böler.";
      breakOffer = "10 saniye dur ve kendine sor: şu an gerçekten neye ihtiyacım var?";
      points = 3;
    }
    return { title: title, body: body, breakOffer: breakOffer, points: points };
  },

  parseCoach(text, opts) {
    var m = String(text).match(/\{[\s\S]*\}/);
    try {
      var obj = m ? JSON.parse(m[0]) : null;
      return {
        title: (obj && obj.title) || "Mola zamanı",
        body: (obj && obj.body) || "",
        breakOffer: (obj && obj.breakOffer) || "",
        points: (obj && typeof obj.points === "number") ? obj.points : 5
      };
    } catch (e) {
      return AI.fallbackCoach(opts);
    }
  },

  async generateCoach(opts, cfg) {
    var system = AI.coachSystem();
    var user = AI.buildCoach(opts);
    var promptText = "SİSTEM PROMPTU:\n" + system + "\n\n\nKULLANICI PROMPTU:\n" + user;
    if (cfg.live && cfg.apiKey) {
      try {
        var callCfg = Object.assign({}, cfg, { temperature: 0.8 });
        var text = await AI.callLLM(callCfg, system, user);
        return { msg: AI.parseCoach(text, opts), source: "live", prompt: promptText };
      } catch (err) {
        return { msg: AI.fallbackCoach(opts), source: "live-error", prompt: promptText, error: err.message };
      }
    }
    await new Promise(function (r) { setTimeout(r, 600); });
    return { msg: AI.fallbackCoach(opts), source: "template", prompt: promptText };
  },

  chatSystem() {
    return [
      "Sen 'SÖZÜM SÖZ' dijital iyi olma hâli koçusun. Kullanıcıyla karşılıklı sohbet edersin.",
      "Kurallar:",
      "1) Yargısız, empatik ve teşvik edici ol; 'bağımlı', 'hasta', 'tedavi' gibi tıbbi veya damgalayıcı sözcükler kullanma, tanı koyma.",
      "2) Yanıtı 6-10 satırla sınırla; daha uzun cevapları kısa paragraflara böl, gereksiz madde yığma.",
      "3) Öneriler kısa, somut ve 'küçük deney' niteliğinde olsun; sert hedefler koyma, kullanıcıyı zorlama.",
      "4) Gerekirse tek bir net soru sor ve yanıtına göre devam et (çok turlu sohbet).",
      "5) Rakamları yalnızca verdiğim anonim veri bağlamına dayandır; veri yoksa varsayım yapma.",
      "6) Her zaman Türkçe yanıt ver.",
      "7) Yönlendirici öneri verdiğinde sona 'Bu bilgi farkındalık amaçlıdır, tıbbi tanı veya tedavi önerisi değildir.' satırını ekle.",
      "8) Kriz sinyali görürsen (intihar, kendine zarar, ağır umutsuzluk) tanı koyma; sakin ve yargısız biçimde ücretsiz destek hatlarına yönlendir: Yeşilay Danışmanlık Hattı 115, acil için 112.",
      "9) Soru ekran kullanımı/dijital iyi olma ile ilgisizse (döviz, yemek, genel haber, matematik vb.) soruyu yanıtlama; bu konunun alanının dışında olduğunu kısaca söyle ve konuyu kullanıcının ekran alışkanlıklarına geri getir.",
      "10) DOĞRULAMA: yanıtı göndermeden önce rakamların yalnızca verilen bağlamdan olduğunu kontrol et; emin değilsen rakam uydurma. Yanıt içinde tıbbi/suçlayıcı ifade varsa düzelt."
    ].join("\n");
  },

  fallbackChat(agg, q) {
    var lines = [];
    if (AI.isCrisis(q)) return AI.crisisReply();
    if (agg && agg.total > 0) {
      var top = agg.topApps[0];
      lines.push("Son 7 gününün özeti: " + agg.total + " oturum, ~" + agg.usedMin + " dk ekran süresi; " + agg.kept + " söz tutuldu, " + (agg.brokenExceed + agg.brokenHop) + " bozuldu." + (top ? " En çok " + top.name + " öne çıkıyor (" + top.used + " dk)." : ""));
      lines.push("");
    } else {
      lines.push("Henüz yeterli verim yok; ama birlikte küçük bir başlangıç yapabiliriz.");
      lines.push("");
    }
var lower = String(q || "").toLowerCase();
    if (AI.isCrisis(q)) {
      return AI.crisisReply();
    }
    if (AI.isMedical(q)) {
      lines.push(AI.medicalReply());
    } else {
      var off = AI.detectOffTopic(q);
      if (off) {
        lines.push(AI.offTopicReply(off));
      } else if (/mola|stres|yorgun|dinlen|göz/i.test(lower)) {
        lines.push("İyi bir adım. Şimdi 20 saniye gözlerini kapat, 3 yavaş nefes al ve bir bardak su iç.");
        lines.push("Telefon ekranındayken 'Mola başla' butonu sana kısa bir mola ve +5 puan kazandırır.");
      } else if (/plan|hedef|başla|nasıl|ipucu|öner/i.test(lower)) {
        lines.push("Küçük ve esnek başlayalım:");
        lines.push("1) Bugün 3 uygulama için süre sözü ver; ilkini 10 dakika tut.");
        lines.push("2) Her sözden sonra 1 dakikalık nefes molası ver.");
        lines.push("3) En çok aşım yaptığın saati not et; yarın o saatte 3 dakika kısaltmayı dene.");
        lines.push("Dilersen şimdi Telefon sekmesinden ilk sözünü koyalım.");
      } else if (/akşam|gece|kaydır|kayma|döngü|bağımlı|uyku|uyuyam/i.test(lower)) {
        lines.push("Geç saatteki oturumlar genellikle yorgunlukla başlar; otomatik kaydırma fark edilmeden sürer.");
        lines.push("Küçük deney: akşam 21:00'den sonra telefonu başka odaya bırak. İlk denemeyi hangi gün yaparsın?");
      } else if (/motivasyon|isteksiz|heves|sıkıldım|can sıkıntısı|enerji/i.test(lower)) {
        lines.push("Motivasyonun düşük olması çok normal; burada önemli olan kendini zorlamak değil, küçük bir ilk adım.");
        lines.push("Şimdi telefonu üç katmana ayır: olmazsa olmaz (mesaj), keyifli (video), kaçış (feed). Kaçış katmanına bugün 5 dakikalık 'giriş sözü' koy.");
        lines.push("Küçük deney: yarın sabah telefonu 20 dakika dışarıda bırak ve kahvaltıda telefonsuz kal.");
      } else if (/bildirim|sürekli bak|tıklama dürtüsü|telefon elime/i.test(lower)) {
        lines.push("Sürekli bakma dürtüsü, bildirim tasarımının bizi yönlendirmesinden gelir; bu senin disiplin eksikliğin değil.");
        lines.push("Küçük deneyler: 1) Uygulama bildirimlerini toplu sessize al (yalnızca kişisel sohbetleri açık bırak). 2) Telefonu evde sabit bir noktada tut, cebinde değil.");
      } else if (/iş|ders|odak|verim|dikkat|çalışamıyorum/i.test(lower)) {
        lines.push("Odak için en etkili perde, telefonu çalışma alanından uzaklaştırmaktır; görünmeyen telefon, çok daha az özlenir.");
        lines.push("Pomodoro denemesi: 25 dakika söz ver (telefon başka odaya), 5 dakika mola. Üç turda bir bildirimlere bak.");
        lines.push("Bugün ilk turu kaçta başlatacağız?");
      } else if (/alternatif|bahçe|spor|yürüyüş|kitap|dışarı|arkadaş|hobi/i.test(lower)) {
        lines.push("Ekran yerine somut bir alternatif öneriyorum: bugün 10 dakikalık yürüyüş + 1 sayfa kitap.");
        lines.push("Küçük deney: feed yerine radyo/playlist dinle, ellerin meşgulken kaydırma isteği azalır.");
      } else if (/üzgün|kızgı|suçlu|pişman|kötü hisset|mahcup/i.test(lower)) {
        lines.push("Bu hissi adlandırdığın için bunu kutlayalım; suçluluk motivasyon yaratmaz, kalıp fark etmek yaratır.");
        lines.push("Küçük deney: kendine mektup yaz 'yarın tek bir aşımı azaltırsam ne kazanırım?' ve o cümleyi alarm ekranına koy.");
        lines.push("Unutma: burada ne sınav ne ceza var; sadece dikkatle seçilmiş küçük adımlar.");
      } else if (/merhaba|selam|nasılsın|hey\b/i.test(lower)) {
        lines.push("Merhaba! Ben SÖZÜM SÖZ koçunum; ekran alışkanlıklarını birlikte gözden geçirebiliriz.");
        lines.push("Zamanın varsa: son 7 günün özetini çıkarayım mı, yoksa küçük bir hedefle mi başlayalım?");
      } else {
        lines.push("Sana netleştirici bir soru sorayım: Uygulamayı şu an hangi amaçla kullanıyorsun (can sıkıntısı, kaçış, alışkanlık)? Yanıtına göre odağı daraltayım.");
      }
    }
    lines.push("");
    lines.push("Bu bilgi farkındalık amaçlıdır, tıbbi tanı veya tedavi önerisi değildir.");
    return lines.join("\n");
  },

  async chat(cfg, sessions, chatHistory) {
    var agg = AI.aggregate(sessions);
    var context = {
      son7Gun: {
        toplamOturum: agg.total,
        toplamKullanimDk: agg.usedMin,
        tutulanSoz: agg.kept,
        bozulanSoz: agg.brokenExceed + agg.brokenHop,
        enCokKullanilan: agg.topApps.slice(0, 3).map(function (a) { return a.name + " (" + a.used + " dk)"; })
      }
    };
    var messages = [
      { role: "system", content: AI.chatSystem() },
      { role: "system", content: "Kullanıcının anonim veri bağlamı (JSON; kimlik içermez): " + JSON.stringify(context) }
    ];
    chatHistory.slice(-20).forEach(function (m) { messages.push({ role: m.role, content: m.content }); });
    var promptText = messages.map(function (m) { return (m.role === "user" ? "KULLANICI" : m.role === "assistant" ? "KOÇ" : "SİSTEM") + ":\n" + m.content; }).join("\n\n");
    var last = chatHistory[chatHistory.length - 1];
    var lastQ = (last && last.content) || "";
    if (AI.isCrisis(lastQ)) {
      return { text: AI.crisisReply(), source: "guard", prompt: promptText };
    }
    if (AI.isMedical(lastQ)) {
      return { text: AI.medicalReply(), source: "guard", prompt: promptText };
    }
    var offTopic = AI.detectOffTopic(lastQ);
    if (offTopic) {
      return { text: AI.offTopicReply(offTopic), source: "guard", prompt: promptText };
    }
    if (cfg.live && cfg.apiKey) {
      try {
        var text = await AI.requestChat(cfg, messages);
        return { text: text, source: "live", prompt: promptText };
      } catch (err) {
        return { text: AI.fallbackChat(agg, lastQ), source: "live-error", prompt: promptText, error: err.message };
      }
    }
    await new Promise(function (r) { setTimeout(r, 700); });
    return { text: AI.fallbackChat(agg, lastQ), source: "template", prompt: promptText };
  }
};