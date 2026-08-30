// ---------- SÖZÜM SÖZ: çekirdek uygulama mantığı ----------

(function () {
  "use strict";

  var STORE_KEY = "sozumsoz-v1";
  var AI_STAMP = "Bu içerik bir yapay zekâ (YZ) modeli tarafından üretilmiştir. YZ hata yapabilir; çıktı farkındalık amaçlıdır, tıbbi tanı veya tedavi önerisi değildir. Önemli kararlar için bir uzman görüşü (doktor, psikolog) almanız önerilir.";

  // Logo resmi yüklenemezse monograma düş (inline SVG'de pratikte tetiklenmez)
  window.__ssIconFallback = function (img) {
    if (!img) return;
    var mono = document.createElement("span");
    mono.className = "app-icon-fall";
    mono.textContent = img.getAttribute("data-mono") || "";
    try { img.parentNode.replaceChild(mono, img); } catch (e) { img.remove(); }
  };

  var noStorage = false;
  try { localStorage.setItem("__sozumsoz_probe", "1"); localStorage.removeItem("__sozumsoz_probe"); }
  catch (e) { noStorage = true; }

  function getStore() {
    return noStorage ? null : localStorage;
  }
  var HOP_WINDOW_MS = 90 * 1000;
  var REWARD_KEPT = 3;
  var PENALTY = -5;
  var BREAK_SECONDS = 20;

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function nowHM(ts) {
    return new Date(ts || Date.now()).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }

  function appById(id) {
    return APPS.filter(function (a) { return a.id === id; })[0];
  }

  // ---------- durum ----------
  var state = {
    points: 0,
    streak: 0,
    bestStreak: 0,
    kept: 0,
    brokenExceed: 0,
    brokenHop: 0,
    milestones: [],
    history: [],
    today: todayKey(),
    todayKept: 0,
    challengeClaimed: false,
    rewardOrders: [],
    breaksTaken: 0,
    lotteryEnteredMonth: null,
    lastClose: null,
    feed: [],
    ai: { live: false, provider: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", apiKey: "" },
    speedFast: true,
    seenIntro: false,
    weeklyDemo: null,
    chatHistory: [],
    breaksLog: [],
    consent: false,
    challenges: { week: null, joined: [], claimed: [] }
  };

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* boş */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        Object.keys(state).forEach(function (k) {
          if (typeof s[k] !== "undefined") state[k] = s[k];
        });
      }
    } catch (e) { /* boş */ }
    if (!state.ai.provider) state.ai.provider = "openai";
    if (!state.challenges) state.challenges = { week: null, joined: [], claimed: [] };
    if (!state.breaksLog) state.breaksLog = [];
    var tk = todayKey();
    if (state.today !== tk) {
      state.today = tk;
      state.todayKept = 0;
      state.challengeClaimed = false;
    }
  }

  // ---------- yardımcılar ----------
  function $(id) { return document.getElementById(id); }

  var session = null;
  var tickerId = null;
  var bgMode = "session";
  var appBooted = false;

  function fmtDelta(delta) { return (delta >= 0 ? "+" : "") + delta; }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ---------- yazı-yazılma efekti (typewriter) ----------
  function typeText(container, text, done) {
    if (window.__SS_INSTANT) {
      container.textContent = text;
      if (done) done();
      return;
    }
    var i = 0, n = text.length;
    if (!n) { if (done) done(); return; }
    (function tick() {
      i += 1;
      container.textContent = text.slice(0, i);
      if (i < n) { setTimeout(tick, 1); }
      else if (done) { done(); }
    })();
  }

  // ---------- puan uçuş efekti ----------
  function floatPoints(delta) {
    try {
      var anchor = $("hPoints");
      if (!anchor) return;
      var el = document.createElement("span");
      el.className = "float-pts";
      el.textContent = (delta > 0 ? "+" : "") + delta;
      anchor.parentNode.appendChild(el);
      var r = anchor.getBoundingClientRect();
      var rr = anchor.parentNode.getBoundingClientRect();
      el.style.left = (r.left - rr.left + r.width / 2 - 15) + "px";
      el.style.top = (r.top - rr.top) + "px";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
    } catch (e) { /* görsel, hata olursa süreç etkilenmesin */ }
  }

  // ---------- bildirimler ----------
  var NOTIF_ICONS = { info: "💬", warn: "⏰", danger: "🚫", good: "🎉", bg: "📲" };
  if (window.__SS_INSTANT) { window.__ss_notify = function (t, b, k, a) { return notify(t, b, k, a); }; }
  function notify(title, body, kind, actions) {
    var stack = $("notifStack");
    if (!stack) return null;
    var key = title + "|" + body;
    for (var i = stack.children.length - 1; i >= 0; i--) {
      if (stack.children[i].getAttribute("data-key") === key) stack.removeChild(stack.children[i]);
    }
    while (stack.querySelectorAll(".notif:not(.fading)").length >= 3) {
      var oldest = stack.querySelector(".notif:not(.fading)");
      if (!oldest) break;
      stack.removeChild(oldest);
    }
    var el = document.createElement("div");
    el.className = "notif k-" + (kind || "info");
    el.setAttribute("data-key", key);
    el.innerHTML =
      "<div class='n-icon'>" + (NOTIF_ICONS[kind] || "💬") + "</div>" +
      "<div class='n-box'><div class='n-title'>" + title + "</div><div class='n-body'>" + body + "</div></div>";
    if (actions && actions.length) {
      var row = document.createElement("div");
      row.className = "notif-actions";
      actions.forEach(function (a) {
        var b = document.createElement("button");
        b.className = "btn " + (a.cls || "btn-ghost");
        b.textContent = a.label;
        b.addEventListener("click", function () { a.onClick(); });
        row.appendChild(b);
      });
      el.appendChild(row);
    }
    stack.appendChild(el);
    if (state && state.feed) pushFeed(title + " - " + body);
    var life = actions && actions.length ? 30000 : 4500;
    setTimeout(function () {
      el.classList.add("fading");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 520);
    }, life);
    return el;
  }
  function dismissNotif(el) {
    if (!el) return;
    el.classList.add("fading");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }

  // ---------- besleme ----------
  function pushFeed(text) {
    state.feed.unshift({ text: text, ts: Date.now() });
    state.feed = state.feed.slice(0, 30);
    save();
    renderFeed();
  }

  function feedEmoji(text) {
    if (/mola/i.test(text)) return "☕";
    if (/çekiliş/i.test(text)) return "🎟️";
    if (/sipariş|ödül/i.test(text)) return "🏆";
    if (/seri/i.test(text)) return "⚡";
    if (/tuttun|tamamlandı|kazandın/i.test(text)) return "🎉";
    if (/aştın|aşım|geçti/i.test(text)) return "⏰";
    if (/atladın/i.test(text)) return "🚫";
    if (/puan/i.test(text)) return "🌟";
    return "📲";
  }

  function renderFeed() {
    var el = $("phoneFeed");
    if (!el) return;
    if (!state.feed.length) { el.innerHTML = "Henüz aktivite yok."; el.className = "feed muted"; return; }
    el.className = "feed";
    el.innerHTML = state.feed.slice(0, 10).map(function (f) {
      return "<div class='feed-item'><span class='feed-emoji'>" + feedEmoji(f.text) + "</span>" +
        "<span class='feed-text'>" + f.text + "</span>" +
        "<span class='feed-time'>" + nowHM(f.ts) + "</span></div>";
    }).join("");
  }

  // ---------- sekme yönlendirme ----------
  function setTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === name);
    });
    document.querySelectorAll(".tabpanel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + name);
    });
    if (name === "stats") renderStats();
    if (name === "charts") renderCharts();
    if (name === "challenges") renderChallenges();
    if (name === "rewards") renderRewards();
    if (name === "draw") renderDraw();
    if (name === "ai") renderAIStatus();
  }

  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { setTab(t.getAttribute("data-tab")); });
  });

  // ---------- başlık ----------
  var WEEKLY_MOODS = {
    good: { emoji: "😀", label: "iyi" },
    mid: { emoji: "😐", label: "ortalama" },
    bad: { emoji: "🙁", label: "kötü" }
  };

  function weeklyMoodKey() {
    var key = state.weeklyDemo;
    if (!key) {
      var since = Date.now() - 7 * 86400000;
      var kept = 0, broken = 0;
      state.history.forEach(function (h) {
        if (h.ts >= since) {
          if (h.result === "kept") kept++; else broken++;
        }
      });
      if (kept === 0 && broken === 0) key = "mid";
      else if (kept >= 3 && (kept / (kept + broken)) >= 0.8) key = "good";
      else if (kept >= 2 && (kept / (kept + broken)) >= 0.5) key = "mid";
      else key = "bad";
    }
    return key;
  }

  function weeklyMood() {
    return WEEKLY_MOODS[weeklyMoodKey()] || WEEKLY_MOODS.mid;
  }

  function moodFaceSVG(key) {
    var paths = {
      good: "<circle cx='9' cy='9.4' r='1.15'/><circle cx='15' cy='9.4' r='1.15'/><path d='M8 13.8c1.1 1.25 2.6 1.9 4 1.9s2.9-.65 4-1.9'/>",
      mid: "<circle cx='9' cy='9.4' r='1.15'/><circle cx='15' cy='9.4' r='1.15'/><path d='M8.6 15h6.8'/>",
      bad: "<path d='M8.1 8.4c.35-.95 1-1.5 1.7-1.5s1.35.55 1.7 1.5'/><path d='M12.5 8.4c.35-.95 1-1.5 1.7-1.5s1.35.55 1.7 1.5'/><path d='M8 16.6c1.1-1.3 2.6-2 4-2s2.9.7 4 2'/>"
    };
    return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" +
      (paths[key] || paths.mid) + "</svg>";
  }

  function updatePhoneMood() {
    var el = $("phoneMood");
    if (!el) return;
    var okno = weeklyMoodKey();
    el.className = "s-status-mood mood-" + okno;
    el.innerHTML = moodFaceSVG(okno);
  }

  function updateMoodUI() {
    var pill = $("hMood");
    if (pill) pill.textContent = weeklyMood().emoji;
    updatePhoneMood();
    updateBgNotif();
  }

  function updateBgNotif() {
    var e = $("bgNotif");
    if (!e) return;
    var mood = weeklyMood();
    if (bgMode === "soz") {
      e.innerHTML =
        "<div class='n-icon'>📊</div>" +
        "<div class='n-box'><div class='n-title'>SÖZÜM SÖZ açık " + mood.emoji + "</div>" +
        "<div class='n-body'>Bu hafta: " + mood.label + " performans · özet uygulama içinde.</div></div>";
    } else {
      e.innerHTML =
        "<div class='n-icon'>🛡️</div>" +
        "<div class='n-box'><div class='n-title'>SÖZÜM SÖZ arka planda çalışıyor " + mood.emoji + "</div>" +
        "<div class='n-body'>Söz takibi aktif · saat " + nowHM() + "</div></div>";
    }
  }

  function showBgNotif(mode) {
    bgMode = mode || "session";
    if (!$("bgNotif")) {
      var el = document.createElement("div");
      el.id = "bgNotif";
      el.className = "notif k-bg";
      $("notifStack").appendChild(el);
    }
    updateBgNotif();
  }

  function hideBgNotif() {
    var e = $("bgNotif");
    if (e && e.parentNode) e.parentNode.removeChild(e);
  }

  function renderHeader() {
    $("hPoints").textContent = state.points;
    $("hStreak").textContent = state.streak;
    updateMoodUI();
  }

  // ---------- TELEFON: ana ekran ----------
  function renderHome() {
    var screen = $("phoneScreen");
    var now = new Date();
    var hour = now.getHours();
    var selam = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
    var html =
      "<div class='s-home'>" +
      "<div class='s-statusbar'><span class='s-status-left'>" +
      "<span class='s-status-mood mood-" + weeklyMoodKey() + "' id='phoneMood'>" + moodFaceSVG(weeklyMoodKey()) + "</span>" +
      nowHM() + "</span><span>🔋</span></div>" +
      "<div class='s-top-row'>" +
      "<div class='s-greet'><h1>" + selam + " 👋</h1>" +
      "<p class='s-sub'>Bugün " + state.todayKept + " sözün tutuldu. Hangi uygulamayı açıyorsun?</p></div>" +
      "<div class='s-score'>" +
      "<div class='s-score-label'>PUAN</div><div class='s-score-val'>" + state.points + "</div>" +
      "</div></div>" +
      "<div class='app-grid'>" +
      "<div class='app-tile' data-app='sozumsoz' style='animation-delay:60ms'>" +
      "<div class='app-icon soz-icon'>" +
      "<img class='app-icon-img' src='" + SOZ_LOGO + "' alt='' data-mono='SS' onerror='window.__ssIconFallback(this)'>" +
      "</div>" +
      "<div class='app-name'>SÖZÜM SÖZ</div>" +
      "</div>" +
      APPS.map(function (a, i) {
        return "<div class='app-tile' data-app='" + a.id + "' style='animation-delay:" + (130 + i * 45) + "ms'>" +
          appIconHTML(a) +
          "<div class='app-name'>" + a.name + "</div>" +
          "</div>";
      }).join("") +
      "</div></div>";
    screen.innerHTML = html;
    screen.querySelectorAll(".app-tile").forEach(function (t) {
      t.addEventListener("click", function () { onTileClick(t.getAttribute("data-app")); });
    });
  }

  function onTileClick(appId) {
    if (appId === "sozumsoz") {
      if (state.consent) { openSozumsozApp(); return; }
      openSozumsozConsent();
      return;
    }
    var app = appById(appId);
    if (!app) return;
    openPromiseDialog(app);
  }

  // ---------- TELEFON: SÖZÜM SÖZ uygulaması içi ----------
  function topAppName7() {
    var since = Date.now() - 7 * 86400000;
    var sums = {}, best = null;
    state.history.forEach(function (h) {
      if (h.ts >= since) sums[h.appName] = (sums[h.appName] || 0) + h.usedMin;
    });
    Object.keys(sums).forEach(function (k) {
      if (!best || sums[k] > best.min) best = { name: k, min: sums[k] };
    });
    return best;
  }

  function sozMenuRow(label, tab) {
    return "<div class='soz-row' data-soztab='" + tab + "'><span>" + label + "</span><span class='chev'>&rsaquo;</span></div>";
  }

  function openSozumsozConsent(cb) {
    showBgNotif("soz");
    $("phoneScreen").innerHTML =
      "<div class='s-consent anim-pop'>" +
      "<div class='brand'><span class='brand-mark'><img class='brand-mark-img' src='" + SOZ_LOGO + "' alt='SÖZÜM SÖZ'></span><span class='brand-name'>SÖZÜM <b>SÖZ</b></span></div>" +
      "<h2>Bilgilendirme ve Açık Rıza</h2>" +
      "<div class='consent-body'>" +
      "<h4>1. Veri Sorumlusu ve Kapsam</h4>" +
      "<p>Bu uygulama (SÖZÜM SÖZ) bir hackathon prototipidir ve 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) madde 10 uyarınca, uygulamanın geliştiricisi veri sorumlusu sıfatıyla aşağıdaki şekilde aydınlatma yapmaktadır.</p>" +
      "<h4>2. İşlenen Kişisel Veriler</h4>" +
      "<ul>" +
      "<li><b>Süre sözü kayıtları:</b> uygulama adı, kategori, hedeflenen ve gerçekleşen süre.</li>" +
      "<li><b>Etkileşim istatistikleri:</b> puan, seri, mola sayısı, görev katılımı.</li>" +
      "<li><b>Sohbet geçmişi:</b> YZ koç sohbetindeki mesajların tamamı.</li>" +
      "<li><b>Cihaz ayarları:</b> seçili YZ sağlayıcı, model ve (isterseniz) API anahtarı.</li>" +
      "</ul>" +
      "<h4>3. İşleme Amaçları</h4>" +
      "<ul>" +
      "<li>Dijital iyi olma hâlinin izlenmesi ve kişisel raporlama.</li>" +
      "<li>Söz/puan/seri/ödül motivasyon sisteminin çalıştırılması.</li>" +
      "<li>İsteğe bağlı YZ koç sohbeti ile yansıma desteği.</li>" +
      "</ul>" +
      "<h4>4. Hukuki Sebep ve Aktarım</h4>" +
      "<ul>" +
      "<li>KVKK m.5: veri sahibinin <b>açık rızası</b> (bu ekranda verdiğiniz onay) ve meşru menfaat.</li>" +
      "<li>KVKK m.8-9: yurt dışı aktarım yalnızca canlı YZ açıkken ve seçtiğiniz sağlayıcıya yapılır; aksi hâlde verileriniz hiçbir sunucuya otomatik gönderilmez.</li>" +
      "</ul>" +
      "<p>Verileriniz yalnızca bu cihazın tarayıcı hafızasında (localStorage) saklanır. Canlı YZ'yi Ayarlar'dan açıp anahtar girmediğiniz sürece cihazdan dışarı çıkmaz. Canlı YZ açılırsa yalnızca anonim oturum özeti ve sohbetin son mesajları seçtiğiniz sağlayıcıya (OpenAI/Gemini) gönderilir; ad, fotoğraf ve iletişim bilgisi asla toplanmaz.</p>" +
      "<h4>5. Saklama Süresi</h4>" +
      "<p>Verileriniz, uygulamayı kullandığınız süre boyunca cihazda saklanır. 'Verilerimi sil' işlemiyle veya tarayıcı verileri temizlendiğinde kalıcı olarak silinir.</p>" +
      "<h4>6. Veri Sahibinin Hakları (KVKK m.11)</h4>" +
      "<ul>" +
      "<li>Verilerinizin işlenip işlenmediğini öğrenme,</li>" +
      "<li>İşlenmişse bilgi talep etme,</li>" +
      "<li>İşleme amacını ve amaca uygun kullanımı öğrenme,</li>" +
      "<li>Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme,</li>" +
      "<li>Verilerin silinmesini veya yok edilmesini isteme,</li>" +
      "<li>Değişiklik ve silme işlemlerinin aktarıldığı kişilere bildirilmesini isteme,</li>" +
      "<li>Otomatik işlemeye itiraz etme ve uğranılan zararın giderilmesini talep etme.</li>" +
      "</ul>" +
      "<p class='small'>Bu haklarınızı uygulama içindeki <b>Ayarlar → Verilerimi indir / Verilerimi sil / Rızayı geri al</b> seçenekleriyle veya tarayıcının gizlilik araçlarıyla doğrudan kullanabilirsiniz.</p>" +
      "<h4>7. Açık Rıza</h4>" +
      "<p class='muted small'>Yukarıdaki aydınlatma metnini okudum; verilerimin belirtilen amaçlarla işlenmesine, gerektiğinde sohbet mesajlarımın seçtiğim YZ sağlayıcısına iletilmesine ve bu kapsamda kişisel verilerimin işlenmesine <b>açık rıza</b> veriyorum. Rızamı istediğim an geri alabilirim (Ayarlar → Rızayı geri al).</p>" +
      "</div>" +
      "<button class='btn btn-primary btn-lg' id='consentYes'>Kabul ediyorum, uygulamayı aç</button>" +
      "<button class='btn btn-ghost btn-lg' id='consentNo'>Kabul etmiyorum</button>" +
      "</div>";
    $("consentYes").addEventListener("click", function () {
      state.consent = true;
      save();
      renderSozumsozApp();
    });
    $("consentNo").addEventListener("click", function () {
      hideBgNotif();
      $("phoneScreen").innerHTML =
        "<div class='s-consent'>" +
        "<div class='brand'><span class='brand-mark'><img class='brand-mark-img' src='" + SOZ_LOGO + "' alt='SÖZÜM SÖZ'></span><span class='brand-name'>SÖZÜM <b>SÖZ</b></span></div>" +
        "<h2>Uygulama kullanılamıyor</h2>" +
        "<p>Bilgilendirmeyi kabul etmediğin için SÖZÜM SÖZ uygulaması açılmadı. Hiçbir verin toplanmaz, saklanmaz ve işlenmez.</p>" +
        "<p class='muted small'>İstersen bilgilendirmeyi tekrar okuyup kararını değiştirebilirsin.</p>" +
        "<button class='btn btn-primary btn-lg' id='consentBack'>Bilgilendirmeyi tekrar oku</button>" +
        "<button class='btn btn-ghost btn-lg' id='consentExit'>Ana ekrana dön</button>" +
        "</div>";
      $("consentBack").addEventListener("click", function () { openSozumsozConsent(); });
      $("consentExit").addEventListener("click", renderHome);
    });
  }

  function openSozumsozApp() {
    if (!state.consent) { openSozumsozConsent(); return; }
    renderSozumsozApp();
  }

  function renderSozumsozApp() {
    var mood = weeklyMood();
    var top = topAppName7();
    $("phoneScreen").innerHTML =
      "<div class='s-soz'>" +
      "<div class='soz-header'>" +
      "<span class='soz-title'>SÖZÜM SÖZ</span>" +
      "<span class='soz-mood'>Bu hafta " + mood.emoji + " " + mood.label + "</span>" +
      "</div>" +
      "<div class='soz-stats'>" +
      "<div class='soz-stat'><b>" + state.points + "</b><span>Puan</span></div>" +
      "<div class='soz-stat'><b>" + state.streak + "</b><span>Seri</span></div>" +
      "<div class='soz-stat'><b>" + state.todayKept + "</b><span>Bugün tutulan</span></div>" +
      "</div>" +
      "<div class='soz-top'>" + (top
        ? "Son 7 günde en çok kullandığın: <b>" + top.name + "</b> (" + top.min + " dk)"
        : "Henüz veri yok. " + state.points + " puanınla başlamak için bir söz ver.") + "</div>" +
      "<div class='soz-menu'>" +
      sozMenuRow("Durum", "stats") +
      sozMenuRow("Grafikler", "charts") +
      sozMenuRow("Ödül Kataloğu", "rewards") +
      sozMenuRow("Aylık Çekiliş", "draw") +
      sozMenuRow("Yansıma (YZ)", "ai") +
      "</div>" +
      "<button class='btn btn-ghost btn-lg' id='sozBack'>Geri dön</button>" +
      "</div>";
    $("sozBack").addEventListener("click", function () { hideBgNotif(); renderHome(); });
    $("phoneScreen").querySelectorAll("[data-soztab]").forEach(function (row) {
      row.addEventListener("click", function () { setTab(row.getAttribute("data-soztab")); });
    });
    showBgNotif("soz");
  }

  // ---------- TELEFON: süre sözü diyaloğu (telefon içi alt sayfa) ----------
  function openPromiseDialog(app) {
    var chosen = null;
    var opts = TIME_OPTIONS.map(function (m) {
      return "<button class='time-btn dur-chip' data-min='" + m + "'>" + m + "<span>dk</span></button>";
    }).join("");
    var sc = $("phoneScreen");
    sc.innerHTML =
      "<div class='s-sheet-backdrop' id='promiseScrim'></div>" +
      "<div class='s-sheet'>" +
      "<div class='sheet-grab'></div>" +
      "<div class='sheet-head'>" +
      appIconHTML(app, "sheet-appicon") +
      "<div class='sheet-meta'><div class='sheet-apptitle'>" + app.name + "</div>" +
      "<span class='sheet-cat'>" + CATEGORY_LABELS[app.category] + "</span></div>" +
      "</div>" +
      "<div class='sheet-q'>Kaç dakikaya <b>söz veriyorsun?</b></div>" +
      "<div class='dur-chips' id='durChips'>" + opts + "</div>" +
      "<div class='dur-custom'>" +
      "<input type='number' id='customMin' min='1' max='240' placeholder='Özel süre (dk)'>" +
      "<button class='dur-dice' id='durSuggest' title='Rastgele süre öner'>🎲</button>" +
      "</div>" +
      "<div class='sheet-reward'><span>Sözünü tutarsan <b class='p-plus'>+3 puan</b></span><span>Aşarsan <b class='p-minus'>−5 puan</b></span></div>" +
      "<button class='btn btn-primary btn-lg btn-glow' id='promiseOk' disabled>Söz ver</button>" +
      "<button class='sheet-link' id='promiseNo'>Vazgeç</button>" +
      "</div>";
    var ok = $("promiseOk");
    var custom = $("customMin");
    var dice = $("durSuggest");
    var btnPromise = function (min) {
      chosen = min;
      document.querySelectorAll(".dur-chip").forEach(function (b) {
        b.classList.toggle("sel", parseInt(b.getAttribute("data-min"), 10) === min);
      });
      if (ok) { ok.textContent = "Söz ver (" + min + " dk)"; ok.disabled = false; }
    };
    document.querySelectorAll(".dur-chip").forEach(function (b) {
      b.addEventListener("click", function () { btnPromise(parseInt(b.getAttribute("data-min"), 10)); });
    });
    custom.addEventListener("input", function () {
      var v = parseInt(custom.value, 10);
      if (v >= 1 && v <= 240) btnPromise(v);
    });
    dice.addEventListener("click", function () {
      var v = 2 + Math.floor(Math.random() * 9);
      custom.value = v;
      btnPromise(v);
    });
    ok.addEventListener("click", function () {
      if (chosen) { renderHome(); enterApp(app, chosen); }
    });
    $("promiseNo").addEventListener("click", renderHome);
    $("promiseScrim").addEventListener("click", renderHome);
  }

  // ---------- uygulama içine girme ----------
  function enterApp(app, minutes) {
    checkHopGuard(app);
    session = {
      appId: app.id,
      appName: app.name,
      category: app.category,
      promisedMin: minutes,
      startedAt: Date.now(),
      elapsedSec: 0,
      usedMin: 0,
      overshootNotified: false
    };
    renderAppScreen();
    showBgNotif();
    if (tickerId) clearInterval(tickerId);
    tickerId = setInterval(tick, 1000);
  }

  function checkHopGuard(app) {
    var last = state.lastClose;
    if (!last) return;
    var withinWindow = (Date.now() - last.ts) <= HOP_WINDOW_MS;
    if (last.result === "broken_exceed") {
      notify("Biraz mola ver", "Aşım ile kapattığın oturumun ardından yeni bir uygulama açtın. Ekran dışında birkaç dakika kal.", "warn");
      state.lastClose = { ts: Date.now(), result: "broken_exceed" };
      save();
      return;
    }
    if (last.result === "kept" && withinWindow) {
      recordResult("broken_hop", PENALTY, {
        appId: app.id, appName: app.name, category: app.category, promisedMin: 1, usedMin: 1
      });
      notify("Uygulama atlama", app.name + " uygulamasına kapatır kapatmaz girdin. Uygulama atlamak sözünü bozar; puanın düştü.", "danger");
      requestCoach("hop", { appName: app.name, category: app.category, promisedMin: 0, overMin: 0 });
      state.lastClose = { ts: Date.now(), result: "broken_hop" };
      save();
      renderHeader();
      renderStats();
    }
  }

  // ---------- YZ koçu: dinamik bildirim + mola ----------
  function requestCoach(type, extra) {
    var s = session;
    var opts = {
      type: type,
      appName: s ? s.appName : (extra && extra.appName) || "",
      category: s ? s.category : (extra && extra.category) || "",
      promisedMin: s ? s.promisedMin : 0,
      overMin: (s && s.usedMin > s.promisedMin) ? (s.usedMin - s.promisedMin) : 0,
      hour: new Date().getHours(),
      streak: state.streak
    };
    AI.generateCoach(opts, state.ai).then(function (res) {
      var m = res.msg;
      var el = notify(m.title, m.body + " " + m.breakOffer + " (YZ üretimi)", type === "overshoot" ? "warn" : "danger", [
        {
          label: "Mola başla (+" + m.points + " puan)",
          cls: "btn-success",
          onClick: function () { dismissNotif(el); startMicroBreak(m.points, m.breakOffer); }
        },
        {
          label: "Şimdi değil",
          cls: "btn-ghost",
          onClick: function () { dismissNotif(el); }
        }
      ]);
    }).catch(function (err) {
      notify("Bildirim üretilemedi", err.message, "info");
    });
  }

  // ---------- mikromola ----------
  function startMicroBreak(points, offerText) {
    if (!session) {
      notify("Mola", "Oturum kapalı olduğu için mola önerisi iptal edildi; bir sonraki oturumda kullanılabilir.", "info");
      return;
    }
    var sc = $("phoneScreen");
    var end = Date.now() + BREAK_SECONDS * 1000;
    sc.innerHTML =
      "<div class='s-break'>" +
      "<div class='bk-ring'><div class='bk-count' id='breakCount'>" + BREAK_SECONDS + "</div></div>" +
      "<div class='bk-text'>" + offerText + "</div>" +
      "<div class='bk-hint'>Mola bitiminde +" + points + " puan kazanırsın.</div>" +
      "<div class='row'><button class='btn btn-warn' id='bkCancel'>Mola değil</button></div>" +
      "</div>";
    $("bkCancel").addEventListener("click", function () { clearInterval(bkTimer); renderAppScreen(); });
    var bkTimer = setInterval(function () {
      var left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      var c = $("breakCount");
      if (c) c.textContent = left;
      if (left <= 0) {
        clearInterval(bkTimer);
        finishMicroBreak(points);
      }
    }, 250);
  }

  function finishMicroBreak(points) {
    state.points += points;
    floatPoints(points);
    state.breaksTaken++;
    state.breaksLog.push({ ts: Date.now() });
    state.breaksLog = state.breaksLog.slice(-60);
    pushFeed("Molayı tamamladın: +" + points + " puan");
    notify("Mola tamamlandı", "+" + points + " puan kazandın 🎉", "good");
    save();
    renderHeader();
    if (session) renderAppScreen(); else renderHome();
    renderStats();
  }

  // ---------- süre sayacı ----------
  function tick() {
    if (!session) return;
    session.elapsedSec += 1;
    var speed = state.speedFast ? 1 : 1 / 60;
    session.usedMin = Math.floor(session.elapsedSec * speed + 1e-9);
    if (!session.overshootNotified && session.usedMin > session.promisedMin) {
      session.overshootNotified = true;
      requestCoach("overshoot");
    }
    renderAppTicker();
  }

  function renderAppTicker() {
    var el = $("appTimerCard");
    if (!el || !session) return;
    var over = session.usedMin > session.promisedMin;
    var remain = Math.max(0, session.promisedMin - session.usedMin);
    var pct = Math.min(100, Math.round(session.usedMin / session.promisedMin * 100));
    el.className = "timer-card" + (over ? " over" : "");
    el.innerHTML =
      "<div class='timer-row'>" +
      "<div class='timer-ring' style='--p:" + pct + "%'>" +
      "<div class='timer-ring-in'>" +
      "<div class='timer-num'>" + (over ? "+" + (session.usedMin - session.promisedMin) : remain) + "</div>" +
      "<div class='timer-num-label'>" + (over ? "dk aşım" : "dk kaldı") + "</div>" +
      "</div></div>" +
      "<div class='timer-info'>" +
      "<div class='timer-info-row'><span>Söz</span><b>" + session.promisedMin + " dk</b></div>" +
      "<div class='timer-info-row'><span>Kullanılan</span><b>" + session.usedMin + " dk</b></div>" +
      "<div class='timer-tip'>Sözünü tutarsan <b>+3 puan</b></div>" +
      "</div></div>";
    if (over && !$("overBanner")) {
      var sc = $("phoneScreen");
      var feed = sc.querySelector(".mock-feed");
      if (feed) {
        var b = document.createElement("div");
        b.id = "overBanner";
        b.className = "over-banner";
        b.innerHTML = "⏰ Süren aşıldı — ekranı kapatıp kısa bir mola ver";
        feed.insertBefore(b, feed.firstChild);
      }
    }
  }

  // ---------- uygulama ekranı ----------
  function renderAppScreen() {
    var sc = $("phoneScreen");
    var app = appById(session.appId);
    var glyphs = CATEGORY_GLYPHS[app.category] || ["✨", "💬", "🚀"];
    var feed = "";
    for (var i = 0; i < 3; i++) {
      feed +=
        "<div class='post-card'>" +
        "<div class='post-head'><span class='post-ava' style='background:linear-gradient(135deg," + app.color + ",#0f172a)'>" + app.monogram + "</span>" +
        "<div class='post-id'><div class='post-user'>" + app.name + "</div><div class='post-time'>1 saniye önce · sponsorlu</div></div>" +
        "<span class='post-more'>•••</span></div>" +
        "<div class='post-media' style='background:linear-gradient(135deg," + MOCK_MEDIA[(i * 3) % MOCK_MEDIA.length] + ",#0f172a)'>" + glyphs[i] + "</div>" +
        "<div class='post-actions'><span>♥ " + (128 + i * 97) + "</span><span>💬 " + (23 + i * 18) + "</span><span>↗ " + (34 + i * 21) + "</span></div>" +
        "</div>";
    }
    sc.innerHTML =
      "<div class='s-app'>" +
      "<div class='appbar'>" +
      "<button class='appbar-back' id='appBackBtn'>‹</button>" +
      appIconHTML(app, "appbar-icon") +
      "<div class='appbar-mid'><div class='appbar-name'>" + app.name + "</div><div class='appbar-cat'>" + CATEGORY_LABELS[app.category] + "</div></div>" +
      "<span class='appbar-badge'>SÖZ aktif</span>" +
      "</div>" +
      "<div id='appTimerCard' class='timer-card'></div>" +
      "<div class='mock-feed'>" + feed + "</div>" +
      "<div class='app-actions'>" +
      "<button class='btn btn-success btn-lg btn-glow' id='btnKeep'>Sözümü tut ve kapat</button>" +
      "<button class='btn btn-ghost btn-lg' id='btnSwitch'>Başka uygulamaya geç</button>" +
      "</div></div>";
    $("appBackBtn").addEventListener("click", function () { finishSession(false); });
    $("btnKeep").addEventListener("click", function () { finishSession(false); });
    $("btnSwitch").addEventListener("click", function () {
      if (session && session.usedMin > session.promisedMin) {
        notify("Süre aşımı", "Süreni aştın; oturum bozulan olarak kapanıyor ve puanın düşüyor.", "danger");
        finishSession(false);
      } else {
        notify("Uygulama atlama", "Başka uygulamaya geçiş sözünü bozar; puanın düşer.", "warn");
        finishSession(true);
      }
    });
    renderAppTicker();
  }

  // ---------- oturum bitişi ----------
  function finishSession(hopFlag) {
    if (!session) return;
    var s = session;
    session = null;
    if (tickerId) { clearInterval(tickerId); tickerId = null; }
    var result = hopFlag ? "broken_hop"
      : (s.usedMin > s.promisedMin ? "broken_exceed" : "kept");
    var delta = result === "kept" ? REWARD_KEPT : PENALTY;
    recordResult(result, delta, s);
    state.lastClose = { ts: Date.now(), result: result };
    save();
    renderHome();
    hideBgNotif();
    renderHeader();
    renderStats();
  }

  function recordResult(result, delta, info) {
    var usedMin = info.usedMin || 0;
    var promisedMin = info.promisedMin || 0;
    var entry = {
      ts: Date.now(),
      appId: info.appId,
      appName: info.appName,
      category: info.category,
      promisedMin: promisedMin,
      usedMin: usedMin,
      result: result,
      delta: delta
    };
    state.history.unshift(entry);
    state.history = state.history.slice(0, 120);
    state.points = Math.max(0, state.points + delta);
    if (delta !== 0) floatPoints(delta);

    if (result === "kept") {
      state.kept++;
      state.todayKept++;
      state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      if (MILESTONES[state.streak] && state.milestones.indexOf(state.streak) === -1) {
        state.milestones.push(state.streak);
        state.points += MILESTONES[state.streak];
        floatPoints(MILESTONES[state.streak]);
        notify("Seri bonusu", "" + state.streak + ". sözünü üst üste tuttun! +" + MILESTONES[state.streak] + " puan bonus 🎉", "good");
        pushFeed("Seri bonusu: " + state.streak + " arka arkaya söz tutma, +" + MILESTONES[state.streak] + " puan");
      }
      if (state.todayKept >= DAILY_CHALLENGE.target && !state.challengeClaimed) {
        notify("Günün sözü tamam", "Bugün " + DAILY_CHALLENGE.target + " sözünü tuttun; Durum sekmesinden ekstra +" + DAILY_CHALLENGE.reward + " puan al 👏", "good");
      }
    } else {
      state.streak = 0;
      if (result === "broken_exceed") state.brokenExceed++;
      else state.brokenHop++;
    }
    pushFeed((delta >= 0 ? "+" : "") + delta + " puan | " + (result === "kept" ? "sözünü tuttun" : result === "broken_exceed" ? "sözünü aştın" : "uygulama atladın") + " (" + info.appName + ")");
  }

  // ---------- DURUM sekmesi ----------
  function sessionsSince(days) {
    var cutoff = Date.now() - days * 86400000;
    return state.history.filter(function (h) { return h.ts >= cutoff; });
  }

  function renderStats() {
    var cards = $("statCards");
    var todaySessions = sessionsSince(1).filter(function (h) { return dailyOf(h.ts) === todayKey(); });
    var todayMin = todaySessions.reduce(function (a, h) { return a + h.usedMin; }, 0);
    var stat = [
      { label: "Puanın", value: state.points, cls: "s-ok" },
      { label: "Şu anki seri", value: state.streak + " söz", cls: "s-amber" },
      { label: "En iyi seri", value: state.bestStreak + " söz", cls: "" },
      { label: "Tutulan söz", value: state.kept, cls: "s-ok" },
      { label: "Bozulan (aşım)", value: state.brokenExceed, cls: "s-bad" },
      { label: "Bozulan (atlama)", value: state.brokenHop, cls: "s-bad" },
      { label: "Tamamlanan mola", value: state.breaksTaken || 0, cls: "s-ok" },
      { label: "Bugünkü kullanım", value: todayMin + " dk", cls: "" }
    ];
    cards.innerHTML = stat.map(function (s) {
      return "<div class='stat-card " + s.cls + "'><div class='stat-label'>" + s.label + "</div><div class='stat-value'>" + s.value + "</div></div>";
    }).join("");

    var last7 = sessionsSince(7);
    var cat = {};
    last7.forEach(function (h) { cat[h.category] = (cat[h.category] || 0) + h.usedMin; });
    var sorted = Object.keys(cat).map(function (k) { return { name: CATEGORY_LABELS[k] || k, min: cat[k] }; })
      .sort(function (a, b) { return b.min - a.min; });
    var maxMin = sorted.length ? sorted[0].min : 0;
    var barsEl = $("categoryBars");
    if (!sorted.length) {
      barsEl.innerHTML = "<div class='muted'>Henüz veri yok.</div>";
    } else {
      barsEl.innerHTML = sorted.map(function (c) {
        var w = maxMin ? Math.round(c.min / maxMin * 100) : 0;
        return "<div class='cat-bar-row'><span class='cat-bar-label'>" + c.name + "</span>" +
          "<div class='cat-bar-track'><div class='cat-bar-fill' style='width:" + w + "%'></div></div>" +
          "<span class='cat-bar-min'>" + c.min + " dk</span></div>";
      }).join("");
    }

    renderChallenge();
    renderCharts();
  }

  function dailyOf(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function renderChallenge() {
    var el = $("challengeCard");
    var prog = Math.min(state.todayKept, DAILY_CHALLENGE.target);
    var done = state.todayKept >= DAILY_CHALLENGE.target;
    var html =
      "<h3>" + DAILY_CHALLENGE.title + "</h3>" +
      "<p>" + DAILY_CHALLENGE.text + "</p>" +
      "<div class='challenge-box'><div class='challenge-progress'>" +
      "<div class='cnt'>" + prog + " / " + DAILY_CHALLENGE.target + " söz tutuldu</div>" +
      "<div class='progress'><div style='width:" + Math.round(prog / DAILY_CHALLENGE.target * 100) + "%'></div></div>" +
      "</div>";
    if (done) {
      html += state.challengeClaimed
        ? "<button class='btn' disabled>Ödül alındı (+" + DAILY_CHALLENGE.reward + ")</button>"
        : "<button class='btn btn-primary' id='btnClaim'>Ödülü al (+" + DAILY_CHALLENGE.reward + " puan)</button>";
    }
    html += "</div>";
    el.innerHTML = html;
    if (done && !state.challengeClaimed) {
      $("btnClaim").addEventListener("click", function () {
        state.challengeClaimed = true;
        state.points += DAILY_CHALLENGE.reward;
        pushFeed("Günün sözü ödülü: +" + DAILY_CHALLENGE.reward + " puan");
        notify("Ödül eklendi", "Günün sözü ödülü +" + DAILY_CHALLENGE.reward + " puan hesabına eklendi.", "good");
        save();
        renderHeader();
        renderStats();
      });
    }
  }

  // ---------- HAFTALIK GÖREVLER ----------
  function ensureWeeklyChallenges() {
    if (!state.challenges) state.challenges = { week: null, joined: [], claimed: [] };
    var wk = weekIdx(Date.now());
    if (state.challenges.week !== wk) {
      state.challenges = { week: wk, joined: [], claimed: [] };
    }
  }

  function challengeCurrent(c) {
    var since = Date.now() - 7 * 86400000;
    var h7 = state.history.filter(function (h) { return h.ts >= since; });
    switch (c.metric) {
      case "weeklyMin":
        return h7.reduce(function (a, h) { return a + h.usedMin; }, 0);
      case "keptCount":
        return h7.filter(function (h) { return h.result === "kept"; }).length;
      case "breaks":
        return state.breaksLog.filter(function (b) { return b.ts >= since; }).length;
      case "distinctApps": {
        var set = {};
        h7.forEach(function (h) { set[h.appId] = 1; });
        return Object.keys(set).length;
      }
      case "overshootCount":
        return h7.filter(function (h) { return h.result === "broken_exceed"; }).length;
    }
    return 0;
  }

  function challengeMet(c, cur, hasData) {
    if (c.direction === "less") return hasData && cur < c.target;
    return cur >= c.target;
  }

  function renderChallenges() {
    var el = $("challengeList");
    if (!el) return;
    ensureWeeklyChallenges();
    var joined = state.challenges.joined;
    var claimed = state.challenges.claimed;
    var has7 = state.history.some(function (h) { return (Date.now() - h.ts) <= 7 * 86400000; });
    el.innerHTML = CHALLENGES.map(function (c) {
      var cur = challengeCurrent(c);
      var met = challengeMet(c, cur, has7);
      var isJ = joined.indexOf(c.id) !== -1;
      var isC = claimed.indexOf(c.id) !== -1;
      var barPct = Math.min(100, Math.round(Math.min(cur, c.target) / c.target * 100));
      var stateTxt, btn;
      if (isC) {
        stateTxt = "Tamamlandı ✓";
        btn = "<button class='btn' disabled>Ödül alındı (+" + c.reward + " puan)</button>";
      } else if (!isJ) {
        stateTxt = c.direction === "less"
          ? "Şu an: " + cur + " " + c.unit + " (hedef: < " + c.target + " " + c.unit + ")"
          : "Şu an: " + cur + " / " + c.target + " " + c.unit;
        btn = "<button class='btn btn-primary' data-join='" + c.id + "'>Göreve katıl</button>";
      } else if (met) {
        stateTxt = "Şart sağlandı!";
        btn = "<button class='btn btn-success' data-claim='" + c.id + "'>Ödülü al (+" + c.reward + " puan)</button>";
      } else {
        stateTxt = c.direction === "less"
          ? "İlerleme: " + cur + " " + c.unit + " (hedef < " + c.target + ")"
          : "İlerleme: " + cur + " / " + c.target + " " + c.unit;
        btn = "<button class='btn' disabled>Katıldın</button>";
      }
      return "<div class='ch-card'>" +
        "<div class='ch-head'><div class='ch-title'>" + c.title + "</div><div class='ch-reward'>+" + c.reward + " puan</div></div>" +
        "<p class='ch-text'>" + c.text + "</p>" +
        "<div class='ch-progress'><div class='ch-bar'><div style='width:" + barPct + "%'></div></div></div>" +
        "<div class='ch-cur'>" + stateTxt + "</div>" +
        "<div class='ch-action'>" + btn + "</div>" +
        "</div>";
    }).join("");

    el.querySelectorAll("[data-join]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.challenges.joined.push(b.getAttribute("data-join"));
        save();
        renderChallenges();
      });
    });
    el.querySelectorAll("[data-claim]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = CHALLENGES.filter(function (x) { return x.id === b.getAttribute("data-claim"); })[0];
        if (!c) return;
        state.challenges.joined = state.challenges.joined.filter(function (x) { return x !== c.id; });
        state.challenges.claimed.push(c.id);
        state.points += c.reward;
        pushFeed("Haftalık görev tamamlandı: " + c.title + " · +" + c.reward + " puan");
        notify("Görev tamamlandı", c.title + " +" + c.reward + " puan hesabına eklendi.", "good");
        save();
        renderHeader();
        renderStats();
        renderChallenges();
      });
    });
  }

  // ---------- GRAFİKLER sekmesi ----------
  var DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  var CATEGORY_COLORS = { social: "#e1306c", video: "#dc2626", messaging: "#16a34a", streaming: "#b91c1c", gaming: "#7c3aed", music: "#15803d", news: "#ea580c" };

  function minOnDayKey(key) {
    var m = 0;
    state.history.forEach(function (h) { if (dailyOf(h.ts) === key) m += h.usedMin; });
    return m;
  }

  function dayKeyOffset(offset) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return dailyOf(d.getTime());
  }

  function pctOf(v, max) { return max > 0 ? Math.round(v / max * 100) : 0; }

  function weekIdx(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    var dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return Math.floor(d.getTime() / (7 * 86400000));
  }

  function renderCharts() {
    renderTodayCompare();
    renderLast7Days();
    renderLast4Weeks();
    renderCategoryDonut();
    renderTopApps();
  }

  function renderTodayCompare() {
    var el = $("chartTodayVsWeek");
    if (!el) return;
    var todayMin = minOnDayKey(todayKey());
    var lastMin = minOnDayKey(dayKeyOffset(-7));
    var maxVal = Math.max(todayMin, lastMin, 1);
    var todayName = DAY_NAMES[new Date().getDay()];
    var lastName = DAY_NAMES[new Date(Date.now() - 7 * 86400000).getDay()];
    var todayH = todayMin > 0 ? Math.max(8, Math.round(todayMin / maxVal * 110)) : 0;
    var lastH = lastMin > 0 ? Math.max(8, Math.round(lastMin / maxVal * 110)) : 0;
    var dif = todayMin - lastMin;
    var diffTxt =
      dif === 0
        ? "Geçen haftanın aynı günüyle aynı kullanım süren var (" + todayMin + " dk)."
        : dif > 0
          ? "Bugün, geçen hafta aynı güne göre " + dif + " dk daha çok zaman harcadın."
          : "Bugün, geçen hafta aynı güne göre " + (-dif) + " dk daha az zaman harcadın.";
    el.innerHTML =
      "<h3>Bugün vs geçen haftanın aynı günü</h3>" +
      "<div class='cmp'>" +
      "<div class='cmp-col'><div class='cmp-label'>Bugün · " + todayName + "</div>" +
      "<div class='cmp-track'><div class='cmp-bar' style='height:" + todayH + "px'></div></div>" +
      "<div class='cmp-value'>" + todayMin + " dk</div></div>" +
      "<div class='cmp-col'><div class='cmp-label'>Geçen hafta · " + lastName + "</div>" +
      "<div class='cmp-track'><div class='cmp-bar mut' style='height:" + lastH + "px'></div></div>" +
      "<div class='cmp-value'>" + lastMin + " dk</div></div>" +
      "</div>" +
      "<div class='cmp-diff'>" + diffTxt + "</div>";
  }

  function renderLast7Days() {
    var el = $("chartLast7");
    if (!el) return;
    var maxMin = 1, days = [];
    for (var i = -6; i <= 0; i++) {
      var k = dayKeyOffset(i);
      var m = minOnDayKey(k);
      if (m > maxMin) maxMin = m;
      days.push({ key: k, min: m, name: DAY_NAMES[new Date(k + "T12:00:00").getDay()], today: i === 0 });
    }
    var total7 = days.reduce(function (a, d) { return a + d.min; }, 0);
    el.innerHTML = "<h3>Son 7 gün - ekran kullanımı</h3>" +
      (total7 === 0
        ? "<div class='muted'>Henüz veri yok.</div>"
        : "<div class='days'>" + days.map(function (d) {
            return "<div class='day-col" + (d.today ? " today" : "") + "'>" +
              "<div class='day-min'>" + d.min + "</div>" +
              "<div class='day-track'><div class='day-bar' style='height:" + Math.max(3, Math.round(d.min / maxMin * 100)) + "px'></div></div>" +
              "<div class='day-name'>" + d.name + "</div>" +
              "</div>";
          }).join("") + "</div>" +
          "<p class='muted small' style='margin-top:8px'>Turuncu çubuk bugünü gösterir.</p>");
  }

  function renderLast4Weeks() {
    var el = $("chartWeeks");
    if (!el) return;
    var sums = {};
    state.history.forEach(function (h) {
      var w = weekIdx(h.ts);
      sums[w] = (sums[w] || 0) + h.usedMin;
    });
    var thisW = weekIdx(Date.now());
    var labels = ["3 hafta önce", "2 hafta önce", "Geçen hafta", "Bu hafta"];
    var data = labels.map(function (l, i) { return { label: l, min: sums[thisW - 3 + i] || 0 }; });
    var maxMin = 1;
    data.forEach(function (d) { if (d.min > maxMin) maxMin = d.min; });
    var totalW = data.reduce(function (a, d) { return a + d.min; }, 0);
    el.innerHTML = "<h3>Haftalık karşılaştırma (son 4 hafta)</h3>" +
      (totalW === 0
        ? "<div class='muted'>Henüz veri yok.</div>"
        : "<div class='weeks'>" + data.map(function (d) {
            return "<div class='week-col'><div class='week-min'>" + d.min + " dk</div>" +
              "<div class='week-track'><div class='week-bar" + (d.label === "Bu hafta" ? " now" : "") + "' style='height:" + Math.max(4, Math.round(d.min / maxMin * 100)) + "px'></div></div>" +
              "<div class='week-name'>" + d.label + "</div></div>";
          }).join("") + "</div>");
  }

  function renderCategoryDonut() {
    var el = $("chartCategories");
    if (!el) return;
    var since = Date.now() - 7 * 86400000;
    var sums = {};
    state.history.forEach(function (h) { if (h.ts >= since) sums[h.category] = (sums[h.category] || 0) + h.usedMin; });
    var data = Object.keys(sums).map(function (k) {
      return { name: CATEGORY_LABELS[k] || k, color: CATEGORY_COLORS[k] || "#6366f1", min: sums[k] };
    }).sort(function (a, b) { return b.min - a.min; });
    var total = data.reduce(function (a, d) { return a + d.min; }, 0);
    if (!total) { el.innerHTML = "<h3>Kategori dağılımı (son 7 gün)</h3><div class='muted'>Henüz veri yok.</div>"; return; }
    var size = 140, c = size / 2, r = 48, C = 2 * Math.PI * r;
    var acc = 0, parts = "";
    data.forEach(function (d) {
      var frac = d.min / total;
      parts += "<circle r='" + r + "' cx='" + c + "' cy='" + c + "' fill='none' stroke='" + d.color + "' stroke-width='24' " +
        "stroke-dasharray='" + (frac * C) + " " + C + "' stroke-dashoffset='" + (-(acc * C + C * 0.25)) + "'/>";
      acc += frac;
    });
    var legend = data.map(function (d) {
      return "<div class='legend-row'><span class='dot' style='background:" + d.color + "'></span>" +
        d.name + "<span class='legend-pct'>%" + Math.round(d.min / total * 100) + " (" + d.min + " dk)</span></div>";
    }).join("");
    el.innerHTML = "<h3>Kategori dağılımı (son 7 gün)</h3>" +
      "<div class='donut-wrap'>" +
      "<div class='donut'><svg viewBox='0 0 " + size + " " + size + "'>" + parts + "</svg>" +
      "<div class='donut-center'><b>" + total + "</b><span>dk</span></div></div>" +
      "<div class='legend'>" + legend + "</div>" +
      "</div>";
  }

  function renderTopApps() {
    var el = $("chartTopApps");
    if (!el) return;
    var since = Date.now() - 7 * 86400000;
    var sums = {};
    state.history.forEach(function (h) { if (h.ts >= since) sums[h.appName] = (sums[h.appName] || 0) + h.usedMin; });
    var data = Object.keys(sums).map(function (k) { return { name: k, min: sums[k] }; })
      .sort(function (a, b) { return b.min - a.min; })
      .slice(0, 6);
    var maxMin = data.length ? data[0].min : 1;
    el.innerHTML = "<h3>En çok kullanılan uygulamalar (son 7 gün)</h3>" +
      (data.length
        ? "<div class='cat-bars'>" + data.map(function (a) {
            return "<div class='cat-bar-row'><span class='cat-bar-label'>" + a.name + "</span>" +
              "<div class='cat-bar-track'><div class='cat-bar-fill' style='width:" + pctOf(a.min, maxMin) + "%'></div></div>" +
              "<span class='cat-bar-min'>" + a.min + " dk</span></div>";
          }).join("") + "</div>"
        : "<div class='muted'>Henüz veri yok.</div>");
  }

  // ---------- ÖDÜL sekmesi ----------
  function renderRewards() {
    var grid = $("rewardGrid");
    grid.innerHTML = REWARDS.map(function (r) {
      var affordable = state.points >= r.price;
      return "<div class='reward-card'>" +
        "<div class='reward-icon'>" + r.monogram + "</div>" +
        "<div class='reward-badge'>Yeşilay ödülü</div>" +
        "<div class='reward-name'>" + r.name + "</div>" +
        "<div class='reward-desc'>" + r.desc + "</div>" +
        "<div class='reward-price'>" + r.price + " puan</div>" +
        "<button class='btn " + (affordable ? "btn-success" : "") + "' data-reward='" + r.id + "' " + (affordable ? "" : "disabled") + ">Al</button>" +
        "</div>";
    }).join("");
    grid.querySelectorAll("[data-reward]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = REWARDS.filter(function (x) { return x.id === b.getAttribute("data-reward"); })[0];
        if (state.points >= r.price) {
          state.points -= r.price;
          state.rewardOrders.push({ id: r.id, name: r.name, ts: Date.now(), price: r.price });
          pushFeed("Ödül siparişi: " + r.name + " (" + r.price + " puan)");
          notify("Sipariş alındı", r.name + " siparişin Yeşilay'a iletildi (prototip senaryosu).", "good");
          save();
          renderHeader();
          renderRewards();
        }
      });
    });
    var mine = $("myRewardsList");
    mine.className = "muted";
    mine.innerHTML = state.rewardOrders.length
      ? state.rewardOrders.slice().reverse().map(function (o) {
          return "<div class='feed-item'>" + nowHM(o.ts) + " - " + o.name + " (" + o.price + " puan)</div>";
        }).join("")
      : "Henüz sipariş vermedin.";
  }

  // ---------- ÇEKİLİŞ sekmesi ----------
  function monthKeyOf(ts) { return dailyOf(ts).slice(0, 7); }

  function computeMonthStats() {
    var mk = todayKey().slice(0, 7);
    var kept = 0, broken = 0;
    state.history.forEach(function (h) {
      if (monthKeyOf(h.ts) === mk) {
        if (h.result === "kept") kept++;
        else broken++;
      }
    });
    return { kept: kept, broken: broken, mk: mk };
  }

  function renderDraw() {
    var ms = computeMonthStats();
    var eligible = ms.broken === 0 && ms.kept >= DRAW_TARGET_KEPT;
    var entered = state.lotteryEnteredMonth === ms.mk;
    var pct = Math.min(100, Math.round(ms.kept / DRAW_TARGET_KEPT * 100));
    $("monthProgress").innerHTML =
      "<div class='cat-bar-row'><span class='cat-bar-label'>Tutulan söz</span>" +
      "<div class='cat-bar-track'><div class='cat-bar-fill' style='width:" + pct + "%'></div></div>" +
      "<span class='cat-bar-min'>" + ms.kept + "/" + DRAW_TARGET_KEPT + "</span></div>";
    $("monthStatus").textContent =
      ms.broken === 0
        ? "Bu ay bozulan söz yok. Tutulan: " + ms.kept + " / " + DRAW_TARGET_KEPT
        : "Bu ay " + ms.broken + " sözün bozuldu; çekilişe katılabilmen için bozulan söz olmamalı.";
    $("prizeList").innerHTML = DRAW_PRIZES.map(function (p) { return "<li>" + p + "</li>"; }).join("");
    var btn = $("btnEnterDraw");
    btn.disabled = !(eligible && !entered);
    btn.textContent = entered ? "Bu ay çekilişe katıldın" : eligible ? "Çekilişe Katıl" : "Şartlar sağlanmadı";
    $("drawEnteredNote").textContent = entered
      ? "Katılımın kayıtlı. Sonuçlar ay sonunda Yeşilay protokolüyle duyurulur (senaryo)."
      : "";
  }

  $("btnEnterDraw").addEventListener("click", function () {
    var mk = todayKey().slice(0, 7);
    if (state.lotteryEnteredMonth !== mk) {
      state.lotteryEnteredMonth = mk;
      pushFeed("Aylık çekilişe katıldın (" + mk + ")");
      notify("Çekilişe katıldın", "Bu ayki tüm sözlerini tuttun. Şansın bol olsun!", "good");
      save();
      renderDraw();
    }
  });

  // ---------- YZ sekmesi ----------
  function renderAIStatus() {
    var el = $("aiStatus");
    if (state.ai.live && state.ai.apiKey) {
      el.innerHTML = "<span class='live-dot'></span> Canlı YZ · " + providerLabel() + " · " + esc(state.ai.model) + " @ " + esc(state.ai.baseUrl);
      el.className = "ai-status live";
    } else {
      el.textContent = "Mod: YZ bağlantısı kapalı - şablon özet üretimi (canlı için Ayarlar'dan API anahtarı ekleyebilirsin).";
      el.className = "ai-status muted";
    }
  }

  function sessionsDaily() {
    return state.history.filter(function (h) { return dailyOf(h.ts) === todayKey(); });
  }

  function runAI(kind) {
    var out = $("aiOutput");
    var wrap = $("aiPromptWrap");
    out.className = "ai-output busy";
    out.innerHTML = "<span>Yapay zekâ düşünüyor</span><span class='ai-dots'></span>";
    wrap.innerHTML = "";
    var sessions = kind === "daily" ? sessionsDaily() : sessionsSince(7);
    AI.generate(kind, sessions, state.ai).then(function (res) {
      out.className = "ai-output";
      var tag = res.source === "live" ? "Canlı YZ yanıtı" : res.source === "live-error" ? "Canlı çağrı başarısız, şablon gösterildi: " + res.error : "Şablon üretimi (canlı bağlantı kapalı)";
      var tagLine = document.createElement("div");
      tagLine.className = "muted small";
      tagLine.style.marginBottom = "8px";
      tagLine.textContent = tag;
      var body = document.createElement("div");
      body.style.whiteSpace = "pre-wrap";
      out.classList.remove("busy");
      out.textContent = "";
      out.appendChild(tagLine);
      out.appendChild(body);
      typeText(body, res.text, function () {
        var stamp = document.createElement("div");
        stamp.className = "ai-stamp";
        stamp.textContent = AI_STAMP;
        out.appendChild(stamp);
      });
      var btn = document.createElement("button");
      btn.className = "prompt-toggle";
      btn.textContent = "Kullanılan promptu göster (+ tasarım gerekçesi)";
      btn.addEventListener("click", function () {
        var existing = wrap.querySelector(".prompt-box");
        if (existing) { existing.remove(); btn.textContent = "Kullanılan promptu göster (+ tasarım gerekçesi)"; return; }
        var pb = document.createElement("div");
        pb.className = "prompt-box";
        var note =
          "PROMPT TASARIM NOTU: Bu projede şu teknikler kullanıldı:\n" +
          "- Sistem rolü + kural listesi (yönlendirilmiş üretim): yargısız dil, tanı yasağı, puan donanımı.\n" +
          "- Günlük yansıma: few-shot (2 örnek: olağan gün + zor gün) + yapılandırılmış veri (JSON) + doğrulama adımı.\n" +
          "- Haftalık özet: adım adım (ADIM 1-4) structured prompting + doğrulama adımı.\n" +
          "- Bölüm ayırıcıları (delimiter): KOMUT/VERİ/ÖRNEK/DOĞRULAMA ayrımı.\n" +
          "- Bildirim koçu (mola önerisi): sistem kuralları + 2 few-shot örnek + JSON çıktı (" +
          "title/body/breakOffer/points) ile kullanıcının bağlamına göre (saat, aşım, seri) dinamik, suçluluk hissettirmeyen bildirimler." +
          "\n- Sıcaklık (temperature): yansıma 0.5, sohbet 0.7, bildirim 0.8.\n" +
          "\n- Verinin anonim özeti gönderilir; kullanıcı adı/kimlik içermez.\n\n" +
          res.prompt;
        pb.textContent = note;
        wrap.appendChild(pb);
        btn.textContent = "Promptu gizle";
      });
      wrap.appendChild(btn);
    }).catch(function (err) {
      out.className = "ai-output error";
      out.textContent = "Beklenmedik hata: " + err.message;
    });
  }

  $("btnDailyAI").addEventListener("click", function () { runAI("daily"); });
  $("btnWeeklyAI").addEventListener("click", function () { runAI("weekly"); });

  // ---------- modal ----------
  function openModal(innerHTML) {
    var root = $("modalRoot");
    root.innerHTML = "<div class='modal-backdrop'></div><div class='modal'>" + innerHTML + "</div>";
    root.classList.add("open");
    root.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  }

  function closeModal() {
    var root = $("modalRoot");
    root.classList.remove("open");
    root.innerHTML = "";
  }

  function providerLabel() {
    return state.ai.provider === "gemini" ? "Google Gemini" : "OpenAI";
  }

  // ---------- Ayarlar ----------
  function openSettings() {
    openModal(
      "<h3>Ayarlar</h3>" +
      "<div class='field'><label>Canlı YZ bağlantısı</label><label class='switch-line'>" +
      "<input type='checkbox' id='setLive'" + (state.ai.live ? " checked" : "") + "> <span>API anahtarıyla gerçek modeli kullan</span></label></div>" +
      "<div class='field'><label>Sağlayıcı (YZ tedarikçisi)</label>" +
      "<select id='setProvider'>" +
      "<option value='openai'" + (state.ai.provider !== "gemini" ? " selected" : "") + ">OpenAI</option>" +
      "<option value='gemini'" + (state.ai.provider === "gemini" ? " selected" : "") + ">Google Gemini</option>" +
      "</select></div>" +
      "<div class='field'><label>API temel adresi</label><input id='setBase' value='" + esc(state.ai.baseUrl) + "'></div>" +
      "<div class='field'><label>Model (Gemini ince-ayarlı bir model adı ise buraya yazılabilir)</label><input id='setModel' value='" + esc(state.ai.model) + "'></div>" +
      "<div class='field'><label>API anahtarı (yalnızca cihazda saklanır)</label><input id='setKey' type='password' value='" + esc(state.ai.apiKey) + "' placeholder='sk-... veya AIza...'></div>" +
      "<div class='row'>" +
      "<button class='btn btn-primary' id='setSave'>Kaydet</button>" +
      "<button class='btn' id='setCancel'>Vazgeç</button>" +
      "</div>" +
      "<div class='row' style='margin-top:16px'>" +
      "<button class='btn btn-danger-ghost' id='btnReset2'>Demoyu sıfırla</button>" +
      "</div>" +
      "<div class='row' style='margin-top:16px'>" +
      "<button class='btn btn-primary' id='btnExport'>Verilerimi indir (JSON)</button>" +
      "</div>" +
      "<div class='row' style='margin-top:8px'>" +
      "<button class='btn btn-danger-ghost' id='btnRevokeConsent'>Rızayı geri al</button>" +
      "</div>" +
      "<div class='row' style='margin-top:8px'>" +
      "<button class='btn btn-danger-ghost' id='btnWipeData'>Verilerimi sil</button>" +
      "</div>" +
      "<p class='muted small' style='margin-top:12px'>KVKK m.7, m.10, m.11 uyarınca: açık rızanızı dilediğiniz an geri alabilir, verilerinizi JSON olarak indirebilir (erişim hakkı) veya kalıcı olarak sildirebilirsiniz (silme hakkı). 'Demoyu sıfırla' demo verilerini temizler; 'Verilerimi sil' ise açık rıza dahil tüm verilerinizi bu cihazdan kalıcı olarak kaldırır ve uygulamayı kilide alır.</p>" +
      "<p class='muted small' style='margin-top:8px'>Genel amaçlı dil modelleri; projeye özel koç davranışı sistem promptuyla sağlanır (ince-ayar eşdeğeri). Canlı bağlantı kapalıyken şablon üretim çalışır. Veri gizliliği: kayıtlar yalnızca bu tarayıcıda; API'ye yalnızca anonim oturum özeti ve (sohbette) son mesajlar gider. Gemini'de model adresi ve anahtar, seçili sağlayıcının otomatik olarak ayarlanır; model adını değiştirerek özel/ince-ayar model kullanabilirsin.</p>"
    );
    $("setSave").addEventListener("click", function () {
      state.ai.live = $("setLive").checked;
      state.ai.provider = $("setProvider").value;
      state.ai.baseUrl = $("setBase").value.trim() || "https://api.openai.com/v1";
      state.ai.model = $("setModel").value.trim() || "gpt-4o-mini";
      state.ai.apiKey = $("setKey").value.trim();
      save();
      closeModal();
      renderAIStatus();
    });
    $("setProvider").addEventListener("change", function () {
      var p = $("setProvider").value;
      if (p === "gemini") {
        if (!$("setBase").value || $("setBase").value.indexOf("generativelanguage") === -1) $("setBase").value = "https://generativelanguage.googleapis.com/v1beta";
        if ($("setModel").value.indexOf("gemini") === -1) $("setModel").value = "gemini-3.6-flash";
      } else {
        if ($("setBase").value.indexOf("generativelanguage") !== -1) $("setBase").value = "https://api.openai.com/v1";
        if ($("setModel").value.indexOf("gemini") !== -1) $("setModel").value = "gpt-4o-mini";
      }
    });
    $("setCancel").addEventListener("click", closeModal);
    $("btnReset2").addEventListener("click", confirmReset);
    $("btnExport").addEventListener("click", exportData);
    $("btnRevokeConsent").addEventListener("click", confirmRevokeConsent);
    $("btnWipeData").addEventListener("click", confirmWipeData);
  }

  function exportData() {
    closeModal();
    try {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "sozumsoz-verilerim.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* boş */ } }, 1000);
    } catch (e) {
      openModal(
        "<h3>Verilerimi indir</h3>" +
        "<p>Tarayıcı bu ortamda dosya indirmeyi desteklemiyor. Verileriniz hâlâ bu cihazda; 'Ayarlar → Verilerimi sil' ile istediğiniz an kalıcı olarak silebilirsiniz.</p>" +
        "<div class='row'><button class='btn btn-primary' id='exportOk'>Tamam</button></div>"
      );
      $("exportOk").addEventListener("click", closeModal);
    }
  }

  function confirmRevokeConsent() {
    closeModal();
    openModal(
      "<h3>Rızayı geri al</h3>" +
      "<p>KVKK m.7 uyarınca açık rızanızı geri alıyorsunuz. Rıza geri alındığında SÖZÜM SÖZ uygulaması kilitlenir ve verileriniz artık bu amaçlarla işlenmez. Mevcut verileriniz cihazda kalır; isterseniz 'Verilerimi sil' ile kalıcı olarak kaldırabilirsiniz.</p>" +
      "<div class='row'>" +
      "<button class='btn btn-danger' id='revokeYes'>Evet, rızamı geri al</button>" +
      "<button class='btn' id='revokeNo'>Vazgeç</button>" +
      "</div>"
    );
    $("revokeYes").addEventListener("click", function () {
      state.consent = false;
      save();
      closeModal();
      renderHome();
    });
    $("revokeNo").addEventListener("click", closeModal);
  }

  function confirmWipeData() {
    closeModal();
    openModal(
      "<h3>Verilerimi sil</h3>" +
      "<p>KVKK m.11 uyarınca silme hakkınızı kullanıyorsunuz. Açık rıza dahil tüm verileriniz bu cihazdan <b>kalıcı olarak silinecek</b>, SÖZÜM SÖZ uygulaması kilitlenecek ve bir dahaki açılışta yeniden rızanız sorulacak. Bu işlem geri alınamaz. Emin misiniz?</p>" +
      "<div class='row'>" +
      "<button class='btn btn-danger' id='wipeYes'>Evet, verilerimi sil</button>" +
      "<button class='btn' id='wipeNo'>Vazgeç</button>" +
      "</div>"
    );
    $("wipeYes").addEventListener("click", function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* boş */ }
      location.reload();
    });
    $("wipeNo").addEventListener("click", closeModal);
  }

  function confirmReset() {
    closeModal();
    openModal(
      "<h3>Demoyu sıfırla</h3>" +
      "<p>Tüm puan, söz ve ayar verileri silinecek. Emin misin?</p>" +
      "<div class='row'>" +
      "<button class='btn btn-danger' id='resetYes'>Evet, sıfırla</button>" +
      "<button class='btn' id='resetNo'>Vazgeç</button>" +
      "</div>"
    );
    $("resetYes").addEventListener("click", function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* boş */ }
      location.reload();
    });
    $("resetNo").addEventListener("click", closeModal);
  }

  // ---------- giriş adımı ----------
  function showIntro() {
    if (state.seenIntro) return;
    openModal(
      "<h3>SÖZÜM SÖZ'e Hoş geldin</h3>" +
      "<p>Dijital bağımlılık ve dijital iyi olma hâli hackathon prototipi. 3 adımda çalışır:</p>" +
      "<p>1) <b>Süre sözü ver:</b> Bir uygulamaya girince kaç dakika kalmayı taahhüt edeceğini söyle.<br>" +
      "2) <b>Sözünü tut:</b> Süre içinde kapatırsan +3 puan; aşarsan ya da hemen başka uygulamaya geçersen -5 puan ve uyarı.<br>" +
      "3) <b>Mola önerileri:</b> YZ koçu, süre aşımında su iç / gözlerini dinlendir gibi küçük molalar önerir; molayı tamamlayınca birkaç puan kazanırsın.<br>" +
      "4) <b>Kazan ve yansıt:</b> Seri bonusları, günün sözü, Yeşilay ödül kataloğu, aylık çekiliş ve YZ yansıma koçu seni destekler.</p>" +
      "<p class='muted small'>Hızlı demo açıkken 1 saniye ≈ 1 dakika sayılır; böylece tüm akışı saniyeler içinde test edebilirsin.</p>" +
      "<div class='row'><button class='btn btn-primary btn-lg' id='introOk'>Anladım, başlayalım</button></div>"
    );
    $("introOk").addEventListener("click", function () {
      state.seenIntro = true;
      save();
      closeModal();
    });
  }

  // ---------- çeşitli ----------
  $("btnSettings").addEventListener("click", openSettings);
  $("btnReset").addEventListener("click", confirmReset);
  $("speedToggle").addEventListener("change", function () {
    state.speedFast = $("speedToggle").checked;
    save();
  });

  // ---------- haftalık skor emojisi (demo) ----------
  document.querySelectorAll("#moodRow .btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var m = b.getAttribute("data-mood");
      state.weeklyDemo = m === "auto" ? null : m;
      save();
      renderHeader();
    });
  });

  // ---------- SOHBET (çok turlu YZ koç) ----------
  function appendChat(role, text, opts) {
    var log = $("chatLog");
    var empty = log.querySelector(".chat-empty");
    if (empty) empty.remove();
    var el = document.createElement("div");
    el.className = "chat-msg " + (role === "user" ? "user" : "assistant");
    if (role === "user") {
      el.innerHTML = "<div>" + esc(text).split("\n").join("<br>") + "</div>";
    } else if (opts && opts.busy) {
      el.innerHTML = "<span>Koç düşünüyor</span><span class='ai-dots'></span>";
      el.classList.add("chat-busy");
    } else {
      var badge = document.createElement("div");
      badge.className = "ai-badge";
      badge.textContent = "YZ";
      el.appendChild(badge);
      var body = document.createElement("div");
      body.style.whiteSpace = "pre-wrap";
      el.appendChild(body);
      typeText(body, text, function () {
        var stamp = document.createElement("div");
        stamp.className = "ai-stamp";
        stamp.textContent = AI_STAMP;
        el.appendChild(stamp);
        if (opts && opts.note) {
          var n = document.createElement("div");
          n.className = "chat-note";
          n.textContent = opts.note;
          el.appendChild(n);
        }
      });
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  var chatBusy = false;

  function doSendChat() {
    var input = $("chatInput");
    var text = (input.value || "").trim();
    if (!text || chatBusy) return;
    chatBusy = true;
    var sendBtn = $("chatSend");
    sendBtn.disabled = true;
    input.value = "";
    appendChat("user", text, {});
    state.chatHistory.push({ role: "user", content: text, ts: Date.now() });
    state.chatHistory = state.chatHistory.slice(-40);
    save();
    var busyEl = appendChat("assistant", "Koç düşünüyor...", { busy: true });
    AI.chat(state.ai, sessionsSince(7), state.chatHistory).then(function (res) {
      var note = res.source === "live" ? "Canlı model yanıtı"
        : res.source === "live-error" ? "Canlı çağrı başarısız, şablon gösterildi: " + res.error
        : "Şablon yanıtı (canlı bağlantı kapalı)";
      state.chatHistory.push({ role: "assistant", content: res.text, ts: Date.now() });
      state.chatHistory = state.chatHistory.slice(-40);
      save();
      if (busyEl.parentNode) busyEl.parentNode.removeChild(busyEl);
      appendChat("assistant", res.text, { note: note });
      chatBusy = false;
      sendBtn.disabled = false;
    }).catch(function (err) {
      if (busyEl.parentNode) busyEl.parentNode.removeChild(busyEl);
      appendChat("assistant", "Beklenmedik hata: " + err.message, {});
      chatBusy = false;
      sendBtn.disabled = false;
    });
  }

  $("chatSend").addEventListener("click", doSendChat);
  $("chatInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") doSendChat();
  });
  document.querySelectorAll(".chip").forEach(function (c) {
    c.addEventListener("click", function () {
      $("chatInput").value = c.getAttribute("data-q");
      doSendChat();
    });
  });

  function init() {
    load();
    ensureWeeklyChallenges();
    bootApp();
  }

  function bootApp() {
    appBooted = true;
    var bm = document.querySelector(".topbar .brand-mark");
    if (bm && SOZ_LOGO) {
      bm.innerHTML = "<img class='brand-mark-img' src='" + SOZ_LOGO + "' alt='SÖZÜM SÖZ'>";
    }
    renderHeader();
    setTab("phone");
    renderHome();
    renderFeed();
    renderStats();
    renderAIStatus();
    setTimeout(showIntro, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();