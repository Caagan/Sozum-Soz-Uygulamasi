const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..', 'src');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + root + '/index.html'
});

dom.window.__SS_INSTANT = true;
dom.window.addEventListener('error', (e) => {
  console.error('WINDOW ERROR:', e.error ? e.error.stack : e.message);
});

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  await wait(1200);
  const w = dom.window;
  const d = w.document;

  const checks = [];
  const ok = (name) => checks.push('OK  ' + name);
  const bad = (name, err) => checks.push('FAIL ' + name + ' :: ' + (err && err.message));

try {
    // Doğrudan açılış: KVKK geçidi yok, uygulama anında açılır
    if (!d.getElementById('consentScreen')) ok('KVKK geçidi yok (consentScreen elementi kaldırıldı)');
    else bad('consentScreen hâlâ var');
    if (d.getElementById('consentScreen') === null && d.getElementById('phoneScreen')) ok('uygulama doğrudan açıldı (phoneScreen mevcut)');
    else bad('doğrudan açılış');

    if (d.getElementById('phoneScreen').querySelector('.app-tile')) ok('telefon app grid render edildi (doğrudan açılış)');
    else bad('app grid');
    if (d.querySelector('.app-tile[data-app="sozumsoz"]')) ok('telefonda SÖZÜM SÖZ uygulama ikonu var');
    else bad('sozumsoz ikonu');
    const ytImg = d.querySelector('.app-tile[data-app="youtube"] .app-icon-img');
    if (ytImg && ytImg.getAttribute('src').indexOf('data:image/svg+xml') === 0) ok('uygulama logoları inline SVG (data-URI) olarak render ediliyor');
    else bad('uygulama logosu');

    if (d.getElementById('hPoints')) ok('header puntalar render edildi');
    else bad('header');

    // Haftalık görevler sekmesi: render + göreve katıl
    d.querySelector('.tab[data-tab="challenges"]').click();
    await wait(60);
    const chCards = d.querySelectorAll('#challengeList .ch-card');
    if (chCards.length === 5) ok('görevler sekmesi: 5 haftalık görev render edildi');
    else bad('görev sayısı: ' + chCards.length);
    const joinBtn = d.querySelector('#challengeList [data-join="ekran10"]');
    if (joinBtn) { joinBtn.click(); await wait(40); }
    if (d.querySelector('#challengeList [data-join="ekran10"]')) bad('göreve katılma butonu kalkmadı');
    else ok('göreve katıldı (Görevler sekmesi)');
    d.querySelector('.tab[data-tab="phone"]').click();
    await wait(200);

    // süre sözü akışı: bir uygulamaya tıkla, 5 dk seç, söz ver
    const tile = d.querySelector('.app-tile[data-app="youtube"]');
    tile.click();
    await wait(50);
    if (d.getElementById('promiseScrim') && d.querySelector('.s-sheet')) ok('süre sözü telefon içi alt sayfa (sheet) açıldı');
    else bad('sheet');
    if (d.querySelector('.sheet-appicon .app-icon-img')) ok('sheet başlığında uygulama logosu var');
    else bad('sheet logosu');
    if (d.querySelectorAll('.dur-chip').length === 8) ok('süre önerileri (8 chip) render edildi');
    else bad('durum chip sayısı: ' + d.querySelectorAll('.dur-chip').length);
    if (d.getElementById('promiseOk').disabled) ok('süre seçilmeden "Söz ver" kilitli');
    else bad('Söz ver kilidi');
    if (d.querySelector('.appbar, .app-grid') === null) ok('sheet açıkken ana ekran değiştirildi');
    else bad('sheet üzerine bindi');
    const timeBtn = d.querySelector('.time-btn[data-min="5"]');
    timeBtn.click();
    await wait(50);
    if (d.querySelector('.dur-chip[data-min="5"]').classList.contains('sel')) ok('seçilen süre chipi işaretlendi');
    else bad('chip seçimi');
    const okBtn = d.getElementById('promiseOk');
    okBtn.click();
    await wait(50);
    if (d.getElementById('appTimerCard')) ok('uygulama ekranı açıldı (timer kartı var)');
    else bad('timer kartı');
    if (d.querySelector('.appbar') && d.querySelector('.appbar-badge')) ok('uygulama appbar + "SÖZ aktif" rozeti var');
    else bad('appbar');
    if (d.querySelector('.appbar-icon .app-icon-img')) ok('appbar başlığında uygulama logosu var');
    else bad('appbar logosu');
    if (d.querySelectorAll('.post-card').length === 3) ok('akış: 3 sahte sosyal gönderisi render edildi');
    else bad('post card sayısı');
    if (d.getElementById('bgNotif')) ok('arka planda çalışma bildirimi görünüyor (haftalık emoji)');
    else bad('arka plan bildirimi');
    if (d.getElementById('hMood').textContent.length > 0) ok('başlıkta haftalık skor emojisi var');
    else bad('haftalık skor emojisi');

    // hızlı demo: 1 sn = 1 dk; 5 dk söz → ~6 sn'de aşım
    await wait(7600);
    if (d.getElementById('overBanner')) ok("asim banner gorundu");
    else bad('aşım banner');
    if (d.querySelectorAll('#notifStack .notif').length <= 3) ok('bildirim yığını en fazla 3 toast (kümeleme önlendi)');
    else bad('toast sayısı: ' + d.querySelectorAll('#notifStack .notif').length);

    // sözünü tut ve kapat (yine de aşım olarak kaydedilecek)
    const keepBtn = d.getElementById('btnKeep');
    if (keepBtn) { keepBtn.click(); await wait(50); }
    const points1 = parseInt(d.getElementById('hPoints').textContent, 10);
    if (points1 > 0 || d.getElementById('phoneScreen').querySelector('.app-tile')) ok('oturum kapatıldı, ana ekrana dönüldü');
    else bad('oturum kapatma');
    if (!d.getElementById('bgNotif')) ok('oturum kapanınca arka plan bildirimi kaldırıldı');
    else bad('arka plan bildirimi kaldırma');

    // SÖZÜM SÖZ uygulamasını telefon içinde aç → önce KVKK konsenti çıkmalı
    d.querySelector('.app-tile[data-app="sozumsoz"]').click();
    await wait(60);
    if (d.getElementById('phoneScreen').querySelector('.s-consent')) ok('SÖZÜM SÖZ ikonuna basınca KVKK açık rıza ekranı geldi');
    else bad('konsent ekranı');
    if (!d.getElementById('phoneScreen').querySelector('.s-soz')) ok('KVKK verilmeden uygulama açılmadı (kilitli)');
    else bad('konsent kilidi');

    // Kabul etmiyorum → uygulama çalışmamalı
    d.getElementById('consentNo').click();
    await wait(40);
    if (d.getElementById('phoneScreen').textContent.indexOf('Uygulama kullanılamıyor') !== -1) ok('kabul etmeyince uygulama başlatılmadı mesajı');
    else bad('kabul etme bloğu');
    if (!d.getElementById('phoneScreen').querySelector('.s-soz')) ok('kabul etmeyince SÖZÜM SÖZ açılmadı');
    else bad('kabul etme kilidi');
    d.getElementById('consentExit').click();
    await wait(40);
    if (d.getElementById('phoneScreen').querySelector('.app-grid')) ok('geri dönünce ana ekranda app grid var');
    else bad('konsent sonrası ana ekran');

    // bu sefer ikona basıp kabul et → uygulama açılır
    d.querySelector('.app-tile[data-app="sozumsoz"]').click();
    await wait(60);
    d.getElementById('consentYes').click();
    await wait(80);
    if (d.getElementById('phoneScreen').querySelector('.s-soz')) ok('SÖZÜM SÖZ uygulaması telefon içinde açıldı (konsent sonrası)');
    else bad('sozumsoz uygulama ekranı');
    if (d.getElementById('phoneScreen').querySelectorAll('.soz-row').length >= 5) ok('uygulama menüsü (5 sayfa linki) render edildi');
    else bad('sozumsoz menüsü');
    if (d.getElementById('bgNotif')) ok('SÖZÜM SÖZ açıkken de bildirim görünüyor');
    else bad('sozumsoz bildirimi');
    d.getElementById('sozBack').click();
    await wait(50);
    if (d.getElementById('phoneScreen').querySelector('.app-grid')) ok('geri dönünce ana ekrana dönüldü');
    else bad('geri dönüş');
    if (!d.getElementById('bgNotif')) ok('geri dönünce bildirim kaldırıldı');
    else bad('geri dönüş bildirimi');
    // KVKK zaten kabul edildiği için ikona tekrar basınca direkt açılmalı
    d.querySelector('.app-tile[data-app="sozumsoz"]').click();
    await wait(60);
    if (d.getElementById('phoneScreen').querySelector('.s-soz') && !d.getElementById('phoneScreen').querySelector('.s-consent')) ok('konsent kabul edilince ikona basınca doğrudan açılıyor');
    else bad('konsent hatırlama');
    d.getElementById('sozBack').click();
    await wait(40);

    // haftalık skor emojisi demo butonu
    d.querySelector('[data-mood="bad"]').click();
    await wait(30);
    if (d.getElementById('hMood').textContent === '🙁') ok('demo skor butonu emojiyi değiştirdi (kötü 🙁)');
    else bad('demo skor butonu (kötü) -> ' + d.getElementById('hMood').textContent);
    d.querySelector('[data-mood="good"]').click();
    await wait(30);
    if (d.getElementById('hMood').textContent === '😀') ok('demo skor butonu emojiyi değiştirdi (iyi 😀)');
    else bad('demo skor butonu (iyi) -> ' + d.getElementById('hMood').textContent);
    d.querySelector('[data-mood="auto"]').click();
    await wait(30);

    // YZ sekmesi
    d.querySelector('.tab[data-tab="ai"]').click();
    await wait(50);
    d.getElementById('btnDailyAI').click();
    await wait(1200);
    const aiOut = d.getElementById('aiOutput').textContent;
    if (!/Henüz çıktı yok/.test(aiOut)) ok('AI günlük yansıma üretildi (ilk 80 + son 80)');
    else bad('AI günlük yansıma');
    ok('AI çıktı (araç): ' + aiOut.replace(/\n/g, ' ').slice(0, 70));
    d.getElementById('btnWeeklyAI').click();
    await wait(1200);
    const aiOut2 = d.getElementById('aiOutput').textContent;
    if (!/Henüz çıktı yok/.test(aiOut2)) ok('AI haftalık özet üretildi');
    else bad('AI haftalık özet');

    // Sohbet (çok turlu)
    d.querySelector('.tab[data-tab="chat"]').click();
    await wait(50);
    d.querySelector('.chip[data-q^="Bugün"]').click();
    await wait(1600);
    const chatLog = d.getElementById('chatLog');
    if (chatLog.querySelector('.chat-msg.user') && chatLog.querySelector('.chat-msg.assistant')) ok('sohbet: kullanıcı + koç mesajları var');
    else bad('sohbet mesajları');
    if (chatLog.textContent.indexOf('farkındalık amaçlıdır') !== -1) ok('sohbet: koç yanıtında yasal uyarı satırı var');
    else bad('sohbet yasal uyarı: ' + chatLog.textContent.slice(-50));
    const assistMsgs = d.querySelectorAll('#chatLog .chat-msg.assistant');
    const lastAssist = assistMsgs[assistMsgs.length - 1];
    if (lastAssist && lastAssist.querySelector('.ai-badge') && lastAssist.querySelector('.ai-stamp')) ok('YZ üretti damgası (rozet + ibare) görünüyor');
    else bad('YZ damgası');
    // ikinci tur (çok turlu süreklilik)
    d.getElementById('chatInput').value = 'Mola öner';
    d.getElementById('chatSend').click();
    await wait(1600);
    if (chatLog.textContent.indexOf('İyi bir adım') !== -1) ok('sohbet: ikinci tur yanıtı geldi (çok turlu)');
    else bad('ikinci tur yanıtı');

    // Kriz guard: destek hatlarına yönlendirme, tanı koyma
    d.getElementById('chatInput').value = 'Kendime zarar vermek istiyorum, dayanamıyorum';
    d.getElementById('chatSend').click();
    await wait(400);
    const crisisMsgs = d.querySelectorAll('#chatLog .chat-msg.assistant');
    const crisisText = crisisMsgs[crisisMsgs.length - 1] ? crisisMsgs[crisisMsgs.length - 1].textContent : '';
    if (crisisText.indexOf('115') !== -1 && crisisText.indexOf('112') !== -1) ok('kriz guard: önce destek hatlarına yönlendirme (115/112)');
    else bad('kriz guard yönlendirme: ' + crisisText.slice(-90));
    if (/tıbbi|tedavi/.test(crisisText)) ok('kriz guard: tanı/tedavi iddiası yok (uyarı satırı)');
    else bad('kriz guard uyarısı');

    // Durum sekmesi
    d.querySelector('.tab[data-tab="stats"]').click();
    await wait(50);
    if (d.querySelector('#statCards .stat-card')) ok('durum kartları render edildi');
    else bad('durum kartları');

    // Grafikler
    d.querySelector('.tab[data-tab="charts"]').click();
    await wait(80);
    if (d.getElementById('chartLast7').innerHTML.indexOf('day-bar') !== -1) ok('grafik: son 7 gün çubukları render edildi');
    else bad('grafik: son 7 gün');
    if (d.getElementById('chartTodayVsWeek').innerHTML.indexOf('cmp-bar') !== -1) ok('grafik: bugün vs geçen hafta aynı gün karşılaştırması');
    else bad('grafik: karşılaştırma');
    if (d.getElementById('chartCategories').innerHTML.indexOf('donut') !== -1) ok('grafik: kategori donut render edildi');
    else bad('grafik: kategori donut');

    // Ödüller
    d.querySelector('.tab[data-tab="rewards"]').click();
    await wait(50);
    if (d.querySelector('#rewardGrid .reward-card')) ok('ödül kataloğu render edildi');
    else bad('ödül kataloğu');

    // Çekiliş
    d.querySelector('.tab[data-tab="draw"]').click();
    await wait(50);
    if (d.getElementById('prizeList').children.length > 0) ok('çekiliş ödülleri render edildi');
    else bad('çekiliş ödülleri');

    // Ayarları aç
    d.getElementById('btnSettings').click();
    await wait(50);
    if (d.getElementById('setLive')) ok('ayarlar modalı açıldı');
    else bad('ayarlar modalı');
    const prov = d.getElementById('setProvider');
    if (prov) {
      prov.value = 'gemini';
      prov.dispatchEvent(new w.Event('change'));
      if (d.getElementById('setBase').value.indexOf('generativelanguage') !== -1 && d.getElementById('setModel').value.indexOf('gemini') !== -1) ok('Gemini sağlayıcı seçimi adres/modeli otomatik ayarlıyor');
      else bad('gemini sağlayıcı ayarı');
    }
    d.getElementById('setCancel').click();
    await wait(30);

    // son aktiviteler
    if (d.querySelector('#phoneFeed .feed-item')) ok('son aktivite beslemesi dolu');
    else bad('son aktivite beslemesi');

    // --- faz 2: sözünü zamanında tutup hemen başka uygulamaya geçme (atlama cezası) ---
    d.getElementById('btnReset').click();
    await wait(50);
    d.getElementById('resetYes').click();
    await wait(800);
    d.querySelector('.app-tile[data-app="youtube"]').click();
    await wait(50);
    d.querySelector('.time-btn[data-min="5"]').click();
    await wait(50);
    d.getElementById('promiseOk').click();
    await wait(80);
    const keepEarly = d.getElementById('btnKeep');
    keepEarly.click();
    await wait(80);
    const pAfterKeep = parseInt(d.getElementById('hPoints').textContent, 10);
    if (pAfterKeep === 3) ok('sözünü tuttu (+3 puan, seri 1)');
    else bad('sözünü tutma puanı: ' + pAfterKeep);
    // hemen ikinci uygulamaya gir (90 sn penceresi içinde) → atlama cezası
    d.querySelector('.app-tile[data-app="instagram"]').click();
    await wait(50);
    d.querySelector('.time-btn[data-min="5"]').click();
    await wait(50);
    d.getElementById('promiseOk').click();
    await wait(120);
    const pAfterHop = parseInt(d.getElementById('hPoints').textContent, 10);
    if (pAfterHop === 0) ok('atlama cezası uygulandı (puan sıfıra çekildi)');
    else bad('atlama cezası puanı: ' + pAfterHop);
    const str = d.getElementById('hStreak').textContent;
    if (str === '0') ok('seri sıfırlandı');
    else bad('seri: ' + str);

    // --- faz 3: YZ koçu mikromola akışı (süre aşımı → mola kartı → +5 puan) ---
    d.getElementById('notifStack').innerHTML = '';
    const pointsB = parseInt(d.getElementById('hPoints').textContent, 10);
    await wait(7000);          // 5 dk sözü hızlı demoda aşılır
    await wait(1500);          // koç bildirimi (şablon) üretilir
    let coachBtn = null;
    d.querySelectorAll('.notif.k-warn .notif-actions .btn').forEach(b => {
      if (!coachBtn && b.textContent.indexOf('Mola başla') !== -1) coachBtn = b;
    });
    if (coachBtn) ok('YZ koçu empatik mola kartı üretildi');
    else bad('YZ koçu mola kartı');
    if (coachBtn) {
      coachBtn.click();
      await wait(120);
      if (d.querySelector('.s-break')) ok('mola ekranı açıldı (geri sayım)');
      else bad('mola ekranı');
      await wait(600);
      if (parseInt(d.getElementById('hPoints').textContent, 10) === pointsB) ok('mola süresince puan sabit');
      else bad('mola süresince puan değişti');
      await wait(20500);
      const pFin = parseInt(d.getElementById('hPoints').textContent, 10);
      if (pFin === pointsB + 5) ok('mola tamamlandı, +5 puan kazanıldı');
      else bad('mola puanı: beklenen ' + (pointsB + 5) + ', alınan ' + pFin);
      if (d.getElementById('appTimerCard')) ok('moladan sonra oturum ekranına dönüldü');
      else bad('moladan sonra ekran dönüşü');
      d.querySelector('.tab[data-tab="stats"]').click();
      await wait(80);
      let molaStat = false;
      d.querySelectorAll('.stat-card').forEach(c => {
        if (c.textContent.indexOf('mola') !== -1 && c.textContent.indexOf('1') !== -1) molaStat = true;
      });
      if (molaStat) ok('istatistikte "Tamamlanan mola: 1" görünüyor');
      else bad('mola istatistiği');
      // Haftalık görev ödülünü al: ekran10 (7 günlük kullanım < 600 dk sağlandı)
      d.querySelector('.tab[data-tab="challenges"]').click();
      await wait(80);
      const claimBtn = d.querySelector('#challengeList [data-claim="ekran10"]');
      const ptsBefore = parseInt(d.getElementById('hPoints').textContent, 10);
      if (claimBtn) { claimBtn.click(); await wait(60); }
      if (parseInt(d.getElementById('hPoints').textContent, 10) === ptsBefore + 10) ok('haftalık görev ödülü eklendi (+10 puan)');
      else bad('haftalık görev ödülü puanı');
      if (d.querySelector('#challengeList [data-claim="ekran10"]')) bad('görev ödülü butonu kalkmadı');
      else ok('görev ödülü tek seferlik (claim butonu kaldırıldı)');
      // YZ koç prompt tasarım notu kontrolü
      d.querySelector('.tab[data-tab="ai"]').click();
      await wait(50);
      d.getElementById('btnWeeklyAI').click();
      await wait(1200);
      const tog = d.querySelector('.prompt-toggle');
      if (tog) { tog.click(); await wait(50); }
      const box = d.querySelector('.prompt-box');
      if (box && box.textContent.indexOf('Bildirim koçu') !== -1) ok('prompt notunda koç tasarımı belgeleniyor');
      else bad('prompt notunda koç bölümü');
    }

    // --- bildirim kümeleme / tekrar kontrolü ---
    const notifFn = d.defaultView.__ss_notify;
    if (notifFn) {
      notifFn('Aynı başlık', 'aynı içerik', 'info');
      notifFn('Aynı başlık', 'aynı içerik', 'info');
      await wait(30);
      let same = 0;
      d.querySelectorAll('#notifStack .notif').forEach(n => {
        const t = n.querySelector('.n-title');
        if (t && t.textContent === 'Aynı başlık') same++;
      });
      if (same === 1) ok('aynı bildirim tekrarı yazılmıyor (dedupe)');
      else bad('dedupe: ' + same);
      notifFn('Bir', 'bir', 'info');
      notifFn('İki', 'iki', 'info');
      notifFn('Üç', 'üç', 'info');
      notifFn('Dört', 'dört', 'info');
      await wait(30);
      const total = d.querySelectorAll('#notifStack .notif').length;
      if (total <= 3) ok('bildirim yığını 3 toast ile sınırlandı (>3 gelince eski kaldırılıyor)');
      else bad('toast limiti: ' + total);
    } else {
      bad('test kancası __ss_notify yok');
    }

  } catch (err) {
    bad('genel', err);
  }

  console.log(checks.join('\n'));
  process.exit(0);
})();